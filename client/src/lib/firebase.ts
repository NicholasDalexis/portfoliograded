/*
 * Firebase client — Google sign-in for portfolio graded.
 * This config is PUBLIC by design (Firebase web config identifies the
 * project; security lives in server-side token verification + Firestore
 * rules, which deny all client access). No secrets here.
 */
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2TyJAPhoY6SOxyiyhbq94tszZx-JKQC0",
  authDomain: "portfolio-graded.firebaseapp.com",
  projectId: "portfolio-graded",
  storageBucket: "portfolio-graded.firebasestorage.app",
  messagingSenderId: "1080347086396",
  appId: "1:1080347086396:web:a94122b5d4f32786c0bd39",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/** Authorization header for API calls; {} when signed out. */
export async function getAuthHeader(): Promise<Record<string, string>> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  if (!token || auth.currentUser?.uid !== user.uid) throw new Error("Sign-in could not be verified. Please try again.");
  return { Authorization: `Bearer ${token}` };
}
