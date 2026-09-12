import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { USERS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CHUNK_SIZE = 800000;

export async function createUserProfile(userId, profileData) {
  try {
    await setDoc(doc(db, USERS, userId), {
      uid: userId,
      ...profileData,
      originalName: profileData.displayName || "",
      usernameHistory: [],
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
    const dataUrl = await fileToBase64(file);
    await updateDoc(doc(db, USERS, userId), {
      photoUrl: dataUrl,
      updatedAt: timestamp(),
    });
    return { data: { photoUrl: dataUrl }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function uploadResume(userId, file) {
  try {
    const dataUrl = await fileToBase64(file);
    const base64 = dataUrl.split(",")[1] || "";
    const mimeType = file.type || "application/pdf";

    const oldSnap = await getDocs(collection(db, USERS, userId, "resumeChunks"));
    for (const d of oldSnap.docs) {
      await deleteDoc(d.ref);
    }

    const chunks = [];
    for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
      chunks.push(base64.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      await setDoc(doc(db, USERS, userId, "resumeChunks", `chunk_${i}`), {
        data: chunks[i],
        index: i,
      });
    }

    await updateDoc(doc(db, USERS, userId), {
      resumeFileName: file.name,
      resumeChunks: chunks.length,
      resumeMimeType: mimeType,
      updatedAt: timestamp(),
    });

    return { data: { resumeUrl: null, resumeFileName: file.name }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getResumeDataUrl(userId) {
  try {
    const userSnap = await getDoc(doc(db, USERS, userId));
    if (!userSnap.exists()) return { data: null, error: null };

    const userData = userSnap.data();
    if (!userData.resumeChunks) return { data: null, error: null };

    let base64 = "";
    for (let i = 0; i < userData.resumeChunks; i++) {
      const chunkSnap = await getDoc(
        doc(db, USERS, userId, "resumeChunks", `chunk_${i}`)
      );
      if (chunkSnap.exists()) {
        base64 += chunkSnap.data().data;
      }
    }

    if (!base64) return { data: null, error: null };

    const mimeType = userData.resumeMimeType || "application/pdf";
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return {
      data: { dataUrl, fileName: userData.resumeFileName || "Resume" },
      error: null,
    };
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
