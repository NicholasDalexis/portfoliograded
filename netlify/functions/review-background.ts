import type { Config, Context } from "@netlify/functions";
import express from "express";
import { validJobSignature, startJob, finishJob } from "../../server/lib/reviewJobs.js";
import { createAuditsRouter } from "../../server/routes/audits.js";
import { adaptApp } from "../../server/lib/netlifyAdapter.js";
import type { OwnedRequest } from "../../server/lib/owner.js";
import { netlifyRequest } from "../../server/lib/netlifyRequest.js";
export default async (request: Request, context: Context) => {
  if (request.method !== "POST") return;
  const text = await request.text();
  if (text.length > 128) return;
  let id: string;
  try { id = JSON.parse(text).id; } catch { return; }
  if (typeof id !== "string" || !validJobSignature(id, request.headers.get("x-pg-job-signature") ?? "")) return;
  const job = await startJob(id);
  if (!job) return;
  try {
    const app = express();
    app.use(express.json({limit:"16kb"}));
    // Only a validated, server-created job supplies identity. This application
    // is invoked in-process, never mounted as an externally reachable route.
    app.use("/api/audits", createAuditsRouter(undefined,undefined,undefined, {
      authorize(req,_res,next) { (req as OwnedRequest).user = job.user; next(); },
      identify(req,_res,next) { (req as OwnedRequest).ownerId = job.ownerId; next(); },
    }));
    const origin = `https://${context.deploy.id}--portfoliograded.netlify.app`;
    const response = await netlifyRequest.run({origin,workerOrigin:origin,ip:job.ipKey}, () => adaptApp(app)(new Request(`${origin}/api/audits`, {
      method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(job.input),
    }),job.ipKey));
    const data = await response.json() as {id?:string;reason?:string};
    if (response.ok && data.id && /^[A-Za-z0-9_-]{24}$/.test(data.id)) await finishJob(id,{reportId:data.id});
    else await finishJob(id,{error:data.reason ?? "The scan could not finish. Please try again."});
  } catch {
    await finishJob(id,{error:"The scan could not finish. Please try again."});
  }
};
// The suffix also supports CLI versions that do not yet honor background:true.
export const config: Config = { background: true };
