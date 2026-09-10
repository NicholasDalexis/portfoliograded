const MAX_BYTES = 1_000_000; // 1 MB — enough for any portfolio page
const TIMEOUT_MS = 10_000;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "timeout"
      | "network"
      | "http_error"
      | "not_html"
      | "no_body",
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchSiteHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FolioGrade/1.0; +https://foliograde.com)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      throw new FetchError("The site took too long to respond (10 s).", "timeout");
    }
    throw new FetchError(
      `Could not reach the site: ${err instanceof Error ? err.message : String(err)}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new FetchError(
      `The site returned HTTP ${res.status}. It may require login or block bots.`,
      "http_error",
    );
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new FetchError(
      `Expected HTML but received "${ct}". Only public HTML pages can be audited.`,
      "not_html",
    );
  }

  if (!res.body) {
    throw new FetchError("The server returned an empty response.", "no_body");
  }

  // Stream with a hard size cap so a huge page doesn't blow memory.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
      if (total >= MAX_BYTES) {
        await reader.cancel();
        break; // use what we have — the head of a page is what matters most
      }
    }
  } catch {
    // If the stream breaks partway, use whatever we collected.
  }

  return new TextDecoder().decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.byteLength + c.byteLength);
      merged.set(acc, 0);
      merged.set(c, acc.byteLength);
      return merged;
    }, new Uint8Array(0)),
  );
}
