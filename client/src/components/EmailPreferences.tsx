import { useEffect, useRef, useState } from "react";
import { type AccountPreferences, MARKETING_CONSENT_TEXT } from "@shared/accountPreferences";
import { loadAccountPreferences, saveAccountPreferences, PreferenceRequestError } from "@/lib/accountPreferences";
import { auth } from "@/lib/firebase";

export function EmailPreferences({ uid }: { uid: string }) {
  const [saved, setSaved] = useState<AccountPreferences | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reload, setReload] = useState(0);
  const [conflict, setConflict] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setSaved(null); setError(""); setStatus(""); setConflict(false); setChecked(false); setBusy(false);
    void loadAccountPreferences(uid).then((value) => { if (generation.current === current) { setSaved(value); setChecked(value.marketingEmails); } }).catch(() => { if (generation.current === current) setError("Your email preference could not be loaded. Try again before changing it."); }).finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current++; };
  }, [uid, reload]);

  async function save() {
    if (!saved || busy || conflict) return;
    const current = generation.current;
    setBusy(true); setError(""); setStatus("");
    try {
      const value = await saveAccountPreferences(uid, checked, saved.revision);
      if (generation.current !== current || auth.currentUser?.uid !== uid) return;
      setSaved(value); setChecked(value.marketingEmails);
      setStatus(value.marketingEmails ? "Your optional email preference is saved. Email delivery is not connected in this preview." : "Your preference is saved. You have opted out of marketing emails.");
    } catch (err) {
      if (generation.current !== current) return;
      setConflict(err instanceof PreferenceRequestError && err.code === "preference_conflict");
      setError(err instanceof Error ? err.message : "Your preference was not saved. Please try again.");
    } finally { if (generation.current === current) setBusy(false); }
  }
  return <section aria-labelledby="email-preferences-heading" className="glass rounded-[2rem] p-6 sm:p-7">
    <h2 id="email-preferences-heading" className="font-display text-2xl font-bold">Email preferences</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Optional portfolio tips and updates about Portfolio Graded. Signing in and using the grader never requires marketing emails.</p>
    {loading ? <p className="mt-5 text-sm" role="status">Loading your preference…</p> : saved && <>
      <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 bg-white/70 p-4 text-sm leading-relaxed">
        <input type="checkbox" checked={checked} disabled={busy || conflict || (!saved.emailVerified && !checked)} onChange={event => { setChecked(event.target.checked); setStatus(""); }} className="mt-1 h-4 w-4 shrink-0 accent-amber-800" />
        <span>{MARKETING_CONSENT_TEXT} <span className="font-semibold">(Optional)</span></span>
      </label>
      {!saved.emailVerified && <p className="mt-3 text-sm text-muted-foreground">A verified account email is needed to opt in. You can still withdraw an existing preference.</p>}
      <button type="button" disabled={busy || conflict || checked === saved.marketingEmails} onClick={() => void save()} className="pg-action mt-5 w-full sm:w-auto">{busy ? "Saving…" : "Save preference"}</button>
    </>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="pg-action-secondary mt-2">Reload preference</button></div>}
    {status && <p role="status" className="mt-4 text-sm font-medium text-foreground">{status}</p>}
    <p className="mt-5 text-sm leading-relaxed text-muted-foreground">This choice is separate from permission to feature a portfolio, saved reports, and account messages. Email delivery is not connected in this preview. You can change this preference here at any time.</p>
  </section>;
}
