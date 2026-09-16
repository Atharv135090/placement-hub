import { collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";
import { isBlocked } from "./blocks";

// NOTE: Automatic message cleanup (age/count-based deletion) has been intentionally
// REMOVED from user-to-user Chat. Messages must remain readable indefinitely
// until the user explicitly clears them via Clear Chat.
// The cleanupConversationMessages function is no longer called.

function getConversationId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// cleanupConversationMessages intentionally removed.
// User-to-user messages must never be automatically deleted by age or count.
// Deletion happens ONLY when the user explicitly uses Clear Chat.

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

  // NOTE: No automatic cleanup — messages persist indefinitely.
  return { data: { id: msgRef.id }, error: null };
}

export function subscribeToMessages(conversationId, callback) {
  // No automatic cleanup — messages persist indefinitely for user-to-user Chat.
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
