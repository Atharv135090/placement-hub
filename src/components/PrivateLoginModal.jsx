import { useState } from "react";
import { usePrivateControl } from "../contexts/PrivateControlContext";
import { signInWithEmail, signInWithGoogle } from "../services/auth";
import { OWNER_EMAIL } from "../config/owner";
import "./PrivateLoginModal.css";

function isOwnerEmail(email) {
  return typeof email === "string" && email.trim().toLowerCase() === OWNER_EMAIL.trim().toLowerCase();
}

export default function PrivateLoginModal() {
  const { showLoginModal, closeLoginModal, enterPrivateMode } = usePrivateControl();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!showLoginModal) return null;

  async function handleEmailLogin(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);

    const { user: authUser, error: authError } = await signInWithEmail(email, password);
    if (authError) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }

    if (!isOwnerEmail(authUser.email)) {
      setError("This account is not authorized for private access.");
      setBusy(false);
      return;
    }

    enterPrivateMode(authUser);
    setBusy(false);
    setEmail("");
    setPassword("");
  }

  async function handleGoogleLogin() {
    if (busy) return;
    setError("");
    setBusy(true);

    const { user: authUser, error: authError } = await signInWithGoogle();
    if (authError) {
      setError("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (!authUser) {
      setBusy(false);
      return;
    }

    if (!isOwnerEmail(authUser.email)) {
      setError("This account is not authorized for private access.");
      setBusy(false);
      return;
    }

    enterPrivateMode(authUser);
    setBusy(false);
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      closeLoginModal();
      setError("");
      setEmail("");
      setPassword("");
    }
  }

  return (
    <div className="plm-overlay" onClick={handleBackdropClick}>
      <div className="plm-modal glass-heavy" onClick={(e) => e.stopPropagation()}>
        <button className="plm-close" onClick={closeLoginModal} disabled={busy}>×</button>

        <div className="plm-header">
          <div className="plm-lock-icon">🔒</div>
          <h2 className="plm-title">Private Access</h2>
          <p className="plm-subtitle">Authorized accounts only</p>
        </div>

        {error && <div className="plm-error">{error}</div>}

        <form className="plm-form" onSubmit={handleEmailLogin}>
          <div className="plm-field">
            <label className="plm-label">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="owner@placement-hub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>

          <div className="plm-field">
            <label className="plm-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>

          <button type="submit" className="btn btn-primary plm-submit" disabled={busy || !email || !password}>
            {busy ? "Authenticating..." : "Enter Private Mode"}
          </button>
        </form>

        <div className="plm-divider">
          <span>or</span>
        </div>

        <button
          className="btn btn-secondary plm-google-btn"
          onClick={handleGoogleLogin}
          disabled={busy}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="plm-footer-text">
          Only authorized owner accounts can access private controls.
        </p>
      </div>
    </div>
  );
}
