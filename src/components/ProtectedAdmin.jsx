import { Navigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";

export default function ProtectedAdmin({ children, ownerOnly = false }) {
  const { isAdmin, isOwner, loading } = useAdmin();
  const isPasswordVerified = typeof window !== "undefined" && (
    sessionStorage.getItem("admin_authenticated") === "true" ||
    localStorage.getItem("admin_authenticated") === "true" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  // Allow access if verified via password 5090 OR user is Firestore admin OR local dev
  if (!isAdmin && !isPasswordVerified) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  if (ownerOnly && !isOwner && !isPasswordVerified) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return children;
}
