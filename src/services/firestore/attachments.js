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
import { db, storage } from "../../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
