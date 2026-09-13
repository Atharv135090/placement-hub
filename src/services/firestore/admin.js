import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COMPANIES, JOBS, APPLICATIONS, ANNOUNCEMENTS, handleFirestoreError } from "./helpers";

export async function deleteAllCompanies() {
  try {
    const snapshot = await getDocs(collection(db, COMPANIES));
    const count = snapshot.size;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, COMPANIES, d.id));
    }
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllJobs() {
  try {
    const snapshot = await getDocs(collection(db, JOBS));
    const count = snapshot.size;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, JOBS, d.id));
    }
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllApplications() {
  try {
    const snapshot = await getDocs(collection(db, APPLICATIONS));
    const count = snapshot.size;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, APPLICATIONS, d.id));
    }
    return { data: { deleted: count }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAllAnnouncements() {
  try {
    const snapshot = await getDocs(collection(db, ANNOUNCEMENTS));
    const count = snapshot.size;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, ANNOUNCEMENTS, d.id));
    }
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
    // 1. Mark user document as deleted and force logout
    try {
      await updateDoc(doc(db, "users", userId), {
        forceLogout: true,
        forceLogoutAt: new Date().toISOString(),
        accountDeleted: true,
        deletedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("adminDeleteUser: user doc update error", e);
    }

    // 2. Best-effort cleanup of secondary collections
    try {
      const appSnap = await getDocs(query(collection(db, "applications"), where("userId", "==", userId)));
      for (const d of appSnap.docs) {
        await deleteDoc(doc(db, "applications", d.id)).catch(() => {});
      }
    } catch (e) {}

    try {
      const folSnap1 = await getDocs(query(collection(db, "follows"), where("fromUserId", "==", userId)));
      for (const d of folSnap1.docs) {
        await deleteDoc(doc(db, "follows", d.id)).catch(() => {});
      }
      const folSnap2 = await getDocs(query(collection(db, "follows"), where("toUserId", "==", userId)));
      for (const d of folSnap2.docs) {
        await deleteDoc(doc(db, "follows", d.id)).catch(() => {});
      }
    } catch (e) {}

    try {
      const blockSnap = await getDocs(query(collection(db, "blocks"), where("userId", "==", userId)));
      for (const d of blockSnap.docs) {
        await deleteDoc(doc(db, "blocks", d.id)).catch(() => {});
      }
    } catch (e) {}

    try {
      const notifSnap1 = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", userId)));
      for (const d of notifSnap1.docs) {
        await deleteDoc(doc(db, "notifications", d.id)).catch(() => {});
      }
      const notifSnap2 = await getDocs(query(collection(db, "notifications"), where("senderId", "==", userId)));
      for (const d of notifSnap2.docs) {
        await deleteDoc(doc(db, "notifications", d.id)).catch(() => {});
      }
    } catch (e) {}

    try {
      const convSnap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", userId)));
      for (const d of convSnap.docs) {
        await deleteDoc(doc(db, "conversations", d.id)).catch(() => {});
      }
    } catch (e) {}

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
