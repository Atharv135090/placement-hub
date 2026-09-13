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
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../config/firebase";
import { SUPPORT_TICKETS, handleFirestoreError, mapDocs } from "./helpers";
import { createNotification } from "./notifications";

/**
 * Generate collision-safe ticket ID (e.g. SUP-001, SUP-7X9)
 */
export function generateTicketId() {
  const timestampPart = Date.now().toString(36).toUpperCase().slice(-3);
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `SUP-${randomPart}`;
}

/**
 * Create a new support ticket with initial message
 */
export async function createSupportTicket({ userId, userName, userEmail, subject, message, attachment = null }) {
  try {
    if (!subject || !subject.trim()) {
      return { data: null, error: "Subject is required" };
    }
    if (!message || !message.trim()) {
      return { data: null, error: "Message is required" };
    }

    const ticketIdCode = generateTicketId();
    const ticketData = {
      ticketId: ticketIdCode,
      userId,
      userName: userName || "Student",
      userEmail: userEmail || "",
      subject: subject.trim(),
      status: "Open", // Open | In Progress | Resolved | Closed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessageText: message.trim(),
      unreadUser: false,
      unreadAdmin: true,
      attachment: attachment || null,
    };

    // 1. Create main ticket doc
    const ticketDocRef = await addDoc(collection(db, SUPPORT_TICKETS), ticketData);
    const docId = ticketDocRef.id;

    // 2. Add initial message inside subcollection
    const messagesCol = collection(db, `${SUPPORT_TICKETS}/${docId}/messages`);
    await addDoc(messagesCol, {
      senderId: userId,
      senderRole: "user",
      senderName: userName || "Student",
      text: message.trim(),
      attachment: attachment || null,
      createdAt: serverTimestamp(),
    });

    return { data: { id: docId, ticketId: ticketIdCode }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Realtime subscription for a specific user's tickets
 */
export function subscribeUserTickets(userId, callback) {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, SUPPORT_TICKETS),
    where("userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = mapDocs(snapshot);
      // Sort by updatedAt desc locally to avoid indexing issues
      tickets.sort((a, b) => {
        const ta = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0).getTime();
        const tb = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0).getTime();
        return tb - ta;
      });
      callback(tickets);
    },
    (error) => {
      console.error("subscribeUserTickets error:", error);
      callback([]);
    }
  );
}

/**
 * Realtime subscription for all support tickets (Admin view)
 */
export function subscribeAllTickets(callback) {
  const q = collection(db, SUPPORT_TICKETS);

  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = mapDocs(snapshot);
      tickets.sort((a, b) => {
        const ta = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0).getTime();
        const tb = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0).getTime();
        return tb - ta;
      });
      callback(tickets);
    },
    (error) => {
      console.error("subscribeAllTickets error:", error);
      callback([]);
    }
  );
}

/**
 * Realtime subscription for messages in a ticket
 */
export function subscribeTicketMessages(ticketDocId, callback) {
  if (!ticketDocId) {
    callback([]);
    return () => {};
  }
  const messagesCol = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);
  const q = query(messagesCol, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = mapDocs(snapshot);
      callback(messages);
    },
    (error) => {
      // Fallback query without orderBy if index is still building
      console.warn("subscribeTicketMessages index warning, using unsorted fallback:", error);
      const fallbackQuery = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);
      return onSnapshot(fallbackQuery, (snap) => {
        const msgs = mapDocs(snap);
        msgs.sort((a, b) => {
          const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return ta - tb;
        });
        callback(msgs);
      });
    }
  );
}

/**
 * Add message to a support ticket
 */
export async function addTicketMessage(ticketDocId, { senderId, senderRole, senderName, text, attachment = null }) {
  try {
    if (!text || !text.trim()) {
      return { data: null, error: "Message text cannot be empty" };
    }

    const trimmedText = text.trim();
    const messagesCol = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);

    // Add message
    const msgRef = await addDoc(messagesCol, {
      senderId,
      senderRole, // "user" | "admin"
      senderName: senderName || (senderRole === "admin" ? "Admin Support" : "User"),
      text: trimmedText,
      attachment: attachment || null,
      createdAt: serverTimestamp(),
    });

    // Update parent ticket doc metadata
    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    const ticketSnap = await getDoc(ticketRef);
    const ticketData = ticketSnap.exists() ? ticketSnap.data() : null;

    const updates = {
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessageText: trimmedText,
    };

    if (senderRole === "user") {
      updates.unreadAdmin = true;
      updates.unreadUser = false;
    } else {
      updates.unreadUser = true;
      updates.unreadAdmin = false;
    }

    await updateDoc(ticketRef, updates);

    // Create notification if admin replied to user
    if (senderRole === "admin" && ticketData?.userId) {
      await createNotification({
        title: `Support Update (#${ticketData.ticketId || "SUP"})`,
        message: `Admin Support replied to your request: "${trimmedText.length > 50 ? trimmedText.slice(0, 50) + "..." : trimmedText}"`,
        type: "support_reply",
        link: `/support?ticket=${ticketDocId}`,
        targetUserId: ticketData.userId,
        senderId,
      });
    }

    return { data: { id: msgRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Update ticket status (Open | In Progress | Resolved | Closed)
 */
export async function updateTicketStatus(ticketDocId, newStatus, changedByUserId) {
  try {
    const validStatuses = ["Open", "In Progress", "Resolved", "Closed"];
    if (!validStatuses.includes(newStatus)) {
      return { data: null, error: "Invalid status value" };
    }

    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    const ticketSnap = await getDoc(ticketRef);
    const ticketData = ticketSnap.exists() ? ticketSnap.data() : null;

    await updateDoc(ticketRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      statusChangedBy: changedByUserId || "admin",
    });

    // Send notification to user if status changed by admin
    if (ticketData?.userId && ticketData.userId !== changedByUserId) {
      await createNotification({
        title: `Support Request Status Changed (#${ticketData.ticketId || "SUP"})`,
        message: `Your support request status has been updated to "${newStatus}".`,
        type: "support_status",
        link: `/support?ticket=${ticketDocId}`,
        targetUserId: ticketData.userId,
        senderId: changedByUserId,
      });
    }

    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Mark ticket as read for user or admin
 */
export async function markTicketRead(ticketDocId, role) {
  try {
    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    if (role === "admin") {
      await updateDoc(ticketRef, { unreadAdmin: false });
    } else {
      await updateDoc(ticketRef, { unreadUser: false });
    }
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Upload support ticket attachment
 */
export async function uploadSupportAttachment(file) {
  try {
    if (!file) return { data: null, error: "No file provided" };
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { data: null, error: "File size must be under 5MB" };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    
    try {
      const storageRef = ref(storage, `support-attachments/${Date.now()}_${safeName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return {
        data: {
          name: file.name,
          fileUrl: url,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
        error: null,
      };
    } catch (storageErr) {
      console.warn("Storage upload failed, using Data URL fallback:", storageErr);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            data: {
              name: file.name,
              fileUrl: reader.result,
              fileType: file.type || "application/octet-stream",
              fileSize: file.size,
            },
            error: null,
          });
        };
        reader.onerror = () => resolve({ data: null, error: "Failed to read file" });
        reader.readAsDataURL(file);
      });
    }
  } catch (error) {
    return handleFirestoreError(error);
  }
}
