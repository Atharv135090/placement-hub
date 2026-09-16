import { Navigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";

export default function ProtectedAdmin({ children, ownerOnly = false }) {
  const { isAdmin, isOwner, loading } = useAdmin();
  const isPasswordVerified = typeof window !== "undefined" && (
    sessionStorage.getItem("admin_authenticated") === "true" ||
    localStorage.getItem("admin_authenticated") === "true"
  );

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  // Admin routes strictly require:
  // 1. User must have an admin or owner role
  // 2. Password 5090 must have been verified in this session
  if (!isAdmin || !isPasswordVerified) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  if (ownerOnly && !isOwner) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return children;
}
