import { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange } from "../services/auth";
import { getUserProfile, createUserProfile, updateUserProfile } from "../services/firestore";
import { OWNER_EMAIL } from "../config/owner";
import { getAutoAssignedPhoto } from "../utils/avatar";

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

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const { data } = await getUserProfile(firebaseUser.uid);
        if (data) {
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
