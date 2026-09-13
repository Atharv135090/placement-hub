import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./AtsChecker.css";

// ── SVG ICONS ──
const LamborghiniShield = () => (
  <svg width="18" height="20" viewBox="0 0 24 28" fill="none" className="ats-brand-logo">
    <path
      d="M12 2L2 5.5V14.5C2 20.5 6.5 25.5 12 27C17.5 25.5 22 20.5 22 14.5V5.5L12 2Z"
      fill="#D97706"
      stroke="#FDE68A"
      strokeWidth="1.2"
    />
    <path
      d="M7 11.5C8 9 10.5 8.5 12 8.5C13.5 8.5 16 9 17 11.5C16 13 14.5 15.5 12 16.5C9.5 15.5 8 13 7 11.5Z"
      fill="#1C1917"
    />
    <circle cx="12" cy="12" r="1.5" fill="#FDE68A" />
  </svg>
);

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
  </svg>
);

const TargetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
  </svg>
);

const TagSearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
    <circle cx="14" cy="9" r="2" />
  </svg>
);

const TrendChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <path d="M4 8l5-5 5 5 6-6" strokeWidth="2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11" />
  </svg>
);

const RocketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ZapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const StarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const FEATURES = [
  {
    id: "ai",
    title: "AI-Powered Analysis",
    description: "Deep learning parser for better insights.",
    icon: <BrainIcon />,
  },
  {
    id: "opt",
    title: "ATS Optimization",
    description: "Improve your resume for higher chances.",
    icon: <TargetIcon />,
  },
  {
    id: "keywords",
    title: "Keyword Matching",
    description: "Find the right skills that matter.",
    icon: <TagSearchIcon />,
  },
  {
    id: "suggestions",
    title: "Actionable Suggestions",
    description: "Clear, practical tips to get hired.",
    icon: <TrendChartIcon />,
  },
];

