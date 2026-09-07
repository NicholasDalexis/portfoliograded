import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
const MAX_IMAGE_BYTES = 6_000_000;
const MAX_ARCHIVE_BYTES = 128_000_000;
const MAX_ARCHIVE_FILES = 512;
const REF = /^[a-f0-9]{64}\.jpg$/;
function directory() { return path.join(process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data"), "rendered-images-v1"); }
/** Content-addressed and private. Old refs may expire under the bounded retention policy. */
export function archiveShot(buf: Buffer): string | undefined {
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return undefined;
  const ref = `${createHash("sha256").update(buf).digest("hex")}.jpg`;
  const dir = directory();
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const target = path.join(dir, ref);
    try { writeFileSync(target, buf, { flag: "wx", mode: 0o600 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const files = readdirSync(dir).filter(name => REF.test(name)).map(name => ({ name, ...statSync(path.join(dir,name)) })).sort((a,b) => a.mtimeMs-b.mtimeMs);
    let bytes = files.reduce((total,item) => total + item.size, 0), count = files.length;
    for (const file of files) {
      if (count <= MAX_ARCHIVE_FILES && bytes <= MAX_ARCHIVE_BYTES) break;
      if (file.name === ref) continue;
      unlinkSync(path.join(dir,file.name)); bytes -= file.size; count--;
    }
    return ref;
  } catch { return undefined; }
}
/** Caller must first authorize the containing audit and choose its own stored ref. */
export function getArchivedShot(ref: string): Buffer | null {
  if (!REF.test(ref)) return null;
  try {
    const target = path.join(directory(), ref);
    if (statSync(target).size > MAX_IMAGE_BYTES) return null;
    const buf = readFileSync(target);
    return `${createHash("sha256").update(buf).digest("hex")}.jpg` === ref ? buf : null;
  } catch { return null; }
}
