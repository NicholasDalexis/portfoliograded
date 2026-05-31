import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Audit from "./pages/Audit";
import Pricing from "./pages/Pricing";
import Method from "./pages/Method";
import Profile from "./pages/Profile";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/audit"} component={Audit} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/method"} component={Method} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
