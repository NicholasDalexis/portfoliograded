import Account from "@/pages/Account";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Audit from "./pages/Audit";
import Pricing from "./pages/Pricing";
import HowTo from "./pages/HowTo";
import Reports from "./pages/Reports";
const Builder = lazy(() => import("./pages/Builder"));
const PortfolioPreview = lazy(() => import("./pages/PortfolioPreview"));
import Admin from "./pages/Admin";
import { Terms, Privacy } from "./pages/Legal";
import { AskNic } from "./components/AskNic";
import { RouteScroll } from "./components/RouteScroll";
import { HighlightAsk } from "./components/HighlightAsk";

function Router() {
  return (
    <Suspense fallback={<main id="main-content" className="flex min-h-screen items-center justify-center bg-background px-5 py-12"><div className="glass-strong w-full max-w-lg rounded-[2rem] p-8" role="status"><p className="pg-brand-eyebrow">Portfolio Graded</p><p className="mt-4 font-display text-2xl font-bold">Opening your page…</p></div></main>}><Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/audit"} component={Audit} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/account"} component={Account} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/how-to"} component={HowTo} />
      <Route path={"/method"} component={HowTo} />
      <Route path={"/build"} component={Builder} />
      <Route path={"/builder"} component={Builder} />
      <Route path={"/portfolio/local/:id"} component={PortfolioPreview} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch></Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast:
                  "!bg-white/80 !backdrop-blur-xl !border !border-white/70 !shadow-[0_30px_60px_-30px_rgba(0,0,0,0.18)]",
              },
            }}
          />
          <RouteScroll />
          <Router />
          <AskNic />
          <HighlightAsk />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
