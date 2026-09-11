import {
  collection,
  doc,
  addDoc,
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
    const snapshot = await getDocs(collection(db, NOTIFICATIONS));
    const notifications = mapDocs(snapshot)
      .filter((n) => !n.readBy?.includes(userId) && (!n.targetUserId || n.targetUserId === userId))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
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
