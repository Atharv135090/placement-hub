import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, auth } from "../../config/firebase";
import { SUPPORT_TICKETS, NOTIFICATIONS, handleFirestoreError, mapDocs } from "./helpers";
import { createNotification } from "./notifications";

async function getAdminUserIds() {
  const snap = await getDocs(
    query(collection(db, "users"), where("role", "in", ["admin", "owner"]))
  );
  return snap.docs.map((d) => d.id);
}

/**
 * Generate collision-safe ticket ID (e.g. SUP-001, SUP-7X9)
 */
export function generateTicketId() {
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `SUP-${randomPart}`;
}

/**
 * Create a new support ticket with initial message
 */
export async function createSupportTicket({ userId, userName, userEmail, subject, message, category, priority, attachment = null }) {
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
      category: category || "Account / Login",
      priority: priority || "Medium",
      status: "submitted",
      statusHistory: {
        submitted: serverTimestamp(),
      },
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

    // 3. Notify admins — fire-and-forget so notification failures never block the request
    notifyAdminsOfNewTicket(docId, userId, userName, subject.trim()).catch(() => {});

    return { data: { id: docId, ticketId: ticketIdCode }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Notify admin/owner users of a new support ticket (fire-and-forget).
 * Student users cannot read the users collection, so we query via admin token
 * and silently skip if the query fails.
 */
async function notifyAdminsOfNewTicket(ticketDocId, senderUserId, senderUserName, subject) {
  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "in", ["admin", "owner"]))
    );
    const adminIds = snap.docs.map((d) => d.id);
    if (adminIds.length === 0) return;

    await Promise.all(
      adminIds.map((adminId) =>
        createNotification({
          title: "New Support Request",
          message: `${senderUserName || "A user"} sent a Support Request: "${subject}"`,
          type: "support_request",
          link: `/admin/support?ticket=${ticketDocId}`,
          targetUserId: adminId,
          senderId: senderUserId,
        })
      )
    );
  } catch (e) {
    console.warn("Failed to notify admins of new support request:", e);
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

  let fallbackUnsub = null;

  const primaryUnsub = onSnapshot(
    q,
    (snapshot) => {
      const messages = mapDocs(snapshot);
      callback(messages);
    },
    (error) => {
      // Fallback query without orderBy if index is still building
      console.warn("subscribeTicketMessages index warning, using unsorted fallback:", error);
      const fallbackQuery = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);
      fallbackUnsub = onSnapshot(fallbackQuery, (snap) => {
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

  return () => {
    primaryUnsub();
    fallbackUnsub?.();
  };
}

/**
 * Add message to a support ticket
 */
export async function addTicketMessage(ticketDocId, { senderId, senderRole, senderName, text, attachment = null, isInternalNote = false }) {
  try {
    if (!text || !text.trim()) {
      return { data: null, error: "Message text cannot be empty" };
    }

    const trimmedText = text.trim();
    const messagesCol = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);

    const msgData = {
      senderId,
      senderRole, // "user" | "admin"
      senderName: senderName || (senderRole === "admin" ? "Admin Support" : "User"),
      text: trimmedText,
      attachment: attachment || null,
      createdAt: serverTimestamp(),
    };
    if (isInternalNote) {
      msgData.isInternalNote = true;
    }

    // Add message
    const msgRef = await addDoc(messagesCol, msgData);

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

    // Create notification if admin replied to user (not for internal notes)
    if (senderRole === "admin" && !isInternalNote && ticketData?.userId) {
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
 * Update ticket status (submitted | under_review | in_progress | resolved)
 */
export async function updateTicketStatus(ticketDocId, newStatus, changedByUserId) {
  try {
    const rawStatus = (newStatus || "").trim();
    const lower = rawStatus.toLowerCase().replace(/\s+/g, "_");
    const allowed = ["submitted", "open", "under_review", "in_progress", "resolved", "closed"];
    if (!allowed.includes(lower)) {
      return { data: null, error: "Invalid status value: " + newStatus };
    }

    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    const ticketSnap = await getDoc(ticketRef);
    const ticketData = ticketSnap.exists() ? ticketSnap.data() : null;

    // Store status history for timeline
    const historyKey = (lower === "open" || lower === "submitted") ? "submitted" : lower;
    const statusHistoryField = `statusHistory.${historyKey}`;

    await updateDoc(ticketRef, {
      status: rawStatus,
      updatedAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      statusChangedBy: changedByUserId || "admin",
      [statusHistoryField]: serverTimestamp(),
    });

    // Send notification to user if status changed by admin
    if (ticketData?.userId && ticketData.userId !== changedByUserId) {
      const statusLabels = {
        submitted: "Submitted",
        under_review: "Under Review",
        in_progress: "In Progress",
        resolved: "Resolved",
      };
      await createNotification({
        title: `Support Request Status Changed (#${ticketData.ticketId || "SUP"})`,
        message: `Your support request status has been updated to "${statusLabels[newStatus] || newStatus}".`,
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
 * Delete a support ticket message (admin only)
 */
export async function deleteTicketMessage(ticketDocId, messageDocId) {
  try {
    const msgRef = doc(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`, messageDocId);
    await deleteDoc(msgRef);

    // Update parent ticket updatedAt
    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    await updateDoc(ticketRef, { updatedAt: serverTimestamp() });

    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Edit a support ticket message (admin only) — adds edited flag and original text
 */
export async function editTicketMessage(ticketDocId, messageDocId, newText) {
  try {
    if (!newText || !newText.trim()) {
      return { data: null, error: "Message text cannot be empty" };
    }

    const msgRef = doc(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`, messageDocId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) {
      return { data: null, error: "Message not found" };
    }

    const msgData = msgSnap.data();
    const updates = {
      text: newText.trim(),
      edited: true,
      editedAt: serverTimestamp(),
    };
    // Store original text only on first edit
    if (!msgData.originalText && !msgData.edited) {
      updates.originalText = msgData.text;
    }

    await updateDoc(msgRef, updates);
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Completely and permanently delete a support ticket, its subcollection messages,
 * associated storage attachments, and related notifications.
 */
export async function deleteSupportTicket(ticketDocId) {
  try {
    if (!ticketDocId) return { error: "Ticket ID is required" };

    const ticketRef = doc(db, SUPPORT_TICKETS, ticketDocId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      // Already deleted or not found
      return { error: null };
    }

    const ticketData = ticketSnap.data();

    // Collect attachments for storage cleanup
    const attachmentUrls = [];
    if (ticketData?.attachment?.fileUrl) {
      attachmentUrls.push(ticketData.attachment.fileUrl);
    }

    // 1. Fetch all messages in subcollection
    const messagesCol = collection(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`);
    const messagesSnap = await getDocs(messagesCol);

    for (const msgDoc of messagesSnap.docs) {
      const msgData = msgDoc.data();
      if (msgData?.attachment?.fileUrl) {
        attachmentUrls.push(msgData.attachment.fileUrl);
      }
    }

    // 2. Delete messages first while ticket document still exists (preserves Firestore security rules verification)
    const messageDeletes = messagesSnap.docs.map((msgDoc) =>
      deleteDoc(doc(db, `${SUPPORT_TICKETS}/${ticketDocId}/messages`, msgDoc.id))
    );
    await Promise.all(messageDeletes);

    // 3. Delete the ticket document itself
    await deleteDoc(ticketRef);

    // 4. Delete related notifications for this ticket
    try {
      let notifDocs = [];
      try {
        const notifQuery = query(
          collection(db, NOTIFICATIONS),
          where("link", "==", `/support?ticket=${ticketDocId}`)
        );
        const notifSnap = await getDocs(notifQuery);
        notifDocs = notifSnap.docs;
      } catch (queryErr) {
        const currentUid = auth?.currentUser?.uid || ticketData?.userId;
        if (currentUid) {
          const userNotifQuery = query(
            collection(db, NOTIFICATIONS),
            where("targetUserId", "==", currentUid),
            where("link", "==", `/support?ticket=${ticketDocId}`)
          );
          const userNotifSnap = await getDocs(userNotifQuery);
          notifDocs = userNotifSnap.docs;
        }
      }

      if (notifDocs && notifDocs.length > 0) {
        const notifDeletes = notifDocs.map((nDoc) =>
          deleteDoc(doc(db, NOTIFICATIONS, nDoc.id)).catch(() => {})
        );
        await Promise.all(notifDeletes);
      }
    } catch (notifErr) {
      console.warn("Notification cleanup non-fatal error:", notifErr);
    }

    // 5. Clean up attachments in Firebase Storage
    for (const url of attachmentUrls) {
      if (url && typeof url === "string" && url.includes("firebasestorage.googleapis.com")) {
        try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef).catch(() => {});
        } catch (storageErr) {
          // ignore storage error if already deleted
        }
      }
    }

    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

/**
 * Upload support ticket attachment.
 * Returns metadata with a Storage URL or a data-URL fallback.
 * Never throws — always returns { data, error }.
 */
export async function uploadSupportAttachment(file) {
  try {
    if (!file) return { data: null, error: "No file provided" };

    if (file.size > 5 * 1024 * 1024) {
      return { data: null, error: "File size must be under 5MB" };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Attempt Storage upload with a 15-second timeout so we never hang
    try {
      const storageRef = ref(storage, `support-attachments/${Date.now()}_${safeName}`);
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Storage upload timed out")), 15000)
      );
      await Promise.race([uploadPromise, timeoutPromise]);

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
    }

    // Fallback: read as data URL so the request is never blocked by Storage
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
  } catch (error) {
    return handleFirestoreError(error);
  }
}
