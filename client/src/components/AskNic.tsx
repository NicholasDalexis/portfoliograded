/*
 * Ask Nic. Floating advice chat, clearly labeled as AI using Nic's advice.
 * The server enforces the daily question allowance.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { ASK_NIC_EVENT } from "./HighlightAsk";
import { track } from "@/lib/track";
import { toast } from "sonner";
import { getAuthHeader } from "@/lib/firebase";

type Msg = { role: "user" | "assistant"; content: string };

const INTRO: Msg = {
  role: "assistant",
  content:
    "I'm Ask Nic, an AI using Nic's portfolio advice. Ask about your portfolio or the job hunt. You get 2 free questions a day.",
};

export function AskNic() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!open || !field) return;
    const resize = () => {
      const styles = getComputedStyle(field);
      const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
      const cap = parseFloat(styles.lineHeight) * 3 + padding + border;
      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight + border, cap)}px`;
      if (!input) field.scrollTop = 0;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [input, open]);
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    inputRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        event.stopPropagation();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [messages, open]);

  // Highlight-to-ask: HighlightAsk dispatches the selected text; we open the
  // chat with it pre-quoted so the user just hits send (or edits first).
  useEffect(() => {
    function onAskAbout(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail?.text?.trim();
      if (!text) return;
      setOpen(true);
      setInput(`"${text}" What does this mean?`);
    }
    window.addEventListener(ASK_NIC_EVENT, onAskAbout);
    return () => window.removeEventListener(ASK_NIC_EVENT, onAskAbout);
  }, []);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    track("asknic_question", { length: q.length });
    setBusy(true);
    try {
      const history = messages.filter(m => m !== INTRO);
      const res = await fetch("/api/ask-nic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ question: q, history }),
      });
      const data = (await res.json()) as {
        answer?: string;
        questionsLeft?: number;
        reason?: string;
      };
      if (!res.ok) {
        setMessages(m => [
          ...m,
          {
            role: "assistant",
            content:
              data.reason ?? "Something glitched. Try again in a minute.",
          },
        ]);
        if (res.status === 429) setLeft(0);
        return;
      }
      setMessages(m => [
        ...m,
        { role: "assistant", content: data.answer ?? "…" },
      ]);
      if (typeof data.questionsLeft === "number") setLeft(data.questionsLeft);
    } catch {
      toast.error("Couldn't reach Ask Nic.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => {
          setOpen(v => {
            if (!v) track("asknic_opened", {});
            return !v;
          });
        }}
        className="no-print pg-action-secondary fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-[45] gap-2 shadow-lg"
        aria-label={open ? "Close Ask Nic" : "Open Ask Nic"}
        aria-expanded={open}
        aria-controls="ask-nic-panel"
      >
        {open ? (
          <X className="h-4 w-4" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}{" "}
        Ask Nic
      </button>

      {open ? (
        <div
          data-asknic-panel
          id="ask-nic-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ask-nic-title"
          className="no-print glass-strong fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-[45] flex h-[min(560px,calc(100dvh-120px-env(safe-area-inset-bottom)))] w-[min(calc(100vw-40px),400px)] flex-col overflow-hidden rounded-[2rem] shadow-2xl"
        >
          <div className="border-b border-border p-5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="ask-nic-title"
                className="font-display text-2xl font-bold"
              >
                Ask Nic
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pg-action-icon"
                aria-label="Close advice panel"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              AI using Nic's advice. Replies may be imperfect.{" "}
              {left !== null
                ? `${left} question${left === 1 ? "" : "s"} left today.`
                : "2 free questions a day."}
            </p>
          </div>

          <div
            ref={bodyRef}
            role="log"
            aria-label="Ask Nic conversation"
            aria-live="polite"
            aria-relevant="additions text"
            className="flex-1 space-y-3 overflow-y-auto p-5"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-5 whitespace-pre-wrap break-words rounded-[1.5rem] rounded-br-md bg-foreground px-4 py-3 text-sm leading-relaxed text-background"
                    : "mr-5 whitespace-pre-wrap break-words rounded-[1.5rem] rounded-bl-md bg-white/70 px-4 py-3 text-sm leading-relaxed text-foreground"
                }
              >
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="mr-5 w-fit rounded-[1.5rem] rounded-bl-md bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                Thinking…
              </div>
            ) : null}
          </div>
          <form
            className="border-t border-border p-4"
            onSubmit={e => {
              e.preventDefault();
              send();
            }}
          >
            <label
              htmlFor="ask-nic-question"
              className="mb-2 block text-sm font-semibold"
            >
              Your question
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="ask-nic-question"
                ref={inputRef}
                aria-label="Ask Nic a portfolio question"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask a question…"
                maxLength={600}
                rows={1}
                className="min-h-12 w-full resize-none rounded-[1.5rem] border border-foreground/20 bg-white/80 px-4 py-3 text-base leading-relaxed outline-none focus:border-amber-700 focus:ring-4 focus:ring-amber-100"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="pg-action-icon h-12 w-12 min-h-12"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
