import { Link, useNavigate } from "react-router-dom";
import { useAdmin } from "../../hooks/useAdmin";
import "./Unauthorized.css";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="unauth-page">
        <div className="loader-spinner" />
      </div>
    );
  }

  // If user has admin role, redirect straight to admin panel
  if (isAdmin) {
    navigate("/admin", { replace: true });
    return null;
  }

  return (
    <div className="unauth-page">
      <div className="unauth-icon">⊘</div>
      <h1>Admin Access Required</h1>
      <p>You do not have administrator privileges. Contact the owner to request access.</p>
      
      <Link to="/" className="unauth-link">← Return to Dashboard</Link>
    </div>
  );
}
