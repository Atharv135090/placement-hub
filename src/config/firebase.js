import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCmnwbXQimf3SPzCvHyBHVojTqMqjkdYZ0",
  authDomain: "placement-hub-f5c73.firebaseapp.com",
  projectId: "placement-hub-f5c73",
  storageBucket: "placement-hub-f5c73.firebasestorage.app",
  messagingSenderId: "44134718973",
  appId: "1:44134718973:web:278c83703418df4c7f4d94",
  measurementId: "G-Y500J31H5K",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export default app;
