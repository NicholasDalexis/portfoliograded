import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPortfolioDraft, MAX_DRAFT_BYTES, type PortfolioDraft } from "../shared/portfolio";
import { loadPortfolioDraft, savePortfolioDraft, PORTFOLIO_STORAGE_KEY, type PortfolioStorage } from "../client/src/lib/portfolioStorage";
import { clearPortfolioRecovery, flushPortfolioDraft, loadPortfolioEditorState } from "../client/src/lib/portfolioRecovery";
function memory() {
  const map = new Map<string,string>();
  const api: PortfolioStorage = { getItem: key => map.get(key) ?? null, setItem: (key,value) => { map.set(key,value); }, removeItem: key => { map.delete(key); } };
  return api;
}
function original() { return { ...createEmptyPortfolioDraft(), name: "Saved name", email: "author@example.com" }; }
const denied = (base: PortfolioStorage): PortfolioStorage => ({ ...base, setItem() { throw new Error("QuotaExceededError"); } });
const json = (draft: PortfolioDraft) => JSON.stringify(draft);
beforeEach(() => clearPortfolioRecovery());

describe("in-tab recovery through navigation and Back", () => {
  it("restores the latest refused edit on route-style re-entry without claiming it is saved", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved, disk);
    const edited = { ...saved, name: "Work typed after storage filled", email: "unfinished@", revision: 2 };
    expect(flushPortfolioDraft(edited, json(saved), { storage: denied(disk) })).toMatchObject({ saved: false, retained: true });
    // Unmount drops all component state; a new editor initializes from the module slot.
    const reopened = loadPortfolioEditorState(disk);
    expect(reopened.draft).toEqual(edited); expect(reopened.recovered).toBe(true); expect(reopened.externalConflict).toBe(false);
    expect(reopened.error).toContain("not been saved"); expect(loadPortfolioDraft(disk)).toEqual(saved);
  });
  it("can reopen more than once without consuming the only unsaved copy", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved, disk);
    const edited = { ...saved, name: "Keep across multiple routes" };
    flushPortfolioDraft(edited, json(saved), { storage: denied(disk) });
    expect(loadPortfolioEditorState(disk).draft).toEqual(edited);
    expect(loadPortfolioEditorState(disk).draft).toEqual(edited);
  });
  it("retains an entirely new draft when its first browser write is refused", () => {
    const disk = memory(); const edited = { ...original(), name: "Brand-new unsaved portfolio" };
    flushPortfolioDraft(edited, "", { storage: denied(disk) });
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft: edited, recovered: true, externalConflict: false, savedJson: "" });
  });
  it("clears recovery after a successful write and returns a durable state", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk); const edited = { ...saved, name: "New name" };
    flushPortfolioDraft(edited, json(saved), { storage: denied(disk) });
    expect(flushPortfolioDraft(edited, json(saved), { storage: disk })).toMatchObject({ saved: true, retained: false });
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft: edited, recovered: false, externalConflict: false, error: "" });
  });
  it("clears recovery after an explicit reset instead of resurrecting the removed draft", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk);
    flushPortfolioDraft({ ...saved, name: "Unsaved" }, json(saved), { storage: denied(disk) });
    disk.removeItem(PORTFOLIO_STORAGE_KEY); clearPortfolioRecovery();
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft: null, recovered: false, externalConflict: false });
  });
  it("does not retain an unchanged draft or overwrite a later disk change", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk);
    const other = { ...saved, name: "Other tab's latest" }; savePortfolioDraft(other,disk);
    const write = vi.fn(disk.setItem);
    expect(flushPortfolioDraft(saved, json(saved), { storage: { ...disk, setItem: write } })).toMatchObject({ saved: true, retained: false });
    expect(write).not.toHaveBeenCalled(); expect(loadPortfolioEditorState(disk).draft).toEqual(other);
  });
  it("preserves unsaved work while identifying a changed stored version as a conflict", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk);
    const edited = { ...saved, name: "This tab's edit" }; flushPortfolioDraft(edited, json(saved), { storage: denied(disk) });
    const other = { ...saved, name: "Other tab's saved edit", revision: 3 }; savePortfolioDraft(other,disk);
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft: edited, externalConflict: true, recovered: true });
    expect(loadPortfolioDraft(disk)).toEqual(other);
  });
  it("identifies deletion elsewhere as a conflict instead of recreating a deleted portfolio", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk);
    const edited = { ...saved, name: "Local unsaved" }; flushPortfolioDraft(edited,json(saved),{storage:denied(disk)});
    disk.removeItem(PORTFOLIO_STORAGE_KEY);
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft: edited, externalConflict: true, recovered: true });
    expect(loadPortfolioDraft(disk)).toBeNull();
  });
  it("retains dirty state without writing when an existing conflict blocks the flush", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk);
    const edited = { ...saved, name: "Keep this unresolved draft" }; const write = vi.fn(disk.setItem);
    expect(flushPortfolioDraft(edited,json(saved),{storage:{...disk,setItem:write},blocked:true})).toMatchObject({ saved:false,retained:true });
    expect(write).not.toHaveBeenCalled(); expect(loadPortfolioEditorState(disk).draft).toEqual(edited);
  });
  it("pauses writes when the current disk version cannot be read", () => {
    const disk = memory(); const saved = original(); savePortfolioDraft(saved,disk); const edited={...saved,name:"In memory"};
    flushPortfolioDraft(edited,json(saved),{storage:denied(disk)});
    const blocked = { ...disk, getItem() { throw new Error("SecurityError"); } };
    expect(loadPortfolioEditorState(blocked)).toMatchObject({ draft:edited,recovered:true,externalConflict:true });
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft:edited,recovered:true,externalConflict:false });
  });
  it("does not silently overwrite a corrupted stored draft on recovery", () => {
    const disk = memory(); const saved=original(); savePortfolioDraft(saved,disk); const edited={...saved,name:"Local"};
    flushPortfolioDraft(edited,json(saved),{storage:denied(disk)});
    disk.setItem(PORTFOLIO_STORAGE_KEY,'{"corrupt":true}');
    expect(loadPortfolioEditorState(disk)).toMatchObject({ draft:edited,recovered:true,externalConflict:true });
    expect(disk.getItem(PORTFOLIO_STORAGE_KEY)).toBe('{"corrupt":true}');
  });
  it("recognizes the same recovered draft already saved by another path", () => {
    const disk=memory(); const saved=original(); savePortfolioDraft(saved,disk); const edited={...saved,name:"Now durable"};
    flushPortfolioDraft(edited,json(saved),{storage:denied(disk)}); savePortfolioDraft(edited,disk);
    expect(loadPortfolioEditorState(disk)).toMatchObject({draft:edited,recovered:false,externalConflict:false,error:""});
  });
  it("treats different property order as equivalent saved data", () => {
    const disk=memory(); const canonical=original();
    const {name,...rest}=canonical; const reordered={name,...rest}; savePortfolioDraft(reordered,disk);
    const edited={...reordered,name:"New name"}; flushPortfolioDraft(edited,json(reordered),{storage:denied(disk)});
    expect(loadPortfolioEditorState(disk)).toMatchObject({draft:edited,recovered:true,externalConflict:false});
  });
  it("keeps immutable copies rather than sharing references with the outgoing or reopened editor", () => {
    const disk=memory(); const saved=original(); savePortfolioDraft(saved,disk); const edited={...saved,name:"Retained"};
    flushPortfolioDraft(edited,json(saved),{storage:denied(disk)}); edited.name="Mutated after capture";
    const first=loadPortfolioEditorState(disk); expect(first.draft?.name).toBe("Retained"); first.draft!.name="Mutated consumer";
    expect(loadPortfolioEditorState(disk).draft?.name).toBe("Retained");
  });
  it("keeps only the latest recovery snapshot", () => {
    const disk=memory(); const saved=original(); savePortfolioDraft(saved,disk);
    flushPortfolioDraft({...saved,name:"First"},json(saved),{storage:denied(disk)});
    flushPortfolioDraft({...saved,name:"Latest"},json(saved),{storage:denied(disk)});
    expect(loadPortfolioEditorState(disk).draft?.name).toBe("Latest");
  });
  it("enforces a bounded snapshot and baseline instead of retaining arbitrary payloads", () => {
    const disk=memory(); const saved=original();
    expect(flushPortfolioDraft({...saved,bio:"x".repeat(MAX_DRAFT_BYTES+1)},"",{storage:denied(disk)})).toMatchObject({saved:false,retained:false});
    expect(loadPortfolioEditorState(disk).draft).toBeNull();
    expect(flushPortfolioDraft({...saved,name:"Edited"},"x".repeat(MAX_DRAFT_BYTES+1),{storage:denied(disk)})).toMatchObject({saved:false,retained:false});
  });
  it("loads a valid external draft directly when no in-tab work exists", () => {
    const disk=memory(); expect(loadPortfolioEditorState(disk).draft).toBeNull();
    const elsewhere=original(); savePortfolioDraft(elsewhere,disk);
    expect(loadPortfolioEditorState(disk)).toMatchObject({draft:elsewhere,recovered:false,externalConflict:false,error:""});
  });
  it("leaves inaccessible storage explicit when there is no recoverable draft", () => {
    const disk=memory(); const blocked={...disk,getItem(){throw new Error("SecurityError");}};
    expect(loadPortfolioEditorState(blocked)).toMatchObject({draft:null,recovered:false,externalConflict:false});
    expect(loadPortfolioEditorState(blocked).error).toContain("could not be read");
  });
});
