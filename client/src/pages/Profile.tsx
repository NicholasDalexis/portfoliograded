/*
 * Profile — signed-in dashboard.
 * Shows Pro status, a "manage billing" action for Pro users, and the user's
 * saved audit history (from the audit.history endpoint).
 */
import { useLocation } from "wouter";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { Sparkles, ExternalLink, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GradePill } from "@/components/GradePill";
import { useAuth } from "@/_core/hooks/useAuth";
import { useUpgrade } from "@/lib/useUpgrade";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { GradeLetter } from "@/lib/audit";

function ProfileInner() {
  const [, navigate] = useLocation();
  const { user, isPro } = useAuth();
  const { startUpgrade } = useUpgrade();
  const historyQuery = trpc.audit.history.useQuery();
  const portal = trpc.billing.createPortal.useMutation();

  function manageBilling() {
    portal.mutate(undefined, {
      onSuccess: ({ url }) => { window.location.href = url; },
      onError: (e) => toast.error("Couldn't open billing", { description: e.message }),
    });
  }

  return (
    <div className="sunlit-bg min-h-screen">
      <SiteHeader onUpgrade={() => navigate("/pricing")} />
      <main className="container py-12 sm:py-16">
        <div className="glass rounded-[1.75rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold">{user?.name || "Your profile"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {isPro ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.92_0.08_85)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[oklch(0.35_0.08_60)]">
                    <Sparkles className="h-3.5 w-3.5" /> Pro
                  </span>
                  <button
                    type="button"
                    onClick={manageBilling}
                    className="rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm font-semibold transition hover:bg-white"
                  >
                    Manage billing
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startUpgrade()}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[oklch(0.2_0.04_50)]"
                  style={{
                    background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
                    boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 10px 24px -12px oklch(0.7 0.16 65 / 0.55)",
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl font-bold">Your scan history</h2>
          </div>

          {historyQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading your audits…</p>
          ) : (historyQuery.data?.length ?? 0) === 0 ? (
            <div className="glass mt-4 rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No audits yet.</p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 rounded-full bg-[oklch(0.2_0.02_60)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[oklch(0.28_0.02_60)]"
              >
                Run your first audit
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {historyQuery.data!.map((a) => (
                <div key={a.id} className="glass flex items-center justify-between gap-4 rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <GradePill grade={a.overallGrade as GradeLetter} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.role} · {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={a.url.startsWith("http") ? a.url : `https://${a.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    Visit <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function Profile() {
  return (
    <>
      <SignedIn>
        <ProfileInner />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
