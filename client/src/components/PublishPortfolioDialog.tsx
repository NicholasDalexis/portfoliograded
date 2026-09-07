import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Globe2, Loader2, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { getAuthHeader } from "@/lib/firebase";
import { validatePortfolioDraft, type PortfolioDraft } from "@shared/portfolio";
type Publication={slug:string;version:number;publishedAt:string;status:string;localUrl:string|null;desiredProductionUrl:string;isPublicInternet:false};
type Capabilities={mode:string;canPublish:boolean;requiresPro:boolean;reason?:string};
const toSlug=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"").slice(0,40);
async function api(path:string,init:RequestInit={}){const response=await fetch(`/api/portfolios${path}`,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...await getAuthHeader(),...init.headers}});const data=await response.json();if(!response.ok)throw new Error(data.reason??data.message??"That didn't finish. Please try again.");return data;}
export function PublishPortfolioDialog({open,onOpenChange,draft,onEdit}: {open:boolean;onOpenChange:(open:boolean)=>void;draft:PortfolioDraft;onEdit:()=>void}) {
 const [slug,setSlug]=useState(()=>toSlug(draft.name));
 const [cap,setCap]=useState<Capabilities|null>(null);
 const [publications,setPublications]=useState<Publication[]>([]);
 const [available,setAvailable]=useState<{slug:string;available:boolean;reserved?:boolean}|null>(null);
 const [checking,setChecking]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [published,setPublished]=useState<Publication|null>(null);
 const [copied,setCopied]=useState(false);
 const [pro,setPro]=useState(false);
 const opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!open)return;if(!slug)setSlug(toSlug(draft.name));let alive=true;setError("");setPublished(null);setCopied(false);setCap(null);api("/capabilities").then(async c=>[c,c.canPublish?await api(""):{publications:[]}]).then(([c,p])=>{if(alive){setCap(c);setPublications(p.publications??[]);}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[open]);
 useEffect(()=>{
  if(!open||!cap?.canPublish)return;setAvailable(null);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3){setChecking(false);return;}
  let alive=true;setChecking(true);const timer=window.setTimeout(()=>{api(`/availability?slug=${encodeURIComponent(slug)}`).then(data=>{if(alive)setAvailable({...data,slug});}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setChecking(false);});},350);
  return()=>{alive=false;window.clearTimeout(timer);};
 },[open,slug,cap]);
 const owned=publications.find(p=>p.slug===slug);
 const validName=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length>=3;
 let draftError="";try{validatePortfolioDraft(draft);}catch{draftError="Finish your email and website addresses before publishing.";}
 if(!draft.name.trim()||!draft.headline.trim())draftError="Add your name and a short headline before publishing.";
 else if(!draft.projects.some(p=>p.title.trim()&&p.summary.trim()))draftError="Add at least one project with a title and description before publishing.";
 async function publish(){
  if(busy||!validName||draftError)return;setBusy(true);setError("");
  try{const data=await api("/publish",{method:"POST",body:JSON.stringify({slug,draft,...(owned?{expectedVersion:owned.version}:{})})});setPublished(data.publication);setPublications(items=>[...items.filter(p=>p.slug!==slug),data.publication]);}
  catch(e){setError(e instanceof Error?e.message:"Publishing did not finish.");}finally{setBusy(false);}
 }
 async function unpublish(){if(!owned||busy)return;setBusy(true);setError("");try{await api(`/${encodeURIComponent(slug)}/unpublish`,{method:"POST",body:JSON.stringify({expectedVersion:owned.version})});const data=await api("");setPublications(data.publications??[]);setPublished(null);}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
 return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[min(94vw,680px)] sm:max-w-[680px] overflow-y-auto rounded-3xl bg-[#fffaf0] p-6 sm:p-8" onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={e=>{if(opener.current?.isConnected){e.preventDefault();opener.current.focus();}}}>
  <div className="pg-assistant-icon"><Globe2 size={22}/></div>
  <DialogTitle className="font-display text-3xl">{published?"Your preview is ready.":"Give your work an address."}</DialogTitle>
  <DialogDescription className="text-base leading-relaxed text-stone-600">{published?"Open it and see your portfolio as a visitor would.":"Choose a name people can remember. We’ll take care of the rest of the address."}</DialogDescription>
  {published?<div className="space-y-4">
   <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="text-emerald-700"/><p className="mt-3 break-all text-lg font-semibold">{published.slug}.portfoliograded.com</p><p className="mt-2 text-sm leading-relaxed text-stone-600">This is your proposed public address. Today’s preview runs on this Mac; it is not live on the internet.</p></div>
   <a className="pg-primary w-full" href={published.localUrl??"/build"}><ExternalLink size={16}/>Open my preview</a>
   <button type="button" className="pg-button w-full" onClick={async()=>{try{await navigator.clipboard.writeText(new URL(published.localUrl??"/build",window.location.origin).href);setCopied(true);}catch{setError("Copy the preview address from your browser after opening it.");}}}><Copy size={16}/>{copied?"Preview address copied":"Copy local preview address"}</button>
   <button type="button" className="pg-button w-full" onClick={()=>onOpenChange(false)}>Keep editing</button>
  </div>:<>
   <div className="mt-2"><label htmlFor="portfolio-site-name" className="mb-2 block text-sm font-semibold">Your website name</label><div className="flex min-w-0 items-center rounded-2xl border-2 border-amber-400 bg-white px-3 focus-within:ring-4 focus-within:ring-amber-100"><input id="portfolio-site-name" value={slug} onChange={e=>{setSlug(toSlug(e.target.value));setError("");}} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={40} placeholder="madisoncollins" aria-describedby="site-name-help" className="min-h-14 min-w-0 flex-1 bg-transparent py-3 text-base font-semibold outline-none"/><span className="shrink-0 text-xs text-stone-500 sm:text-sm">.portfoliograded.com</span></div>
   <p id="site-name-help" role="status" className="mt-2 min-h-5 text-xs text-stone-600">{!validName?"Use 3–40 letters or numbers, with single hyphens if you like.":checking?"Checking this name…":owned?"This is your saved preview address.":available?(available.available?"Available for a preview on this Mac.":"That name is unavailable. Try another."):""}</p></div>
   <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5"><div className="flex items-center gap-2 font-semibold"><LockKeyhole size={17}/>Build free. Publish with Pro.</div><p className="mt-2 text-sm leading-relaxed text-stone-600">The proposed Pro plan keeps your portfolio online at your own Portfolio Graded address. Your paid subscription will cover hosting while it’s active.</p><p className="mt-2 text-xs leading-relaxed text-stone-500">Planned: $50/year or $9.99/month. Payments are off in this private preview. Final plan details will be confirmed before launch.</p><button type="button" className="mt-3 min-h-11 text-sm font-semibold underline underline-offset-4" onClick={()=>{onOpenChange(false);setPro(true);}}>Compare planned plans</button></div>
   {cap?.mode==="local-preview"&&<p className="rounded-xl bg-white p-3 text-xs leading-relaxed text-stone-600"><strong>Private test on this Mac.</strong> Publishing below creates a working local preview without a payment. The public subdomain is not reserved or live yet.</p>}
   {draftError&&<div className="rounded-xl bg-amber-100/60 p-3 text-sm"><p>{draftError}</p><button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={()=>{onOpenChange(false);onEdit();}}>Finish these details</button></div>}
   <button type="button" className="pg-primary w-full" disabled={busy||!cap?.canPublish||Boolean(draftError)||!validName||checking||available?.slug!==slug||(!available.available&&!owned)} onClick={()=>void publish()}>{busy?<Loader2 className="animate-spin" size={17}/>:<Globe2 size={17}/>} {busy?"Preparing your portfolio…":cap?.mode==="local-preview"?(owned?"Update local preview":"Publish local preview"):"Publish portfolio"}</button>
   {cap&&!cap.canPublish&&<p className="text-sm leading-relaxed text-stone-600">{cap.reason||"Public publishing is being connected. Your portfolio is ready to keep editing."}</p>}
   {owned?.status==="published"&&<button type="button" disabled={busy} className="pg-button" onClick={()=>void unpublish()}>Take this preview offline</button>}
  </>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 </DialogContent></Dialog><UpgradeDialog open={pro} onOpenChange={setPro}/></>;
}
