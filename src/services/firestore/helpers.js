import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebase";

// ─── COLLECTIONS ──────────────────────────────────────────────

export const COMPANIES = "companies";
export const JOBS = "jobs";
export const USERS = "users";
export const APPLICATIONS = "applications";
export const ANNOUNCEMENTS = "announcements";
export const ATTACHMENTS = "attachments";
export const NOTIFICATIONS = "notifications";

// ─── HELPERS ──────────────────────────────────────────────────

export function normalizeCompanyName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function timestamp() {
  return serverTimestamp();
}

export function handleFirestoreError(error) {
  console.error("Firestore operation failed:", error.message);
  return { data: null, error: error.message };
}

export function mapDocs(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
