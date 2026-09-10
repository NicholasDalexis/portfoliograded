import type { RefObject } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SubmissionNotice({ open, onOpenChange, returnFocusRef }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocusRef?: RefObject<HTMLButtonElement | null> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onCloseAutoFocus={event => { if (returnFocusRef?.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); } }} className="max-h-[90dvh] overflow-y-auto rounded-[2rem] border-white/80 bg-background p-6 sm:max-w-xl sm:p-8">
      <DialogHeader className="pr-8 text-left">
        <DialogTitle className="font-display text-3xl font-bold">How we use submissions</DialogTitle>
        <DialogDescription className="mt-2 text-sm">The short version.</DialogDescription>
      </DialogHeader>
      <ul className="space-y-3 text-sm leading-relaxed text-foreground">
        <li><strong>Your work, or permission.</strong> Only submit a portfolio you own or have the right to have reviewed.</li>
        <li><strong>We save the review.</strong> Your link, role, optional builder answer, available screenshots, feedback and checklist help you return to your report. Reports belong to your account or this browser.</li>
        <li><strong>Nic may review submissions privately</strong> to improve the grading guidelines. We ask separately before featuring your portfolio publicly.</li>
        <li><strong>No automatic model training.</strong> Submitting does not give consent to train a model. We don’t sell your data.</li>
      </ul>
      <div className="flex flex-wrap gap-x-5 border-t border-foreground/10 pt-2 text-sm font-semibold">
        <Link href="/privacy#how-we-use-it" className="inline-flex min-h-11 items-center underline underline-offset-4">Full privacy policy</Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4">Terms of service</Link>
      </div>
    </DialogContent>
  </Dialog>;
}
