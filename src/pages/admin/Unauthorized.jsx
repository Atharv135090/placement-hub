import { Link } from "react-router-dom";
import "./Unauthorized.css";

export default function Unauthorized() {
  return (
    <div className="unauth-page">
      <div className="unauth-icon">⊘</div>
      <h1>Access Denied</h1>
      <p>You don't have permission to access the admin area.</p>
      <Link to="/" className="unauth-link">← Return to Dashboard</Link>
    </div>
  );
}
