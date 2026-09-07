import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Smartphone, MousePointer2 } from "lucide-react";
import { exportPortfolioHTML, isSafePortfolioURL, PortfolioDraftSchema, type PortfolioDraft } from "@shared/portfolio";

// Only the editor receives this fixed script. No user text becomes executable,
// and the iframe has a unique opaque origin, with no access to app storage.
const EDITOR_SCRIPT = `document.addEventListener('click',function(e){e.preventDefault();var t=e.target instanceof Element?e.target:null;var p=t&&t.closest('[data-pg-project]');var s=t&&t.closest('[data-pg-section]');parent.postMessage({type:'pg-edit-section',section:p?'work':s?s.getAttribute('data-pg-section'):'about',project:p?p.getAttribute('data-pg-project'):null},'*')});window.addEventListener('scroll',function(){parent.postMessage({type:'pg-canvas-scroll',y:scrollY},'*')});window.addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.type==='pg-canvas-restore'&&typeof e.data.y==='number'&&Number.isFinite(e.data.y)){scrollTo({top:Math.max(0,Math.min(e.data.y,document.documentElement.scrollHeight)),behavior:'instant'})}});`;
export function editorPortfolioHTML(draft: PortfolioDraft) {
  // Incomplete contact fields are excluded from the canvas, not from the draft.
  const renderable = { ...draft, email: PortfolioDraftSchema.shape.email.safeParse(draft.email).success ? draft.email : "", links: draft.links.filter(l => isSafePortfolioURL(l.url)), projects: draft.projects.map(p => ({...p, link: p.link && isSafePortfolioURL(p.link) ? p.link : ""})) };
  return exportPortfolioHTML(renderable).replace("script-src 'none'", "script-src 'sha256-zX5u+lJnkW903/WbxbT1BjYncIsEnrPjOQ+Un2bd8p4='").replace("</head>", "<style>[data-pg-section],[data-pg-project]{cursor:pointer;transition:box-shadow .15s}[data-pg-section]:hover,[data-pg-project]:hover{box-shadow:inset 0 0 0 2px #b88124}a{cursor:pointer}</style></head>").replace("</body>", `<script>${EDITOR_SCRIPT}</script></body>`);
}
export function PortfolioCanvas({ draft, onSelect, compact = false }: { draft: PortfolioDraft; onSelect: (section: "about"|"work"|"contact", project?: string) => void; compact?: boolean }) {
  const [device, setDevice] = useState<"web"|"mobile">(()=>window.matchMedia("(max-width: 639px)").matches?"mobile":"web");
  const [width, setWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvasScroll = useRef(0);
  useEffect(()=>{canvasScroll.current=0;},[draft.id,draft.template]);
  const select = useRef(onSelect); select.current = onSelect;
  const current = useRef(draft); current.current = draft;
  useEffect(() => {
    const node = box.current; if (!node) return;
    const observer = new ResizeObserver(e => {if(e[0].contentRect.width>0)setWidth(e[0].contentRect.width);});
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      if(event.data?.type === "pg-canvas-scroll") {if(typeof event.data.y === "number" && Number.isFinite(event.data.y)) canvasScroll.current=Math.max(0,Math.min(event.data.y,100000)); return;}
      if(event.data?.type !== "pg-edit-section") return;
      const { section, project } = event.data;
      if (!["about","work","contact"].includes(section)) return;
      select.current(section, typeof project === "string" && current.current.projects.some(p => p.id === project) ? project : undefined);
    };
    window.addEventListener("message", receive); return () => window.removeEventListener("message", receive);
  }, []);
  const html = useMemo(() => editorPortfolioHTML(draft), [draft]);
  const target = device === "mobile" ? 390 : 1200;
  const scale = Math.min(1, width / target);
  const visibleHeight = compact ? 420 : 720;
  return <div className="pg-canvas">
    <div className="pg-canvas-toolbar">
      <span className="inline-flex items-center gap-2 text-xs text-stone-600"><MousePointer2 size={14}/> Click a section to edit</span>
      <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
        {(["web","mobile"] as const).map(d => <button key={d} type="button" aria-label={`${d === "web" ? "Web" : "Mobile"} preview`} aria-pressed={device===d} onClick={() => setDevice(d)} className={`flex min-h-11 min-w-11 items-center justify-center rounded-full ${device===d ? "bg-stone-900 text-white" : "text-stone-500"}`}>{d === "web" ? <Monitor size={17}/> : <Smartphone size={17}/>}</button>)}
      </div>
    </div>
    <div className="pg-canvas-surface">
      <div className="pg-browser-chrome"><i/><i/><i/><span>{draft.name ? `${draft.name}’s portfolio` : "Your portfolio"}</span></div>
      <div ref={box} className="relative overflow-hidden" style={{height:visibleHeight}}>
        <iframe ref={frame} onLoad={()=>frame.current?.contentWindow?.postMessage({type:"pg-canvas-restore",y:canvasScroll.current},"*")} title={`${device === "web" ? "Web" : "Mobile"} preview of your portfolio`} sandbox="allow-scripts" srcDoc={html} className="block border-0 bg-white" style={{width:target,height:visibleHeight/scale,transform:`scale(${scale})`,transformOrigin:"top left",marginLeft:width>target?(width-target)/2:0}} />
      </div>
    </div>
  </div>;
}
