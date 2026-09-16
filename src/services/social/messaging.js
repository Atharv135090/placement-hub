import { collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment, writeBatch } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";
import { isBlocked } from "./blocks";

// PRD §20: Messages are retained up to 50 per conversation.
// Beyond 50 messages, oldest messages are deleted to stay within the limit.
// Users can also explicitly clear all messages via Clear Chat.

function getConversationId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// PRD §20: Max 50 messages per conversation. Beyond that, oldest are trimmed.
// Users can also explicitly clear all messages via Clear Chat.

export async function getOrCreateConversation(uid1, uid2) {
  try {
    const blocked = await isBlocked(uid1, uid2);
    if (blocked.data) return { data: null, error: "blocked" };

    const convId = getConversationId(uid1, uid2);
    const convRef = doc(db, "conversations", convId);

    let convSnap;
    try {
      convSnap = await getDoc(convRef);
    } catch {
      // Document may not exist — security rule denies read on non-existent docs
      convSnap = null;
    }

    if (convSnap && convSnap.exists()) {
      // Conversation exists — ensure both users are participants
      const data = convSnap.data();
      const participants = data.participants || [];
      if (!participants.includes(uid1)) {
        // User was removed (e.g. after Delete Chat) — re-add them and reset for a fresh start
        await setDoc(convRef, {
          participants: [uid1, uid2],
          lastMessage: null,
          lastMessageAt: null,
          unread1: 0,
          unread2: 0,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      // New conversation — create it
      await setDoc(convRef, {
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
    const enriched = (await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participants?.find((p) => p !== userId);
        if (!otherId) return null;
        const otherSnap = await getDoc(doc(db, "users", otherId));
        const otherProfile = otherSnap.exists() ? otherSnap.data() : {};
        return {
          ...c,
          otherUser: { id: otherId, ...otherProfile },
          unreadCount: c.participants?.[0] === userId ? (c.unread1 || 0) : (c.unread2 || 0),
        };
      })
    )).filter(Boolean);
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

export async function sendMessage(conversationId, senderId, text, participants) {
  const msgData = {
    conversationId,
    senderId,
    text,
    createdAt: serverTimestamp(),
    read: false,
  };

  const msgRef = await addDoc(collection(db, "messages"), msgData);

  const unreadField = participants?.[0] === senderId ? "unread2" : "unread1";
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    [unreadField]: increment(1),
  });

  // Create notification for the recipient (matches existing notification schema)
  try {
    const recipientId = participants?.find((p) => p !== senderId);
    if (recipientId) {
      const { getSenderDisplayName } = await import("../firestore/notifications");
      const senderName = await getSenderDisplayName(senderId);
      await addDoc(collection(db, "notifications"), {
        title: "New Message",
        message: `${senderName} sent you a message.`,
        type: "message",
        senderId,
        targetUserId: recipientId,
        conversationId,
        messageId: msgRef.id,
        link: `/chat?student=${senderId}`,
        readBy: [],
        createdAt: serverTimestamp(),
      });
    }
  } catch (notifErr) {
    console.warn("Failed to create message notification:", notifErr);
  }

  // Apply retention limits after sending
  await enforceRetention(conversationId);
  return { data: { id: msgRef.id }, error: null };
}

// PRD §20: Enforce message retention limits (max 50 messages, 4-day inactive cleanup)
const MAX_MESSAGES = 50;

async function enforceRetention(conversationId) {
  try {
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    const docs = snap.docs;

    if (docs.length <= MAX_MESSAGES) return;

    // Delete oldest messages beyond the limit, keeping the newest half
    const toDelete = docs.length - MAX_MESSAGES;
    const batchOps = writeBatch(db);
    for (let i = 0; i < toDelete; i++) {
      batchOps.delete(docs[i].ref);
    }
    await batchOps.commit();
  } catch (err) {
    console.warn("Message retention enforcement failed (non-fatal):", err);
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
  }, (error) => {
    console.error("subscribeToMessages error:", error);
    callback([]);
  });
}

export function subscribeToConversations(userId, callback) {
  const q = query(collection(db, "conversations"), where("participants", "array-contains", userId));
  let generation = 0;
  return onSnapshot(q, (snapshot) => {
    const convs = mapDocs(snapshot);
    const otherIds = [...new Set(convs.map((c) => c.participants?.find((p) => p !== userId)).filter(Boolean))];
    const gen = ++generation;
    if (otherIds.length === 0) {
      callback([]);
      return;
    }
    Promise.all(
      otherIds.map(async (otherId) => {
        const otherSnap = await getDoc(doc(db, "users", otherId));
        return otherSnap.exists() ? { id: otherId, ...otherSnap.data() } : { id: otherId };
      })
    ).then((profiles) => {
      if (gen !== generation) return;
      const profileMap = {};
      profiles.forEach((p) => { profileMap[p.id] = p; });
      const enriched = convs.map((c) => {
        const otherId = c.participants?.find((p) => p !== userId);
        if (!otherId) return null;
        return {
          ...c,
          otherUser: profileMap[otherId] || { id: otherId },
          unreadCount: c.participants?.[0] === userId ? (c.unread1 || 0) : (c.unread2 || 0),
        };
      }).filter(Boolean);
      enriched.sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis?.() || 0;
        const bTime = b.lastMessageAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      callback(enriched);
    });
  }, (error) => {
    console.error("subscribeToConversations error:", error);
    callback([]);
  });
}

export async function markConversationRead(conversationId, userId, participants) {
  try {
    const unreadField = participants?.[0] === userId ? "unread1" : "unread2";
    await updateDoc(doc(db, "conversations", conversationId), { [unreadField]: 0 });
    return { error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

// ─── MESSAGE READ/DECRYPT ────────────────────────────────────
// New messages are stored as plaintext in the `text` field.
// Legacy messages (messageVersion 1 or 2) may be stored in `encryptedText`.
// This function handles both transparently.

function sortIds(uid1, uid2) {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

async function deriveKeyV1(uid1, uid2) {
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

async function decryptV1(cipherText, uid1, uid2) {
  const [ivHex, encHex] = cipherText.split(":");
  const iv = new Uint8Array(ivHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const data = new Uint8Array(encHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await deriveKeyV1(uid1, uid2);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

/**
 * Read a message's text content.
 * - New messages store plaintext in the `text` field.
 * - Legacy encrypted messages store ciphertext in `encryptedText` with messageVersion 1 or 2.
 *   These are best-effort decrypted; if decryption fails, a friendly fallback is returned.
 */
export async function readMessageText(msg, uid1, uid2) {
  // New plaintext message
  if (msg.text != null) return msg.text;

  // Legacy encrypted message
  const version = msg.messageVersion;
  const cipherText = msg.encryptedText;
  if (!cipherText || (!version && version !== 1 && version !== 2)) return "";

  // Try V1 PBKDF2 (symmetric, no key lookup needed)
  if (version === 1 || !version) {
    try {
      return await decryptV1(cipherText, uid1, uid2);
    } catch {}
  }

  // V2 ECDH messages and V1 fallback failures — cannot decrypt without private keys.
  // Return a friendly fallback, not a technical error.
  return "Legacy message (encrypted with an older version)";
}

// ─── CLEAR CHAT: PERMANENT MESSAGE DELETION ──────────────────

const BATCH_LIMIT = 450;

export async function clearAllConversationMessages(conversationId) {
  try {
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const q = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;

      if (docs.length === 0) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      const batchDocs = docs.slice(0, BATCH_LIMIT);
      batchDocs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      totalDeleted += batchDocs.length;
      hasMore = docs.length > BATCH_LIMIT;
    }

    return { error: null, deletedCount: totalDeleted };
  } catch (error) {
    return handleSocialError(error);
  }
}

// ─── DISAPPEARING MESSAGES: DELETE EXPIRED ───────────────────

const DISAPPEARING_DURATIONS_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function deleteExpiredMessages(conversationId, disappearingDuration) {
  if (!disappearingDuration || !DISAPPEARING_DURATIONS_MS[disappearingDuration]) {
    return { error: null, deletedCount: 0 };
  }

  try {
    const durationMs = DISAPPEARING_DURATIONS_MS[disappearingDuration];
    const cutoffTime = Date.now() - durationMs;

    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snapshot = await getDocs(q);

    const expiredDocs = snapshot.docs.filter((d) => {
      const data = d.data();
      const created = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
      return created < cutoffTime;
    });

    if (expiredDocs.length === 0) {
      return { error: null, deletedCount: 0 };
    }

    let totalDeleted = 0;
    for (let i = 0; i < expiredDocs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = expiredDocs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += chunk.length;
    }

    return { error: null, deletedCount: totalDeleted };
  } catch (error) {
    return handleSocialError(error);
  }
}

// PRD §20: Trim oldest half of messages in conversations inactive for 4+ days
export async function trimInactiveConversation(conversationId) {
  try {
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    const docs = snap.docs;
    if (docs.length <= 2) return { error: null, deletedCount: 0 };

    const toDelete = Math.floor(docs.length / 2);
    const batch = writeBatch(db);
    for (let i = 0; i < toDelete; i++) {
      batch.delete(docs[i].ref);
    }
    await batch.commit();
    return { error: null, deletedCount: toDelete };
  } catch (error) {
    return handleSocialError(error);
  }
}
