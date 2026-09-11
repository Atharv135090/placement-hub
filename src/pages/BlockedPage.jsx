import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

export default function BlockedPage() {
  const { blockedMessage, setBlockedMessage } = useAuth();

  async function handleSignOut() {
    setBlockedMessage(null);
    await signOut(auth);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg, #0a0a0f)",
      color: "var(--text, #e2e8f0)",
      padding: 20,
    }}>
      <div style={{
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        background: "var(--card-bg, rgba(255,255,255,0.04))",
        border: "1px solid var(--border, rgba(255,255,255,0.08))",
        borderRadius: 16,
        padding: "40px 32px",
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
          Account Blocked
        </h1>

        <p style={{
          fontSize: 15,
          color: "var(--text-secondary, #94a3b8)",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          {blockedMessage || "Your account has been blocked by Placement Hub. Please contact support if you believe this was a mistake."}
        </p>

        <div style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 24,
          fontSize: 13,
          color: "var(--text-secondary, #94a3b8)",
        }}>
          <strong style={{ color: "var(--text, #e2e8f0)" }}>Need help?</strong>
          <br />
          Contact the Placement Hub administrator for assistance with your account.
        </div>

        <button
          onClick={handleSignOut}
          style={{
            background: "var(--accent, #e11d48)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
