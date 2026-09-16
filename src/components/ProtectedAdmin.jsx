import { Navigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";

export default function ProtectedAdmin({ children, ownerOnly = false }) {
  const { isAdmin, isOwner, loading } = useAdmin();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  // Admin routes strictly require the user to have an admin or owner Firebase role.
  if (!isAdmin) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  if (ownerOnly && !isOwner) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return children;
}
