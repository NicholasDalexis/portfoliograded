import {
  MAX_IMAGE_BYTES, importPortfolioJSON, serializePortfolioDraft, exportPortfolioHTML,
  isSafePortfolioImage, type PortfolioDraft, type PortfolioImage,
} from "../../../shared/portfolio";

export const PORTFOLIO_STORAGE_KEY = "pg-builder-draft-v1";
export interface PortfolioStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
export class PortfolioStorageError extends Error {
  constructor(message: string) { super(message); this.name = "PortfolioStorageError"; }
}
function browserStorage(): PortfolioStorage {
  try { return window.localStorage; } catch { throw new PortfolioStorageError("Browser storage is unavailable. Keep this page open and download a JSON backup."); }
}
export function loadPortfolioDraft(storage?: PortfolioStorage): PortfolioDraft | null {
  let json: string | null;
  try { json = (storage ?? browserStorage()).getItem(PORTFOLIO_STORAGE_KEY); }
  catch { throw new PortfolioStorageError("Your saved draft could not be read. It has not been overwritten."); }
  if (json === null) return null;
  try { return importPortfolioJSON(json); }
  catch { throw new PortfolioStorageError("Your saved draft could not be validated. It has not been overwritten. Import a valid JSON backup or explicitly start a new draft."); }
}
/** Saves exactly this revision. The editor owns revision increments and undo. */
export function savePortfolioDraft(draft: PortfolioDraft, storage?: PortfolioStorage): void {
  const json = serializePortfolioDraft(draft);
  try { (storage ?? browserStorage()).setItem(PORTFOLIO_STORAGE_KEY, json); }
  catch { throw new PortfolioStorageError("This draft could not be saved in your browser. Download a JSON backup, then reduce image sizes or free browser storage."); }
}
/** Call only after the user explicitly chooses to replace/remove their local draft. */
export function clearPortfolioDraft(storage?: PortfolioStorage): void {
  try { (storage ?? browserStorage()).removeItem(PORTFOLIO_STORAGE_KEY); }
  catch { throw new PortfolioStorageError("The saved draft could not be removed. Your existing data was left in place."); }
}
function filename(draft: PortfolioDraft, extension: string): string {
  const name = draft.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "portfolio";
  return `${name.toLowerCase()}-r${draft.revision}.${extension}`;
}
function download(content: string, name: string, type: string): void {
  let url: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  try {
    url = URL.createObjectURL(new Blob([content], { type }));
    anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
    anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click();
  } catch { throw new PortfolioStorageError("The download could not be started. Your draft is still in this page; try a browser that supports file downloads."); }
  finally {
    anchor?.remove();
    if (url) { const finishedURL = url; setTimeout(() => URL.revokeObjectURL(finishedURL), 1000); }
  }
}
export function downloadPortfolioJSON(draft: PortfolioDraft): void {
  download(serializePortfolioDraft(draft), filename(draft, "json"), "application/json;charset=utf-8");
}
export function downloadPortfolioHTML(draft: PortfolioDraft): void {
  download(exportPortfolioHTML(draft), filename(draft, "html"), "text/html;charset=utf-8");
}

const INPUT_IMAGE_LIMIT = 15 * 1024 * 1024;
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image compression failed.")), type, quality));
}
function blobDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image conversion failed."));
    reader.onerror = () => reject(new Error("Image conversion failed.")); reader.readAsDataURL(blob);
  });
}
/** Decodes and re-encodes locally; no upload, remote URL, SVG, or metadata passthrough. */
export async function compressPortfolioImage(file: File, options: { maxDimension?: number; targetBytes?: number } = {}): Promise<PortfolioImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new PortfolioStorageError("Choose a JPEG, PNG, or WebP image. SVG and animated formats are not supported.");
  if (!file.size || file.size > INPUT_IMAGE_LIMIT) throw new PortfolioStorageError("Choose an image smaller than 15 MB.");
  const maxDimension = Math.min(2000, Math.max(320, Number.isFinite(options.maxDimension) ? options.maxDimension! : 1600));
  const targetBytes = Math.min(MAX_IMAGE_BYTES, Math.max(32 * 1024, Number.isFinite(options.targetBytes) ? options.targetBytes! : 220 * 1024));
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50_000_000) throw new Error("Image dimensions are too large.");
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image editing is unavailable in this browser.");
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.72, 0.58]) {
        let blob = await canvasBlob(canvas, "image/webp", quality);
        if (blob.type !== "image/webp") {
          context.fillStyle = "#fbf8f1"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          blob = await canvasBlob(canvas, "image/jpeg", quality);
        }
        if (blob.size <= targetBytes) {
          const src = await blobDataURL(blob);
          if (!isSafePortfolioImage(src)) throw new Error("The converted image format is unsupported.");
          return { src, alt: "" };
        }
      }
      scale *= 0.75;
    }
    throw new Error("The image could not be reduced enough. Choose a smaller image.");
  } catch (error) {
    throw new PortfolioStorageError(error instanceof Error ? error.message : "This image could not be read. Try a different JPEG, PNG, or WebP file.");
  } finally { bitmap?.close(); }
}
