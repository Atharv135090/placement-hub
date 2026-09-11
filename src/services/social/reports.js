import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { handleSocialError, mapDocs } from "./helpers";

export async function reportUser(reporterId, reportedId, reason, details = "", evidenceUrls = []) {
  try {
    const docRef = await addDoc(collection(db, "reports"), {
      reporterId,
      reportedId,
      reason,
      details,
      evidenceUrls,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function uploadReportEvidence(reportId, file) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `report-evidence/${reportId}/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    return { data: { fileUrl, fileName: file.name, fileType: file.type, fileSize: file.size }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getAllReports() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "reports"), orderBy("createdAt", "desc"))
    );
    const reports = mapDocs(snapshot);
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const reporterSnap = await getDoc(doc(db, "users", r.reporterId));
        const reportedSnap = await getDoc(doc(db, "users", r.reportedId));
        return {
          ...r,
          reporterName: reporterSnap.exists() ? reporterSnap.data().displayName || "Unknown" : "Deleted User",
          reportedName: reportedSnap.exists() ? reportedSnap.data().displayName || "Unknown" : "Deleted User",
        };
      })
    );
    return { data: enriched, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function updateReportStatus(reportId, status) {
  try {
    await updateDoc(doc(db, "reports", reportId), { status });
    return { data: { id: reportId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}
