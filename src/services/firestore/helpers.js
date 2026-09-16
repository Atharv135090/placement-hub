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
export const USERS_PUBLIC = "users_public";
export const APPLICATIONS = "applications";
export const ANNOUNCEMENTS = "announcements";
export const ATTACHMENTS = "attachments";
export const NOTIFICATIONS = "notifications";
export const SUPPORT_TICKETS = "supportTickets";

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

// ─── PUBLIC PROFILE HELPERS (§8 User Privacy) ────────────────
// Other users' safe fields live in users_public (synced by Cloud Function).
// Use these instead of reading from users/ for other users' data.

export async function getPublicProfile(userId) {
  const snap = await getDoc(doc(db, USERS_PUBLIC, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getPublicProfiles(userIds) {
  if (!userIds.length) return [];
  const refs = userIds.map((id) => doc(db, USERS_PUBLIC, id));
  const snaps = await Promise.all(refs.map((r) => getDoc(r)));
  return snaps
    .filter((s) => s.exists())
    .map((s) => ({ id: s.id, ...s.data() }));
}
