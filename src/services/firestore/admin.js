import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
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
    return handleFirestoreError(error);
  }
}

export async function adminDeleteUser(userId) {
  try {
    const batch_ops = [];

    batch_ops.push(updateDoc(doc(db, "users", userId), {
      accountDeleted: true,
      deletedAt: new Date().toISOString(),
      displayName: "[Deleted User]",
      email: null,
      photoUrl: null,
      skills: [],
      projects: [],
      about: "",
      forceLogout: true,
      forceLogoutAt: new Date().toISOString(),
    }));

    const followSnap1 = await getDocs(query(collection(db, "follows"), where("fromUserId", "==", userId)));
    followSnap1.forEach((d) => batch_ops.push(deleteDoc(doc(db, "follows", d.id))));

    const followSnap2 = await getDocs(query(collection(db, "follows"), where("toUserId", "==", userId)));
    followSnap2.forEach((d) => batch_ops.push(deleteDoc(doc(db, "follows", d.id))));

    const blockSnap1 = await getDocs(query(collection(db, "blocks"), where("blockerId", "==", userId)));
    blockSnap1.forEach((d) => batch_ops.push(deleteDoc(doc(db, "blocks", d.id))));

    const blockSnap2 = await getDocs(query(collection(db, "blocks"), where("blockedId", "==", userId)));
    blockSnap2.forEach((d) => batch_ops.push(deleteDoc(doc(db, "blocks", d.id))));

    const notifSnap = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", userId)));
    notifSnap.forEach((d) => batch_ops.push(deleteDoc(doc(db, "notifications", d.id))));

    await Promise.all(batch_ops);
    return { data: { success: true }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
