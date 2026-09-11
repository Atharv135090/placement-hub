import { collection, doc, getDoc, getDocs, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";

export async function getStudentProfile(userId) {
  try {
    const docSnap = await getDoc(doc(db, "users", userId));
    if (!docSnap.exists()) return { data: null, error: "Profile not found" };
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToStudentProfile(userId, callback) {
  return onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("subscribeToStudentProfile error:", error);
    callback(null);
  });
}

export async function getAllStudents() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    return { data: mapDocs(snapshot), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToStudents(callback, onError) {
  return onSnapshot(collection(db, "users"), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.error("subscribeToStudents error:", error);
    if (onError) onError(error);
    callback([]);
  });
}

export async function updateStudentProfile(userId, updates) {
  try {
    await updateDoc(doc(db, "users", userId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { data: { id: userId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}
