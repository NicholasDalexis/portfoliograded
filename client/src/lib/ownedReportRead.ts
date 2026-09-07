type ReadContext = {
  owner: string | null;
  currentOwner: () => string | null;
  getHeaders: () => Promise<Record<string, string>>;
  signal: AbortSignal;
  request?: typeof fetch;
};

/** A read belongs to its starting identity, including while a token refresh waits. */
export async function readOwnedReportJson<T>(
  path: string,
  context: ReadContext
): Promise<T> {
  const current = () => {
    if (context.signal.aborted || context.currentOwner() !== context.owner)
      throw new DOMException("Report read cancelled", "AbortError");
  };
  current();
  const headers = await context.getHeaders();
  current();
  if (context.owner && !/^Bearer \S+$/.test(headers.Authorization ?? ""))
    throw new Error("Sign-in could not be verified");
  const response = await (
    context.request ?? ((input, init) => fetch(input, init))
  )(path, {
    method: "GET",
    headers,
    signal: context.signal,
  });
  current();
  if (!response.ok) throw new Error("Saved reports unavailable");
  const data: T = await response.json();
  current();
  return data;
}
