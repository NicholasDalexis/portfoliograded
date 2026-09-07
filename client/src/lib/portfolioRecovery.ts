import { MAX_DRAFT_BYTES, validateEditablePortfolioDraft, type PortfolioDraft } from "@shared/portfolio";
import { loadPortfolioDraft, savePortfolioDraft, type PortfolioStorage } from "./portfolioStorage";

type Recovery = { draft: PortfolioDraft; savedJson: string };
// One bounded draft per live tab, never a history or cross-tab/global store.
// Module state survives client-side routes and Back, but not a page reload.
let unsavedRecovery: Recovery | null = null;
const copy = (draft: PortfolioDraft) => validateEditablePortfolioDraft(draft);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Browser storage is unavailable.";

export function clearPortfolioRecovery(): void { unsavedRecovery = null; }

function rememberPortfolioRecovery(draft: PortfolioDraft, savedJson: string): void {
  if (typeof savedJson !== "string" || new TextEncoder().encode(savedJson).byteLength > MAX_DRAFT_BYTES) throw new Error("The saved-draft baseline is too large for in-tab recovery.");
  const baseline = savedJson ? JSON.stringify(copy(JSON.parse(savedJson))) : "";
  unsavedRecovery = { draft: copy(draft), savedJson: baseline };
}

export interface PortfolioEditorState {
  draft: PortfolioDraft | null;
  savedJson: string;
  recovered: boolean;
  externalConflict: boolean;
  error: string;
}

/** Recover this tab's work before considering a stored draft. Never overwrite
 * a disk change merely because an unsaved copy exists in this tab.
 */
export function loadPortfolioEditorState(storage?: PortfolioStorage): PortfolioEditorState {
  let disk: PortfolioDraft | null = null;
  let diskError = "";
  try { disk = loadPortfolioDraft(storage); } catch (error) { diskError = errorMessage(error); }
  const diskJson = disk ? JSON.stringify(disk) : "";
  if (!unsavedRecovery) return { draft: disk, savedJson: diskJson, recovered: false, externalConflict: false, error: diskError };
  const recovery = unsavedRecovery;
  const draft = copy(recovery.draft);
  if (!diskError && diskJson === JSON.stringify(draft)) {
    clearPortfolioRecovery();
    return { draft: disk, savedJson: diskJson, recovered: false, externalConflict: false, error: "" };
  }
  const externalConflict = Boolean(diskError || diskJson !== recovery.savedJson);
  return { draft, savedJson: recovery.savedJson, recovered: true, externalConflict,
    error: externalConflict
      ? diskError
        ? `Your unsaved draft was recovered in this tab. Stored data could not be checked, so saving is paused. ${diskError}`
        : "Your unsaved draft was recovered in this tab. The saved version changed elsewhere, so saving is paused until you choose which draft to keep."
      : "Your unsaved draft was recovered in this tab. It has not been saved in browser storage yet. Keep this tab open or download a backup.",
  };
}

/** Used by navigation/pagehide flushes. A refused write preserves one immutable
 * in-tab recovery snapshot; callers must not describe that as a durable save.
 */
export function flushPortfolioDraft(draft: PortfolioDraft, savedJson: string, options: { storage?: PortfolioStorage; blocked?: boolean } = {}): { saved: boolean; retained: boolean; error: string } {
  if (JSON.stringify(draft) === savedJson) {
    clearPortfolioRecovery();
    return { saved: true, retained: false, error: "" };
  }
  let error = options.blocked ? "Resolve the saved-draft conflict before saving." : "";
  if (!options.blocked) {
    try {
      savePortfolioDraft(draft, options.storage);
      clearPortfolioRecovery();
      return { saved: true, retained: false, error: "" };
    } catch (failure) { error = errorMessage(failure); }
  }
  try {
    rememberPortfolioRecovery(draft, savedJson);
    return { saved: false, retained: true, error };
  } catch (failure) {
    return { saved: false, retained: false, error: `${error} ${errorMessage(failure)}`.trim() };
  }
}
