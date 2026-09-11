import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, storage } from "../../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { USERS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

export async function createUserProfile(userId, profileData) {
  try {
    await setDoc(doc(db, USERS, userId), {
      uid: userId,
      ...profileData,
      role: profileData.role ?? "student",
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });
    return { data: { id: userId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getUserProfile(userId) {
  try {
    const docSnap = await getDoc(doc(db, USERS, userId));
    if (!docSnap.exists()) {
      return { data: null, error: "User profile not found" };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function updateUserProfile(userId, updates) {
  try {
    await updateDoc(doc(db, USERS, userId), {
      ...updates,
      updatedAt: timestamp(),
    });
    return { data: { id: userId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function uploadProfilePicture(userId, file) {
  try {
    const storageRef = ref(storage, `profile-pictures/${userId}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await updateDoc(doc(db, USERS, userId), {
      photoUrl: downloadURL,
      updatedAt: timestamp(),
    });
    return { data: { photoUrl: downloadURL }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function uploadResume(userId, file) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `resumes/${userId}/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    await updateDoc(doc(db, USERS, userId), {
      resumeUrl: downloadURL,
      resumeFileName: file.name,
      updatedAt: timestamp(),
    });
    return { data: { resumeUrl: downloadURL, resumeFileName: file.name }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function toggleSaveJob(userId, jobId, isSaved) {
  try {
    const userRef = doc(db, USERS, userId);
    const operation = isSaved ? arrayRemove(jobId) : arrayUnion(jobId);
    await updateDoc(userRef, {
      savedJobIds: operation,
      updatedAt: timestamp(),
    });
    return { data: { jobId, saved: !isSaved }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getUserSavedIds(userId) {
  try {
    const docSnap = await getDoc(doc(db, USERS, userId));
    if (!docSnap.exists()) return { data: [], error: null };
    return { data: docSnap.data().savedJobIds || [], error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, USERS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
