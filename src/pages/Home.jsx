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

  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => {
        const aTime = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
        const bTime = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [applications]);

  const totalAppsCount = applications.length;
  const companiesCount = companies.length;
  const interviewsCount = stats.interview;
  const offersCount = stats.offer;

  const gaugePercent = Math.min(100, Math.round((totalAppsCount / 100) * 100));
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (circumference * gaugePercent) / 100;

  function getStatusIcon(status) {
    switch (status) {
      case "offer":
      case "selected": return "🎉";
      case "interview": return "📅";
      case "shortlisted": return "⭐";
      case "applied": return "📋";
      case "rejected": return "❌";
      default: return "📋";
    }
  }

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

  return (
    <div className="home-dashboard animate-fade-in">
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

      <div className="dash-hero-banner glass">
        <div className="hero-left-col">
          <h1 className="hero-heading">{greeting}, {name}! 🎉</h1>
          <p className="hero-tagline">
            Track your placement journey, interview schedules, and drive announcements in real-time.
          </p>
        </div>
        <div className="hero-car-card">
          <img
            src="/assets/car_banner.jpg"
            alt="Performance"
            className="hero-car-img"
          />
          <div className="hero-car-overlay" />
          <div className="hero-car-quote">
            <span>PLACEMENT JOURNEY</span>
            <strong>ELEVATED ↗</strong>
          </div>
        </div>
      </div>

      <div className="dash-stats-grid">
        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-icon-wrap icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <span className="stat-value">{totalAppsCount}</span>
          <span className="stat-label">Total Applications</span>
        </div>

        <div className="dash-stat-card glass" onClick={() => navigate("/companies")}>
          <div className="stat-icon-wrap icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
            </svg>
          </div>
          <span className="stat-value">{companiesCount}</span>
          <span className="stat-label">Companies Registered</span>
        </div>

        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-icon-wrap icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <span className="stat-value">{interviewsCount}</span>
          <span className="stat-label">Interviews</span>
        </div>

        <div className="dash-stat-card glass" onClick={() => navigate("/applications")}>
          <div className="stat-icon-wrap icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="stat-value">{offersCount}</span>
          <span className="stat-label">Offers Received 🎉</span>
        </div>
      </div>

      <div className="dash-main-split">
        <div className="dash-col-left">
          <div className="progress-gauge-card glass">
            <div className="sec-header-row">
              <h3 className="section-title">Application Progress</h3>
              <Link to="/analytics" className="view-all-link">Analytics ➔</Link>
            </div>
            <div className="gauge-split">
              <div className="gauge-radial-wrap">
                <svg width="120" height="120" className="radial-svg">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="var(--border)"
                    strokeWidth="9"
                    fill="none"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke="var(--accent)"
                    strokeWidth="9"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                </svg>
                <div className="radial-center-text">
                  <span className="rc-num">{totalAppsCount}</span>
                  <span className="rc-denom">/ 100</span>
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

          <div className="recent-activity-card glass">
            <div className="sec-header-row">
              <h3 className="section-title">Recent Activity</h3>
              <Link to="/applications" className="view-all-link">View All ➔</Link>
            </div>
            <div className="recent-activity-list">
              {recentApplications.length === 0 ? (
                <div className="activity-item">
                  <div className="activity-icon-badge">📋</div>
                  <div className="activity-info">
                    <strong>No applications yet</strong>
                    <span>Browse companies and apply to get started</span>
                  </div>
                </div>
              ) : (
                recentApplications.map((app) => (
                  <div key={app.id} className="activity-item">
                    <div className="activity-icon-badge">{getStatusIcon(app.status)}</div>
                    <div className="activity-info">
                      <strong>{getStatusLabel(app.status)} — {app.companyName || "Company"}</strong>
                      <span>{app.role || "Open Role"} · {getTimeAgo(app.appliedAt || app.updatedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="dash-col-right">
          <div className="upcoming-drives-card glass">
            <div className="sec-header-row">
              <h3 className="section-title">Registered Companies</h3>
              <Link to="/companies" className="view-all-link">View All ➔</Link>
            </div>
            <div className="drives-compact-list">
              {companies.length === 0 ? (
                <div className="drive-compact-row glass">
                  <div className="compact-left">
                    <div>
                      <div className="compact-comp-name">No companies yet</div>
                      <div className="compact-time-badge">Companies will appear here</div>
                    </div>
                  </div>
                </div>
              ) : (
                companies.slice(0, 4).map((c) => (
                  <div key={c.id} className="drive-compact-row glass">
                    <div className="compact-left">
                      <div className="compact-logo">
                        <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={28} />
                      </div>
                      <div>
                        <div className="compact-comp-name">{c.name}</div>
                        <div className="compact-time-badge">{c.industry || "Technology"} · {c.location || "India"}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary compact-apply-btn"
                      onClick={() => navigate(`/companies/${c.id}`)}
                    >
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="motto-action-card glass">
            <div className="motto-text-side">
              <h3>Big Dreams<br />Require<br />Consistent<br />Action.</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "4px 0 10px 0" }}>
                Practice mock interviews, analyze company aptitude tests, and polish your resume.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/assistant")}
                style={{ width: "fit-content" }}
              >
                Ask Assistant ➔
              </button>
            </div>
            <div className="motto-visual-side">
              <img
                src="/assets/car_banner.jpg"
                alt="Consistent Action"
                className="motto-vis-img"
              />
              <div className="motto-vis-gradient" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
