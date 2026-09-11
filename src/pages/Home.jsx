import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { getActiveAnnouncements } from "../services/firestore";
import CompanyLogo from "../components/CompanyLogo";
import "./Home.css";

export default function Home() {
  const { user, profile } = useAuth();
  const { companies, applications, stats } = usePlacementData();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    async function fetchAnnouncements() {
      const { data } = await getActiveAnnouncements();
      setAnnouncements(data || []);
    }
    fetchAnnouncements();
  }, []);

  const name = profile?.displayName || user?.displayName || "Student";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const activeApplications = useMemo(
    () => applications.filter((a) => a.status !== "removed"),
    [applications]
  );

  const recentApplications = useMemo(() => {
    return [...activeApplications]
      .sort((a, b) => {
        const aTime = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
        const bTime = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [activeApplications]);

  const totalAppsCount = activeApplications.length;
  const companiesCount = companies.length;
  const interviewsCount = stats.interview;
  const offersCount = stats.offer;

  // Dynamic or fallback trends based on real counts
  const appsTrend = totalAppsCount > 0 ? `+${totalAppsCount} this month` : "+0 this month";
  const compTrend = companiesCount > 0 ? `+${companiesCount} this month` : "+0 this month";
  const intTrend = interviewsCount > 0 ? `+${interviewsCount} this month` : "+0 this month";
  const offerTrend = offersCount > 0 ? `+${offersCount} this month` : "+0 this month";

  // Circular gauge calculations
  const targetGoal = Math.max(20, totalAppsCount || 20);
  const gaugePercent = totalAppsCount > 0 ? Math.min(100, Math.round((totalAppsCount / targetGoal) * 100)) : 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (circumference * gaugePercent) / 100;

  function getStatusLabel(status) {
    switch (status) {
      case "offer":
      case "selected": return "Offer Received";
      case "interview": return "Interview Scheduled";
      case "shortlisted": return "Shortlisted";
      case "applied": return "Application Sent";
      case "rejected": return "Not Selected";
      default: return "Applied";
    }
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return "";
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }

  function formatCompanyName(raw) {
    if (!raw) return "Company";
    let clean = String(raw).replace(/^[\.\s\-–—]*company\s*name:\s*/i, "").trim();
    if (clean.toLowerCase().includes("industry:")) {
      clean = clean.split(/industry:/i)[0].trim();
    }
    if (clean && clean === clean.toLowerCase()) {
      clean = clean.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return clean || "Company";
  }

  function formatIndustry(c) {
    if (c.industry && !c.industry.startsWith(".")) return c.industry;
    return "";
  }

  function formatOrgSize(c) {
    if (c.organisationSize && !c.organisationSize.startsWith(".")) return c.organisationSize;
    return "";
  }

  function formatWebsite(c) {
    if (c.website && !c.website.startsWith(".")) return c.website;
    return null;
  }

  function formatDescription(c) {
    if (c.description && !c.description.startsWith(".")) return c.description;
    return "";
  }

  function truncate(str, max = 60) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max).trim() + "..." : str;
  }

  function getField(val, fallback = "Not available") {
    return val && String(val).trim() ? String(val).trim() : fallback;
  }

  return (
    <div className="home-dashboard animate-fade-in">
      {/* Optional Announcements */}
      {announcements.length > 0 && (
        <div className="dash-announcements">
          {announcements.slice(0, 1).map((ann) => (
            <div key={ann.id} className="dash-announcement dash-announcement--high glass">
              <span className="dash-ann-icon">📢</span>
              <div className="dash-ann-content">
                <strong>{ann.title}</strong>
                <p>{ann.message || ann.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 1. HERO BANNER ────────────────────────────────────────── */}
      <div className="dash-hero-banner glass ambient-sheen">
        <div className="hero-left-col">
          <h1 className="hero-heading">{greeting}, {name}! 🎉</h1>
          <p className="hero-tagline">
            Track your placement journey, interview schedules, and drive announcements in real-time.
          </p>
        </div>
        <div className="hero-car-card">
          <img
            src="/assets/car_banner.jpg"
            alt="Placement Journey Performance"
            className="hero-car-img"
          />
          <div className="hero-car-overlay" />
          <div className="hero-car-quote">
            <span className="hero-car-tag">PLACEMENT JOURNEY</span>
            <strong className="hero-car-elevated">ELEVATED →</strong>
          </div>
        </div>
      </div>

      {/* ── 2. FOUR STAT METRIC CARDS ─────────────────────────────── */}
      <div className="dash-stats-grid">
        {/* Card 1: Total Applications */}
        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-rose-pill">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          </div>
          <span className="stat-value">{totalAppsCount}</span>
          <span className="stat-label">Total Applications</span>
          <div className="stat-trend-pill">
            <span className="trend-arrow">↑</span>
            <span>{appsTrend}</span>
          </div>
        </div>

        {/* Card 2: Companies Registered */}
        <div className="dash-stat-card glass" onClick={() => navigate("/companies")}>
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-rose-pill">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
              </svg>
            </div>
          </div>
          <span className="stat-value">{companiesCount}</span>
          <span className="stat-label">Companies Registered</span>
          <div className="stat-trend-pill">
            <span className="trend-arrow">↑</span>
            <span>{compTrend}</span>
          </div>
        </div>

        {/* Card 3: Interviews */}
        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-rose-pill">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="12" width="4" height="8" rx="1" />
                <rect x="10" y="8" width="4" height="12" rx="1" />
                <rect x="17" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
          </div>
          <span className="stat-value">{interviewsCount}</span>
          <span className="stat-label">Interviews</span>
          <div className="stat-trend-pill">
            <span className="trend-arrow">↑</span>
            <span>{intTrend}</span>
          </div>
        </div>

        {/* Card 4: Offers Received */}
        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-card-top">
            <div className="stat-icon-wrap icon-rose-pill">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <span className="stat-value">{offersCount}</span>
          <span className="stat-label">Offers Received 🎉</span>
          <div className="stat-trend-pill">
            <span className="trend-arrow">↑</span>
            <span>{offerTrend}</span>
          </div>
        </div>
      </div>

      {/* ── 3. MIDDLE ROW: APPLICATION PROGRESS & REGISTERED COMPANIES ─ */}
      <div className="dash-middle-row">
        {/* Left: Application Progress */}
        <div className="progress-gauge-card glass">
          <div className="sec-header-row">
            <h3 className="section-title">Application Progress</h3>
            <Link to="/analytics" className="view-all-link">Analytics →</Link>
          </div>
          
          <div className="gauge-split">
            <div className="gauge-radial-wrap">
              <svg width="128" height="128" viewBox="0 0 120 120" className="radial-svg">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="var(--border)"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Active Progress Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="var(--accent)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="radial-center-text">
                <span className="rc-num">{totalAppsCount}</span>
                <span className="rc-denom">/ {targetGoal}</span>
              </div>
            </div>

            <div className="gauge-breakdown-list">
              <div className="g-row">
                <span className="g-dot dot-offer" />
                <span className="g-name">Offers</span>
                <strong className="g-count">{offersCount}</strong>
              </div>
              <div className="g-row">
                <span className="g-dot dot-interview" />
                <span className="g-name">Interviews</span>
                <strong className="g-count">{interviewsCount}</strong>
              </div>
              <div className="g-row">
                <span className="g-dot dot-shortlisted" />
                <span className="g-name">Shortlisted</span>
                <strong className="g-count">{stats.shortlisted}</strong>
              </div>
              <div className="g-row">
                <span className="g-dot dot-applied" />
                <span className="g-name">Applied</span>
                <strong className="g-count">{stats.applied}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Registered Companies */}
        <div className="registered-companies-section glass">
          <div className="sec-header-row">
            <h3 className="section-title">Registered Companies</h3>
            <Link to="/companies" className="view-all-link">View All →</Link>
          </div>

          <div className="companies-container">
            {companies.length === 0 ? (
              <div className="empty-companies-card">
                <div className="empty-comp-icon">🏢</div>
                <div className="empty-comp-title">No companies registered yet</div>
                <p className="empty-comp-sub">
                  When the Admin/Owner adds a company, it will automatically appear here.
                </p>
                {(profile?.role === "admin" || profile?.role === "owner") && (
                  <button
                    className="btn btn-primary btn-empty-action"
                    onClick={() => navigate("/companies/new")}
                  >
                    + Add Company
                  </button>
                )}
              </div>
            ) : (
              <div className="companies-cards-grid">
                {companies.slice(0, 3).map((c) => {
                  const compName = formatCompanyName(c.name);
                  const compIndustry = formatIndustry(c);
                  const compSize = formatOrgSize(c);
                  const compWebsite = formatWebsite(c);
                  const compLocation = c.location && !c.location.startsWith(".") ? c.location : "";
                  const compDesc = formatDescription(c);

                  return (
                    <div key={c.id} className="company-ref-card glass-subtle">
                      {/* Header: Logo, Name, Sector */}
                      <div className="crc-header">
                        <div className="crc-logo-wrap">
                          <CompanyLogo name={compName} logoUrl={c.logoUrl} size={36} />
                        </div>
                        <div className="crc-title-wrap">
                          <h4 className="crc-name" title={compName}>{compName}</h4>
                          <span className="crc-industry">{compIndustry}</span>
                        </div>
                      </div>

                      {/* Metadata Items */}
                      <div className="crc-meta-list">
                        <div className="crc-meta-item">
                          <span className="crc-meta-icon">👥</span>
                          <span className="crc-meta-text">{compSize}</span>
                        </div>
                        <div className="crc-meta-item">
                          <span className="crc-meta-icon">📍</span>
                          <span className="crc-meta-text" title={compLocation}>{compLocation}</span>
                        </div>
                        <div className="crc-meta-item">
                          <span className="crc-meta-icon">🔗</span>
                          {compWebsite ? (
                            <a
                              href={compWebsite.startsWith("http") ? compWebsite : `https://${compWebsite}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="crc-meta-link"
                              title={compWebsite}
                            >
                              {compWebsite.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                            </a>
                          ) : (
                            <span className="crc-meta-text">https://www.placementhub.io</span>
                          )}
                        </div>
                      </div>

                      {/* Short Description */}
                      <p className="crc-desc" title={compDesc}>
                        {truncate(compDesc, 64)}
                      </p>

                      {/* Action View Button */}
                      <div className="crc-footer">
                        <button
                          className="btn-glossy-pill"
                          onClick={() => navigate(`/companies/${c.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. LOWER ROW: RECENT ACTIVITY & BIG DREAMS CARD (SCROLL REVEAL) ─ */}
      <div className="dash-lower-row">
        {/* Left: Recent Activity */}
        <div className="recent-activity-section glass">
          <div className="sec-header-row">
            <h3 className="section-title">Recent Activity</h3>
            <Link to="/applications" className="view-all-link">View All →</Link>
          </div>

          <div className="recent-activity-list">
            {recentApplications.length === 0 ? (
              <div className="empty-activity-card">
                <span className="empty-act-icon">📋</span>
                <div>
                  <strong className="empty-act-title">No applications yet</strong>
                  <p className="empty-act-sub">Browse registered companies and apply to get started</p>
                </div>
              </div>
            ) : (
              recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="activity-ref-item"
                  onClick={() => navigate("/applications")}
                >
                  <div className="act-logo-wrap">
                    <CompanyLogo name={app.companyName} logoUrl={app.logoUrl} size={32} />
                  </div>
                  <div className="act-info">
                    <strong className="act-title">
                      {app.role ? `Applied to ${app.role}` : `${getStatusLabel(app.status)}`}
                    </strong>
                    <span className="act-meta">
                      {getField(app.companyName, "Company")} · {getTimeAgo(app.appliedAt || app.updatedAt) || "Recently"}
                    </span>
                  </div>
                  <span className="act-chevron">›</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Big Dreams Require Consistent Action */}
        <div className="big-dreams-banner glass">
          <div className="big-dreams-left">
            <h3 className="big-dreams-title">
              Big Dreams<br />
              Require<br />
              Consistent Action.
            </h3>
            <p className="big-dreams-sub">
              Practice mock interviews, analyze company aptitude tests, and polish your resume.
            </p>
            <button
              className="btn-glossy-pill btn-dreams-action"
              onClick={() => navigate("/assistant")}
            >
              Ask Assistant →
            </button>
          </div>

          <div className="big-dreams-right">
            <img
              src="/assets/car_banner.jpg"
              alt="Dream Big"
              className="big-dreams-img"
            />
            <div className="big-dreams-overlay" />
            <div className="big-dreams-slogan">
              <span>Better</span>
              <span>Placements</span>
              <em>Brighter</em>
              <em>Future</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
