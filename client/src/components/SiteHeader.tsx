/*
 * Sunlit Glass — Site Header
 * Frosted glass bar: wordmark left, nav center, auth + Go Pro right.
 * Auth uses Clerk: signed-out shows "Sign in", signed-in shows a Profile link
 * and the Clerk UserButton.
 */
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

interface Props {
  onUpgrade?: () => void;
}

export function SiteHeader({ onUpgrade }: Props) {
  const [location] = useLocation();
  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 transition",
        location === href ? "bg-white/70 text-foreground" : "hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40">
      <div className="container pt-4">
        <div className="glass flex items-center justify-between rounded-full px-4 py-2.5 sm:px-5 sm:py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grad-flowerboy block h-6 w-6 rounded-full ring-1 ring-white/70"
              style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.7), 0 4px 12px -6px oklch(0.7 0.16 65 / 0.6)" }}
            />
            <span className="font-display text-lg font-bold tracking-tight">
              portfolio<span className="grad-text">graded</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-semibold text-muted-foreground sm:flex">
            {navLink("/", "Home")}
            {navLink("/pricing", "Pricing")}
            {navLink("/method", "Method")}
            <SignedIn>{navLink("/profile", "Profile")}</SignedIn>
          </nav>

          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>

            <button
              type="button"
              onClick={onUpgrade}
              className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[oklch(0.2_0.04_50)] transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.9 0.13 80), oklch(0.92 0.11 95))",
                boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.85), 0 10px 24px -12px oklch(0.7 0.16 65 / 0.55)",
              }}
            >
              <span className="relative z-10">Go Pro</span>
              <span aria-hidden className="relative z-10 text-xs font-bold opacity-70">★</span>
            </button>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
