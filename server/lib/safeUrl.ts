/**
 * safeUrl — synchronous, string-level URL validation.
 *
 * Rejects obviously dangerous inputs (non-http schemes, private IP literals,
 * localhost, credentials in the URL). Does NOT perform DNS resolution, so a
 * hostname that *resolves* to a private address will pass this check.
 *
 * TODO (Phase 2 — when the worker fetches user URLs):
 *   - Async DNS resolve → reject if any A/AAAA record is RFC-1918/loopback/
 *     link-local/ULA.
 *   - Re-resolve at each redirect hop (cap at 3 redirects).
 *   - Allowlist response Content-Type; cap response body size (e.g. 10 MB).
 *   - Total fetch budget: 15 s.
 */

type Valid = { ok: true; url: string };
type Invalid = { ok: false; reason: string };

// IPv4 private/reserved ranges as simple prefix checks.
const PRIVATE_IPV4_PREFIXES = [
  "10.",
  "127.",
  "0.",
  "169.254.", // link-local / AWS metadata
  "192.168.",
];

const PRIVATE_IPV4_172_RE = /^172\.(1[6-9]|2\d|3[01])\./;

// Rough IPv6 patterns to reject at the string level.
const PRIVATE_IPV6_RE =
  /^(\[?)(::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i;

function isPrivateIpLiteral(hostname: string): boolean {
  // Strip brackets from IPv6 literals (e.g. "[::1]")
  const h = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;

  if (PRIVATE_IPV6_RE.test(h)) return true;
  if (PRIVATE_IPV4_172_RE.test(h)) return true;
  for (const prefix of PRIVATE_IPV4_PREFIXES) {
    if (h.startsWith(prefix)) return true;
  }
  return false;
}

export function validatePublicUrl(input: string): Valid | Invalid {
  if (!input || typeof input !== "string") {
    return { ok: false, reason: "URL is required." };
  }

  const trimmed = input.trim();

  if (trimmed.length > 2048) {
    return { ok: false, reason: "URL is too long." };
  }

  // Accept bare hostnames by prepending https://
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: "URL could not be parsed. Check it looks like yourname.com." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Protocol "${parsed.protocol}" is not allowed. Use http or https.` };
  }

  // Reject credentials embedded in the URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }

  const hostname = parsed.hostname;

  if (!hostname) {
    return { ok: false, reason: "URL has no hostname." };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return { ok: false, reason: "Localhost URLs are not allowed." };
  }

  if (isPrivateIpLiteral(hostname)) {
    return { ok: false, reason: "Private or reserved IP addresses are not allowed." };
  }

  // Require at least one dot — rejects bare labels like "intranet"
  if (!hostname.includes(".")) {
    return { ok: false, reason: "Hostname must contain at least one dot (e.g. yourname.com)." };
  }

  return { ok: true, url: parsed.toString() };
}
