import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Sparkles, Undo2 } from "lucide-react";
import { getAuthHeader } from "@/lib/firebase";
import { createEmptyPortfolioDraft, type PortfolioDraft } from "@shared/portfolio";
import { applyPortfolioComposition, portfolioComposeInput } from "@shared/portfolioCompose";

export function PortfolioAssistant({draft,onApply,onManual,initialPrompt="",onUndo,canUndo=false}: {draft:PortfolioDraft|null;onApply:(draft:PortfolioDraft)=>void;onManual:()=>void;initialPrompt?:string;onUndo?:()=>void;canUndo?:boolean}) {
 const [prompt,setPrompt]=useState(initialPrompt);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [proposal,setProposal]=useState<{draft:PortfolioDraft;baseId:string|null;revision:number;request:string}|null>(null);
 const [lastApplied,setLastApplied]=useState(false);
 const [left,setLeft]=useState<number|null>(null);
 const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 useEffect(()=>{if(initialPrompt)setPrompt(initialPrompt);},[initialPrompt]);
 const stale=Boolean(proposal&&(proposal.baseId!==(draft?.id??null)||proposal.revision!==(draft?.revision??0)));
 async function request(){
  if(busy||prompt.trim().length<10)return;
  setBusy(true);setError("");setProposal(null);setLastApplied(false);
  const base=draft??createEmptyPortfolioDraft();const request=prompt.trim();
  const controller=new AbortController();abort.current=controller;const timer=window.setTimeout(()=>controller.abort(),100000);
  try{
   const response=await fetch("/api/builder/compose",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...await getAuthHeader()},signal:controller.signal,body:JSON.stringify({instruction:request,draft:portfolioComposeInput(base)})});
   const data=await response.json();if(!response.ok)throw new Error(data.reason??"The design assistant could not finish. Try again.");
   const next=applyPortfolioComposition(base,data.content);
   setProposal({draft:next,baseId:draft?.id??null,revision:draft?.revision??0,request});setLeft(typeof data.requestsLeft==="number"?data.requestsLeft:null);
  }catch(err){setError(controller.signal.aborted?"This is taking longer than expected. Your portfolio is unchanged. Try again.":err instanceof Error?err.message:"Please try again.");}
  finally{window.clearTimeout(timer);setBusy(false);abort.current=null;}
 }
 const removed=proposal&&draft?draft.projects.filter(p=>!proposal.draft.projects.some(n=>n.id===p.id)).length:0;
 return <div className="pg-assistant">
  <div className="pg-assistant-icon"><Sparkles size={20}/></div>
  <h2 className="mt-4 font-display text-[28px] leading-tight">{draft?"Let’s make it feel like you.":"Tell us what you have in mind."}</h2>
  <p className="mt-3 text-sm leading-relaxed text-stone-600">{draft?"Ask for a new look, a stronger introduction, or help turning your work into a story. You review every change.":"Describe what you do and the work you want to show. We’ll suggest a design and help with the words."}</p>
  <div className="mt-5 space-y-2">
   {(draft?["Give it a bold studio look","Make my introduction shorter","Help me tell the story of my work"]:["I’m a photographer building my first portfolio","I’m a marketing graduate with class projects"]).map(text=><button type="button" key={text} className="pg-prompt-chip" onClick={()=>setPrompt(text)}>{text}<span aria-hidden="true">↗</span></button>)}
  </div>
  <form className="pg-prompt-box mt-5" onSubmit={event=>{event.preventDefault();void request();}}>
   <label htmlFor="portfolio-description" className="sr-only">{draft?"Ask for a change":"Describe your portfolio"}</label>
   <textarea id="portfolio-description" value={prompt} onChange={event=>setPrompt(event.target.value)} maxLength={3000} rows={4} placeholder={draft?"Make this warmer and more personal…":"I’m Madison, a graphic designer. I want to show my poster designs and a branding project from college…"} className="block w-full resize-y border-0 bg-transparent p-4 text-base outline-none placeholder:text-stone-400"/>
   <div className="flex items-center justify-between gap-2 px-3 pb-3"><span className="text-xs text-stone-500">Your words. Your work.</span><button type="submit" disabled={busy||prompt.trim().length<10} className="pg-primary min-h-11 !rounded-full !px-4">{busy?<Loader2 size={17} className="animate-spin"/>:<ArrowUp size={17}/>} {busy?"Creating…":draft?"Suggest changes":"Create my portfolio"}</button></div>
  </form>
  <p className="mt-3 text-[11px] leading-relaxed text-stone-500">Optional AI help. Your request and portfolio text are sent to our AI provider. Photos and separate contact fields stay out. Please check facts before applying.</p>
  {left!==null&&<p className="mt-2 text-xs text-stone-500">{left} assistant requests left today. Editing stays available.</p>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {proposal&&<div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
   <p className="text-xs font-bold uppercase tracking-widest text-amber-900">Ready for your review</p>
   <h3 className="mt-3 font-display text-xl">{proposal.draft.name||"Your portfolio"}</h3>
   <p className="mt-2 text-sm font-semibold">{proposal.draft.headline}</p>
   <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{proposal.draft.bio}</p>
   <p className="mt-3 text-xs capitalize">{proposal.draft.template} layout · {proposal.draft.accent} color</p>
   {proposal.draft.projects.map(p=><details key={p.id} className="mt-3 border-t border-amber-200 pt-3"><summary className="cursor-pointer text-sm font-semibold">{p.title||"Untitled project"}</summary><div className="mt-2 space-y-2 text-xs leading-relaxed text-stone-600">{[p.summary,p.role,p.process,p.outcome].filter(Boolean).map((t,i)=><p key={i}>{t}</p>)}</div></details>)}
   {Boolean(removed)&&<p className="mt-3 text-sm font-semibold text-amber-900">This suggestion removes {removed} existing {removed===1?"project":"projects"}. Review before applying.</p>}
   {stale&&<p className="mt-3 text-xs font-semibold text-amber-900">Your portfolio has changed since this request. Ask again to keep your latest edits.</p>}
   <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={stale} className="pg-primary" onClick={()=>{onApply(proposal.draft);setProposal(null);setLastApplied(true);setPrompt("");}}><Check size={16}/>Apply to my portfolio</button><button type="button" className="pg-button" onClick={()=>setProposal(null)}>Keep what I have</button></div>
  </div>}
  {lastApplied&&<p role="status" className="mt-4 text-sm text-emerald-800">Your portfolio is updated. You can keep refining it.</p>}
  <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="pg-button" onClick={onManual}>Edit it myself</button>{canUndo&&onUndo&&<button type="button" className="pg-button" onClick={()=>{onUndo();setProposal(null);setLastApplied(false);}}><Undo2 size={15}/>Undo</button>}</div>
 </div>;
}
