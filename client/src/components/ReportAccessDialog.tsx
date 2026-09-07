import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Free report access only. It does not enroll anyone in marketing or billing. */
export function ReportAccessDialog({
  open,
  onOpenChange,
  busy,
  error,
  onContinue,
  signedIn,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string;
  onContinue: () => void;
  signedIn: boolean;
  onReturnFocus?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={event => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
        }}
        className="max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/80 bg-background p-6 sm:max-w-md sm:p-8"
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="font-display text-3xl font-bold leading-tight">
            Read your full feedback. It's free.
          </DialogTitle>
          <DialogDescription className="mt-3 text-base leading-relaxed">
            Sign in with Google to open this category and keep this report with
            your account.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          className="pg-action mt-2 w-full"
          disabled={busy}
          onClick={onContinue}
        >
          {busy
            ? "Opening your feedback…"
            : signedIn
              ? "Continue to my feedback"
              : "Continue with Google"}
        </button>
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            Opening your saved report. No new grading run.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-amber-900/20 bg-accent p-4 text-sm leading-relaxed"
          >
            {error}
          </p>
        )}
        <p className="text-center text-sm font-semibold">
          No payment required.
        </p>
        <button
          type="button"
          className="pg-action-secondary w-full"
          onClick={() => onOpenChange(false)}
        >
          Not now
        </button>
      </DialogContent>
    </Dialog>
  );
}
