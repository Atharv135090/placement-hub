import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from "../services/auth";
import PlacementLogo from "../components/PlacementLogo";
import "./Login.css";

export default function Login() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="page-loader"><div className="loader-spinner" /></div>;
  if (user) { navigate("/", { replace: true }); return null; }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    const { user: googleUser, error: err } = await signInWithGoogle();
    setBusy(false);
    if (err) {
      setError(err);
    } else if (googleUser) {
      navigate("/", { replace: true });
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fn = mode === "signin" ? signInWithEmail : signUpWithEmail;
    const { error: err } = await fn(email, password);
    setBusy(false);
    if (err) setError(err);
    else navigate("/", { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow login-bg-1" />
      <div className="login-bg-glow login-bg-2" />

      <div className="login-card glass-heavy">
        <div className="login-brand">
          <PlacementLogo size={42} />
          <span className="login-brand-text">Placement Hub</span>
        </div>

        <h1 className="login-headline">Your Placement Journey<br />Starts Here</h1>
        <p className="login-sub">Track · Prepare · Apply · Get Placed</p>

        {error && <div className="login-error">{error}</div>}

        {mode === "choice" ? (
          <div className="login-actions">
            <button className="btn-auth btn-auth-google" onClick={handleGoogle} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="login-divider"><span>or</span></div>

            <button className="btn-auth btn-auth-email" onClick={() => setMode("signin")}>
              Continue with Email
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleEmailAuth}>
            <input
              type="email"
              className="input-field"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="input-field"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
            <button type="button" className="login-back-btn" onClick={() => { setMode("choice"); setError(""); }}>
              ← Back to options
            </button>
          </form>
        )}

        <p className="login-footer">By continuing, you agree to our Terms and Privacy Policy.</p>
      </div>
    </div>
  );
}
