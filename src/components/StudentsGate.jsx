import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

const Students = lazy(() => import("../pages/Students"));

const STUDENTS_PIN = "5090";
const STORAGE_KEY = "students_gate_unlocked";

function PageSpinner() {
  return (
    <div className="page-loader">
      <div className="loader-spinner" />
    </div>
  );
}

function GateUI({ onUnlock }) {
  const navigate = useNavigate();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleVerify() {
    if (pin === STUDENTS_PIN) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      onUnlock();
    } else {
      setError("Incorrect PIN.");
      setPin("");
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: 24,
    }}>
      <div className="glass" style={{
        maxWidth: 440,
        width: "100%",
        padding: "48px 36px",
        borderRadius: 20,
        textAlign: "center",
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), var(--accent-hover, #be123c))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
          Students
        </h2>
        <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
          Students is currently in development.
          <br />
          We're preparing this space for a better student experience.
          <br />
          Please check back soon.
        </p>

        <button
          className="btn btn-ghost"
          onClick={() => navigate("/")}
          style={{ marginBottom: 28, width: "100%" }}
        >
          ← Go Back
        </button>

        <div style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.08))", paddingTop: 20 }}>
          {!showPin ? (
            <button
              className="btn btn-secondary"
              onClick={() => setShowPin(true)}
              style={{ width: "100%", fontSize: "0.84rem", opacity: 0.7 }}
            >
              Admin Access
            </button>
          ) : (
            <div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 10 }}>
                Enter admin PIN to unlock Students for this session.
              </p>
              <input
                type="password"
                className="input-field"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
                autoFocus
                style={{ textAlign: "center", letterSpacing: "4px", fontSize: "1.1rem", marginBottom: 8 }}
              />
              {error && (
                <p style={{ color: "var(--accent)", fontSize: "0.82rem", fontWeight: 600, marginBottom: 8 }}>
                  {error}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setShowPin(false); setPin(""); setError(""); }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleVerify}
                  style={{ flex: 1 }}
                >
                  Unlock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentsGate() {
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  if (unlocked) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Students />
      </Suspense>
    );
  }

  return <GateUI onUnlock={() => setUnlocked(true)} />;
}
