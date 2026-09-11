import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { db, storage, functions } from "../../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
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

export async function getModerationHistory(reportedUserId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "reports"), orderBy("createdAt", "desc"))
    );
    const allReports = mapDocs(snapshot);
    const userReports = allReports.filter((r) => r.reportedId === reportedUserId);
    return { data: userReports, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getModerationsByReport(reportId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "moderations"), where("reportId", "==", reportId), orderBy("createdAt", "desc"))
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function sendAdminMessage(reportId, targetUserId, message) {
  try {
    const fn = httpsCallable(functions, "adminSendMessage");
    const result = await fn({ reportId, targetUserId, message });
    return { data: result.data, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function sendAdminWarning(reportId, targetUserId, reason, warningMessage) {
  try {
    const fn = httpsCallable(functions, "adminSendWarning");
    const result = await fn({ reportId, targetUserId, reason, warningMessage });
    return { data: result.data, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function adminUpdateReport(reportId, status, { resolutionNote, dismissedReason } = {}) {
  try {
    const fn = httpsCallable(functions, "adminUpdateReport");
    const result = await fn({ reportId, status, resolutionNote, dismissedReason });
    return { data: result.data, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}
