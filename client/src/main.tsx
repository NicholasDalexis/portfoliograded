import { trpc } from "@/lib/trpc";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!CLERK_PUBLISHABLE_KEY) {
  console.error("[Clerk] VITE_CLERK_PUBLISHABLE_KEY is not set");
}

/**
 * Wires the tRPC client so every request carries the current Clerk session
 * token as a Bearer header. `getToken` is read at request time, so tokens stay
 * fresh as Clerk rotates them.
 */
function ApiProviders({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const queryClient = useMemo(() => new QueryClient(), []);

  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
            async fetch(input, init) {
              const token = await getToken();
              const headers = new Headers(init?.headers);
              if (token) headers.set("Authorization", `Bearer ${token}`);
              return globalThis.fetch(input, { ...(init ?? {}), headers, credentials: "include" });
            },
          }),
        ],
      }),
    [getToken],
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <ApiProviders>
      <App />
    </ApiProviders>
  </ClerkProvider>,
);
