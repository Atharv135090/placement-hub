import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { ATTACHMENTS, timestamp, handleFirestoreError, mapDocs } from "./helpers";

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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadJobAttachment(jobId, companyId, file) {
  try {
    const MAX_BASE64_BYTES = 700 * 1024;
    if (file.size > MAX_BASE64_BYTES) {
      return {
        data: null,
        error: "File too large for free storage (max 700KB). Please use a smaller file.",
      };
    }

    const dataUrl = await fileToDataUrl(file);

    const docRef = await addDoc(collection(db, ATTACHMENTS), {
      jobId,
      companyId: companyId || "",
      name: file.name,
      dataUrl,
      fileType: file.type || "application/pdf",
      fileSize: file.size || 0,
      uploadedAt: timestamp(),
    });

    return {
      data: { id: docRef.id, name: file.name, dataUrl, fileType: file.type, fileSize: file.size },
      error: null,
    };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAttachmentsByJob(jobId) {
  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(
          collection(db, ATTACHMENTS),
          where("jobId", "==", jobId),
          orderBy("uploadedAt", "desc")
        )
      );
    } catch {
      snapshot = await getDocs(
        query(
          collection(db, ATTACHMENTS),
          where("jobId", "==", jobId)
        )
      );
    }
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleFirestoreError(error);
  }
}

export async function getAttachmentsByCompany(companyId) {
  try {
    let snapshot;
    try {
      snapshot = await getDocs(
        query(
          collection(db, ATTACHMENTS),
          where("companyId", "==", companyId),
          orderBy("uploadedAt", "desc")
        )
      );
    } catch {
      snapshot = await getDocs(
        query(
          collection(db, ATTACHMENTS),
          where("companyId", "==", companyId)
        )
      );
    }
    const atts = mapDocs(snapshot);
    atts.sort((a, b) => {
      const ta = a.uploadedAt?.seconds ? a.uploadedAt.seconds * 1000 : new Date(a.uploadedAt || 0).getTime();
      const tb = b.uploadedAt?.seconds ? b.uploadedAt.seconds * 1000 : new Date(b.uploadedAt || 0).getTime();
      return tb - ta;
    });
    return { data: atts, error: null };
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
