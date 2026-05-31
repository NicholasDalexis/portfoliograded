/*
 * useUpgrade — single source of truth for the "Go Pro" action.
 * Signed-in users are sent to a real Stripe Checkout session; signed-out users
 * are nudged to sign in first (Clerk modal is wired at the call site).
 */
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useUpgrade() {
  const { isSignedIn } = useClerkAuth();
  const checkout = trpc.billing.createCheckout.useMutation();

  async function startUpgrade() {
    if (!isSignedIn) {
      toast.message("Sign in to upgrade", {
        description: "Create a free account first, then unlock Pro.",
      });
      return false;
    }
    try {
      const { url } = await checkout.mutateAsync();
      window.location.href = url;
      return true;
    } catch (e) {
      toast.error("Couldn't start checkout", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
      return false;
    }
  }

  return { startUpgrade, upgrading: checkout.isPending };
}
