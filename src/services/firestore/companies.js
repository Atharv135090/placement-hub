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
  limit,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { COMPANIES, timestamp, handleFirestoreError, mapDocs, normalizeCompanyName } from "./helpers";

export { normalizeCompanyName };

export async function addCompany(companyData) {
  try {
    const normalizedName = (companyData.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const docRef = await addDoc(collection(db, COMPANIES), {
      ...companyData,
      normalizedName,
      isActive: companyData.isActive ?? true,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getCompanies() {
  try {
    const snapshot = await getDocs(collection(db, COMPANIES));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getCompany(companyId) {
  try {
    const docSnap = await getDoc(doc(db, COMPANIES, companyId));
    if (!docSnap.exists()) {
      return { data: null, error: "Company not found" };
    }
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function updateCompany(companyId, updates) {
  try {
    const updateData = { ...updates, updatedAt: timestamp() };
    if (updates.name) {
      updateData.normalizedName = updates.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    }
    await updateDoc(doc(db, COMPANIES, companyId), updateData);
    return { data: { id: companyId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteCompany(companyId) {
  try {
    await deleteDoc(doc(db, COMPANIES, companyId));
    return { data: { id: companyId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getActiveCompanies() {
  try {
    const snapshot = await getDocs(
      query(collection(db, COMPANIES), where("isActive", "==", true))
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function findCompanyByName(name) {
  try {
    const normalized = normalizeCompanyName(name);
    if (!normalized) return { data: null, error: null };

    const exactSnapshot = await getDocs(
      query(
        collection(db, COMPANIES),
        where("normalizedName", "==", normalized),
        limit(1)
      )
    );
    if (!exactSnapshot.empty) {
      const d = exactSnapshot.docs[0];
      return { data: { id: d.id, ...d.data() }, error: null };
    }

    const allSnapshot = await getDocs(collection(db, COMPANIES));
    let bestMatch = null;
    let bestScore = 0;
    for (const d of allSnapshot.docs) {
      const data = d.data();
      const cname = (data.normalizedName || "").toLowerCase();
      if (cname.includes(normalized) || normalized.includes(cname)) {
        const score = normalized.length / Math.max(cname.length, 1);
        if (score > bestScore) { bestScore = score; bestMatch = { id: d.id, ...data }; }
      }
    }
    if (bestMatch && bestScore > 0.3) {
      return { data: bestMatch, error: null };
    }

    for (const d of allSnapshot.docs) {
      const data = d.data();
      const cname = (data.name || "").toLowerCase();
      if (cname.includes(name.toLowerCase()) || name.toLowerCase().includes(cname)) {
        return { data: { id: d.id, ...data }, error: null };
      }
    }

    return { data: null, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}
