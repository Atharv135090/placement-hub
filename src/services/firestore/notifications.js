import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  arrayUnion,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { NOTIFICATIONS, handleFirestoreError, mapDocs } from "./helpers";

const FALLBACK_SENDER_NAME = "Deleted User";

export async function getSenderDisplayName(uid) {
  if (!uid) return FALLBACK_SENDER_NAME;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return FALLBACK_SENDER_NAME;
    const data = snap.data();
    return data.displayName || data.name || FALLBACK_SENDER_NAME;
  } catch {
    return FALLBACK_SENDER_NAME;
  }
}

export async function createNotification({ title, message, type, link, targetUserId, senderId, followRequestId }) {
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS), {
      title,
      message,
      type: type || "info",
      link: link || null,
      targetUserId: targetUserId || null,
      senderId: senderId || null,
      followRequestId: followRequestId || null,
      readBy: [],
      createdAt: serverTimestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getUnreadNotifications(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, NOTIFICATIONS), where("targetUserId", "==", userId), orderBy("createdAt", "desc"))
    );
    const notifications = mapDocs(snapshot)
      .filter((n) => !n.readBy?.includes(userId))
      .slice(0, 50);
    return { data: notifications, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAllNotifications() {
  try {
    const snapshot = await getDocs(
      query(collection(db, NOTIFICATIONS), orderBy("createdAt", "desc"))
    );
    const notifications = mapDocs(snapshot).slice(0, 50);
    return { data: notifications, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function markNotificationRead(notificationId, userId) {
  try {
    const docRef = doc(db, NOTIFICATIONS, notificationId);
    await updateDoc(docRef, { readBy: arrayUnion(userId) });
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function markAllNotificationsRead(userId) {
  try {
    const snapshot = await getDocs(collection(db, NOTIFICATIONS));
    const batch = snapshot.docs.filter((d) => !d.data().readBy?.includes(userId));
    for (const d of batch) {
      await updateDoc(doc(db, NOTIFICATIONS, d.id), { readBy: arrayUnion(userId) });
    }
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export function subscribeToNotifications(userId, callback) {
  const q = query(
    collection(db, NOTIFICATIONS),
    where("targetUserId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => !n.readBy?.includes(userId))
      .slice(0, 50);
    callback(notifications);
  }, (error) => {
    console.error("subscribeToNotifications error:", error);
    callback([]);
  });
}
