import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PortfolioAssistant } from "@/components/PortfolioAssistant";
import { PortfolioCanvas } from "@/components/PortfolioCanvas";
import { PublishPortfolioDialog } from "@/components/PublishPortfolioDialog";
import { PortfolioTemplatePreview } from "@/components/PortfolioTemplatePreview";
import "@/builder.css";
import { MessageCircle, Palette, Pencil, Settings2, Globe2, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileJson,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearPortfolioRecovery, flushPortfolioDraft, loadPortfolioEditorState } from "@/lib/portfolioRecovery";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getAuthHeader } from "@/lib/firebase";
import {
  createEmptyPortfolioDraft,
  exportPortfolioHTML,
  importPortfolioJSON,
  validatePortfolioDraft,
  validateEditablePortfolioDraft,
  PortfolioDraftSchema,
  isSafePortfolioURL,
  MAX_IMAGES,
  MAX_LINKS,
  MAX_PROJECTS,
  PORTFOLIO_ROLES,
  PORTFOLIO_TEXT_LIMITS as LIMITS,
  type PortfolioDraft,
  type PortfolioProject,
} from "@shared/portfolio";
import {
  loadPortfolioDraft,
  clearPortfolioDraft,
  savePortfolioDraft,
  downloadPortfolioHTML,
  PORTFOLIO_STORAGE_KEY,
  downloadPortfolioJSON,
  compressPortfolioImage,
} from "@/lib/portfolioStorage";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/85 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-45";
const PRIMARY = `${BUTTON} !border-amber-300 !bg-amber-200 hover:!bg-amber-300`;
const INPUT =
  "min-h-11 w-full min-w-0 rounded-xl border border-stone-300 bg-white/90 px-3 py-2.5 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-200";
const TEMPLATES = [
  {
    id: "editorial",
    label: "Editorial",
    detail: "A clear story, beautifully told.",
    best: "Case studies, writing & thoughtful process",
    tint: "#ecd59f",
  },
  {
    id: "gallery",
    label: "Gallery",
    detail: "Let your work do the talking.",
    best: "Photography, design & visual collections",
    tint: "#cfdbc8",
  },
  {
    id: "studio",
    label: "Studio",
    detail: "A confident introduction to you.",
    best: "Multidisciplinary work & creative services",
    tint: "#e6c5b8",
  },
] as const;
const ACCENTS = [
  { id: "gold", label: "Golden hour", color: "#e6c66e" },
  { id: "sage", label: "Soft sage", color: "#a9bea5" },
  { id: "rose", label: "Warm rose", color: "#d9a99e" },
] as const;
type Section = "about" | "work" | "finish";
type Suggestion = {
  headline?: string;
  bio?: string;
  projects?: Array<
    Pick<PortfolioProject, "id"> &
      Partial<
        Pick<
          PortfolioProject,
          "title" | "summary" | "role" | "process" | "outcome"
        >
      >
  >;
};
type AiReview = {
  suggestion: Suggestion;
  draftId: string;
  revision: number;
  changes: { label: string; before: string; after: string }[];
};

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "That did not finish. Please try again.";
}
function Field({
  label,
  value,
  onChange,
  help,
  placeholder,
  maxLength,
  multiline = false,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  placeholder?: string;
  maxLength: number;
  multiline?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const props = {
    id,
    value,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    placeholder,
    maxLength,
    className: INPUT,
    "aria-describedby": help ? `${id}-help` : undefined,
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {multiline ? (
        <textarea {...props} rows={3} className={`${INPUT} resize-y`} />
      ) : (
        <input {...props} type={type} autoComplete={autoComplete} />
      )}
      {help && (
        <p id={`${id}-help`} className="text-xs leading-relaxed text-stone-600">
          {help}
        </p>
      )}
    </div>
  );
}
function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-stone-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{children}</p>
    </div>
  );
}
export function validateSuggestion(
  raw: unknown,
  base: PortfolioDraft,
): AiReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "The writing suggestion was incomplete. Your draft is unchanged.",
    );
  const value = raw as Record<string, unknown>;
  const suggestion: Suggestion = {};
  const changes: AiReview["changes"] = [];
  for (const key of ["headline", "bio"] as const)
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string" || value[key].length > LIMITS[key])
        throw new Error(
          "The writing suggestion was too long. Your draft is unchanged.",
        );
      suggestion[key] = value[key];
      if (value[key] !== base[key])
        changes.push({
          label: key === "headline" ? "Your headline" : "Your introduction",
          before: base[key],
          after: value[key],
        });
    }
  if (value.projects !== undefined) {
    if (!Array.isArray(value.projects) || value.projects.length > MAX_PROJECTS)
      throw new Error("The project suggestion could not be verified.");
    const seen = new Set<string>();
    suggestion.projects = value.projects.map((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        throw new Error("The project suggestion could not be verified.");
      const p = entry as Record<string, unknown>;
      const original = base.projects.find((project) => project.id === p.id);
      if (!original || seen.has(original.id))
        throw new Error(
          "The suggestion referred to an unknown project. Your draft is unchanged.",
        );
      seen.add(original.id);
      const result: NonNullable<Suggestion["projects"]>[number] = {
        id: original.id,
      };
      for (const key of [
        "title",
        "summary",
        "role",
        "process",
        "outcome",
      ] as const)
        if (p[key] !== undefined) {
          const limit = key === "role" ? LIMITS.projectRole : LIMITS[key];
          if (typeof p[key] !== "string" || p[key].length > limit)
            throw new Error("The writing suggestion could not be verified.");
          result[key] = p[key];
          if (p[key] !== original[key])
            changes.push({
              label: `${original.title || "Untitled project"}: ${key === "role" ? "your contribution" : key}`,
              before: original[key],
              after: p[key],
            });
        }
      return result;
    });
  }
  if (!changes.length)
    throw new Error(
      "No new wording was suggested. Your draft is unchanged; try a more specific request.",
    );
  return { suggestion, draftId: base.id, revision: base.revision, changes };
}
export function applySuggestion(
  base: PortfolioDraft,
  suggestion: Suggestion,
): PortfolioDraft {
  return {
    ...base,
    headline: suggestion.headline ?? base.headline,
    bio: suggestion.bio ?? base.bio,
    projects: base.projects.map((project) => ({
      ...project,
      ...(suggestion.projects?.find((change) => change.id === project.id) ??
        {}),
    })),
  };
}

