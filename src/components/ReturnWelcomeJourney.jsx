import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import PlacementLogo from "./PlacementLogo";
import journeyDarkBg from "../assets/journey_dark_bg.jpg";
import journeyLightBg from "../assets/journey_light_bg.jpg";
import runningStudent from "../assets/running_student.png";
import "./ReturnWelcomeJourney.css";

const MILESTONES = [
  {
    id: 1,
    key: "explore",
    title: "Explore",
    subtitle: "Top Companies",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.4)",
  },
  {
    id: 2,
    key: "prepare",
    title: "Prepare",
    subtitle: "Build Your Skills",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: "#34d399",
    glow: "rgba(52, 211, 153, 0.4)",
  },
  {
    id: 3,
    key: "apply",
    title: "Apply",
    subtitle: "Grab Opportunities",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    color: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.4)",
  },
  {
    id: 4,
    key: "place",
    title: "Place",
    subtitle: "Achieve Your Goals",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
        <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
        <path d="M6 2h12v7a6 6 0 0 1-12 0V2z" />
      </svg>
    ),
    hasFlag: true,
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.45)",
  },
];

export default function ReturnWelcomeJourney() {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0); // 0 = start, 1 = Explore, 2 = Prepare, 3 = Apply, 4 = Place
  const [isLooping, setIsLooping] = useState(false);
  const timeoutsRef = useRef([]);

  // Clear pending timers safely
  const clearAllTimers = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  // Tab-based trigger evaluation (PRD §2, §3, §4, §5, §25, §26)
  useEffect(() => {
    // Wait for auth initialization (PRD §5 — do not show before Firebase resolves)
    if (loading) return;

    // Do not show for logged-out users
    if (!user?.uid) {
      setOpen(false);
      return;
    }

    // sessionStorage is per-tab: cleared when tab closes, fresh on new tab open
    // PRD §3: welcomeJourneyShown = true  (single key per tab)
    const alreadyShown = sessionStorage.getItem("welcomeJourneyShown") === "true";

    // If current browser tab/document has NOT yet shown the popup, display it
    if (!alreadyShown) {
      const openTimer = setTimeout(() => {
        setOpen(true);
        try {
          sessionStorage.setItem("welcomeJourneyShown", "true");
        } catch {
          // ignore storage errors
        }
      }, 500);

      timeoutsRef.current.push(openTimer);
    }

    // Developer / manual testing trigger
    const handleManualShow = () => {
      setOpen(true);
    };
    window.addEventListener("ph-show-welcome-journey", handleManualShow);
    window.showWelcomeJourney = handleManualShow;

    return () => {
      window.removeEventListener("ph-show-welcome-journey", handleManualShow);
      delete window.showWelcomeJourney;
      clearAllTimers();
    };
  }, [user?.uid, loading]);

  // 2. Animation Sequence
  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setIsLooping(false);
      clearAllTimers();
      return;
    }

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setActiveStep(4);
      setIsLooping(true);
      return;
    }

    clearAllTimers();

    // Step sequence along the journey: 1=Explore, 2=Prepare, 3=Apply, 4=Place
    const t0 = setTimeout(() => setActiveStep(0), 100);
    const t1 = setTimeout(() => setActiveStep(1), 750);   // Explore illuminates
    const t2 = setTimeout(() => setActiveStep(2), 2100);  // Prepare illuminates
    const t3 = setTimeout(() => setActiveStep(3), 3400);  // Apply illuminates
    const t4 = setTimeout(() => setActiveStep(4), 4800);  // Place illuminates
    const tLoop = setTimeout(() => setIsLooping(true), 5800); // Looping/calm state

    timeoutsRef.current = [t0, t1, t2, t3, t4, tLoop];

    return () => clearAllTimers();
  }, [open]);

  // 3. Keyboard Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    clearAllTimers();
  };

  if (!open || !user) return null;

  // Dynamic user name resolution (PRD §6)
  const rawName = profile?.displayName || profile?.name || user?.displayName || "";
  const firstName = rawName.trim().split(" ")[0] || rawName.trim();

  return (
    <div
      className="rwj-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome Journey"
    >
      <div
        className="rwj-card glass-heavy animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="rwj-header">
          <div className="rwj-brand">
            <PlacementLogo size={28} />
            <div className="rwj-brand-text">
              <span className="rwj-brand-title">Placement Hub</span>
              <span className="rwj-brand-sub">Track • Prepare • Apply</span>
            </div>
          </div>

          <div className="rwj-header-right">
            <span className="rwj-slogan">Same Students. Bigger Dreams.</span>
            <button
              type="button"
              className="rwj-close-btn"
              onClick={handleClose}
              aria-label="Close"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Welcome Headings */}
        <div className="rwj-headings">
          <h2 className="rwj-welcome-title">
            Welcome back{firstName ? `, ` : "!"}
            {firstName && <span className="rwj-user-name">{firstName}!</span>}
          </h2>
          <p className="rwj-journey-title">Your placement journey continues.</p>
          <p className="rwj-motivational">Small steps today, big opportunities tomorrow!</p>
        </div>

        {/* Scenic Animated Journey Viewport */}
        <div className="rwj-scene">
          {/* Background image: dark mode night / light mode day with error fallback */}
          <img
            src={journeyDarkBg}
            alt="Placement Journey Dark"
            className="rwj-bg-img rwj-bg-dark"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <img
            src={journeyLightBg}
            alt="Placement Journey Light"
            className="rwj-bg-img rwj-bg-light"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />

          {/* Road Path SVG overlay with glowing guide lines */}
          <svg className="rwj-road-svg" viewBox="0 0 800 360" preserveAspectRatio="none">
            <defs>
              <linearGradient id="roadGlowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#34d399" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Glowing path line */}
            <path
              className="rwj-svg-road-line rwj-svg-road-line--glow"
              d="M 20 340 Q 230 330, 320 285 T 560 215 T 710 150"
            />
            <path
              className="rwj-svg-road-line rwj-svg-road-line--core"
              d="M 20 340 Q 230 330, 320 285 T 560 215 T 710 150"
            />
          </svg>

          {/* 4 Milestones positioned along the journey */}
          <div className="rwj-milestones-track">
            {MILESTONES.map((m) => {
              const isPastOrActive = activeStep >= m.id;
              const isCurrent = activeStep === m.id;

              return (
                <div
                  key={m.key}
                  className={`rwj-milestone-node rwj-milestone--${m.key} ${
                    isPastOrActive ? "is-active" : ""
                  } ${isCurrent ? "is-current" : ""}`}
                >
                  {/* Road dot/node */}
                  <div
                    className="rwj-road-node-dot"
                    style={{
                      borderColor: m.color,
                      boxShadow: isPastOrActive ? `0 0 14px ${m.color}` : "none",
                    }}
                  />

                  {/* Milestone Card Badge */}
                  <div
                    className="rwj-milestone-badge"
                    style={{
                      borderColor: isPastOrActive ? m.color : "rgba(255, 255, 255, 0.15)",
                      boxShadow: isPastOrActive
                        ? `0 6px 20px rgba(0, 0, 0, 0.35), 0 0 18px ${m.glow}`
                        : "0 4px 12px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {m.hasFlag && (
                      <div className="rwj-trophy-flag">
                        <span className="rwj-flag-pennant">🚩</span>
                      </div>
                    )}
                    <div
                      className="rwj-milestone-icon-box"
                      style={{
                        color: isPastOrActive ? m.color : "#94a3b8",
                        background: isPastOrActive
                          ? `rgba(${m.id === 1 ? "56, 189, 248" : m.id === 2 ? "52, 211, 153" : m.id === 3 ? "244, 63, 94" : "251, 191, 36"}, 0.15)`
                          : "rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      {m.icon}
                    </div>
                    <div className="rwj-milestone-text">
                      <span className="rwj-milestone-title">{m.title}</span>
                      <span className="rwj-milestone-sub">{m.subtitle}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Running Student Animated Character */}
          <div
            className={`rwj-runner-container step-${activeStep} ${
              isLooping ? "is-looping" : ""
            }`}
          >
            {/* Runner dust / light trail */}
            <div className="rwj-runner-dust" />

            {/* Runner character image with error safety */}
            <img
              src={runningStudent}
              alt="Running Student"
              className="rwj-runner-img"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>

          {/* Milestone Rock Slogan on Bottom-Right */}
          <div className="rwj-rock-badge">
            <span className="rwj-rock-line">Better</span>
            <span className="rwj-rock-line">Skills</span>
            <span className="rwj-rock-line">Brighter</span>
            <span className="rwj-rock-line">Future.</span>
          </div>
        </div>

        {/* Primary CTA Button */}
        <div className="rwj-actions">
          <button
            type="button"
            className="rwj-continue-btn"
            onClick={handleClose}
          >
            <span>Let's Continue</span>
            <span className="rwj-btn-arrow">→</span>
          </button>
        </div>

        {/* Milestone Indicator Dots & Footer Tagline */}
        <div className="rwj-footer">
          <div className="rwj-indicator-dots" aria-hidden="true">
            {[1, 2, 3, 4].map((stepNum) => (
              <span
                key={stepNum}
                className={`rwj-dot ${
                  activeStep === stepNum || (activeStep >= 4 && stepNum === 4)
                    ? "rwj-dot--active"
                    : ""
                }`}
              />
            ))}
          </div>
          <span className="rwj-footer-nav">Track • Prepare • Apply • Place</span>
        </div>
      </div>
    </div>
  );
}
