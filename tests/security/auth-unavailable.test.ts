import { expect, it, vi } from "vitest";
import { optionalAuth, requireAuth } from "@server/lib/firebaseAdmin.js";

it("does not downgrade supplied credentials when the auth provider is unavailable", async () => {
  // Security setup points at an absent fixture key and removes real credentials.
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;
  const next = vi.fn(), anonymous = response();
  await optionalAuth({ headers: {} } as any, anonymous, next);
  expect(next).toHaveBeenCalledTimes(1); expect(anonymous.status).not.toHaveBeenCalled();
  for (const middleware of [optionalAuth, requireAuth]) {
    const res = response(), continuation = vi.fn(), req = { headers: { authorization: "Bearer fixture-token" }, user: { uid: "stale" } } as any;
    await middleware(req, res, continuation);
    expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith({ error: "auth_unavailable" });
    expect(req.user).toBeUndefined(); expect(continuation).not.toHaveBeenCalled();
  }
});
