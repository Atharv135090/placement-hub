import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile } from "../services/firestore";
import "./Onboarding.css";

const FEATURES = [
  { icon: "🎯", title: "Track upcoming drives", desc: "Never miss a placement opportunity" },
  { icon: "📋", title: "Manage your applications", desc: "Keep status updated across rounds" },
  { icon: "⚡", title: "Stay organized", desc: "Track criteria, CTC packages, and dates" },
  { icon: "🏆", title: "Achieve your goals", desc: "Get placed at your dream company" },
];

const BRANCHES = [
  "Computer Science", "Information Technology", "Electronics", "Electrical",
  "Mechanical", "Civil", "Chemical", "Biotechnology", "Other"
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.displayName || "");
  const [branch, setBranch] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = (user?.displayName || user?.email || "Student").split(" ")[0];

  async function handleProfileSubmit() {
    if (!name.trim() || !branch || !gradYear) return;
    setSaving(true);
    await updateUserProfile(user.uid, {
      displayName: name.trim(),
      branch,
      gradYear: Number(gradYear),
      onboarded: true,
    });
    setSaving(false);
    setStep(2);
  }

  function finish() {
    navigate("/", { replace: true });
  }

  return (
    <div className="onboarding-page">
      <div className="ob-bg-glow ob-bg-1" />
      <div className="ob-bg-glow ob-bg-2" />

      <div className="onboarding-card glass-heavy">
        {step === 0 ? (
          <div className="onboarding-step">
            <span className="ob-tag">WELCOME TO</span>
            <h1 className="ob-title">Placement Hub 👋</h1>
            <p className="ob-sub">Your personal placement command center. Track companies, manage applications, and stay ahead.</p>

            <div className="onboarding-features">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-item glass">
                  <span className="f-icon">{f.icon}</span>
                  <div className="f-text">
                    <strong>{f.title}</strong>
                    <span>{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="ob-actions">
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => setStep(1)}>
                Let's Get Started ➔
              </button>
              <button className="ob-skip-btn" onClick={finish}>
                Skip
              </button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="onboarding-step">
            <span className="ob-tag">STEP 1 OF 1</span>
            <h1 className="ob-title">Tell Us About You</h1>
            <p className="ob-sub">Help us personalize your placement experience.</p>

            <div className="ob-form">
              <div className="ob-field">
                <label>Your Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="ob-field">
                <label>Branch / Department</label>
                <select
                  className="input-field"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="">Select your branch</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="ob-field">
                <label>Graduation Year</label>
                <select
                  className="input-field"
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                >
                  <option value="">Select year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ob-actions">
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={handleProfileSubmit}
                disabled={!name.trim() || !branch || !gradYear || saving}
              >
                {saving ? "Saving..." : "Continue ➔"}
              </button>
              <button className="ob-skip-btn" onClick={finish}>
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="onboarding-step">
            <div className="ob-check-badge">✓</div>
            <h1 className="ob-title">You're All Set, {name.split(" ")[0] || displayName}!</h1>
            <p className="ob-sub">Your placement dashboard is ready. Explore active drives and track your progress.</p>
            
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '24px' }} onClick={finish}>
              Go to Dashboard ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
