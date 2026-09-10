import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  currentUser: null as null | {
    uid: string;
    getIdToken: () => Promise<string>;
  },
  authStateReady: vi.fn(async () => {}),
}));
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => state,
  GoogleAuthProvider: class {},
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
import { getAuthHeader } from "@/lib/firebase";

beforeEach(() => {
  state.currentUser = null;
  state.authStateReady.mockReset().mockResolvedValue();
});
describe("client authorization fails closed for signed-in requests", () => {
  it("allows an intentional signed-out request to use browser guest access", async () => {
    await expect(getAuthHeader()).resolves.toEqual({});
    expect(state.authStateReady).toHaveBeenCalledOnce();
  });
  it("returns the verified current account token", async () => {
    state.currentUser = {
      uid: "one",
      getIdToken: async () => "synthetic-token",
    };
    await expect(getAuthHeader()).resolves.toEqual({
      Authorization: "Bearer synthetic-token",
    });
  });
  it("rejects a token refresh error instead of falling back to guest access", async () => {
    state.currentUser = {
      uid: "one",
      getIdToken: async () => {
        throw new Error("refresh failed");
      },
    };
    await expect(getAuthHeader()).rejects.toThrow("refresh failed");
  });
  it("rejects empty tokens and account changes while a token is resolving", async () => {
    state.currentUser = { uid: "one", getIdToken: async () => "" };
    await expect(getAuthHeader()).rejects.toThrow("could not be verified");
    state.currentUser = {
      uid: "one",
      getIdToken: async () => {
        state.currentUser = { uid: "two", getIdToken: async () => "two-token" };
        return "one-token";
      },
    };
    await expect(getAuthHeader()).rejects.toThrow("could not be verified");
  });
});
