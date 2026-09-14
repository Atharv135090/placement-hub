import { collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";
import { isBlocked } from "./blocks";
import {
  getECDHPrivateKey,
  getECDHPublicKey,
  fetchECDHPublicKey,
  encryptMessageE2EE,
  decryptMessageE2EE,
} from "../../utils/crypto";

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
    const convSnap = await getDoc(convRef);

    if (convSnap.exists()) {
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

export async function sendMessage(conversationId, senderId, encryptedText, participants, messageVersion = 2, senderPubKey = null, recipientPubKey = null) {
  // Build message doc — include public key metadata so future decryption
  // never depends on key availability at decryption time.
  const msgData = {
    conversationId,
    senderId,
    encryptedText,
    messageVersion,
    createdAt: serverTimestamp(),
    read: false,
  };
  // Persist sender/recipient public keys with the message for permanent E2EE metadata
  if (senderPubKey) msgData.senderPubKey = senderPubKey;
  if (recipientPubKey) msgData.recipientPubKey = recipientPubKey;

  const msgRef = await addDoc(collection(db, "messages"), msgData);

  const unreadField = participants?.[0] === senderId ? "unread2" : "unread1";
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: encryptedText,
    lastMessageAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    [unreadField]: increment(1),
  });

  // Create notification for the recipient (matches existing notification schema)
  try {
    const recipientId = participants?.find((p) => p !== senderId);
    if (recipientId) {
      await addDoc(collection(db, "notifications"), {
        title: "New Message",
        message: "You have a new message",
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

// ─── ENCRYPTION ──────────────────────────────────────────────

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

export async function encryptMessage(plaintext, senderUid, recipientUid) {
  const privateKey = await getECDHPrivateKey(senderUid);
  // Fetch recipient's REAL public key from Firestore (not local IndexedDB)
  const recipientPubKey = await fetchECDHPublicKey(recipientUid);
  // Also get sender's own public key to persist with the message
  const senderPubKey = await getECDHPublicKey(senderUid);

  if (privateKey && recipientPubKey) {
    try {
      const encrypted = await encryptMessageE2EE(plaintext, privateKey, recipientPubKey);
      // Return pubkey metadata so it can be stored alongside the message.
      // This ensures future decryption always has the required keys regardless
      // of time elapsed or key rotation.
      return { encryptedText: encrypted, messageVersion: 2, senderPubKey, recipientPubKey };
    } catch (err) {
      console.warn("V2 encryption failed, falling back to V1:", err);
    }
  }

  // Fallback: V1 PBKDF2 symmetric key (deterministic from UIDs)
  console.log("encryptMessage: Using V1 fallback for", senderUid, "->", recipientUid);
  const key = await deriveKeyV1(senderUid, recipientUid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const encHex = Array.from(new Uint8Array(enc)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { encryptedText: `${ivHex}:${encHex}`, messageVersion: 1, senderPubKey: null, recipientPubKey: null };
}

/**
 * Decrypt a message, using embedded public-key metadata first.
 * Priority order:
 *   1. V2 ECDH using keys embedded in the message document (senderPubKey / recipientPubKey)
 *   2. V2 ECDH using Firestore-fetched public key
 *   3. V1 PBKDF2 deterministic fallback
 *
 * Message age is NEVER a factor in decryption decisions.
 */
export async function decryptMessage(cipherText, uid1, uid2, messageVersion, msgSenderPubKey = null, msgRecipientPubKey = null) {
  const myPrivKey = await getECDHPrivateKey(uid1);

  // ── Strategy 1: try both public keys embedded in the message document ──
  // Since ECDH is symmetric (ECDH(A_priv, B_pub) = ECDH(B_priv, A_pub)),
  // one of the two stored keys must belong to the other party.
  // We try both without needing to know who was the sender.
  // This path works indefinitely regardless of time elapsed or Firestore key changes.
  if (myPrivKey) {
    if (msgSenderPubKey) {
      try {
        return await decryptMessageE2EE(cipherText, myPrivKey, msgSenderPubKey);
      } catch {
        // This key was our own — try the other embedded key
      }
    }
    if (msgRecipientPubKey) {
      try {
        return await decryptMessageE2EE(cipherText, myPrivKey, msgRecipientPubKey);
      } catch {
        // Neither embedded key worked — fall through to Firestore lookup
      }
    }
  }

  // ── Strategy 2: V2 ECDH with Firestore-fetched current public key ──
  // Works if neither key pair has changed since the message was sent.
  if (myPrivKey) {
    const theirPubKey = await fetchECDHPublicKey(uid2);
    if (theirPubKey) {
      try {
        return await decryptMessageE2EE(cipherText, myPrivKey, theirPubKey);
      } catch {
        // V2 with current Firestore key failed — try V1
      }
    }
  }

  // ── Strategy 3: V1 PBKDF2 deterministic fallback ──
  // Works for all V1-encrypted messages regardless of key state.
  try {
    return await decryptV1(cipherText, uid1, uid2);
  } catch {
    // V1 also failed — message is genuinely unrecoverable
  }

  // All strategies exhausted — message is genuinely unrecoverable with current keys.
  // This is not age-based; it means the required private key is not available on this device.
  return "Unable to decrypt this message.";
}


/**
 * Re-encrypt a V1 message with V2 (ECDH).
 * Returns { encryptedText, messageVersion: 2 } or null if re-encryption fails.
 */
export async function reEncryptMessageV1(cipherText, senderUid, recipientUid) {
  try {
    const plainText = await decryptV1(cipherText, senderUid, recipientUid);
    const privateKey = await getECDHPrivateKey(senderUid);
    const recipientPubKey = await fetchECDHPublicKey(recipientUid);
    if (!privateKey || !recipientPubKey) return null;
    const encrypted = await encryptMessageE2EE(plainText, privateKey, recipientPubKey);
    return { encryptedText: encrypted, messageVersion: 2 };
  } catch {
    return null;
  }
}

/**
 * Re-encrypt all V1 messages in a conversation with V2 (ECDH).
 * Only works if both users have ECDH keys published to Firestore.
 * Returns the number of messages re-encrypted.
 */
export async function reEncryptConversationMessages(conversationId, senderUid, recipientUid) {
  try {
    const privateKey = await getECDHPrivateKey(senderUid);
    const recipientPubKey = await fetchECDHPublicKey(recipientUid);
    if (!privateKey || !recipientPubKey) return 0;

    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snapshot = await getDocs(q);
    let reEncrypted = 0;

    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      if (msg.messageVersion === 2) continue; // Already V2

      try {
        const plainText = msg.messageVersion === 1
          ? await decryptV1(msg.encryptedText, senderUid, recipientUid)
          : await decryptV1(msg.encryptedText, senderUid, recipientUid); // Unknown version — try V1

        const encrypted = await encryptMessageE2EE(plainText, privateKey, recipientPubKey);
        await updateDoc(doc(db, "messages", docSnap.id), {
          encryptedText: encrypted,
          messageVersion: 2,
        });
        reEncrypted++;
      } catch {
        // This message couldn't be decrypted — skip it
      }
    }
    return reEncrypted;
  } catch (err) {
    console.error("reEncryptConversationMessages error:", err);
    return 0;
  }
}
