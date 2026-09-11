import { useState } from "react";
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
  </svg>
);

const TargetIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
    <circle cx="14" cy="9" r="2" />
  </svg>
);

const TrendChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <path d="M4 8l5-5 5 5 6-6" strokeWidth="2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FEATURES = [
  {
    id: "ai",
    title: "AI-Powered Analysis",
    description: "Deep learning parser evaluating phrasing, structural clarity, and technical relevance.",
    icon: <BrainIcon />,
  },
  {
    id: "opt",
    title: "ATS Optimization",
    description: "Pre-flight compliance testing matching modern corporate tracking systems.",
    icon: <TargetIcon />,
  },
  {
    id: "keywords",
    title: "Keyword Matching",
    description: "Precision gap analysis comparing candidate resumes against top hiring company criteria.",
    icon: <TagSearchIcon />,
  },
  {
    id: "suggestions",
    title: "Actionable Suggestions",
    description: "Targeted recommendations to boost interview shortlisting confidence.",
    icon: <TrendChartIcon />,
  },
];

export default function AtsChecker() {
  const [activeHighlight, setActiveHighlight] = useState(null);

  return (
    <div className="ats-workspace animate-fade-in">
      {/* Ambient background glows */}
      <div className="ats-ambient-glow ats-ambient-glow--pink" />
      <div className="ats-ambient-glow ats-ambient-glow--purple" />
      <div className="ats-ambient-glow ats-ambient-glow--cyan" />

      <div className="ats-container">
        {/* Grand Showcase Card */}
        <div className="ats-showcase-card glass-heavy">
          {/* Top Brand Pill */}
          <div className="ats-brand-pill glass">
            <LamborghiniShield />
            <span className="ats-brand-name">LAMBORGHINI</span>
            <span className="ats-brand-divider">|</span>
            <span className="ats-brand-slogan">Driven by a Better You.</span>
          </div>

          {/* Main 2-Column Body */}
          <div className="ats-showcase-grid">
            {/* ── LEFT COLUMN: HERO & CAPABILITIES ── */}
            <div className="ats-hero-col">
              <div className="ats-badge-row">
                <div className="ats-soon-pill">
                  <span className="ats-pulse-beacon" />
                  <span className="ats-soon-pill-text">COMING SOON</span>
                </div>
                <span className="ats-future-tag">STEP 1 • FUTURE FEATURE PREVIEW</span>
              </div>

              <h1 className="ats-main-title">
                ATS <span className="ats-gradient-text">Checker</span>
              </h1>

              <div className="ats-subtitle-status">
                <span className="ats-status-dot" />
                <span className="ats-status-name">Next-Generation Career Intelligence</span>
              </div>

              <p className="ats-hero-description">
                A smart ATS checker designed to analyze your resume, identify opportunities for
                improvement, and help you stand out in placement applications.
              </p>

              {/* 4 Feature Highlight Cards */}
              <div className="ats-features-grid">
                {FEATURES.map((item) => {
                  const isHovered = activeHighlight === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`ats-feature-card glass ${isHovered ? "active" : ""}`}
                      onMouseEnter={() => setActiveHighlight(item.id)}
                      onMouseLeave={() => setActiveHighlight(null)}
                    >
                      <div className="ats-feature-icon-box">{item.icon}</div>
                      <div className="ats-feature-info">
                        <div className="ats-feature-title-row">
                          <h4 className="ats-feature-title">{item.title}</h4>
                          <span className="ats-feature-tag">Preview</span>
                        </div>
                        <p className="ats-feature-desc">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT COLUMN: AUTOMOTIVE & ATS HUD VISUAL ── */}
            <div className="ats-visual-col">
              <div className="ats-visual-stage">
                {/* Background Rotating Telemetry Gyroscope */}
                <div className="ats-gyro-container">
                  <svg className="ats-gyro-ring" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" fill="none" opacity="0.25" />
                    <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1" strokeDasharray="12 4" fill="none" opacity="0.35" />
                    <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.15" />
                    <line x1="100" y1="5" x2="100" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                    <line x1="100" y1="175" x2="100" y2="195" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                    <line x1="5" y1="100" x2="25" y2="100" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                    <line x1="175" y1="100" x2="195" y2="100" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                  </svg>
                </div>

                {/* Floating Holographic HUD Resume Document */}
                <div className="ats-hud-resume glass-heavy">
                  {/* Animated Vertical Scanning Laser */}
                  <div className="ats-scan-laser" />

                  <div className="ats-resume-header">
                    <span className="ats-resume-doc-badge">YOUR RESUME</span>
                    <span className="ats-resume-doc-chip">PDF • ATS READY</span>
                  </div>

                  <div className="ats-resume-body-mock">
                    <div className="ats-resume-avatar-mock" />
                    <div className="ats-resume-lines-group">
                      <div className="ats-mock-line ats-mock-line--bold" />
                      <div className="ats-mock-line ats-mock-line--mid" />
                    </div>
                  </div>

                  <div className="ats-resume-sections">
                    <div className="ats-mock-line ats-mock-line--section" />
                    <div className="ats-mock-line ats-mock-line--full" />
                    <div className="ats-mock-line ats-mock-line--full" />
                    <div className="ats-mock-line ats-mock-line--short" />
                  </div>
                </div>

                {/* Floating Holographic ATS Score Gauge */}
                <div className="ats-hud-score-card glass-heavy">
                  <div className="ats-score-radial-box">
                    <svg className="ats-score-svg" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" className="ats-radial-bg" />
                      <circle cx="40" cy="40" r="34" className="ats-radial-progress" />
                    </svg>
                    <div className="ats-score-number">98</div>
                  </div>
                  <div className="ats-score-label">ATS SCORE</div>

                  <div className="ats-score-checklist">
                    <div className="ats-check-item">
                      <span className="ats-check-badge"><CheckIcon /></span>
                      <span>ATS Friendly</span>
                    </div>
                    <div className="ats-check-item">
                      <span className="ats-check-badge"><CheckIcon /></span>
                      <span>Keyword Match</span>
                    </div>
                    <div className="ats-check-item">
                      <span className="ats-check-badge"><CheckIcon /></span>
                      <span>Actionable Insights</span>
                    </div>
                  </div>
                </div>

                {/* SVJ Automotive Visual Treatment (Light & Dark theme responsive) */}
                <div className="ats-car-wrapper">
                  <img
                    src="/assets/ats/ats_svj_dark.jpg"
                    alt="Aventador SVJ Cyber Visual"
                    className="ats-car-img ats-car-img--dark"
                  />
                  <img
                    src="/assets/ats/ats_svj_light.jpg"
                    alt="Aventador SVJ Studio Visual"
                    className="ats-car-img ats-car-img--light"
                  />

                  {/* Aerodynamic glowing red badge overlay */}
                  <div className="ats-svj-floating-badge">SVJ</div>
                </div>

                {/* Orbital Neon Ribbon with Slogan */}
                <div className="ats-orbital-ribbon-box">
                  <svg className="ats-ribbon-svg" viewBox="0 0 450 180" fill="none">
                    <defs>
                      <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff2e74" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#e11d48" stopOpacity="1" />
                        <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    <path
                      id="ribbonPath"
                      d="M 20 120 C 80 170, 360 170, 430 90 C 450 60, 380 20, 260 20"
                      stroke="url(#neonGradient)"
                      strokeWidth="2.5"
                      strokeDasharray="6 3"
                      className="ats-ribbon-path"
                    />
                  </svg>
                  <div className="ats-ribbon-slogan">SAME YOU. A STRONGER RESUME.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── BOTTOM BANNER: COMING SOON & ITALIAN TRICOLOR ── */}
          <div className="ats-footer-banner">
            <div className="ats-footer-line" />
            <div className="ats-footer-center">
              <div className="ats-cs-spaced">C O M I N G &nbsp; S O O N</div>
              <div className="ats-cs-sub">HIGHER OPPORTUNITIES AHEAD</div>
              <div className="ats-tricolor-strip">
                <span className="ats-tri-green" />
                <span className="ats-tri-white" />
                <span className="ats-tri-red" />
              </div>
            </div>
            <div className="ats-footer-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
