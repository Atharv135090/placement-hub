import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COMPANIES, JOBS, APPLICATIONS, ANNOUNCEMENTS, handleFirestoreError } from "./helpers";

async function batchDelete(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const docs = snapshot.docs;
  const count = docs.length;
  const BATCH_SIZE = 500;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.delete(doc(db, collectionName, d.id));
    }
    await batch.commit();
  }
  return count;
}

export async function deleteAllCompanies() {
  try {
    const count = await batchDelete(COMPANIES);
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllJobs() {
  try {
    const count = await batchDelete(JOBS);
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllApplications() {
  try {
    const count = await batchDelete(APPLICATIONS);
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllAnnouncements() {
  try {
    const count = await batchDelete(ANNOUNCEMENTS);
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function adminLogoutUser(userId) {
  try {
    await updateDoc(doc(db, "users", userId), {
      forceLogout: true,
      forceLogoutAt: new Date().toISOString(),
    });
    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error.message || "Failed to logout user" };
  }
}

export async function adminDeleteUser(userId) {
  try {
    // ── 0. Mark user as pending deletion (visible immediately in admin list) ──
    try {
      await updateDoc(doc(db, "users", userId), {
        accountDeleted: true,
        accountDeletedAt: new Date().toISOString(),
      });
    } catch (_) {}

    // ── 1. Delete follow relationships (both directions) ──
    try {
      const folSnap1 = await getDocs(query(collection(db, "follows"), where("fromUserId", "==", userId)));
      for (const d of folSnap1.docs) {
        await deleteDoc(doc(db, "follows", d.id)).catch(() => {});
      }
      const folSnap2 = await getDocs(query(collection(db, "follows"), where("toUserId", "==", userId)));
      for (const d of folSnap2.docs) {
        await deleteDoc(doc(db, "follows", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: follows cleanup error", e);
    }

    // ── 2. Delete notifications (both sender and target) ──
    try {
      const notifSnap1 = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", userId)));
      for (const d of notifSnap1.docs) {
        await deleteDoc(doc(db, "notifications", d.id)).catch(() => {});
      }
      const notifSnap2 = await getDocs(query(collection(db, "notifications"), where("senderId", "==", userId)));
      for (const d of notifSnap2.docs) {
        await deleteDoc(doc(db, "notifications", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: notifications cleanup error", e);
    }

    // ── 3. Delete applications ──
    try {
      const appSnap = await getDocs(query(collection(db, "applications"), where("userId", "==", userId)));
      for (const d of appSnap.docs) {
        await deleteDoc(doc(db, "applications", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: applications cleanup error", e);
    }

    // ── 4. Delete blocks (both directions) ──
    try {
      const blockSnap1 = await getDocs(query(collection(db, "blocks"), where("blockerId", "==", userId)));
      for (const d of blockSnap1.docs) {
        await deleteDoc(doc(db, "blocks", d.id)).catch(() => {});
      }
      const blockSnap2 = await getDocs(query(collection(db, "blocks"), where("blockedId", "==", userId)));
      for (const d of blockSnap2.docs) {
        await deleteDoc(doc(db, "blocks", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: blocks cleanup error", e);
    }

    // ── 5. Delete conversations and their messages ──
    try {
      const convSnap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", userId)));
      for (const d of convSnap.docs) {
        // Delete messages in this conversation
        try {
          const msgSnap = await getDocs(query(collection(db, "messages"), where("conversationId", "==", d.id)));
          for (const m of msgSnap.docs) {
            await deleteDoc(doc(db, "messages", m.id)).catch(() => {});
          }
        } catch (_) {}
        await deleteDoc(doc(db, "conversations", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: conversations cleanup error", e);
    }

    // ── 6. Delete admin conversations and their messages ──
    try {
      const adminConvSnap = await getDocs(query(collection(db, "adminConversations"), where("participants", "array-contains", userId)));
      for (const d of adminConvSnap.docs) {
        try {
          const adminMsgSnap = await getDocs(query(collection(db, "adminMessages"), where("conversationId", "==", d.id)));
          for (const m of adminMsgSnap.docs) {
            await deleteDoc(doc(db, "adminMessages", m.id)).catch(() => {});
          }
        } catch (_) {}
        await deleteDoc(doc(db, "adminConversations", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: admin conversations cleanup error", e);
    }

    // ── 7. Delete support tickets and their messages ──
    try {
      const ticketSnap = await getDocs(query(collection(db, "supportTickets"), where("userId", "==", userId)));
      for (const d of ticketSnap.docs) {
        try {
          const ticketMsgSnap = await getDocs(collection(db, "supportTickets", d.id, "messages"));
          for (const m of ticketMsgSnap.docs) {
            await deleteDoc(doc(db, "supportTickets", d.id, "messages", m.id)).catch(() => {});
          }
        } catch (_) {}
        await deleteDoc(doc(db, "supportTickets", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: support tickets cleanup error", e);
    }

    // ── 8. Delete userKeys (E2EE public key) ──
    try {
      await deleteDoc(doc(db, "userKeys", userId)).catch(() => {});
    } catch (e) {
      console.warn("adminDeleteUser: userKeys cleanup error", e);
    }

    // ── 9. Delete resume chunks subcollection ──
    try {
      const chunkSnap = await getDocs(collection(db, "users", userId, "resumeChunks"));
      for (const d of chunkSnap.docs) {
        await deleteDoc(doc(db, "users", userId, "resumeChunks", d.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("adminDeleteUser: resume chunks cleanup error", e);
    }

    // ── 10. Delete user document (last, after all related data is cleaned) ──
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (e) {
      console.warn("adminDeleteUser: user doc delete error", e);
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("adminDeleteUser error:", error);
    return { data: null, error: error.message || "Failed to delete user" };
  }
}

export async function adminBlockUser(userId, blocked) {
  try {
    await updateDoc(doc(db, "users", userId), {
      blocked: blocked,
      blockedAt: blocked ? new Date().toISOString() : null,
      forceLogout: blocked,
      forceLogoutAt: blocked ? new Date().toISOString() : null,
    });
    return { data: { success: true, blocked }, error: null };
  } catch (error) {
    return { data: null, error: error.message || "Failed to update block state" };
  }
}
