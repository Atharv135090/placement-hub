import { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange } from "../services/auth";
import { getUserProfile, createUserProfile, updateUserProfile } from "../services/firestore";
import { OWNER_EMAIL } from "../config/owner";

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
          // Force token refresh so custom claims are up-to-date
          try {
            await firebaseUser.getIdToken(true);
          } catch {
            // Token refresh failed — continue with document-based role
          }
        } else {
          const isOwnerEmail = typeof firebaseUser.email === "string"
            && firebaseUser.email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();
          const { data: newProfile } = await createUserProfile(firebaseUser.uid, {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "",
            photoUrl: firebaseUser.photoURL || "",
            role: isOwnerEmail ? "owner" : "student",
          });
          setProfile(newProfile ? { uid: firebaseUser.uid, ...newProfile } : null);
          // Force token refresh so custom claims are set
          try {
            await firebaseUser.getIdToken(true);
          } catch {
            // Token refresh failed — continue with document-based role
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
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
