import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── COLLECTIONS ──────────────────────────────────────────────

const COMPANIES = "companies";
const JOBS = "jobs";
const USERS = "users";
const APPLICATIONS = "applications";
const ANNOUNCEMENTS = "announcements";
const ATTACHMENTS = "attachments";
const NOTIFICATIONS = "notifications";

export function normalizeCompanyName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── HELPERS ──────────────────────────────────────────────────

function timestamp() {
  return serverTimestamp();
}

function handleFirestoreError(error) {
  console.error("Firestore operation failed:", error.message);
  return { data: null, error: error.message };
}

function mapDocs(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ═══════════════════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// JOBS / PLACEMENT DRIVES
// ═══════════════════════════════════════════════════════════════

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
    const snapshot = await getDocs(
      query(
        collection(db, JOBS),
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc")
      )
    );
    return { data: mapDocs(snapshot), error: null };
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

// ═══════════════════════════════════════════════════════════════
// USERS / STUDENT PROFILES
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// APPLICATIONS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════

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

export async function getRecentJobs(count = 5) {
  try {
    const snapshot = await getDocs(query(collection(db, JOBS), limit(count)));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// SAVED JOBS (stored as array in user profile)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// BATCH APPLICATION LOOKUP
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ADMIN: ALL APPLICATIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllApplications() {
  try {
    const snapshot = await getDocs(collection(db, APPLICATIONS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: ALL USERS
// ═══════════════════════════════════════════════════════════════

export async function getAllUsers() {
  try {
    const snapshot = await getDocs(collection(db, USERS));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: DELETE APPLICATION
// ═══════════════════════════════════════════════════════════════

export async function deleteApplication(applicationId) {
  try {
    await deleteDoc(doc(db, APPLICATIONS, applicationId));
    return { data: { id: applicationId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: COUNT HELPERS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ATTACHMENTS
// ═══════════════════════════════════════════════════════════════

export async function addAttachment(attachmentData) {
  try {
    const docRef = await addDoc(collection(db, ATTACHMENTS), {
      ...attachmentData,
      uploadedAt: timestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function uploadJobAttachment(jobId, companyId, file) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `job-attachments/${jobId}/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);
    const docRef = await addDoc(collection(db, ATTACHMENTS), {
      jobId,
      companyId: companyId || "",
      name: file.name,
      fileUrl,
      fileType: file.type || "application/pdf",
      fileSize: file.size || 0,
      uploadedAt: timestamp(),
    });
    return { data: { id: docRef.id, name: file.name, fileUrl, fileType: file.type, fileSize: file.size }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAttachmentsByJob(jobId) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, ATTACHMENTS),
        where("jobId", "==", jobId),
        orderBy("uploadedAt", "desc")
      )
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAttachmentsByCompany(companyId) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, ATTACHMENTS),
        where("companyId", "==", companyId),
        orderBy("uploadedAt", "desc")
      )
    );
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function deleteAttachment(attachmentId) {
  try {
    await deleteDoc(doc(db, ATTACHMENTS, attachmentId));
    return { data: { id: attachmentId }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPANY SEARCH (by normalizedName)
// ═══════════════════════════════════════════════════════════════

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

// ─── NOTIFICATIONS ──────────────────────────────────────────────

export async function createNotification({ title, message, type, link, targetUserId }) {
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS), {
      title,
      message,
      type: type || "info",
      link: link || null,
      targetUserId: targetUserId || null,
      readBy: [],
      createdAt: serverTimestamp(),
    });
    return { data: { id: docRef.id }, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getUnreadNotifications(userId) {
  try {
    const snapshot = await getDocs(collection(db, NOTIFICATIONS));
    const notifications = mapDocs(snapshot)
      .filter((n) => !n.readBy?.includes(userId) && (!n.targetUserId || n.targetUserId === userId))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 50);
    return { data: notifications, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAllNotifications() {
  try {
    const snapshot = await getDocs(collection(db, NOTIFICATIONS));
    const notifications = mapDocs(snapshot)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 50);
    return { data: notifications, error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function markNotificationRead(notificationId, userId) {
  try {
    const docRef = doc(db, NOTIFICATIONS, notificationId);
    await updateDoc(docRef, { readBy: arrayUnion(userId) });
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function markAllNotificationsRead(userId) {
  try {
    const snapshot = await getDocs(collection(db, NOTIFICATIONS));
    const batch = snapshot.docs.filter((d) => !d.data().readBy?.includes(userId));
    for (const d of batch) {
      await updateDoc(doc(db, NOTIFICATIONS, d.id), { readBy: arrayUnion(userId) });
    }
    return { error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: BULK DELETE
// ═══════════════════════════════════════════════════════════════

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