export default function Builder() {
  const [, navigate] = useLocation();
  const [initial] = useState(() => loadPortfolioEditorState());
  const [draft, setDraft] = useState<PortfolioDraft | null>(initial.draft);
  const [panel, setPanel] = useState<"chat" | "content" | "style">("chat");
  const [publishOpen, setPublishOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<Section>("about");
  const [smallView, setSmallView] = useState<"edit" | "preview">("edit");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">(
    (initial.error || initial.recovered) ? "failed" : "saved",
  );
  const [storageError, setStorageError] = useState(initial.error);
  const [externalConflict, setExternalConflict] = useState(initial.externalConflict);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(
    initial.draft?.projects[0]?.id ?? null,
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<PortfolioDraft | null>(
    null,
  );
  const [resetPending, setResetPending] = useState(false);
  const undoStack = useRef<PortfolioDraft[]>([]);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const conflictRef = useRef(externalConflict);
  conflictRef.current = externalConflict;
  const savedJson = useRef(initial.savedJson);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      !draft ||
      externalConflict ||
      JSON.stringify(draft) === savedJson.current
    )
      return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        if (conflictRef.current) return;
        savePortfolioDraft(draft);
        clearPortfolioRecovery();
        savedJson.current = JSON.stringify(draft);
        setSaveStatus("saved");
        setStorageError("");
      } catch (error) {
        setSaveStatus("failed");
        setStorageError(message(error));
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, externalConflict]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PORTFOLIO_STORAGE_KEY && event.key !== null) return;
      if (event.newValue === savedJson.current) return;
      if (!currentDraft.current) {
        try {
          const newest = loadPortfolioDraft();
          clearPortfolioRecovery();
          savedJson.current = newest ? JSON.stringify(newest) : "";
          currentDraft.current = newest; conflictRef.current = false;
          setDraft(newest); setExternalConflict(false); setStorageError(""); setSaveStatus("saved");
          setActiveProject(newest?.projects[0]?.id ?? null);
          setNotice(newest ? "Loaded the portfolio saved in your other tab." : "Choose a starting point for your portfolio.");
        } catch (error) { setStorageError(message(error)); setSaveStatus("failed"); }
        return;
      }
      conflictRef.current = true;
      setExternalConflict(true);
      setSaveStatus("failed");
      setStorageError(
        "This portfolio was changed in another tab. Saving is paused so those changes are not overwritten.",
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    // Wouter navigation can unmount before the typing debounce fires. Persist
    // the current validated draft here as well as on browser page transitions.
    const flush = () => {
      const value = currentDraft.current;
      if (!value) return;
      const result = flushPortfolioDraft(value, savedJson.current, { blocked: conflictRef.current });
      if (result.saved) savedJson.current = JSON.stringify(value);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (
        currentDraft.current &&
        JSON.stringify(currentDraft.current) !== savedJson.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  function remember(value: PortfolioDraft) {
    undoStack.current = [...undoStack.current.slice(-4), value];
    setUndoAvailable(true);
  }
  function replace(next: PortfolioDraft, rememberPrevious = false) {
    const previous = currentDraft.current;
    if (!previous) window.scrollTo({top:0,behavior:"instant"});
    if (rememberPrevious && previous) remember(previous);
    setDraft({
      ...next,
      revision: Math.max(next.revision, previous?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    setSaveStatus(conflictRef.current ? "failed" : "saving");
    setError("");
  }
  function edit(patch: Partial<PortfolioDraft>) {
    if (currentDraft.current) replace({ ...currentDraft.current, ...patch });
  }
  function editProject(id: string, patch: Partial<PortfolioProject>) {
    const base = currentDraft.current;
    if (base)
      replace({
        ...base,
        projects: base.projects.map((project) =>
          project.id === id ? { ...project, ...patch } : project,
        ),
      });
  }
  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) return;
    replace(previous);
    setUndoAvailable(undoStack.current.length > 0);
    setNotice(
      "Previous draft restored. Your latest typing may have been replaced.",
    );
    setActiveProject(previous.projects[0]?.id ?? null);
  }
  function addProject() {
    if (!draft || draft.projects.length >= MAX_PROJECTS) return;
    const project: PortfolioProject = {
      id: crypto.randomUUID(),
      title: "",
      summary: "",
      role: "",
      process: "",
      outcome: "",
    };
    replace({ ...draft, projects: [...draft.projects, project] }, true);
    setActiveProject(project.id);
    setNotice("Project added. Start with a title and what you made.");
  }
  function moveProject(id: string, direction: number) {
    if (!draft) return;
    const index = draft.projects.findIndex((project) => project.id === id);
    const target = index + direction;
    if (target < 0 || target >= draft.projects.length) return;
    const projects = [...draft.projects];
    [projects[index], projects[target]] = [projects[target], projects[index]];
    replace({ ...draft, projects }, true);
    setNotice(`Project moved to position ${target + 1}.`);
  }
  function removeProject(id: string) {
    if (!draft) return;
    const projects = draft.projects.filter((project) => project.id !== id);
    replace({ ...draft, projects }, true);
    setActiveProject(projects[0]?.id ?? null);
    setNotice("Project removed. Use Undo to restore it.");
  }
  async function uploadImage(id: string, file?: File) {
    if (!file || !draft) return;
    const baseId = draft.id;
    if (
      !draft.projects.find((project) => project.id === id)?.image &&
      draft.projects.filter((project) => project.image).length >= MAX_IMAGES
    ) {
      setError(
        `Keep up to ${MAX_IMAGES} project images. Remove one image before adding another.`,
      );
      return;
    }
    setUploading(id);
    setError("");
    try {
      const image = await compressPortfolioImage(file, {
        maxDimension: 1280,
        targetBytes: 220 * 1024,
      });
      const current = currentDraft.current;
      if (
        !current ||
        current.id !== baseId ||
        !current.projects.some((project) => project.id === id)
      )
        return;
      const previousAlt =
        current.projects.find((project) => project.id === id)?.image?.alt ?? "";
      const next = {
        ...current,
        projects: current.projects.map((project) =>
          project.id === id
            ? { ...project, image: { ...image, alt: previousAlt } }
            : project,
        ),
      };
      validateEditablePortfolioDraft(next);
      replace(next);
      setNotice(
        "Image resized for a lighter portfolio. Add a description for screen readers.",
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setUploading(null);
    }
  }
  function download(kind: "html" | "json") {
    if (!draft) return;
    try {
      (kind === "html" ? downloadPortfolioHTML : downloadPortfolioJSON)(draft);
      setNotice(
        kind === "html"
          ? "HTML download started. Open the file in a browser, or upload it to your website host."
          : "Backup download started. Keep it somewhere safe; import it here to continue editing.",
      );
      setError("");
    } catch (error) {
      setError(message(error));
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error(
          "That backup is larger than 2 MB. Import a Portfolio Graded JSON backup within the draft limit.",
        );
      const imported = importPortfolioJSON(await file.text());
      if (currentDraft.current) setImportPending(imported);
      else {
        replace(imported);
        setActiveProject(imported.projects[0]?.id ?? null);
        setNotice("Backup imported. Your portfolio is ready to edit.");
      }
    } catch (error) {
      setError(message(error));
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }
  function saveNow(): boolean {
    if (!draft || externalConflict) return false;
    try {
      savePortfolioDraft(draft);
      clearPortfolioRecovery();
      savedJson.current = JSON.stringify(draft);
      setSaveStatus("saved");
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(message(error));
      setSaveStatus("failed");
      return false;
    }
  }
  function openPortfolio() {
    if (!draft || !saveNow()) return;
    try { validatePortfolioDraft(draft); }
    catch (error) {
      setError(`Your editable draft is saved. Finish the contact fields before opening your website. ${message(error)}`);
      return;
    }
    navigate(`/portfolio/local/${encodeURIComponent(draft.id)}`);
  }
  const importControl = (
    <>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Import portfolio backup"
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      <button
        type="button"
        className={BUTTON}
        onClick={() => importInput.current?.click()}
      >
        <Upload size={16} /> Import backup
      </button>
    </>
  );

  function chooseTemplate(template: PortfolioDraft["template"]) {
    if (draft) { replace({...draft,template},true); setNotice("New look applied. Your words and projects are kept."); }
    else { replace(createEmptyPortfolioDraft(template)); setPanel("content"); setNotice("Your template is ready. Add your name to make it yours."); }
  }
  function editFromCanvas(next: "about"|"work"|"contact", project?: string) {
    setPanel("content"); setSection(next === "work" ? "work" : "about"); setSmallView("edit");
    if(project)setActiveProject(project);
    if(next === "contact") window.setTimeout(()=>{const node=document.getElementById("portfolio-contact-section") as HTMLDetailsElement|null;if(node){node.open=true;node.scrollIntoView({block:"center",behavior:"smooth"});}},100);
  }
  const templateChoices = <div className="pg-template-grid">{TEMPLATES.map(template=><button key={template.id} type="button" className={`pg-template-card ${draft?.template===template.id?"is-selected":""}`} aria-pressed={draft?.template===template.id} onClick={()=>chooseTemplate(template.id)}>
    <PortfolioTemplatePreview template={template.id} selected={draft?.template===template.id}/>
    <div className="p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-display text-2xl">{template.label}</h3>{draft?.template===template.id?<Check size={18}/>:<ArrowRight size={18}/>}</div><p className="mt-1 text-sm text-stone-600">{template.detail}</p><p className="mt-3 text-xs text-stone-500">{template.best}</p></div>
  </button>)}</div>;
  return <div className="min-h-screen">
    <SiteHeader/>
    <main id="main-content" tabIndex={-1} className={`pg-builder-shell ${draft?"pg-editor-page":"pg-starter-page"}`}>
      {!draft ? <>
        <div className="pg-builder-intro"><p className="pg-eyebrow">FROM YOUR FIRST IDEA TO YOUR NEXT OPPORTUNITY</p><h1>A portfolio that<br/><em>feels like you.</em></h1><p>Tell your story. Show your work. Make something you’re proud to share.</p><span className="pg-free-note"><CheckCircle2 size={15}/> Free to create and edit · Pro to publish at launch</span></div>
        <div className="pg-starter-assistant"><PortfolioAssistant draft={null} onApply={next=>{replace(next,true);setNotice("Your first draft is ready. Make it yours.");}} onManual={()=>document.getElementById("choose-a-template")?.scrollIntoView({behavior:"smooth",block:"start"})}/></div>
        <section id="choose-a-template" className="scroll-mt-28"><div className="pg-section-heading"><div><p className="pg-eyebrow">OR START WITH A LOOK YOU LOVE</p><h2 className="mt-2 font-display text-3xl">A little structure. All your personality.</h2></div><p>Every template is made for desktop and phone.</p></div>{templateChoices}</section>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/" className={BUTTON}>Already have a portfolio? Get it graded <ArrowRight size={15}/></Link><button type="button" className="min-h-11 px-4 text-sm text-stone-500 underline underline-offset-4" onClick={()=>setSettingsOpen(true)}>Restore a saved copy</button></div>
      </> : <>
        <div className="pg-editor-topbar"><div className="min-w-0"><p className="pg-eyebrow">YOUR PORTFOLIO STUDIO</p><h1 className="mt-1 truncate font-display text-3xl">{draft.name ? `${draft.name}’s portfolio` : "Make it yours."}</h1><p role="status" className={`mt-2 flex items-center gap-1.5 text-xs ${saveStatus==="failed"?"text-red-800":"text-stone-500"}`}>{saveStatus==="saving"?<Loader2 className="animate-spin" size={13}/>:<CheckCircle2 size={13}/>} {saveStatus==="saved"?"Saved on this device":saveStatus==="saving"?"Saving your changes…":"Your latest changes aren’t saved"}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className="pg-button !px-3" aria-label="Portfolio settings" onClick={()=>setSettingsOpen(true)}><Settings2 size={18}/></button><button type="button" className="pg-button" onClick={openPortfolio}><Eye size={17}/>Preview</button><button type="button" className="pg-primary" disabled={Boolean(uploading)||externalConflict} onClick={()=>setPublishOpen(true)}><Globe2 size={17}/>Publish</button></div></div>
        {storageError&&<div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Keep this tab open. Your latest changes aren’t saved.</strong><p className="mt-2">{storageError}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="pg-button" disabled={externalConflict} onClick={()=>saveNow()}>Try saving again</button><button type="button" className="pg-button" onClick={()=>download("json")}>Keep a safe copy</button>{externalConflict&&<button type="button" className="pg-button" onClick={()=>{try{const newest=loadPortfolioDraft();if(draft)remember(draft);clearPortfolioRecovery();savedJson.current=newest?JSON.stringify(newest):"";setDraft(newest);setExternalConflict(false);conflictRef.current=false;setStorageError("");setSaveStatus("saved");}catch(e){setError(message(e));}}}>Load the saved draft</button>}</div></div>}
        <div className="pg-mobile-switch"><button type="button" aria-pressed={smallView==="edit"} onClick={()=>setSmallView("edit")}>Edit</button><button type="button" aria-pressed={smallView==="preview"} onClick={()=>setSmallView("preview")}>Preview</button></div>
        <div className="pg-workspace">
          <aside className={`pg-editor-sidebar ${smallView==="preview"?"pg-hide-mobile":""}`} aria-label="Portfolio editor">
            <nav className="pg-editor-tabs" aria-label="How to edit your portfolio">{([{id:"chat",label:"Ask AI",Icon:MessageCircle},{id:"content",label:"Edit",Icon:Pencil},{id:"style",label:"Design",Icon:Palette}] as const).map(({id,label,Icon})=><button key={id} type="button" aria-pressed={panel===id} onClick={()=>setPanel(id)}><Icon size={16}/>{label}</button>)}</nav>
            <div className="pg-editor-panel">
              {panel==="chat"&&<PortfolioAssistant draft={draft} onApply={next=>{replace(next,true);setNotice("Your changes are applied. Review the preview, or undo whenever you need.");}} onManual={()=>setPanel("content")} onUndo={undo} canUndo={undoAvailable}/>}
              {panel==="content"&&<><nav className="mb-6 flex gap-2" aria-label="Portfolio content"><button type="button" className={section==="about"?PRIMARY:BUTTON} onClick={()=>setSection("about")}>About you</button><button type="button" className={section==="work"?PRIMARY:BUTTON} onClick={()=>setSection("work")}>Your work</button></nav>
                  {section === "about" && (
                    <>
                      <SectionTitle
                        eyebrow="The introduction"
                        title="Make it feel like you."
                      >
                        Tell someone what you do before they start scrolling.
                        You can refine this as you go.
                      </SectionTitle>
                      <div className="space-y-5">
                        <Field
                          label="Your name"
                          value={draft.name}
                          onChange={(name) => edit({ name })}
                          maxLength={LIMITS.name}
                          placeholder="e.g. Jordan Lee"
                          autoComplete="name"
                        />
                        <div className="space-y-1.5">
                          <label
                            htmlFor="portfolio-role"
                            className="text-sm font-semibold"
                          >
                            What kind of work do you do?
                          </label>
                          <select
                            id="portfolio-role"
                            value={draft.role}
                            onChange={(event) =>
                              edit({ role: event.target.value })
                            }
                            className={INPUT}
                          >
                            {!PORTFOLIO_ROLES.some(
                              (role) => role === draft.role,
                            ) && (
                              <option value={draft.role}>
                                {draft.role || "Choose your focus"}
                              </option>
                            )}
                            {PORTFOLIO_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-stone-600">
                            Choose General portfolio if your work crosses
                            categories.
                          </p>
                        </div>
                        <Field
                          label="Your headline"
                          value={draft.headline}
                          onChange={(headline) => edit({ headline })}
                          maxLength={LIMITS.headline}
                          placeholder="e.g. Graphic designer making useful things feel human"
                          help="One sentence: what you make, who it's for, or what makes your approach yours."
                        />
                        <Field
                          label="A short introduction"
                          value={draft.bio}
                          onChange={(bio) => edit({ bio })}
                          maxLength={LIMITS.bio}
                          multiline
                          placeholder="What draws you to this work? What would you like to do next?"
                          help="Start with 2 or 3 sentences. A specific detail is more memorable than a long list of adjectives."
                        />
                        <details
                          id="portfolio-contact-section"
                          className="rounded-2xl border border-stone-200 bg-white/50 p-4"
                          open={Boolean(
                            draft.email || draft.location || draft.links.length,
                          )}
                        >
                          <summary className="min-h-7 cursor-pointer text-sm font-semibold">
                            Contact & links{" "}
                            <span className="font-normal text-stone-500">
                              (optional)
                            </span>
                          </summary>
                          <div className="mt-4 space-y-4">
                            <Field
                              label="Contact email"
                              type="email"
                              value={draft.email}
                              onChange={(email) => edit({ email })}
                              maxLength={LIMITS.email}
                              autoComplete="email"
                              placeholder="you@example.com"
                              help="This will appear on your portfolio. Use an address you're comfortable sharing."
                            />
                            <Field
                              label="Location"
                              value={draft.location}
                              onChange={(location) => edit({ location })}
                              maxLength={LIMITS.location}
                              placeholder="e.g. Brooklyn, NY · open to remote work"
                            />
                            {draft.links.map((link, index) => (
                              <div
                                key={link.id}
                                className="space-y-3 rounded-xl border border-stone-200 bg-white/70 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-stone-500">
                                    LINK {index + 1}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Remove link ${index + 1}`}
                                    className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-stone-100"
                                    onClick={() => {
                                      replace(
                                        {
                                          ...draft,
                                          links: draft.links.filter(
                                            (item) => item.id !== link.id,
                                          ),
                                        },
                                        true,
                                      );
                                      setNotice(
                                        "Link removed. Use Undo to restore it.",
                                      );
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <Field
                                  label="Link label"
                                  value={link.label}
                                  onChange={(label) =>
                                    edit({
                                      links: draft.links.map((item) =>
                                        item.id === link.id
                                          ? { ...item, label }
                                          : item,
                                      ),
                                    })
                                  }
                                  maxLength={LIMITS.linkLabel}
                                  placeholder="e.g. LinkedIn, Instagram or résumé"
                                />
                                <Field
                                  label="Website address"
                                  type="url"
                                  value={link.url}
                                  onChange={(url) =>
                                    edit({
                                      links: draft.links.map((item) =>
                                        item.id === link.id
                                          ? { ...item, url }
                                          : item,
                                      ),
                                    })
                                  }
                                  maxLength={LIMITS.url}
                                  placeholder="https://…"
                                  help="Use the full https:// address."
                                />
                              </div>
                            ))}
                            <button
                              type="button"
                              className={BUTTON}
                              disabled={draft.links.length >= MAX_LINKS}
                              onClick={() =>
                                edit({
                                  links: [
                                    ...draft.links,
                                    {
                                      id: crypto.randomUUID(),
                                      label: "",
                                      url: "",
                                    },
                                  ],
                                })
                              }
                            >
                              <Plus size={16} /> Add a link
                            </button>
                          </div>
                        </details>
                        <button
                          type="button"
                          className={`${PRIMARY} w-full`}
                          onClick={() => setSection("work")}
                        >
                          Add your work <ArrowRight size={16} />
                        </button>
                      </div>
                    </>
                  )}

                  {section === "work" && (
                    <>
                      <SectionTitle
                        eyebrow="The proof"
                        title="Good work. Clear stories."
                      >
                        A few thoughtful projects go further than everything
                        you've ever made. Class, personal and volunteer projects
                        count.
                      </SectionTitle>
                      {!draft.projects.length ? (
                        <div className="rounded-2xl border border-dashed border-amber-400 bg-amber-50/60 p-6 text-center">
                          <LayoutTemplate
                            size={28}
                            className="mx-auto text-amber-800"
                          />
                          <h3 className="mt-3 font-display text-xl">
                            Start with one project.
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-stone-600">
                            What did you make, what was your part, and what did
                            you learn?
                          </p>
                          <button
                            type="button"
                            className={`${PRIMARY} mt-4`}
                            onClick={addProject}
                          >
                            <Plus size={16} /> Add your first project
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {draft.projects.map((project, index) => (
                            <section
                              key={project.id}
                              className="overflow-hidden rounded-2xl border border-stone-200 bg-white/65"
                            >
                              <div className="flex items-center gap-2 p-3">
                                <button
                                  type="button"
                                  aria-expanded={activeProject === project.id}
                                  aria-controls={`project-${project.id}`}
                                  onClick={() =>
                                    setActiveProject(
                                      activeProject === project.id
                                        ? null
                                        : project.id,
                                    )
                                  }
                                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left focus-visible:outline-2 focus-visible:outline-amber-700"
                                >
                                  <span className="font-mono text-xs text-stone-400">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <span className="truncate text-sm font-semibold">
                                    {project.title || "Untitled project"}
                                  </span>
                                  <ChevronRight
                                    size={16}
                                    className={`ml-auto shrink-0 transition ${activeProject === project.id ? "rotate-90" : ""}`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move project ${index + 1} up`}
                                  disabled={index === 0}
                                  onClick={() => moveProject(project.id, -1)}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move project ${index + 1} down`}
                                  disabled={index === draft.projects.length - 1}
                                  onClick={() => moveProject(project.id, 1)}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-stone-100 disabled:opacity-30"
                                >
                                  <ArrowDown size={15} />
                                </button>
                              </div>
                              {activeProject === project.id && (
                                <div
                                  id={`project-${project.id}`}
                                  className="space-y-4 border-t border-stone-200 p-4"
                                >
                                  <Field
                                    label="Project title"
                                    value={project.title}
                                    onChange={(title) =>
                                      editProject(project.id, { title })
                                    }
                                    maxLength={LIMITS.title}
                                    placeholder="Give the project a short, clear name"
                                  />
                                  <Field
                                    label="What did you make?"
                                    value={project.summary}
                                    onChange={(summary) =>
                                      editProject(project.id, { summary })
                                    }
                                    maxLength={LIMITS.summary}
                                    multiline
                                    placeholder="The challenge, who it was for, and what you created."
                                  />
                                  <Field
                                    label="What was your part?"
                                    value={project.role}
                                    onChange={(role) =>
                                      editProject(project.id, { role })
                                    }
                                    maxLength={LIMITS.projectRole}
                                    placeholder="e.g. Research, concept and visual design"
                                    help="If it was a team project, make your own contribution clear."
                                  />
                                  {project.image ? (
                                    <div className="space-y-3">
                                      <img
                                        src={project.image.src}
                                        alt={
                                          project.image.alt ||
                                          "Your uploaded project image"
                                        }
                                        className="max-h-56 w-full rounded-xl border border-stone-200 object-contain bg-white"
                                      />
                                      <Field
                                        label="Describe this image"
                                        value={project.image.alt}
                                        onChange={(alt) =>
                                          editProject(project.id, {
                                            image: { ...project.image!, alt },
                                          })
                                        }
                                        maxLength={LIMITS.imageAlt}
                                        placeholder="e.g. Three poster designs for a neighborhood film festival"
                                        help="This description helps people using screen readers understand the work."
                                      />
                                      <button
                                        type="button"
                                        className={BUTTON}
                                        onClick={() => {
                                          replace(
                                            {
                                              ...draft,
                                              projects: draft.projects.map(
                                                (item) =>
                                                  item.id === project.id
                                                    ? {
                                                        ...item,
                                                        image: undefined,
                                                      }
                                                    : item,
                                              ),
                                            },
                                            true,
                                          );
                                          setNotice(
                                            "Image removed. Use Undo to restore it.",
                                          );
                                        }}
                                      >
                                        <Trash2 size={15} /> Remove image
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-stone-300 p-4">
                                      <label
                                        className={`${BUTTON} relative w-full focus-within:ring-2 focus-within:ring-amber-600 ${uploading ? "opacity-50" : ""}`}
                                      >
                                        {uploading === project.id ? (
                                          <Loader2
                                            size={16}
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <ImagePlus size={16} />
                                        )}
                                        {uploading === project.id
                                          ? "Preparing image…"
                                          : "Add a project image"}
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          disabled={
                                            Boolean(uploading) ||
                                            draft.projects.filter(
                                              (item) => item.image,
                                            ).length >= MAX_IMAGES
                                          }
                                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-2"
                                          aria-label={`Upload an image for project ${index + 1}`}
                                          onChange={(event) => {
                                            void uploadImage(
                                              project.id,
                                              event.target.files?.[0],
                                            );
                                            event.target.value = "";
                                          }}
                                        />
                                      </label>
                                      <p className="mt-2 text-xs leading-relaxed text-stone-500">
                                        Add a photo or a screenshot. We keep it light so your portfolio loads quickly.{" "}
                                        {
                                          draft.projects.filter(
                                            (item) => item.image,
                                          ).length
                                        }
                                        /{MAX_IMAGES} images used.
                                      </p>
                                    </div>
                                  )}
                                  <details className="rounded-xl border border-stone-200 p-3">
                                    <summary className="min-h-8 cursor-pointer text-sm font-semibold">
                                      Add the story{" "}
                                      <span className="font-normal text-stone-500">
                                        (optional)
                                      </span>
                                    </summary>
                                    <div className="mt-3 space-y-4">
                                      <Field
                                        label="How did you approach it?"
                                        value={project.process}
                                        onChange={(process) =>
                                          editProject(project.id, { process })
                                        }
                                        maxLength={LIMITS.process}
                                        multiline
                                        placeholder="A decision you made, something you tried, or how you solved the challenge."
                                      />
                                      <Field
                                        label="What changed or what did you learn?"
                                        value={project.outcome}
                                        onChange={(outcome) =>
                                          editProject(project.id, { outcome })
                                        }
                                        maxLength={LIMITS.outcome}
                                        multiline
                                        placeholder="Share a real result, feedback, or a lesson you would use next time."
                                        help="You don't need a big number. An honest lesson is better than an invented result."
                                      />
                                      <Field
                                        label="Project link"
                                        type="url"
                                        value={project.link ?? ""}
                                        onChange={(link) =>
                                          editProject(project.id, { link })
                                        }
                                        maxLength={LIMITS.url}
                                        placeholder="https://…"
                                        help="Optional: a live project, video or detailed case study."
                                      />
                                    </div>
                                  </details>
                                  <button
                                    type="button"
                                    className={`${BUTTON} !text-red-800`}
                                    onClick={() => removeProject(project.id)}
                                  >
                                    <Trash2 size={15} /> Remove project
                                  </button>
                                </div>
                              )}
                            </section>
                          ))}
                          <button
                            type="button"
                            className={`${BUTTON} w-full`}
                            disabled={draft.projects.length >= MAX_PROJECTS}
                            onClick={addProject}
                          >
                            <Plus size={16} /> Add a project{" "}
                            <span className="text-xs font-normal text-stone-500">
                              {draft.projects.length}/{MAX_PROJECTS}
                            </span>
                          </button>
                        </div>
                      )}
                      <div className="mt-4 flex justify-start">
                        {undoAvailable && (
                          <button
                            type="button"
                            className={BUTTON}
                            onClick={undo}
                          >
                            <Undo2 size={16} /> Undo last change
                          </button>
                        )}
                      </div>
                      <div className="mt-5 rounded-xl bg-amber-50/80 p-4">
                        <p className="text-xs leading-relaxed text-amber-950">
                          <strong>
                            A lighter portfolio loads more easily.
                          </strong>{" "}
                          Pick one useful image per project. Large galleries can
                          make your best work harder to reach on a phone.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`${PRIMARY} mt-5 w-full`}
                        onClick={() => setPanel("style")}
                      >
                        Make it yours <ArrowRight size={16} />
                      </button>
                    </>
                  )}

              </>}
              {panel==="style"&&<><p className="pg-eyebrow">MAKE YOURSELF AT HOME</p><h2 className="mt-2 font-display text-3xl">Your look, your way.</h2><p className="mb-5 mt-3 text-sm leading-relaxed text-stone-600">Try a different layout. Your words and work stay right where they belong.</p>{templateChoices}<fieldset className="mt-6"><legend className="mb-3 text-sm font-semibold">Choose a color</legend><div className="flex flex-wrap gap-2">{ACCENTS.map(accent=><button key={accent.id} type="button" className={`pg-button ${draft.accent===accent.id?"!border-stone-800 !bg-white":""}`} aria-pressed={draft.accent===accent.id} onClick={()=>replace({...draft,accent:accent.id},true)}><span className="h-4 w-4 rounded-full border border-black/10" style={{background:accent.color}}/>{accent.label}</button>)}</div></fieldset></>}
            </div>
          </aside>
          <section className={`pg-preview-area ${smallView==="edit"?"pg-hide-mobile":""}`} aria-label="Live portfolio preview"><PortfolioCanvas draft={draft} onSelect={editFromCanvas}/><p className="mt-3 text-center text-xs leading-relaxed text-stone-500">Your changes appear here as you make them. Nothing goes live until you publish.</p></section>
        </div>
      </>}
      {(notice||undoAvailable)&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/80 p-4"><p role="status" className="min-w-0 flex-1 text-sm text-stone-600">{notice}</p>{undoAvailable&&<button type="button" className="pg-button" onClick={undo}><Undo2 size={16}/>Undo</button>}</div>}
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {draft&&<PublishPortfolioDialog open={publishOpen} onOpenChange={setPublishOpen} draft={draft} onEdit={()=>{setPanel("content");setSection("about");setSmallView("edit");}}/>}
      <Dialog open={settingsOpen || resetPending} onOpenChange={open=>{setSettingsOpen(open);if(!open)setResetPending(false);}}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#fffaf0] p-6">{resetPending ? <><DialogTitle className="font-display text-2xl">Start a fresh portfolio?</DialogTitle><DialogDescription>Save a copy if you want to keep this one. Your current draft will be replaced on this device. Undo is available until you leave this page.</DialogDescription><div className="flex flex-wrap gap-2"><button type="button" className="pg-button" onClick={()=>download("json")}>Save a copy first</button><button type="button" className="pg-primary" disabled={externalConflict} onClick={()=>{try{if(conflictRef.current)return;if(draft)remember(draft);clearPortfolioDraft();clearPortfolioRecovery();savedJson.current="";currentDraft.current=null;setDraft(null);setExternalConflict(false);setStorageError("");setSaveStatus("saved");setSection("about");setResetPending(false);setSettingsOpen(false);setNotice("Choose a new starting point. Undo can restore your previous draft.");}catch(e){setError(message(e));}}}>Start fresh</button><button type="button" className="pg-button" onClick={()=>setResetPending(false)}>Keep editing</button></div></> : <><DialogTitle className="font-display text-2xl">Your portfolio settings</DialogTitle><DialogDescription>Your draft is saved on this device. Keep a copy if you’re changing browsers or want an extra backup.</DialogDescription><div className="space-y-3">{draft&&<button type="button" className="pg-button w-full" onClick={()=>download("json")}>Save a copy of my work</button>}{importControl}{draft&&<><details className="rounded-xl border border-stone-200 p-3"><summary className="min-h-8 cursor-pointer text-sm text-stone-600">Advanced options</summary><button type="button" className="pg-button mt-3" onClick={()=>download("html")}>Export website file</button></details><button type="button" className="pg-button w-full !text-red-800" disabled={externalConflict} onClick={()=>{setResetPending(true);}}>Start a new portfolio</button></>}</div></>}</DialogContent></Dialog>
      <Dialog open={Boolean(importPending)} onOpenChange={open=>{if(!open)setImportPending(null);}}><DialogContent className="rounded-3xl bg-[#fffaf0] p-6"><DialogTitle className="font-display text-2xl">Restore this saved portfolio?</DialogTitle><DialogDescription>This will replace the draft you’re editing. Save a copy first if you want to keep both. You can undo until you leave this page.</DialogDescription><div className="flex flex-wrap gap-2"><button type="button" className="pg-primary" disabled={externalConflict} onClick={()=>{if(importPending){replace(importPending,true);setActiveProject(importPending.projects[0]?.id??null);setImportPending(null);setSettingsOpen(false);setNotice("Your saved portfolio is ready to edit.");}}}>Restore portfolio</button><button type="button" className="pg-button" onClick={()=>setImportPending(null)}>Keep this draft</button></div></DialogContent></Dialog>
    </main><SiteFooter/>
  </div>;
}
