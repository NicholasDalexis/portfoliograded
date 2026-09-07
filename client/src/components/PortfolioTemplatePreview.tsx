import { useEffect, useMemo, useRef, useState } from "react";
import { getTemplatePreviewHTML } from "@shared/portfolioTemplateDemos";
import type { PortfolioDraft } from "@shared/portfolio";
export function PortfolioTemplatePreview({template,selected}:{template:PortfolioDraft["template"];selected:boolean}) {
 const box=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(360);
 useEffect(()=>{const node=box.current;if(!node)return;const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(node);return()=>observer.disconnect();},[]);
 const html=useMemo(()=>getTemplatePreviewHTML(template),[template]);
 return <div ref={box} className="pg-template-image" style={{height:width*.73}} aria-hidden="true"><iframe title={`${template} example`} tabIndex={-1} sandbox="" srcDoc={html} style={{width:1200,height:900,transform:`scale(${width/1200})`}}/><span className="pg-template-badge">{selected?"Your current look":"Preview template"}</span></div>;
}
