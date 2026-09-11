import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { APPLICATIONS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

function getApplicationDocId(userId, jobId) {
  return `${userId}_${jobId}`;
}

export async function addApplication(applicationData) {
  try {
    const docId = getApplicationDocId(applicationData.userId, applicationData.jobId);
    const docRef = doc(db, APPLICATIONS, docId);
    await setDoc(docRef, {
      ...applicationData,
      status: applicationData.status ?? "applied",
      createdAt: timestamp(),
      updatedAt: timestamp(),
    }, { merge: true });
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getApplicationByUserAndJob(userId, jobId) {
  try {
    const docId = getApplicationDocId(userId, jobId);
    const docSnap = await getDoc(doc(db, APPLICATIONS, docId));
    if (!docSnap.exists()) {
      return { data: null, error: null };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getMyApplications(userId) {
  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(
          collection(db, APPLICATIONS),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      );
    } catch {
      snapshot = await getDocs(
        query(
          collection(db, APPLICATIONS),
          where("userId", "==", userId)
        )
      );
    }
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getApplication(applicationId) {
  try {
    const docSnap = await getDoc(doc(db, APPLICATIONS, applicationId));
    if (!docSnap.exists()) {
      return { data: null, error: "Application not found" };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function updateApplication(applicationId, updates) {
  try {
    await updateDoc(doc(db, APPLICATIONS, applicationId), {
      ...updates,
      updatedAt: timestamp(),
    });
    return { data: { id: applicationId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function addApplicationMessage(applicationId, message) {
  try {
    const appRef = doc(db, APPLICATIONS, applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) return { error: "Application not found" };
    const existing = appSnap.data().messages || [];
    const newMessage = {
      id: `msg_${Date.now()}`,
      text: message.text,
      createdAt: new Date().toISOString(),
    };
    await updateDoc(appRef, {
      messages: [...existing, newMessage],
      updatedAt: timestamp(),
    });
    return { data: newMessage, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteApplicationMessage(applicationId, messageId) {
  try {
    const appRef = doc(db, APPLICATIONS, applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) return { error: "Application not found" };
    const existing = appSnap.data().messages || [];
    await updateDoc(appRef, {
      messages: existing.filter(m => m.id !== messageId),
      updatedAt: timestamp(),
    });
    return { data: { id: messageId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getApplicationsByJobIds(userId, jobIds) {
  if (!jobIds.length) return { data: [], error: null };
  try {
    const snapshot = await getDocs(
      query(
        collection(db, APPLICATIONS),
        where("userId", "==", userId),
        where("jobId", "in", jobIds)
      )
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAllApplications() {
  try {
    const snapshot = await getDocs(collection(db, APPLICATIONS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteApplication(applicationId) {
  try {
    await deleteDoc(doc(db, APPLICATIONS, applicationId));
    return { data: { id: applicationId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
