import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Unauthorized.css";

export default function Unauthorized() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (pin.trim() === "5090") {
      sessionStorage.setItem("admin_authenticated", "true");
      navigate("/admin/companies");
    } else {
      setError("Incorrect admin passcode");
    }
  }

  return (
    <div className="unauth-page">
      <div className="unauth-icon">⊘</div>
      <h1>Admin Access Required</h1>
      <p>Enter the admin passcode (5090) to proceed to Admin Panel, or return to Dashboard.</p>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="password"
          placeholder="Passcode: 5090"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "1px solid rgba(0,0,0,0.12)",
            background: "var(--bg-surface, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            fontSize: "0.9rem",
            outline: "none"
          }}
        />
        <button
          type="submit"
          style={{
            padding: "9px 20px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.88rem",
            boxShadow: "0 2px 10px rgba(225, 29, 72, 0.3)"
          }}
        >
          Unlock Admin
        </button>
      </form>
      
      {error && <p style={{ color: "#e11d48", fontSize: "0.85rem", marginTop: "-10px", marginBottom: "18px", fontWeight: 600 }}>{error}</p>}
      
      <Link to="/" className="unauth-link">← Return to Dashboard</Link>
    </div>
  );
}
