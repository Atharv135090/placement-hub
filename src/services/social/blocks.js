import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError } from "./helpers";

export async function blockUser(blockerId, blockedId) {
  try {
    const docId = `${blockerId}_${blockedId}`;
    await setDoc(doc(db, "blocks", docId), {
      blockerId,
      blockedId,
      createdAt: serverTimestamp(),
    });
    const followDocId1 = `${blockerId}_${blockedId}`;
    const followDocId2 = `${blockedId}_${blockerId}`;
    try { await deleteDoc(doc(db, "follows", followDocId1)); } catch {}
    try { await deleteDoc(doc(db, "follows", followDocId2)); } catch {}
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function unblockUser(blockerId, blockedId) {
  try {
    const docId = `${blockerId}_${blockedId}`;
    await deleteDoc(doc(db, "blocks", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function isBlocked(userId1, userId2) {
  const docId1 = `${userId1}_${userId2}`;
  const docId2 = `${userId2}_${userId1}`;
  try {
    const snap1 = await getDoc(doc(db, "blocks", docId1));
    if (snap1.exists()) return { data: true, error: null };
  } catch {
    // Document may not exist — security rule denies read on non-existent docs
  }
  try {
    const snap2 = await getDoc(doc(db, "blocks", docId2));
    if (snap2.exists()) return { data: true, error: null };
  } catch {
    // Document may not exist
  }
  return { data: false, error: null };
}