export default function AtsChecker() {
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPhase, setPreviewPhase] = useState(0); // 0: idle, 1: scanning, 2: analyzing, 3: scoring, 4: result
  const [animScore, setAnimScore] = useState(0);
  const [notified, setNotified] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Mouse Parallax state
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const isReducedMotion = useRef(false);
  const previewOverlayRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    isReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function handleMouseMove(e) {
    if (isReducedMotion.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normX = (e.clientX - centerX) / (rect.width / 2);
    const normY = (e.clientY - centerY) / (rect.height / 2);
    setParallax({ x: Math.max(-1, Math.min(1, normX)), y: Math.max(-1, Math.min(1, normY)) });
  }

  function handleMouseLeave() {
    setParallax({ x: 0, y: 0 });
  }

  // Preview state machine — runs when showPreviewModal or previewKey changes
  useEffect(() => {
    if (!showPreviewModal) return;

    setPreviewPhase(1);
    setAnimScore(0);

    const timers = [];
    const intervals = [];

    // Phase 1 → 2 (scanning → analyzing)
    timers.push(setTimeout(() => setPreviewPhase(2), 2600));

    // Phase 2 → 3 (analyzing → scoring) with score animation
    timers.push(setTimeout(() => {
      setPreviewPhase(3);
      const targets = [0, 24, 51, 73, 86, 98];
      let step = 0;
      const iv = setInterval(() => {
        if (step < targets.length) {
          setAnimScore(targets[step]);
          step++;
        } else {
          clearInterval(iv);
        }
      }, 300);
      intervals.push(iv);
    }, 5400));

    // Phase 3 → 4 (scoring → result)
    timers.push(setTimeout(() => setPreviewPhase(4), 9000));

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [showPreviewModal, previewKey]);

  // Escape key to close
  useEffect(() => {
    if (!showPreviewModal) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setShowPreviewModal(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPreviewModal]);

  // Focus trap & autofocus for overlay
  useEffect(() => {
    if (showPreviewModal && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [showPreviewModal, previewPhase]);

  // Lock body scroll when preview is open
  useEffect(() => {
    if (showPreviewModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showPreviewModal]);

  function handleOpenPreview() {
    setPreviewKey((k) => k + 1);
    setShowPreviewModal(true);
  }

  function handleClosePreview() {
    setShowPreviewModal(false);
    setPreviewPhase(0);
    setAnimScore(0);
  }

  function handleWatchAgain() {
    setPreviewKey((k) => k + 1);
  }

  return (
    <div className="ats-workspace animate-fade-in" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {/* Ambient background glows */}
      <div
        className="ats-ambient-glow ats-ambient-glow--pink"
        style={{ transform: `translate3d(${parallax.x * -18}px, ${parallax.y * -14}px, 0)` }}
      />
      <div
        className="ats-ambient-glow ats-ambient-glow--purple"
        style={{ transform: `translate3d(${parallax.x * 20}px, ${parallax.y * 16}px, 0)` }}
      />
      <div
        className="ats-ambient-glow ats-ambient-glow--cyan"
        style={{ transform: `translate3d(${parallax.x * -12}px, ${parallax.y * 10}px, 0)` }}
      />

      <div className="ats-container">
        {/* Main 2-Column Desktop Hero Layout */}
        <div className="ats-hero-layout">
          {/* ── LEFT COLUMN ── */}
          <div className="ats-left-col">
            {/* Top Brand Pill */}
            <div className="ats-brand-pill">
              <LamborghiniShield />
              <span className="ats-brand-name">LAMBORGHINI</span>
              <span className="ats-brand-divider">|</span>
              <span className="ats-brand-slogan">Driven by a Better You.</span>
            </div>

            {/* Badge Sub-row */}
            <div className="ats-badge-row">
              <div className="ats-soon-pill">
                <span className="ats-pulse-beacon" />
                <span className="ats-soon-pill-text">COMING SOON</span>
              </div>
              <span className="ats-future-tag">STEP 1 • FUTURE FEATURE PREVIEW</span>
            </div>

            {/* Main Heading */}
            <h1 className="ats-main-title">
              ATS <span className="ats-gradient-text">Checker</span>
            </h1>

            {/* Subtitle */}
            <div className="ats-subtitle-status">
              <span className="ats-status-dot" />
              <span className="ats-status-name">Next-Generation Career Intelligence</span>
            </div>

            {/* Description */}
            <p className="ats-hero-description">
              A smart ATS checker designed to analyze your resume, identify opportunities for
              improvement, and help you stand out in placement applications.
            </p>

            {/* Action Buttons: Notify Me & Watch Preview */}
            <div className="ats-cta-group">
              <button
                type="button"
                className={`ats-btn-primary ${notified ? "notified" : ""}`}
                onClick={() => setNotified(!notified)}
              >
                <BellIcon />
                <span>{notified ? "Notifications Enabled ✓" : "Notify Me"}</span>
              </button>

              <button
                type="button"
                className="ats-btn-preview"
                onClick={handleOpenPreview}
              >
                <PlayIcon />
                <span>Watch Preview</span>
              </button>
            </div>

            {/* Metrics Row */}
            <div className="ats-metrics-row">
              <div className="ats-metric-item">
                <span className="ats-metric-icon"><UsersIcon /></span>
                <div>
                  <strong className="ats-metric-value">10K+</strong>
                  <span className="ats-metric-label">Students</span>
                </div>
              </div>
              <div className="ats-metric-divider" />
              <div className="ats-metric-item">
                <span className="ats-metric-icon"><BuildingIcon /></span>
                <div>
                  <strong className="ats-metric-value">50+</strong>
                  <span className="ats-metric-label">Companies</span>
                </div>
              </div>
              <div className="ats-metric-divider" />
              <div className="ats-metric-item">
                <span className="ats-metric-icon"><RocketIcon /></span>
                <div>
                  <strong className="ats-metric-value">3x</strong>
                  <span className="ats-metric-label">Better Shortlists</span>
                </div>
              </div>
            </div>

            {/* 4 Feature Cards Grid */}
            <div className="ats-features-grid">
              {FEATURES.map((item) => (
                <div
                  key={item.id}
                  className={`ats-feature-card ${activeHighlight === item.id ? "active" : ""}`}
                  onMouseEnter={() => setActiveHighlight(item.id)}
                  onMouseLeave={() => setActiveHighlight(null)}
                  onClick={handleOpenPreview}
                  role="button"
                  tabIndex={0}
                >
                  <div className="ats-feature-icon-box">{item.icon}</div>
                  <div className="ats-feature-info">
                    <h4 className="ats-feature-title">{item.title}</h4>
                    <p className="ats-feature-desc">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: SHOWCASE WITH GLOWING BORDER ── */}
          <div className="ats-right-col">
            <div
              className="ats-showcase-frame"
              style={{ transform: `translate3d(${parallax.x * 6}px, ${parallax.y * 4}px, 0)` }}
            >
              {/* Handwritten Script Title Overlay */}
              <div className="ats-handwritten-title">
                Drive Your Career Forward
              </div>

              {/* SVJ Badge */}
              <div className="ats-svj-badge">SVJ</div>

              {/* Left HUD Resume Card */}
              <div
                className="ats-hud-card ats-hud-card--resume"
                style={{ transform: `translate3d(${parallax.x * -14}px, ${parallax.y * -10}px, 0)` }}
              >
                <div className="ats-hud-card-header">
                  <span className="ats-hud-card-title">YOUR RESUME</span>
                  <span className="ats-hud-card-sub">PDF • ATS READY</span>
                </div>
                <div className="ats-hud-card-body">
                  <div className="ats-hud-doc-icon">📄</div>
                  <div className="ats-hud-lines">
                    <div className="ats-hud-line ats-hud-line--w80" />
                    <div className="ats-hud-line ats-hud-line--w50" />
                    <div className="ats-hud-line ats-hud-line--w100" />
                    <div className="ats-hud-line ats-hud-line--w60" />
                  </div>
                </div>
                <div className="ats-scan-laser" />
              </div>

              {/* Central AI Analyzing Cube Node */}
              <div
                className="ats-ai-node"
                style={{ transform: `translate3d(${parallax.x * 8}px, ${parallax.y * 6}px, 0)` }}
              >
                <div className="ats-ai-cube">
                  <span className="ats-ai-cube-text">AI</span>
                </div>
                <span className="ats-ai-label">Analyzing...</span>
                <div className="ats-laser-line-left" />
                <div className="ats-laser-line-right" />
              </div>

              {/* Right HUD Score Card */}
              <div
                className="ats-hud-card ats-hud-card--score"
                style={{ transform: `translate3d(${parallax.x * 16}px, ${parallax.y * 12}px, 0)` }}
              >
                <div className="ats-score-radial">
                  <svg viewBox="0 0 80 80" className="ats-score-svg">
                    <circle cx="40" cy="40" r="34" className="ats-radial-bg" />
                    <circle cx="40" cy="40" r="34" className="ats-radial-fill" />
                  </svg>
                  <span className="ats-score-val">98</span>
                </div>
                <span className="ats-score-title">ATS SCORE</span>
                <div className="ats-score-checks">
                  <div className="ats-check-row"><CheckIcon /> <span>ATS Friendly</span></div>
                  <div className="ats-check-row"><CheckIcon /> <span>Keyword Match</span></div>
                  <div className="ats-check-row"><CheckIcon /> <span>Actionable Insights</span></div>
                </div>
              </div>

              {/* Center Car Stage & Pedestal */}
              <div
                className="ats-car-stage"
                style={{ transform: `translate3d(${parallax.x * 10}px, ${parallax.y * 6}px, 0)` }}
              >
                <div className="ats-pedestal-ring" />
                <img
                  src="/assets/ats/ats_svj_dark.jpg"
                  alt="Aventador SVJ"
                  className="ats-car-img ats-car-img--dark"
                />
                <img
                  src="/assets/ats/ats_svj_light.jpg"
                  alt="Aventador SVJ"
                  className="ats-car-img ats-car-img--light"
                />
              </div>

              {/* Showcase Integrated Footer Bar */}
              <div className="ats-showcase-footer-bar">
                <div className="ats-showcase-footer-item">
                  <ShieldIcon /> <span>PREMIUM TECHNOLOGY</span>
                </div>
                <div className="ats-showcase-footer-item">
                  <ZapIcon /> <span>FASTER OPPORTUNITIES</span>
                </div>
                <div className="ats-showcase-footer-item">
                  <StarIcon /> <span>BRIGHTER TOMORROW</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Slogan */}
        <div className="ats-footer-slogan">
          <span>PLACEMENT HUB</span>
          <span className="ats-slogan-dot">•</span>
          <span>SMART TOOLS. BRIGHTER OPPORTUNITIES.</span>
        </div>
      </div>

      {/* WATCH PREVIEW OVERLAY MODAL */}
      {showPreviewModal && createPortal(
        <div
          className="ats-preview-overlay animate-fade-in"
          onClick={handleClosePreview}
          ref={previewOverlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="ATS Preview Demo"
        >
          <div className="ats-preview-modal" onClick={(e) => e.stopPropagation()}>
            {/* Ambient Glows */}
            <div className="ats-modal-glow ats-modal-glow--pink" />
            <div className="ats-modal-glow ats-modal-glow--cyan" />

            {/* Modal Header */}
            <div className="ats-modal-header">
              <div className="ats-modal-brand">
                <span className="ats-modal-badge">PREVIEW DEMO</span>
                <span className="ats-modal-title">FUTURE ATS ANALYSIS</span>
              </div>

              <div className="ats-modal-phase-stepper" aria-hidden="true">
                <span className={`ats-step-pill ${previewPhase === 1 ? "active" : ""}`}>1. Scan</span>
                <span className={`ats-step-pill ${previewPhase === 2 ? "active" : ""}`}>2. Analysis</span>
                <span className={`ats-step-pill ${previewPhase === 3 ? "active" : ""}`}>3. Score</span>
                <span className={`ats-step-pill ${previewPhase === 4 ? "active" : ""}`}>4. Final</span>
              </div>

              <button
                type="button"
                className="ats-modal-close-btn"
                onClick={handleClosePreview}
                title="Close preview (Esc)"
                aria-label="Close preview"
                ref={closeBtnRef}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="ats-modal-body">
              {/* PHASE 1: SCANNING */}
              {previewPhase === 1 && (
                <div className="ats-phase-wrap animate-fade-in">
                  <div className="ats-scanner-stage">
                    <div className="ats-scanner-doc">
                      <div className="ats-laser-beam" />
                      <div className="ats-doc-header">
                        <div className="ats-doc-title">RESUME_PROFILE_2026.PDF</div>
                        <span className="ats-doc-status">SCANNING IN PROGRESS...</span>
                      </div>
                      <div className="ats-doc-content-mock">
                        <div className="ats-doc-line ats-doc-line--h1" />
                        <div className="ats-doc-line ats-doc-line--h2" />
                        <div className="ats-doc-grid">
                          <div className="ats-doc-card">EXPERIENCE</div>
                          <div className="ats-doc-card">EDUCATION</div>
                          <div className="ats-doc-card">PROJECTS</div>
                          <div className="ats-doc-card">SKILLS</div>
                        </div>
                      </div>
                    </div>

                    <div className="ats-scan-checklist">
                      <div className="ats-scan-check-row active"><span className="ats-scan-check-icon">✓</span> <span>RESUME STRUCTURE</span></div>
                      <div className="ats-scan-check-row active"><span className="ats-scan-check-icon">✓</span> <span>KEYWORD MATCH</span></div>
                      <div className="ats-scan-check-row active"><span className="ats-scan-check-icon">✓</span> <span>CONTENT QUALITY</span></div>
                      <div className="ats-scan-check-row active"><span className="ats-scan-check-icon">✓</span> <span>ATS COMPATIBILITY</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 2: ANALYSIS */}
              {previewPhase === 2 && (
                <div className="ats-phase-wrap animate-fade-in">
                  <div className="ats-analysis-stage">
                    <div className="ats-analysis-card animate-slide-up">
                      <div className="ats-analysis-icon"><BrainIcon /></div>
                      <h4>AI ANALYSIS</h4>
                      <p>Evaluating phrasing, structural clarity, and technical relevance against top tech firms.</p>
                      <div className="ats-mini-bar-track"><div className="ats-mini-bar-fill" style={{ width: "92%" }} /></div>
                    </div>
                    <div className="ats-analysis-card animate-slide-up" style={{ animationDelay: "0.15s" }}>
                      <div className="ats-analysis-icon"><TagSearchIcon /></div>
                      <h4>KEYWORD MATCH</h4>
                      <p>Matching candidate skills against 50+ corporate recruiter criteria.</p>
                      <div className="ats-mini-bar-track"><div className="ats-mini-bar-fill" style={{ width: "95%" }} /></div>
                    </div>
                    <div className="ats-analysis-card animate-slide-up" style={{ animationDelay: "0.3s" }}>
                      <div className="ats-analysis-icon"><TargetIcon /></div>
                      <h4>ATS OPTIMIZATION</h4>
                      <p>Pre-flight compliance testing matching modern corporate tracking systems.</p>
                      <div className="ats-mini-bar-track"><div className="ats-mini-bar-fill" style={{ width: "98%" }} /></div>
                    </div>
                    <div className="ats-analysis-card animate-slide-up" style={{ animationDelay: "0.45s" }}>
                      <div className="ats-analysis-icon"><TrendChartIcon /></div>
                      <h4>ACTIONABLE INSIGHTS</h4>
                      <p>Targeted recommendations to boost interview shortlisting confidence.</p>
                      <div className="ats-mini-bar-track"><div className="ats-mini-bar-fill" style={{ width: "90%" }} /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 3: SCORE */}
              {previewPhase === 3 && (
                <div className="ats-phase-wrap animate-fade-in">
                  <div className="ats-score-stage">
                    <div className="ats-big-score-ring">
                      <svg className="ats-big-ring-svg" viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r="70" className="ats-big-ring-bg" />
                        <circle cx="80" cy="80" r="70" className="ats-big-ring-fill" strokeDashoffset={440 - (440 * animScore) / 100} />
                      </svg>
                      <div className="ats-big-score-text">
                        <span className="ats-big-score-num">{animScore}</span>
                        <span className="ats-big-score-sub">ATS SCORE</span>
                      </div>
                    </div>

                    <div className="ats-score-proof-list">
                      <div className="ats-proof-item"><CheckIcon /> <span>ATS Friendly</span></div>
                      <div className="ats-proof-item"><CheckIcon /> <span>Strong Keyword Match</span></div>
                      <div className="ats-proof-item"><CheckIcon /> <span>Clear Structure</span></div>
                      <div className="ats-proof-item"><CheckIcon /> <span>Actionable Insights</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 4: FINAL RESULT */}
              {previewPhase === 4 && (
                <div className="ats-phase-wrap animate-fade-in">
                  <div className="ats-final-stage">
                    <div className="ats-final-badge">YOUR RESUME</div>
                    <h2 className="ats-final-title">READY FOR BETTER OPPORTUNITIES</h2>
                    <p className="ats-final-slogan">"Same You. A Stronger Resume."</p>

                    <div className="ats-final-cta-row">
                      <button type="button" className="ats-btn-preview" onClick={handleWatchAgain}>
                        Watch Again
                      </button>
                      <button type="button" className="ats-btn-primary" onClick={handleClosePreview}>
                        Close Preview
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
