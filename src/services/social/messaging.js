import { collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment, limit } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";
import { isBlocked } from "./blocks";
import {
  getECDHPrivateKey,
  fetchECDHPublicKey,
  encryptMessageE2EE,
  decryptMessageE2EE,
} from "../../utils/crypto";

const MAX_MESSAGES = 50;
const INACTIVE_DAYS = 4;

function getConversationId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export async function cleanupConversationMessages(conversationId) {
  try {
    const msgQuery = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snapshot = await getDocs(msgQuery);
    const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (messages.length <= MAX_MESSAGES) {
      const convSnap = await getDoc(doc(db, "conversations", conversationId));
      if (!convSnap.exists()) return;
      const convData = convSnap.data();
      const lastActivityAt = convData.lastActivityAt;
      if (!lastActivityAt) return;

      const lastMs = lastActivityAt.toMillis ? lastActivityAt.toMillis() : new Date(lastActivityAt).getTime();
      const nowMs = Date.now();
      const daysSinceInactive = (nowMs - lastMs) / (1000 * 60 * 60 * 24);

      if (daysSinceInactive >= INACTIVE_DAYS && messages.length > 2) {
        const halfCount = Math.floor(messages.length / 2);
        const toDelete = messages.slice(0, halfCount);
        await Promise.all(toDelete.map((m) => deleteDoc(doc(db, "messages", m.id))));
      }
      return;
    }

    const excessCount = messages.length - MAX_MESSAGES;
    const toDelete = messages.slice(0, excessCount);
    await Promise.all(toDelete.map((m) => deleteDoc(doc(db, "messages", m.id))));
  } catch (error) {
    console.error("cleanupConversationMessages error:", error);
  }
}

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

export async function sendMessage(conversationId, senderId, encryptedText, participants, messageVersion = 2) {
  const msgRef = await addDoc(collection(db, "messages"), {
    conversationId,
    senderId,
    encryptedText,
    messageVersion,
    createdAt: serverTimestamp(),
    read: false,
  });

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

  cleanupConversationMessages(conversationId).catch(() => {});

  return { data: { id: msgRef.id }, error: null };
}

export function subscribeToMessages(conversationId, callback) {
  cleanupConversationMessages(conversationId).catch(() => {});

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
    const otherIds = [...new Set(convs.map((c) => c.participants.find((p) => p !== userId)))];
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
        const otherId = c.participants.find((p) => p !== userId);
        return {
          ...c,
          otherUser: profileMap[otherId] || { id: otherId },
          unreadCount: c.participants[0] === userId ? (c.unread1 || 0) : (c.unread2 || 0),
        };
      });
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

  if (privateKey && recipientPubKey) {
    try {
      const encrypted = await encryptMessageE2EE(plaintext, privateKey, recipientPubKey);
      return { encryptedText: encrypted, messageVersion: 2 };
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
  return { encryptedText: `${ivHex}:${encHex}`, messageVersion: 1 };
}

export async function decryptMessage(cipherText, uid1, uid2, messageVersion) {
  try {
    if (messageVersion === 2) {
      const myPrivKey = await getECDHPrivateKey(uid1);
      // Fetch the OTHER user's REAL public key from Firestore
      const theirPubKey = await fetchECDHPublicKey(uid2);
      if (myPrivKey && theirPubKey) {
        return await decryptMessageE2EE(cipherText, myPrivKey, theirPubKey);
      }
      console.warn("decryptMessage V2: missing key material", {
        hasMyPrivKey: !!myPrivKey,
        hasTheirPubKey: !!theirPubKey,
        uid1,
        uid2,
      });
      return "Unable to decrypt this message.";
    }
    return await decryptV1(cipherText, uid1, uid2);
  } catch (err) {
    console.warn("decryptMessage error:", err?.message, "version:", messageVersion);
    return "Unable to decrypt this message.";
  }
}
