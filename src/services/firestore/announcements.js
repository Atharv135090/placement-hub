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
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { ANNOUNCEMENTS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

export async function addAnnouncement(announcementData) {
  try {
    const docRef = await addDoc(collection(db, ANNOUNCEMENTS), {
      ...announcementData,
      isActive: announcementData.isActive ?? true,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAnnouncements() {
  try {
    const snapshot = await getDocs(collection(db, ANNOUNCEMENTS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAnnouncement(announcementId) {
  try {
    const docSnap = await getDoc(doc(db, ANNOUNCEMENTS, announcementId));
    if (!docSnap.exists()) {
      return { data: null, error: "Announcement not found" };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function updateAnnouncement(announcementId, updates) {
  try {
    await updateDoc(doc(db, ANNOUNCEMENTS, announcementId), {
      ...updates,
      updatedAt: timestamp(),
    });
    return { data: { id: announcementId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAnnouncement(announcementId) {
  try {
    await deleteDoc(doc(db, ANNOUNCEMENTS, announcementId));
    return { data: { id: announcementId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getActiveAnnouncements() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, ANNOUNCEMENTS),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      )
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
