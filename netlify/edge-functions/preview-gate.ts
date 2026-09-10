import type { Config, Context } from "@netlify/edge-functions";
async function hasAccess(request: Request): Promise<boolean> {
  const secret = Netlify.env.get("PREVIEW_COOKIE_SECRET");
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return false;
  const cookies = (request.headers.get("cookie") ?? "").split(";").map(x=>x.trim()).filter(x=>x.startsWith("pg_preview="));
  if(cookies.length !== 1) return false;
  const match = /^pg_preview=(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(cookies[0]);
  if(!match || Number(match[1]) < Date.now()) return false;
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const sig = Uint8Array.from(atob(match[2].replace(/-/g,"+").replace(/_/g,"/")+"="),c=>c.charCodeAt(0));
  return crypto.subtle.verify("HMAC",key,sig,new TextEncoder().encode(match[1]));
}
export default async (request: Request, context: Context) => {
  const path = new URL(request.url).pathname;
  // These endpoints have their own authentication and never serve private assets.
  if (path === "/.netlify/functions/review-background" || path === "/healthz" || path === "/preview/login" || path === "/api/billing/webhook") return context.next();
  const headers = {"Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow", "X-Content-Type-Options":"nosniff"};
  if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n",{headers:{...headers,"Content-Type":"text/plain"}});
  if (path === "/sitemap.xml") return new Response("Not available in private preview",{status:404,headers});
  if (!(await hasAccess(request))) {
    if (path.startsWith("/api/") || path.startsWith("/.netlify/")) return Response.json({error:"preview_password_required"},{status:401,headers});
    return new Response(null,{status:302,headers:{...headers,Location:"/preview/login"}});
  }
  const response = await context.next();
  for (const [key,value] of Object.entries(headers)) response.headers.set(key,value);
  return response;
};
export const config: Config = { path:"/*" };
