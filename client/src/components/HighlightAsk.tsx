/*
 * HighlightAsk. select any text on the site and a small "Ask Nic" pill pops
 * up next to the selection. Clicking it opens the Ask Nic chat with the
 * highlighted words pre-quoted, ready for "what does this mean?".
 * The native selection stays visible (the pill prevents default on mousedown
 * so clicking it doesn't clear the highlight).
 */
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { track } from "@/lib/track";

export const ASK_NIC_EVENT = "pg:ask-nic";

export function askNicAbout(text: string) {
  window.dispatchEvent(new CustomEvent(ASK_NIC_EVENT, { detail: { text } }));
}

/** Static, non-interactive replica of the pill, for explainer cards. */
export function HighlightPillDemo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-accent px-3 py-2 text-sm font-semibold text-foreground">
      <MessageCircle className="h-3.5 w-3.5" /> Explain this
    </span>
  );
}

export function HighlightAsk() {
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(
    null
  );

  useEffect(() => {
    function onSelection() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";

      // Ignore empty, tiny, or huge selections, and anything inside inputs or the chat itself.
      if (!sel || sel.isCollapsed || text.length < 3 || text.length > 280) {
        setPos(null);
        return;
      }
      const anchorEl =
        sel.anchorNode instanceof Element
          ? sel.anchorNode
          : (sel.anchorNode?.parentElement ?? null);
      if (
        anchorEl?.closest(
          "input, textarea, [contenteditable], [data-asknic-panel]"
        )
      ) {
        setPos(null);
        return;
      }

      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          setPos(null);
          return;
        }
        const halfWidth = Math.min(280, window.innerWidth - 40) / 2;
        setPos({
          x: Math.max(
            halfWidth + 20,
            Math.min(
              rect.left + rect.width / 2,
              window.innerWidth - halfWidth - 20
            )
          ),
          y:
            rect.top > 70
              ? rect.top - 8
              : Math.min(rect.bottom + 62, window.innerHeight - 16),
          text,
        });
      } catch {
        setPos(null);
      }
    }

    // mouseup + touchend catch the end of a selection gesture; selectionchange
    // clears the pill when the selection collapses.
    document.addEventListener("mouseup", onSelection);
    document.addEventListener("touchend", onSelection);
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPos(null);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keyup", onSelection);
    return () => {
      document.removeEventListener("mouseup", onSelection);
      document.removeEventListener("touchend", onSelection);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keyup", onSelection);
    };
  }, []);

  if (!pos) return null;

  return (
    <button
      type="button"
      // preventDefault on mousedown keeps the text selection alive while clicking
      onMouseDown={e => e.preventDefault()}
      onClick={() => {
        track("highlight_ask", { length: pos.text.length });
        askNicAbout(pos.text);
        setPos(null);
      }}
      className="no-print pg-action-secondary fixed z-[46] w-[280px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-full gap-1.5 shadow-lg"
      style={{
        left: pos.x,
        top: pos.y,
      }}
      aria-label="Ask Nic about this"
    >
      <MessageCircle className="h-3.5 w-3.5" /> Explain this
    </button>
  );
}
