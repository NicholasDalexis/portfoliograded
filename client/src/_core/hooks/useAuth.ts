import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

/**
 * Thin wrapper over Clerk that also exposes our server-derived profile
 * (including Pro status). Sign-in/up and sign-out are handled by Clerk
 * components/hooks; this hook surfaces the combined state the app needs.
 */
export function useAuth() {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();

  // Our own profile (role, isPro) — only meaningful when signed in.
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: isLoaded && isSignedIn,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return useMemo(
    () => ({
      user: meQuery.data ?? null,
      clerkUser: clerkUser ?? null,
      loading: !isLoaded || meQuery.isLoading,
      isAuthenticated: Boolean(isSignedIn),
      isPro: meQuery.data?.isPro ?? false,
      refresh: () => meQuery.refetch(),
      logout,
    }),
    [meQuery.data, meQuery.isLoading, isLoaded, isSignedIn, clerkUser, logout, meQuery],
  );
}
