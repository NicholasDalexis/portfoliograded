import { publicProcedure, router } from "./trpc";

export const systemRouter = router({
  /** Liveness probe used by Railway's healthcheck. */
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),
});
