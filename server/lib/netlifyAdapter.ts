import serverless from "serverless-http";
import type { Express } from "express";
/** Adapt the existing Express application inside a modern Web Request function.
 * Keep duplicate Set-Cookie headers and binary screenshot bytes intact. */
export function adaptApp(app: Express) {
  const handle = serverless(app, { binary: ["image/*", "font/*", "application/octet-stream"] });
  return async (request: Request, ip: string): Promise<Response> => {
    const url = new URL(request.url);
    const bytes = request.method === "GET" || request.method === "HEAD" ? null : Buffer.from(await request.arrayBuffer());
    const headers = Object.fromEntries(request.headers);
    // Client-supplied proxy headers never become an owner/quota identity.
    for (const key of ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded"]) delete headers[key];
    headers.host = url.host;
    headers["x-forwarded-proto"] = "https";
    const result = await handle({
      httpMethod: request.method, path: url.pathname, rawUrl: request.url,
      headers, queryStringParameters: Object.fromEntries(url.searchParams),
      multiValueQueryStringParameters: Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key)])),
      body: bytes?.toString("base64") ?? null, isBase64Encoded: Boolean(bytes),
      requestContext: { identity: { sourceIp: ip } },
    }, {}) as { statusCode: number; headers?: Record<string,string>; multiValueHeaders?: Record<string,string[]>; body: string; isBase64Encoded?: boolean };
    const output = new Headers(result.headers);
    for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
      output.delete(key); for (const value of values) output.append(key, value);
    }
    const noBody = request.method === "HEAD" || [204, 304].includes(result.statusCode);
    return new Response(noBody ? null : result.isBase64Encoded ? new Uint8Array(Buffer.from(result.body, "base64")) : result.body, { status: result.statusCode, headers: output });
  };
}
