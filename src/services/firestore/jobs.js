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
  limit as firestoreLimit,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { JOBS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

export async function addJob(jobData) {
  try {
    const docRef = await addDoc(collection(db, JOBS), {
      ...jobData,
      isActive: jobData.isActive ?? true,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getJobs() {
  try {
    const snapshot = await getDocs(collection(db, JOBS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getJob(jobId) {
  try {
    const docSnap = await getDoc(doc(db, JOBS, jobId));
    if (!docSnap.exists()) {
      return { data: null, error: "Job not found" };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getJobsByCompany(companyId) {
  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(
          collection(db, JOBS),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc")
        )
      );
    } catch {
      snapshot = await getDocs(
        query(
          collection(db, JOBS),
          where("companyId", "==", companyId)
        )
      );
    }
    const jobs = mapDocs(snapshot);
    jobs.sort((a, b) => {
      const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    return { data: jobs, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function updateJob(jobId, updates) {
  try {
    await updateDoc(doc(db, JOBS, jobId), {
      ...updates,
      updatedAt: timestamp(),
    });
    return { data: { id: jobId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteJob(jobId) {
  try {
    await deleteDoc(doc(db, JOBS, jobId));
    return { data: { id: jobId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getActiveJobs() {
  try {
    const snapshot = await getDocs(
      query(collection(db, JOBS), where("isActive", "==", true))
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getRecentJobs(count = 5) {
  try {
    const snapshot = await getDocs(query(collection(db, JOBS), firestoreLimit(count)));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getJobsByCompanyIds(companyIds) {
  if (!companyIds.length) return { data: [], error: null };
  try {
    const snapshot = await getDocs(
      query(collection(db, JOBS), where("companyId", "in", companyIds))
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
