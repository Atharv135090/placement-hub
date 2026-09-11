import { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthChange } from "../services/auth";
import { getUserProfile, createUserProfile, updateUserProfile } from "../services/firestore";
import { OWNER_EMAIL } from "../config/owner";
import { getAutoAssignedPhoto } from "../utils/avatar";
import { db } from "../config/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState(null);
  const forceLogoutHandledRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const { data } = await getUserProfile(firebaseUser.uid);
        if (data) {
          if (data.blocked) {
            setBlockedMessage("Your account has been blocked by Placement Hub. Please contact support if you believe this was a mistake.");
            await signOut(auth);
            return;
          }
          if (data.accountDeleted) {
            await signOut(auth);
            return;
          }
          if (data.forceLogout) {
            forceLogoutHandledRef.current = true;
            await updateUserProfile(firebaseUser.uid, { forceLogout: false, forceLogoutAt: null });
            await signOut(auth);
            return;
          }
          const isOwnerEmail = typeof firebaseUser.email === "string"
            && firebaseUser.email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();
          if (isOwnerEmail && data.role !== "owner") {
            await updateUserProfile(firebaseUser.uid, { role: "owner" });
            setProfile({ ...data, role: "owner" });
          } else {
            setProfile(data);
          }

          if (!data.photoUrl) {
            const googlePhoto = firebaseUser.photoURL;
            const autoPhoto = googlePhoto || getAutoAssignedPhoto(firebaseUser);
            await updateUserProfile(firebaseUser.uid, { photoUrl: autoPhoto });
            setProfile((prev) => prev ? { ...prev, photoUrl: autoPhoto } : prev);
          }

          try {
            await firebaseUser.getIdToken(true);
          } catch {
          }
        } else {
          const isOwnerEmail = typeof firebaseUser.email === "string"
            && firebaseUser.email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();
          const googlePhoto = firebaseUser.photoURL;
          const autoPhoto = googlePhoto || getAutoAssignedPhoto(firebaseUser);
          const { data: newProfile } = await createUserProfile(firebaseUser.uid, {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "",
            photoUrl: autoPhoto,
            role: isOwnerEmail ? "owner" : "student",
          });
          setProfile(newProfile ? { uid: firebaseUser.uid, ...newProfile } : null);
          try {
            await firebaseUser.getIdToken(true);
          } catch {
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.blocked) {
        setBlockedMessage("Your account has been blocked by Placement Hub. Please contact support if you believe this was a mistake.");
        signOut(auth);
      } else if (d.accountDeleted) {
        signOut(auth);
      } else if (d.forceLogout && !forceLogoutHandledRef.current) {
        forceLogoutHandledRef.current = true;
        updateUserProfile(user.uid, { forceLogout: false, forceLogoutAt: null }).then(() => {
          signOut(auth);
        });
      }
    }, () => {});
    return () => unsub();
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, blockedMessage, setBlockedMessage }}>
      {children}
    </AuthContext.Provider>
  );
}
