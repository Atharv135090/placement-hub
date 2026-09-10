import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

function handleSocialError(error) {
  console.error("Social operation failed:", error.message);
  return { data: null, error: error.message };
}

function mapDocs(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════════
// STUDENT PROFILES
// ═══════════════════════════════════════════════════════════════

export async function getStudentProfile(userId) {
  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    if (!docSnap.exists()) return { data: null, error: "Profile not found" };
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getAllStudents() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "users"), where("role", "==", "student"))
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function updateStudentProfile(userId, updates) {
  try {
    await updateDoc(doc(db, "users", userId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { data: { id: userId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// FOLLOW SYSTEM
// ═══════════════════════════════════════════════════════════════

export async function sendFollowRequest(fromUserId, toUserId) {
  try {
    if (fromUserId === toUserId) return { data: null, error: "cannot_follow_self" };

    const blocked1 = await isBlocked(fromUserId, toUserId);
    if (blocked1.data) return { data: null, error: "blocked" };

    const docId = `${fromUserId}_${toUserId}`;
    const existing = await getDoc(doc(db, "follows", docId));
    if (existing.exists()) return { data: null, error: "already_exists" };

    const toProfile = await getDoc(doc(db, "users", toUserId));
    const isPublic = toProfile.exists() && toProfile.data().profileVisibility === "public";

    await setDoc(doc(db, "follows", docId), {
      fromUserId,
      toUserId,
      status: isPublic ? "accepted" : "pending",
      createdAt: serverTimestamp(),
    });

    if (isPublic) {
      await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
      await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
    }

    return { data: { id: docId, status: isPublic ? "accepted" : "pending" }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function acceptFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await updateDoc(doc(db, "follows", docId), { status: "accepted" });
    await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function rejectFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function unfollowUser(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: "not_found" };

    const data = docSnap.data();
    if (data.status === "accepted") {
      await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(-1) });
      await updateDoc(doc(db, "users", toUserId), { followersCount: increment(-1) });
    }
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function cancelFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function removeFollower(ownerUserId, followerUserId) {
  try {
    const docId = `${followerUserId}_${ownerUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: "not_found" };

    if (docSnap.data().status === "accepted") {
      await updateDoc(doc(db, "users", followerUserId), { followingCount: increment(-1) });
      await updateDoc(doc(db, "users", ownerUserId), { followersCount: increment(-1) });
    }
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowStatus(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: null };
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowers(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("toUserId", "==", userId), where("status", "==", "accepted"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowing(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("fromUserId", "==", userId), where("status", "==", "accepted"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.toUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getPendingFollowRequests(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("toUserId", "==", userId), where("status", "==", "pending"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data(), followFrom: f.fromUserId } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToPendingFollowRequests(userId, callback) {
  const q = query(
    collection(db, "follows"),
    where("toUserId", "==", userId),
    where("status", "==", "pending")
  );
  return onSnapshot(q, async (snapshot) => {
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data(), followFrom: f.fromUserId } : null;
      })
    );
    callback(profiles.filter(Boolean));
  });
}

export function subscribeToFollowStatus(fromUserId, toUserId, callback) {
  const docId = `${fromUserId}_${toUserId}`;
  return onSnapshot(doc(db, "follows", docId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
    } else {
      callback(docSnap.data().status);
    }
  });
}

export function subscribeToAllFollowStatuses(userId, callback) {
  const q = query(
    collection(db, "follows"),
    where("fromUserId", "==", userId)
  );
  return onSnapshot(q, async (snapshot) => {
    const statuses = {};
    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.status) {
        statuses[data.toUserId] = data.status;
      }
    }
    callback(statuses);
  });
}

// ═══════════════════════════════════════════════════════════════
// BLOCK / REPORT
// ═══════════════════════════════════════════════════════════════

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
  try {
    const docId1 = `${userId1}_${userId2}`;
    const docId2 = `${userId2}_${userId1}`;
    const snap1 = await getDoc(doc(db, "blocks", docId1));
    if (snap1.exists()) return { data: true, error: null };
    const snap2 = await getDoc(doc(db, "blocks", docId2));
    if (snap2.exists()) return { data: true, error: null };
    return { data: false, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function reportUser(reporterId, reportedId, reason, details = "", evidenceUrls = []) {
  try {
    const docRef = await addDoc(collection(db, "reports"), {
      reporterId,
      reportedId,
      reason,
      details,
      evidenceUrls,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function uploadReportEvidence(reportId, file) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `report-evidence/${reportId}/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    return { data: { fileUrl, fileName: file.name, fileType: file.type, fileSize: file.size }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getAllReports() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "reports"), orderBy("createdAt", "desc"))
    );
    const reports = mapDocs(snapshot);
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const reporterSnap = await getDoc(doc(db, "users", r.reporterId));
        const reportedSnap = await getDoc(doc(db, "users", r.reportedId));
        return {
          ...r,
          reporterName: reporterSnap.exists() ? reporterSnap.data().displayName || "Unknown" : "Deleted User",
          reportedName: reportedSnap.exists() ? reportedSnap.data().displayName || "Unknown" : "Deleted User",
        };
      })
    );
    return { data: enriched, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function updateReportStatus(reportId, status) {
  try {
    await updateDoc(doc(db, "reports", reportId), { status });
    return { data: { id: reportId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAT / MESSAGES
// ═══════════════════════════════════════════════════════════════

function getConversationId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export async function getOrCreateConversation(uid1, uid2) {
  try {
    const blocked = await isBlocked(uid1, uid2);
    if (blocked.data) return { data: null, error: "blocked" };

    const convId = getConversationId(uid1, uid2);
    const convSnap = await getDoc(doc(db, "conversations", convId));
    if (!convSnap.exists()) {
      await setDoc(doc(db, "conversations", convId), {
        participants: [uid1, uid2],
        lastMessage: null,
        lastMessageAt: null,
        unread1: 0,
        unread2: 0,
        createdAt: serverTimestamp(),
      });
    }
    return { data: { id: convId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getConversations(userId) {
  try {
    const q1 = query(collection(db, "conversations"), where("participants", "array-contains", userId));
    const snapshot = await getDocs(q1);
    const convs = mapDocs(snapshot);
    const enriched = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participants.find((p) => p !== userId);
        const otherSnap = await getDoc(doc(db, "users", otherId));
        const otherProfile = otherSnap.exists() ? otherSnap.data() : {};
        return {
          ...c,
          otherUser: { id: otherId, ...otherProfile },
          unreadCount: c.participants[0] === userId ? (c.unread1 || 0) : (c.unread2 || 0),
        };
      })
    );
    enriched.sort((a, b) => {
      const aTime = a.lastMessageAt?.toMillis?.() || 0;
      const bTime = b.lastMessageAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    return { data: enriched, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function sendMessage(conversationId, senderId, encryptedText) {
  try {
    const msgRef = await addDoc(collection(db, "messages"), {
      conversationId,
      senderId,
      encryptedText,
      createdAt: serverTimestamp(),
      read: false,
    });

    const convSnap = await getDoc(doc(db, "conversations", conversationId));
    if (convSnap.exists()) {
      const conv = convSnap.data();
      const unreadField = conv.participants[0] === senderId ? "unread2" : "unread1";
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: encryptedText,
        lastMessageAt: serverTimestamp(),
        [unreadField]: increment(1),
      });
    }

    return { data: { id: msgRef.id }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToMessages(conversationId, callback) {
  const q = query(
    collection(db, "messages"),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToConversations(userId, callback) {
  const q = query(collection(db, "conversations"), where("participants", "array-contains", userId));
  return onSnapshot(q, async (snapshot) => {
    const convs = mapDocs(snapshot);
    const enriched = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participants.find((p) => p !== userId);
        const otherSnap = await getDoc(doc(db, "users", otherId));
        const otherProfile = otherSnap.exists() ? otherSnap.data() : {};
        return {
          ...c,
          otherUser: { id: otherId, ...otherProfile },
          unreadCount: c.participants[0] === userId ? (c.unread1 || 0) : (c.unread2 || 0),
        };
      })
    );
    enriched.sort((a, b) => {
      const aTime = a.lastMessageAt?.toMillis?.() || 0;
      const bTime = b.lastMessageAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    callback(enriched);
  });
}

export async function markConversationRead(conversationId, userId) {
  try {
    const convSnap = await getDoc(doc(db, "conversations", conversationId));
    if (!convSnap.exists()) return { error: null };
    const conv = convSnap.data();
    const unreadField = conv.participants[0] === userId ? "unread1" : "unread2";
    await updateDoc(doc(db, "conversations", conversationId), { [unreadField]: 0 });
    return { error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHAT ENCRYPTION (Web Crypto API - AES-GCM)
// ═══════════════════════════════════════════════════════════════

function sortIds(uid1, uid2) {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

async function deriveKey(uid1, uid2) {
  const [a, b] = sortIds(uid1, uid2);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${a}:${b}:placement-hub-chat-v1`),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode("placement-hub-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(plaintext, uid1, uid2) {
  const key = await deriveKey(uid1, uid2);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const encHex = Array.from(new Uint8Array(encrypted)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${ivHex}:${encHex}`;
}

export async function decryptMessage(cipherText, uid1, uid2) {
  try {
    const [ivHex, encHex] = cipherText.split(":");
    const iv = new Uint8Array(ivHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const data = new Uint8Array(encHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const key = await deriveKey(uid1, uid2);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[encrypted message]";
  }
}
