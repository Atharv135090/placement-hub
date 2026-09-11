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
    await updateDoc(doc(db, "users", userId), {
      forceLogout: true,
      forceLogoutAt: new Date().toISOString(),
      accountDeleted: true,
      deletedAt: new Date().toISOString(),
    });

    const collectionsToDelete = ["applications", "follows", "blocks", "notifications"];
    for (const col of collectionsToDelete) {
      const snap = await getDocs(query(collection(db, col), where("userId", "==", userId)));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, col, d.id));
      }
    }

    const sentNotifSnap = await getDocs(query(collection(db, "notifications"), where("senderId", "==", userId)));
    for (const d of sentNotifSnap.docs) {
      await deleteDoc(doc(db, "notifications", d.id));
    }

    const convSnap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", userId)));
    for (const d of convSnap.docs) {
      await deleteDoc(doc(db, "conversations", d.id));
    }

    return { data: { success: true }, error: null };
  } catch (error) {
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
