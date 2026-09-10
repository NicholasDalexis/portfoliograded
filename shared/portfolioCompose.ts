import { z } from "zod";
import { ACCENT_IDS, TEMPLATE_IDS, PortfolioDraftSchema, PortfolioProjectSchema, type PortfolioDraft, validateEditablePortfolioDraft } from "./portfolio";
export const composeProjectSchema = PortfolioProjectSchema.pick({id:true,title:true,summary:true,role:true,process:true,outcome:true}).strict();
export const composeContentSchema = z.object({
  name:PortfolioDraftSchema.shape.name, headline:PortfolioDraftSchema.shape.headline, role:PortfolioDraftSchema.shape.role, bio:PortfolioDraftSchema.shape.bio,
  template:z.enum(TEMPLATE_IDS),accent:z.enum(ACCENT_IDS),projects:z.array(composeProjectSchema).max(12),
}).strict();
export const composeRequestSchema = z.object({ instruction:z.string().trim().min(10).max(3000), draft:composeContentSchema }).strict();
export type ComposeContent = z.infer<typeof composeContentSchema>;
export function portfolioComposeInput(draft: PortfolioDraft): ComposeContent {
  return composeContentSchema.parse({...Object.fromEntries(["name","headline","role","bio","template","accent"].map(k => [k,draft[k as keyof PortfolioDraft]])),projects:draft.projects.map(({id,title,summary,role,process,outcome})=>({id,title,summary,role,process,outcome}))});
}
export function applyPortfolioComposition(base:PortfolioDraft, raw:unknown):PortfolioDraft {
  const content = composeContentSchema.parse(raw);
  if(new Set(content.projects.map(p=>p.id)).size!==content.projects.length) throw new Error("The suggestions included repeated projects. Try again.");
  if(base.projects.some(p=>!content.projects.some(next=>next.id===p.id))) throw new Error("A suggestion cannot remove your existing projects. Remove a project directly in Edit if you want to delete it.");
  return validateEditablePortfolioDraft({...base,...content,projects:content.projects.map(p=>({...base.projects.find(old=>old.id===p.id),...p}))});
}
