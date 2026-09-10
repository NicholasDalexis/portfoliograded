import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { auth, subscribeAuth } from "@/lib/firebase";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EmailPreferences } from "@/components/EmailPreferences";
import { SignInDialog } from "@/components/SignInDialog";

export default function Account() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeAuth(value => { setUser(value); setReady(true); }), []);
  return <div className="min-h-screen bg-background"><SiteHeader />
    <main id="main-content" tabIndex={-1} className="container max-w-3xl py-12 sm:py-16">
      <p className="pg-brand-eyebrow">Your preferences</p>
      <h1 className="pg-page-title mt-3">Your account</h1>
      {!ready ? <p role="status" className="mt-5">Checking sign-in…</p> : user ? <>
        <p className="mb-7 mt-4 break-all text-sm text-muted-foreground">Signed in as {user.email ?? user.displayName ?? "you"}.</p>
        <EmailPreferences key={user.uid} uid={user.uid} />
      </> : <div className="glass mt-7 rounded-[2rem] p-6 sm:p-7"><p className="text-sm leading-relaxed">Sign in to manage your optional email preference. The free grader is available without an account.</p><button type="button" onClick={() => setOpen(true)} className="pg-action mt-5 w-full sm:w-auto">Sign in</button></div>}
    </main><SiteFooter /><SignInDialog open={open} onOpenChange={setOpen} />
  </div>;
}
