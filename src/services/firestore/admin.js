import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "../../config/firebase";
import { COMPANIES, JOBS, APPLICATIONS, ANNOUNCEMENTS, handleFirestoreError } from "./helpers";

const callAdminLogoutUser = httpsCallable(functions, "adminLogoutUser");
const callAdminDeleteUser = httpsCallable(functions, "adminDeleteUser");
const callAdminBlockUser = httpsCallable(functions, "adminBlockUser");

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
    await callAdminLogoutUser({ userId });
    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error.message || "Failed to logout user" };
  }
}

export async function adminDeleteUser(userId) {
  try {
    await callAdminDeleteUser({ userId });
    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error.message || "Failed to delete user" };
  }
}

export async function adminBlockUser(userId, blocked) {
  try {
    await callAdminBlockUser({ userId, blocked });
    return { data: { success: true, blocked }, error: null };
  } catch (error) {
    return { data: null, error: error.message || "Failed to update block state" };
  }
}
