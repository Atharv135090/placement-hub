import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../config/firebase";

export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      sessionStorage.setItem("ph_just_logged_in", "true");
    }
    return { user: result.user, error: null };
  } catch (error) {
    console.error("Google sign-in error:", error);
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      return { user: null, error: null };
    }
    if (error.code === "auth/popup-blocked") {
      return { user: null, error: "Pop-up was blocked by the browser. Please allow pop-ups for this site and try again." };
    }
    return { user: null, error: error.message || "Google sign-in failed. Please try again." };
  }
}

export async function signInWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user) {
      sessionStorage.setItem("ph_just_logged_in", "true");
    }
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

export async function signUpWithEmail(email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user) {
      sessionStorage.setItem("ph_just_logged_in", "true");
    }
    return { user: result.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
}

export async function logOut() {
  try {
    sessionStorage.removeItem("ph_just_logged_in");
    sessionStorage.removeItem("welcomeJourneyShown");
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (
          key.startsWith("welcomeJourneyShown") ||
          key.startsWith("ph_welcome_") ||
          key.startsWith("ph_session_")
        ) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      // ignore storage access errors
    }
    await signOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}
