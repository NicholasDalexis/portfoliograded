import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { auth, signInWithGoogle } from "@/lib/firebase";
import { loadAccountPreferences, saveAccountPreferences } from "@/lib/accountPreferences";
import { MARKETING_CONSENT_TEXT } from "@shared/accountPreferences";
import { track } from "@/lib/track";

/** Google is live; email-provider setup is a separate release prerequisite. No emails are sent here. */
export function SignInDialog({ open, onOpenChange, returnFocusRef }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocusRef?: { readonly current: HTMLElement | null } }) {
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; if (open) { setMarketing(false); setBusy(false); setError(""); setSignedIn(false); } return () => { generation.current++; }; }, [open]);
  async function google() {
    if (busy) return;
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const user = await signInWithGoogle();
      track("signed_in", {});
      if (generation.current !== current) return;
      setSignedIn(true);
      if (marketing) {
        try {
          const latest = await loadAccountPreferences(user.uid);
          await saveAccountPreferences(user.uid, true, latest.revision);
        } catch {
          if (generation.current === current && auth.currentUser?.uid === user.uid) setError("You are signed in, but your email preference was not saved. You can try again from Account → Email preferences.");
          return;
        }
      }
      if (generation.current === current) onOpenChange(false);
    } catch (err) {
      if (generation.current === current && (err as {code?:string}).code !== "auth/popup-closed-by-user") setError("Google sign-in could not finish. Please try again. Email sign-in is not available yet.");
    } finally { if (generation.current === current) setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      onCloseAutoFocus={returnFocusRef ? event => {
        if (returnFocusRef.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      } : undefined}
      className="max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/80 bg-background p-6 sm:max-w-md sm:p-8">
      <DialogHeader className="pr-6 text-left"><DialogTitle className="font-display text-3xl font-bold">Keep your progress.</DialogTitle><DialogDescription className="mt-3 text-sm leading-relaxed">Sign in before grading to keep new reports with your account. Continue with Google below.</DialogDescription></DialogHeader>
      {!signedIn && <>
        <button type="button" onClick={() => void google()} disabled={busy} className="pg-action mt-3 w-full">{busy ? "Opening Google…" : "Continue with Google"}</button>
        <label className="mt-1 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-amber-900/15 bg-white/70 p-4 text-sm leading-relaxed"><input type="checkbox" checked={marketing} disabled={busy} onChange={event => setMarketing(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-800" /><span>{MARKETING_CONSENT_TEXT} <span className="font-semibold">(Optional)</span></span></label>
        <p className="text-sm leading-relaxed text-muted-foreground">Email delivery is not connected yet. Leave this unchecked to sign in without adding a marketing preference. This choice does not give permission to feature your portfolio.</p>
      </>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {signedIn ? <button type="button" onClick={() => onOpenChange(false)} className="pg-action-secondary">Continue to the grader</button> : <p className="border-t border-amber-900/10 pt-4 text-sm leading-relaxed text-muted-foreground">Don't use Google? Email sign-in is being prepared. You can keep using the free grader without an account.</p>}
    </DialogContent>
  </Dialog>;
}
