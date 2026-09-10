import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { OWNER_EMAIL } from "../config/owner";

export function useAdmin() {
  const { user, profile, loading: authLoading } = useAuth();
  const [role, setRole] = useState(null);
  const [claimsLoaded, setClaimsLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    // Primary: use profile role from AuthContext (set from users/{uid} document)
    if (profile?.role) {
      if (!cancelled) {
        setRole(profile.role);
        setClaimsLoaded(true);
      }
      return () => { cancelled = true; };
    }

    // Fallback: check email-based ownership
    const emailIsOwner = typeof user.email === "string" &&
      user.email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();

    // Fallback: check custom claims (if Cloud Functions are deployed)
    if (typeof user?.getIdTokenResult === "function") {
      user.getIdTokenResult(true).then((result) => {
        if (!cancelled) {
          const claimsRole = result?.claims?.role || null;
          const effectiveRole = (!claimsRole && emailIsOwner) ? "owner" : (claimsRole || (emailIsOwner ? "owner" : null));
          setRole(effectiveRole);
          setClaimsLoaded(true);
        }
      }).catch(() => {
        if (!cancelled) {
          setRole(emailIsOwner ? "owner" : null);
          setClaimsLoaded(true);
        }
      });
    } else {
      if (!cancelled) {
        setRole(emailIsOwner ? "owner" : null);
        setClaimsLoaded(true);
      }
    }

    return () => { cancelled = true; };
  }, [user, profile, authLoading]);

  const loading = authLoading || !claimsLoaded;
  const isAdmin = role === "admin" || role === "owner";
  const isOwner = role === "owner";

  return { role, isAdmin, isOwner, loading };
}
