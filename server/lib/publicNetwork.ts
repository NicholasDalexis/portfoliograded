import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import ipaddr from "ipaddr.js";

export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address.replace(/^\[|\]$/g, ""));
    if (parsed.kind() === 'ipv4') {
      const bytes = parsed.toByteArray();
      if ((bytes[0] === 198 && (bytes[1] === 18 || bytes[1] === 19)) || (bytes[0] === 192 && bytes[1] === 0 && bytes[2] === 0) || (bytes[0] === 192 && bytes[1] === 88 && bytes[2] === 99)) return false;
    }
    return parsed.range() === "unicast";
  } catch { return false; }
}

export function parsePublicUrl(input: string): URL {
  if (typeof input !== "string" || input.length > 2048) throw new Error("Use a public website URL under 2,048 characters.");
  const raw = input.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      (!host.includes('.') && !net.isIP(host)) || host === 'localhost' || host.endsWith('.local') ||
      (net.isIP(host) && !publicAddress(host))) throw new Error("Only public HTTP or HTTPS websites are supported.");
  url.hash = '';
  return url;
}

export async function resolvePublic(hostname: string): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = net.isIP(host) ? [{address: host, family: net.isIP(host)}] : await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), 4000); }),
    ]);
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Private or reserved network addresses are not allowed.');
    return addresses.find(a => a.family === 4) ?? addresses[0];
  } finally { if (timer) clearTimeout(timer); }
}

// Validate and connect to the same resolved address. Never let the HTTP client
// do a second, attacker-controlled lookup between validation and connection.
export async function publicFetch(input: string, options: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<Response> {
  const url = parsePublicUrl(input);
  const resolved = await resolvePublic(url.hostname);
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: 'GET', agent: false, signal: options.signal, family: resolved.family,
      headers: { ...options.headers, 'accept-encoding': 'identity' },
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
    }, response => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      const MAX_BYTES = 2_000_000;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) { response.destroy(new Error('This page exceeds the 2 MB HTML scan limit.')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        const status = response.statusCode ?? 502;
        if (status < 200 || status > 599) throw new Error('Website returned an invalid HTTP status.');
        resolve(new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), {status, headers}));
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(14000, () => request.destroy(new Error('Website request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

let proxyPromise: Promise<number> | undefined;
/** Loopback-only proxy for Chromium. Every connection, including subresources
 * and HTTPS tunnels, uses a validated and pinned public address. */
export function browserProxyPort(): Promise<number> {
  if (proxyPromise) return proxyPromise;
  proxyPromise = new Promise((resolve, reject) => {
    let connections = 0;
    let budgetStart = Date.now(), transferred = 0;
    const spend = (bytes: number) => {
      if (Date.now() - budgetStart > 30_000) { budgetStart = Date.now(); transferred = 0; }
      transferred += bytes;
      return transferred <= 64_000_000;
    };
    const proxy = http.createServer(async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      if (++connections > 32 || !spend(0)) { --connections; res.writeHead(429).end(); return; }
      res.once('close', () => --connections);
      try {
        const url = parsePublicUrl(req.url ?? '');
        if (url.protocol !== 'http:') throw new Error('Use CONNECT for TLS.');
        const destination = await resolvePublic(url.hostname);
        const upstream = http.request(url, {
          method: req.method, agent: false, family: destination.family,
          headers: {host: url.host, accept: req.headers.accept ?? '*/*', 'user-agent': req.headers['user-agent'] ?? 'PortfolioGraded/1.1'},
          lookup: (_host, _opts, cb) => cb(null, destination.address, destination.family),
        }, incoming => {
          res.writeHead(incoming.statusCode ?? 502, incoming.headers);
          let bytes = 0;
          incoming.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 15_000_000 || !spend(chunk.length)) incoming.destroy(); });
          incoming.on('error', () => res.destroy());
          incoming.pipe(res);
        });
        upstream.setTimeout(20000, () => upstream.destroy());
        upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
        req.on('aborted', () => upstream.destroy());
        res.on('close', () => upstream.destroy());
        upstream.end();
      } catch { res.writeHead(403).end(); }
    });
    proxy.on('connect', async (req, socket, head) => {
      socket.on('error', () => socket.destroy());
      if (++connections > 32 || !spend(0)) { --connections; socket.destroy(); return; }
      socket.once('close', () => --connections);
      try {
        const url = parsePublicUrl(`https://${req.url}`);
        if (url.port && url.port !== '443') throw new Error('TLS port not allowed.');
        const destination = await resolvePublic(url.hostname);
        const upstream = net.connect({host: destination.address, port: 443, family: destination.family});
        const lifetime = setTimeout(() => { upstream.destroy(); socket.destroy(); }, 25000);
        upstream.on('error', () => socket.destroy());
        socket.on('close', () => { clearTimeout(lifetime); upstream.destroy(); });
        upstream.once('connect', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          let bytes = 0;
          upstream.on('data', chunk => { bytes += chunk.length; if (bytes > 15_000_000 || !spend(chunk.length)) { upstream.destroy(); socket.destroy(); } });
          socket.on('data', chunk => { if (!spend(chunk.length)) { upstream.destroy(); socket.destroy(); } });
          socket.pipe(upstream); upstream.pipe(socket);
        });
      } catch { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); }
    });
    proxy.on('error', reject);
    proxy.listen(0, '127.0.0.1', () => resolve((proxy.address() as net.AddressInfo).port));
    proxy.unref();
  });
  return proxyPromise;
}
