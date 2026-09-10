import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogIn, LogOut, ArrowUpRight, History, Mail } from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { auth, signOut, subscribeAuth } from "@/lib/firebase";
import { SignInDialog } from "./SignInDialog";
import { cn } from "@/lib/utils";
import { UpgradeDialog } from "./UpgradeDialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "./ui/dropdown-menu";

const NAV = [{ href: "/", label: "Grading" }, { href: "/how-to", label: "How to" }];

export function SiteHeader({ onUpgrade }: { onUpgrade?: () => void }) {
  const [location] = useLocation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [user?.photoURL]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => subscribeAuth(value => { setUser(value); setAuthReady(true); }), []);
  const active = (href: string) => href === "/" ? location === "/" || location === "/audit" : href === "/how-to" ? location === "/how-to" || location === "/method" : false;

  const accountContent = <>{user?.photoURL && !photoFailed ? <img src={user.photoURL} onError={() => setPhotoFailed(true)} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" /> : <LogIn className="h-4 w-4" />}<span className="hidden sm:inline">{user ? (user.displayName?.split(" ")[0] ?? "Account") : "Sign in"}</span></>;
  const accountClass = "pg-action-secondary min-h-11 min-w-11 gap-1.5 px-2 py-2 text-sm sm:px-3";
  const navLinks = <>{NAV.map(item => <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={cn("inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-700 sm:text-sm", active(item.href) ? "bg-amber-100/70 text-foreground" : "text-muted-foreground hover:bg-white/70 hover:text-foreground")}>{item.label}</Link>)}<a href="https://stillunemployed.com/" target="_blank" rel="noopener noreferrer" aria-label="Find Jobs on Still Unemployed (opens in a new tab)" className="inline-flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-amber-700 sm:text-sm">Find Jobs <ArrowUpRight aria-hidden className="h-3.5 w-3.5" /></a></>;

  return <>
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded-xl bg-white px-4 py-3 font-semibold focus:not-sr-only">Skip to content</a>
    <header className="sticky top-0 z-40">
      <div className="container pt-4">
        <div className="glass flex items-center justify-between gap-1 rounded-full px-2.5 py-2 sm:px-5 sm:py-3">
          <Link href="/" aria-label="Portfolio Graded home" className="flex min-h-11 shrink-0 items-center gap-1.5 sm:gap-2.5">
            <span aria-hidden className="grad-flowerboy block h-5 w-5 rounded-full ring-1 ring-white/70 sm:h-6 sm:w-6" />
            <span className="whitespace-nowrap font-display text-sm font-bold tracking-tight sm:text-lg">portfolio <span className="grad-text">graded</span></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">{navLinks}</nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {user ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={`Account: ${user.displayName ?? user.email ?? "signed in"}`} className={accountClass}>{accountContent}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 border-amber-900/15 bg-[#fffaf0] p-2"><DropdownMenuLabel className="break-words">Signed in as {user.displayName ?? "you"}<span className="mt-1 block break-all text-xs font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/reports" className="min-h-11"><History className="mr-2 h-4 w-4" />My reports</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/account" className="min-h-11"><Mail className="mr-2 h-4 w-4" />Email preferences</Link></DropdownMenuItem><DropdownMenuItem onSelect={() => { void signOut().then(() => toast.success("Signed out")).catch(() => toast.error("Could not sign out. Please try again.")); }} className="pg-action-secondary mt-1 min-h-11 w-full justify-center rounded-full font-semibold"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <button type="button" onClick={() => setSignInOpen(true)} disabled={!authReady} aria-haspopup="dialog" aria-label={!authReady ? "Checking sign-in" : "Sign in"} className={accountClass}>{accountContent}</button>}
            <button type="button" onClick={onUpgrade ?? (() => setUpgradeOpen(true))} aria-haspopup="dialog" className="pg-action-secondary pg-action-primary min-h-11 shrink-0 gap-1 whitespace-nowrap px-2.5 py-2 text-xs sm:px-4 sm:text-sm">Go Pro <span aria-hidden>★</span></button>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="mt-2 flex justify-center gap-1 rounded-full bg-white/85 px-1 lg:hidden">{navLinks}</nav>
      </div>
    </header>
    <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
  </>;
}
