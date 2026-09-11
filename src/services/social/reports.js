import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { db, storage } from "../../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { handleSocialError, mapDocs } from "./helpers";
import { getOrCreateAdminConversation, sendAdminChatMessage } from "./adminMessaging";

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
    const reports = mapDocs(snapshot).slice(0, 200);
    const enriched = await Promise.all(
      reports.map(async (r) => {
        try {
          const [reporterSnap, reportedSnap] = await Promise.all([
            getDoc(doc(db, "users", r.reporterId)),
            getDoc(doc(db, "users", r.reportedId)),
          ]);
          return {
            ...r,
            reporterName: reporterSnap.exists() ? reporterSnap.data().displayName || "Unknown" : "Deleted User",
            reportedName: reportedSnap.exists() ? reportedSnap.data().displayName || "Unknown" : "Deleted User",
          };
        } catch (e) {
          return {
            ...r,
            reporterName: "Unknown",
            reportedName: "Unknown",
          };
        }
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
    const { getAuth } = await import("firebase/auth");
    const adminId = getAuth().currentUser?.uid;
    if (!adminId) {
      console.error("sendAdminMessage: No authenticated user");
      return { data: null, error: "Not authenticated" };
    }

    console.log("sendAdminMessage:", { reportId, targetUserId, adminId });

    const convRes = await getOrCreateAdminConversation(adminId, targetUserId);
    if (convRes.error) {
      console.error("Failed to create conversation:", convRes.error);
      return { data: null, error: convRes.error };
    }

    const warningText = `[WARNING] ${warningMessage.trim()}`;
    const msgRes = await sendAdminChatMessage(
      convRes.data.id,
      adminId,
      warningText,
      [adminId, targetUserId]
    );
    if (msgRes.error) {
      console.error("Failed to send chat message:", msgRes.error);
      return { data: null, error: msgRes.error };
    }

    await addDoc(collection(db, "moderations"), {
      reportId,
      targetUserId,
      adminId,
      action: "message",
      message: message.trim(),
      conversationId: convRes.data.id,
      createdAt: new Date().toISOString(),
    });

    await addDoc(collection(db, "notifications"), {
      title: "Message from Placement Hub Admin",
      message: message.trim(),
      type: "admin_message",
      link: `/chat?adminConv=${convRes.data.id}`,
      targetUserId,
      senderId: adminId,
      readBy: [],
      createdAt: new Date().toISOString(),
    });

    console.log("sendAdminMessage: success, conversation:", convRes.data.id);
    return { data: { success: true, conversationId: convRes.data.id }, error: null };
  } catch (error) {
    console.error("sendAdminMessage FAILED:", error.code, error.message);
    return handleSocialError(error);
  }
}

export async function sendAdminWarning(reportId, targetUserId, reason, warningMessage) {
  try {
    const { getAuth } = await import("firebase/auth");
    const adminId = getAuth().currentUser?.uid;
    if (!adminId) {
      console.error("sendAdminWarning: No authenticated user");
      return { data: null, error: "Not authenticated" };
    }

    console.log("sendAdminWarning:", { reportId, targetUserId, adminId, reason });

    await addDoc(collection(db, "moderations"), {
      reportId,
      targetUserId,
      adminId,
      action: "warning",
      reason: reason || "",
      message: warningMessage.trim(),
      createdAt: new Date().toISOString(),
    });

    await updateDoc(doc(db, "reports", reportId), { status: "reviewing" });

    await addDoc(collection(db, "notifications"), {
      title: "Warning from Placement Hub Admin",
      message: `You have received a warning: ${warningMessage.trim()}`,
      type: "admin_warning",
      link: `/chat?adminConv=${convRes.data.id}`,
      targetUserId,
      senderId: adminId,
      readBy: [],
      createdAt: new Date().toISOString(),
    });

    console.log("sendAdminWarning: success");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("sendAdminWarning FAILED:", error.code, error.message);
    return handleSocialError(error);
  }
}

export async function adminUpdateReport(reportId, status, { resolutionNote, dismissedReason } = {}) {
  try {
    const { getAuth } = await import("firebase/auth");
    const adminId = getAuth().currentUser?.uid;
    if (!adminId) {
      console.error("adminUpdateReport: No authenticated user");
      return { data: null, error: "Not authenticated" };
    }

    console.log("adminUpdateReport:", { reportId, status, adminId });

    const updateData = { status };
    const now = new Date().toISOString();

    if (status === "resolved") {
      updateData.resolvedBy = adminId;
      updateData.resolvedAt = now;
      updateData.resolutionNote = resolutionNote || "";
    } else if (status === "dismissed") {
      updateData.dismissedBy = adminId;
      updateData.dismissedAt = now;
      updateData.dismissedReason = dismissedReason || "";
    }

    await updateDoc(doc(db, "reports", reportId), updateData);

    const reportSnap = await getDoc(doc(db, "reports", reportId));
    const reportedId = reportSnap.exists() ? reportSnap.data().reportedId : "";

    await addDoc(collection(db, "moderations"), {
      reportId,
      targetUserId: reportedId,
      adminId,
      action: `status_${status}`,
      reason: status === "resolved" ? resolutionNote : dismissedReason || "",
      createdAt: now,
    });

    console.log("adminUpdateReport: success");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("adminUpdateReport FAILED:", error.code, error.message);
    return handleSocialError(error);
  }
}
