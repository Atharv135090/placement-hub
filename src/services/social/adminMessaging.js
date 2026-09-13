import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";

function getAdminConvId(adminId, studentId) {
  return adminId < studentId
    ? `admin_${adminId}_${studentId}`
    : `admin_${studentId}_${adminId}`;
}

export async function getOrCreateAdminConversation(adminId, studentId) {
  try {
    const convId = getAdminConvId(adminId, studentId);
    await setDoc(
      doc(db, "adminConversations", convId),
      {
        participants: [adminId, studentId],
        isAdminConversation: true,
        lastMessage: null,
        lastMessageAt: null,
        unread1: 0,
        unread2: 0,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { data: { id: convId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function sendAdminChatMessage(conversationId, senderId, text, participants) {
  try {
    const msgRef = await addDoc(collection(db, "adminMessages"), {
      conversationId,
      senderId,
      text: text.trim(),
      isAdminMessage: true,
      createdAt: new Date().toISOString(),
      read: false,
    });

    const unreadField = participants?.[0] === senderId ? "unread2" : "unread1";
    await updateDoc(doc(db, "adminConversations", conversationId), {
      lastMessage: text.trim(),
      lastMessageAt: new Date().toISOString(),
      [unreadField]: increment(1),
    });

    // Create notification for the recipient
    try {
      const recipientId = participants?.find((p) => p !== senderId);
      if (recipientId) {
        await addDoc(collection(db, "notifications"), {
          title: "New Message",
          message: "You have a new message from admin",
          type: "message",
          senderId,
          targetUserId: recipientId,
          conversationId,
          messageId: msgRef.id,
          link: `/chat?student=${senderId}`,
          readBy: [],
          createdAt: new Date().toISOString(),
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create admin message notification:", notifErr);
    }

    return { data: { id: msgRef.id }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getAdminConversations(userId) {
  try {
    const q = query(
      collection(db, "adminConversations"),
      where("participants", "array-contains", userId)
    );
    const snapshot = await getDocs(q);
    const convs = mapDocs(snapshot);
    const enriched = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participants.find((p) => p !== userId);
        const otherSnap = await getDoc(doc(db, "users", otherId));
        const otherProfile = otherSnap.exists() ? otherSnap.data() : {};
        return {
          ...c,
          otherUser: { id: otherId, ...otherProfile },
          unreadCount:
            c.participants[0] === userId ? c.unread1 || 0 : c.unread2 || 0,
        };
      })
    );
    enriched.sort((a, b) => {
      const aTime = a.lastMessageAt
        ? new Date(a.lastMessageAt).getTime()
        : 0;
      const bTime = b.lastMessageAt
        ? new Date(b.lastMessageAt).getTime()
        : 0;
      return bTime - aTime;
    });
    return { data: enriched, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToAdminMessages(conversationId, callback) {
  const q = query(
    collection(db, "adminMessages"),
    where("conversationId", "==", conversationId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      console.error("subscribeToAdminMessages error:", error);
      callback([]);
    }
  );
}

export function subscribeToAdminConversations(userId, callback) {
  const q = query(
    collection(db, "adminConversations"),
    where("participants", "array-contains", userId)
  );
  let generation = 0;
  return onSnapshot(
    q,
    (snapshot) => {
      const convs = mapDocs(snapshot);
      const otherIds = [
        ...new Set(
          convs.map((c) => c.participants.find((p) => p !== userId))
        ),
      ];
      const gen = ++generation;
      if (otherIds.length === 0) {
        callback([]);
        return;
      }
      Promise.all(
        otherIds.map(async (otherId) => {
          const otherSnap = await getDoc(doc(db, "users", otherId));
          return otherSnap.exists()
            ? { id: otherId, ...otherSnap.data() }
            : { id: otherId };
        })
      ).then((profiles) => {
        if (gen !== generation) return;
        const profileMap = {};
        profiles.forEach((p) => {
          profileMap[p.id] = p;
        });
        const enriched = convs.map((c) => {
          const otherId = c.participants.find((p) => p !== userId);
          return {
            ...c,
            otherUser: profileMap[otherId] || { id: otherId },
            unreadCount:
              c.participants[0] === userId
                ? c.unread1 || 0
                : c.unread2 || 0,
          };
        });
        enriched.sort((a, b) => {
          const aTime = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : 0;
          const bTime = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : 0;
          return bTime - aTime;
        });
        callback(enriched);
      });
    },
    (error) => {
      console.error("subscribeToAdminConversations error:", error);
      callback([]);
    }
  );
}

export async function markAdminConversationRead(conversationId, userId) {
  try {
    const convSnap = await getDoc(doc(db, "adminConversations", conversationId));
    if (!convSnap.exists()) return { error: null };
    const conv = convSnap.data();
    const unreadField =
      conv.participants[0] === userId ? "unread1" : "unread2";
    await updateDoc(doc(db, "adminConversations", conversationId), {
      [unreadField]: 0,
    });
    return { error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}
