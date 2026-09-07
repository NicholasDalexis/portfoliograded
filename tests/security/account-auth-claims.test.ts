import { afterAll, expect, test, vi } from "vitest";
const fixtures = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: () => ({ name: "test" }), cert: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: fixtures.verifyIdToken }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({}) }));
import { verifyBearer } from "@server/lib/firebaseAdmin";
vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", JSON.stringify({ project_id: "test-project", client_email: "test@example.test", private_key: "not-a-real-key" }));
afterAll(() => vi.unstubAllEnvs());
const req = { headers: { authorization: "Bearer fixture-token" } } as any;

test("only the verified Firebase boolean claim grants email verification", async () => {
  for (const claim of [undefined, false, "true", 1, null, true]) {
    fixtures.verifyIdToken.mockResolvedValue({ uid: "alice", email: "alice@example.test", email_verified: claim });
    expect((await verifyBearer(req))?.emailVerified).toBe(claim === true);
  }
});
test("forged claims outside a verified token cannot provide an identity", async () => {
  fixtures.verifyIdToken.mockRejectedValue(new Error("signature invalid")); expect(await verifyBearer(req)).toBeNull();
  expect(await verifyBearer({ headers: { email_verified: true } } as any)).toBeNull();
});
