import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main id="main-content" className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
          <section className="glass-strong w-full max-w-2xl rounded-[2rem] p-6 sm:p-10" aria-labelledby="page-error-title">
            <AlertTriangle
              aria-hidden
              size={28}
              className="mb-5 text-amber-900"
            />

            <p className="pg-brand-eyebrow">Portfolio Graded</p>
            <h1 id="page-error-title" className="pg-page-title mt-4">This page couldn't open.</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">Try reloading the page. If it still won't open, return to grading and choose your next step.</p>
            <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="pg-action"
            >
              <RotateCcw aria-hidden size={16} />
              Reload page
            </button>
            <a href="/" className="pg-action-secondary">Back to grading</a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
