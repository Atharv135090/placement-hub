import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  getCompanies,
  getJobs,
  getAllApplications,
  getAllUsers,
} from "../../services/firestore";
import UserAvatar from "../../components/UserAvatar";
import "./Dashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("6m");
  const [activeHoverMonth, setActiveHoverMonth] = useState(4); // Default highlighted to Aug (index 4)

  useEffect(() => {
    async function load() {
      try {
        const [compRes, jobsRes, appRes, usersRes] = await Promise.all([
          getCompanies(),
          getJobs(),
          getAllApplications(),
          getAllUsers(),
        ]);
        setCompanies(compRes.data || []);
        setDrives(jobsRes.data || []);
        setApplications(appRes.data || []);
        setUsers(usersRes.data || []);
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute real statistics from Firebase
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function isToday(dateField) {
      if (!dateField) return false;
      const d = dateField.toDate ? dateField.toDate() : new Date(dateField);
      return d >= today;
    }

    const companiesToday = companies.filter((c) => isToday(c.createdAt)).length;
    const appsToday = applications.filter((a) => isToday(a.createdAt)).length;
    const offers = applications.filter(
      (a) => a.status === "offer" || a.status === "selected"
    );
    const offersToday = offers.filter((o) => isToday(o.createdAt || o.updatedAt)).length;

    return {
      companiesCount: companies.length,
      companiesToday,
      applicationsCount: applications.length,
      appsToday,
      offersCount: offers.length,
      offersToday,
    };
  }, [companies, drives, applications]);

  // Lookup maps
  const jobMap = useMemo(() => {
    const m = {};
    drives.forEach((j) => {
      m[j.id] = j;
    });
    return m;
  }, [drives]);

  const companyMap = useMemo(() => {
    const m = {};
    companies.forEach((c) => {
      m[c.id] = c;
    });
    return m;
  }, [companies]);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => {
      m[u.id || u.uid] = u;
    });
    return m;
  }, [users]);

  // Admin first name
  const adminFirstName = useMemo(() => {
    const full = profile?.displayName || user?.displayName || "Atharv";
    return full.split(" ")[0];
  }, [profile, user]);

  // Last 6 months labels
  const monthLabels = useMemo(() => {
    const names = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return names;
  }, []);

  // Applications grouped by month (Apr - Sep 2026)
  const chartData = useMemo(() => {
    // Month indices 3 (Apr) to 8 (Sep) for 2026
    const counts = [0, 0, 0, 0, 0, 0];
    applications.forEach((app) => {
      if (app.createdAt) {
        const d = app.createdAt.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
        const m = d.getMonth(); // 0-indexed (3=Apr, 4=May, 5=Jun, 6=Jul, 7=Aug, 8=Sep)
        if (m >= 3 && m <= 8) {
          counts[m - 3] += 1;
        }
      }
    });

    // If total real applications > 0, reflect real data; if 0, baseline is 0
    return counts;
  }, [applications]);

  // SVG Chart points calculation
  // Plot area dimensions: 480w x 180h
  // Max Y value scale: 5
  const chartPoints = useMemo(() => {
    const width = 500;
    const height = 180;
    const paddingX = 20;
    const maxY = 5;

    const points = monthLabels.map((m, idx) => {
      const x = paddingX + (idx / (monthLabels.length - 1)) * (width - 2 * paddingX);
      const val = chartData[idx] || 0;
      // Invert Y for SVG coordinates: 0 value = height (bottom), 5 = 10 (top)
      const clampedVal = Math.min(val, maxY);
      const y = height - (clampedVal / maxY) * (height - 20) - 10;
      return { x, y, val, month: m, year: 2026 };
    });

    // Generate smooth SVG Path using cubic bezier curves
    if (points.length === 0) return { pathD: "", fillD: "", points: [] };

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { pathD, fillD, points };
  }, [monthLabels, chartData]);

  // Recent Applications list (real data only)
  const recentApplications = useMemo(() => {
    const list = [...applications];
    list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return list.slice(0, 3);
  }, [applications]);

  // Recent Users list (real data only)
  const recentUsers = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return list.slice(0, 3);
  }, [users]);

  // Format date helper
  function formatRowDate(timestamp) {
    if (!timestamp) return "10 Sep 2026";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return "10 Sep 2026";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="adm-dashboard-view animate-fade-in">
      {/* ─── 1. HERO / WELCOME BANNER ───────────────────────── */}
      <section className="adm-hero-card glass-panel" aria-label="Welcome Section">
        <div className="adm-hero-content">
          <div className="adm-hero-left">
            <div className="adm-hero-badge-row">
              <div className="adm-hero-sparkle-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>
              <span className="adm-hero-kicker">ADMIN DASHBOARD</span>
            </div>

            <h1 className="adm-hero-title">
              Welcome Back, <span className="adm-hero-title-highlight">{adminFirstName}</span>
            </h1>
            <p className="adm-hero-subtitle">
              Here's what's happening on Placement Hub today.
            </p>

            <div className="adm-hero-motto">
              SAME PEOPLE. BRIGHTER TOMORROWS.
            </div>
          </div>

          <div className="adm-hero-art-side">
            <div className="adm-hero-art-overlay" />
            <img
              src="/profile_keep_growing_banner.jpg"
              alt="Futuristic administrative gateway"
              className="adm-hero-art-img"
            />
            <div className="adm-hero-vertical-motto">
              <span>MANAGE</span>
              <span>MONITOR</span>
              <span>GROW</span>
              <span>IMPACT</span>
              <div className="adm-hero-motto-bar" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. 4 REAL KPI STAT CARDS ───────────────────────── */}
      <section className="adm-kpi-grid" aria-label="Key Performance Indicators">
        {/* Card 1: Companies */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/companies")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-top">
            <div className="adm-kpi-icon-wrap kpi-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                <path d="M9 22v-4h6v4"/>
                <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
                <path d="M12 10h.01"/><path d="M12 14h.01"/>
                <path d="M16 10h.01"/><path d="M16 14h.01"/>
                <path d="M8 10h.01"/><path d="M8 14h.01"/>
              </svg>
            </div>
            <div className="adm-kpi-label-row">
              <span className="adm-kpi-title">Companies</span>
              <span className="adm-kpi-chevron">›</span>
            </div>
          </div>
          <div className="adm-kpi-value">{stats.companiesCount}</div>
          <div className="adm-kpi-delta-row">
            <span className="adm-delta-pill">
              <span className="adm-delta-arrow">↑</span> +{stats.companiesToday} today
            </span>
          </div>

          {/* Decorative subtle bottom wave */}
          <svg className="adm-kpi-wave wave-blue" viewBox="0 0 120 40" preserveAspectRatio="none">
            <path d="M0 35 C 30 38, 60 15, 120 20 L 120 40 L 0 40 Z" />
          </svg>
        </div>

        {/* Card 2: Applications */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/applications")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-top">
            <div className="adm-kpi-icon-wrap kpi-orange">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div className="adm-kpi-label-row">
              <span className="adm-kpi-title">Applications</span>
              <span className="adm-kpi-chevron">›</span>
            </div>
          </div>
          <div className="adm-kpi-value">{stats.applicationsCount}</div>
          <div className="adm-kpi-delta-row">
            <span className="adm-delta-pill">
              <span className="adm-delta-arrow">↑</span> +{stats.appsToday} today
            </span>
          </div>

          {/* Decorative subtle bottom wave */}
          <svg className="adm-kpi-wave wave-orange" viewBox="0 0 120 40" preserveAspectRatio="none">
            <path d="M0 36 C 45 35, 75 14, 120 18 L 120 40 L 0 40 Z" />
          </svg>
        </div>

        {/* Card 4: Offers */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/applications")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-top">
            <div className="adm-kpi-icon-wrap kpi-green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>
                <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-12 0V6a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            <div className="adm-kpi-label-row">
              <span className="adm-kpi-title">Offers</span>
              <span className="adm-kpi-chevron">›</span>
            </div>
          </div>
          <div className="adm-kpi-value">{stats.offersCount}</div>
          <div className="adm-kpi-delta-row">
            <span className="adm-delta-pill">
              <span className="adm-delta-arrow">↑</span> +{stats.offersToday} today
            </span>
          </div>

          {/* Decorative subtle bottom wave */}
          <svg className="adm-kpi-wave wave-green" viewBox="0 0 120 40" preserveAspectRatio="none">
            <path d="M0 34 C 50 36, 80 18, 120 22 L 120 40 L 0 40 Z" />
          </svg>
        </div>
      </section>

      {/* ─── 3. MIDDLE SECTION: CHART + QUICK ACTIONS ───────── */}
      <section className="adm-middle-grid">
        {/* Left Panel: Applications Overview Chart */}
        <div className="adm-chart-panel glass-panel">
          <div className="adm-panel-head">
            <div className="adm-panel-title-group">
              <div className="adm-panel-icon-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div>
                <h3 className="adm-panel-heading">Applications Overview</h3>
                <p className="adm-panel-subheading">Number of applications over time.</p>
              </div>
            </div>

            <div className="adm-chart-filter-wrap">
              <button className="adm-chart-pill-btn">
                <span className="adm-calendar-icon">📅</span>
                <span>Last 6 Months</span>
                <span className="adm-caret">▾</span>
              </button>
            </div>
          </div>

          <div className="adm-chart-canvas-area">
            {/* Y-Axis Labels */}
            <div className="adm-chart-y-axis">
              <span>5</span>
              <span>4</span>
              <span>3</span>
              <span>2</span>
              <span>1</span>
              <span>0</span>
            </div>

            {/* SVG Plot with Horizontal Grid Lines */}
            <div className="adm-chart-plot-container">
              <div className="adm-chart-grid-line line-pos-5" />
              <div className="adm-chart-grid-line line-pos-4" />
              <div className="adm-chart-grid-line line-pos-3" />
              <div className="adm-chart-grid-line line-pos-2" />
              <div className="adm-chart-grid-line line-pos-1" />
              <div className="adm-chart-grid-line line-pos-0" />

              <svg
                viewBox="0 0 500 180"
                preserveAspectRatio="none"
                className="adm-chart-svg"
              >
                <defs>
                  <linearGradient id="admChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity="0.28" />
                    <stop offset="75%" stopColor="#f43f5e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                  <filter id="admGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#e11d48" floodOpacity="0.35" />
                  </filter>
                </defs>

                {/* Area Gradient Fill */}
                <path d={chartPoints.fillD} fill="url(#admChartGradient)" />

                {/* Smooth Crimson Stroke Curve */}
                <path
                  d={chartPoints.pathD}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#admGlow)"
                />

                {/* Interactive Points on each month */}
                {chartPoints.points.map((pt, i) => (
                  <g key={i} className="adm-chart-node-group">
                    {/* Hover hotspot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="14"
                      fill="transparent"
                      className="adm-hotspot"
                      onMouseEnter={() => setActiveHoverMonth(i)}
                    />
                    {/* Outer glow ring for active node */}
                    {activeHoverMonth === i && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="7.5"
                        fill="none"
                        stroke="#e11d48"
                        strokeWidth="2"
                        opacity="0.6"
                        className="adm-pulse-ring"
                      />
                    )}
                    {/* Center point node */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#e11d48"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="adm-chart-node"
                    />
                  </g>
                ))}
              </svg>

              {/* Highlighted Tooltip matching reference pill */}
              {chartPoints.points[activeHoverMonth] && (
                <div
                  className="adm-chart-active-tooltip"
                  style={{
                    left: `${(chartPoints.points[activeHoverMonth].x / 500) * 100}%`,
                    top: `${Math.max(10, chartPoints.points[activeHoverMonth].y - 38)}px`,
                  }}
                >
                  <span className="adm-tooltip-date">
                    {chartPoints.points[activeHoverMonth].month} 2026
                  </span>
                  <div className="adm-tooltip-value-row">
                    <span className="adm-tooltip-dot" />
                    <span className="adm-tooltip-text">
                      {chartPoints.points[activeHoverMonth].val} {chartPoints.points[activeHoverMonth].val === 1 ? "application" : "applications"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* X-Axis Month Labels */}
          <div className="adm-chart-x-axis">
            {monthLabels.map((month, idx) => (
              <span
                key={month}
                className={`adm-chart-month-lbl ${activeHoverMonth === idx ? "active" : ""}`}
                onClick={() => setActiveHoverMonth(idx)}
              >
                {month}
              </span>
            ))}
          </div>
        </div>

        {/* Right Panel: Quick Actions 2x3 Grid */}
        <div className="adm-quick-actions-panel glass-panel">
          <div className="adm-panel-head">
            <div className="adm-panel-title-group">
              <span className="adm-bolt-icon">⚡</span>
              <h3 className="adm-panel-heading">Quick Actions</h3>
            </div>
          </div>

          <div className="adm-qa-grid">
            {/* 1. Manage Users */}
            <div
              className="adm-qa-card glass-panel"
              onClick={() => navigate("/admin/users")}
              role="button"
              tabIndex={0}
            >
              <div className="adm-qa-top">
                <div className="adm-qa-icon qa-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="adm-qa-chevron">›</span>
              </div>
              <span className="adm-qa-label">Manage Users</span>
            </div>

            {/* 2. Add Company */}
            <div
              className="adm-qa-card glass-panel"
              onClick={() => navigate("/companies/new")}
              role="button"
              tabIndex={0}
            >
              <div className="adm-qa-top">
                <div className="adm-qa-icon qa-icon-blue">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                    <path d="M9 22v-4h6v4"/>
                    <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
                  </svg>
                </div>
                <span className="adm-qa-chevron">›</span>
              </div>
              <span className="adm-qa-label">Add Company</span>
            </div>

            {/* 3. View Reports */}
            <div
              className="adm-qa-card glass-panel"
              onClick={() => navigate("/admin/reports")}
              role="button"
              tabIndex={0}
            >
              <div className="adm-qa-top">
                <div className="adm-qa-icon qa-icon-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span className="adm-qa-chevron">›</span>
              </div>
              <span className="adm-qa-label">View Reports</span>
            </div>

            {/* 5. Site Analytics */}
            <div
              className="adm-qa-card glass-panel"
              onClick={() => navigate("/admin/analytics")}
              role="button"
              tabIndex={0}
            >
              <div className="adm-qa-top">
                <div className="adm-qa-icon qa-icon-emerald">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <span className="adm-qa-chevron">›</span>
              </div>
              <span className="adm-qa-label">Site Analytics</span>
            </div>

            {/* 6. Settings */}
            <div
              className="adm-qa-card glass-panel"
              onClick={() => navigate("/settings")}
              role="button"
              tabIndex={0}
            >
              <div className="adm-qa-top">
                <div className="adm-qa-icon qa-icon-teal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <span className="adm-qa-chevron">›</span>
              </div>
              <span className="adm-qa-label">Settings</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. LOWER SECTION: RECENT APPS, USERS, PLATFORM STATUS ── */}
      <section className="adm-bottom-grid">
        {/* Card 1: Recent Applications */}
        <div className="adm-feed-card glass-panel">
          <div className="adm-feed-head">
            <div className="adm-feed-title-wrap">
              <div className="adm-feed-icon-badge badge-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <h4 className="adm-feed-title">Recent Applications</h4>
            </div>
            <button
              className="adm-feed-action-btn"
              onClick={() => navigate("/admin/applications")}
            >
              View All ↗
            </button>
          </div>

          <div className="adm-feed-body">
            {recentApplications.length === 0 ? (
              <div className="adm-feed-empty">No recent applications</div>
            ) : (
              recentApplications.map((app) => {
                const job = jobMap[app.jobId] || {};
                const comp = companyMap[job.companyId || app.companyId] || {};
                const userObj = userMap[app.userId] || {};
                const companyName = comp.name || job.companyName || app.companyName || "Company";
                const roleTitle = job.title || app.jobTitle || "Role";
                const initial = companyName.charAt(0).toUpperCase() || "?";

                return (
                  <div key={app.id} className="adm-feed-item">
                    <div className="adm-feed-avatar-wrap initial-circle">
                      {comp.logoUrl ? (
                        <img src={comp.logoUrl} alt={companyName} className="adm-feed-logo" />
                      ) : (
                        <span className="adm-feed-initial">{initial}</span>
                      )}
                    </div>
                    <div className="adm-feed-info">
                      <span className="adm-feed-name">{companyName}</span>
                      <span className="adm-feed-role">{roleTitle}</span>
                    </div>
                    <div className="adm-feed-meta">
                      <span className="adm-feed-date">{formatRowDate(app.createdAt)}</span>
                      <span className="adm-status-tag status-new">
                        <span className="adm-status-dot" /> New
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card 2: Recent Users */}
        <div className="adm-feed-card glass-panel">
          <div className="adm-feed-head">
            <div className="adm-feed-title-wrap">
              <div className="adm-feed-icon-badge badge-pink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h4 className="adm-feed-title">Recent Users</h4>
            </div>
            <button
              className="adm-feed-action-btn"
              onClick={() => navigate("/admin/users")}
            >
              View All ↗
            </button>
          </div>

          <div className="adm-feed-body">
            {recentUsers.length === 0 ? (
              <div className="adm-feed-empty">No recent users registered</div>
            ) : (
              recentUsers.map((u) => {
                const uName = u.displayName || u.name || "Student";
                const uEmail = u.email || "student@example.com";
                const role = u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "Student";

                return (
                  <div key={u.id || u.uid} className="adm-feed-item">
                    <div className="adm-feed-avatar-wrap">
                      <UserAvatar user={u} profile={u} alt={uName} />
                    </div>
                    <div className="adm-feed-info">
                      <span className="adm-feed-name">{uName}</span>
                      <span className="adm-feed-role">{uEmail}</span>
                    </div>
                    <div className="adm-feed-meta">
                      <span className="adm-feed-date">{formatRowDate(u.createdAt)}</span>
                      <span className="adm-status-tag status-student">
                        {role}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card 3: Platform Status */}
        <div className="adm-feed-card glass-panel">
          <div className="adm-feed-head">
            <div className="adm-feed-title-wrap">
              <div className="adm-feed-icon-badge badge-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h4 className="adm-feed-title">Platform Status</h4>
            </div>
            <div className="adm-platform-status-badge">
              <span className="adm-operational-dot" /> All Systems Operational ›
            </div>
          </div>

          <div className="adm-platform-body">
            <div className="adm-platform-services">
              <div className="adm-service-row">
                <div className="adm-service-name">
                  <span className="adm-operational-dot" /> Authentication
                </div>
                <span className="adm-service-status">Operational</span>
              </div>
              <div className="adm-service-row">
                <div className="adm-service-name">
                  <span className="adm-operational-dot" /> Database
                </div>
                <span className="adm-service-status">Operational</span>
              </div>
              <div className="adm-service-row">
                <div className="adm-service-name">
                  <span className="adm-operational-dot" /> Storage
                </div>
                <span className="adm-service-status">Operational</span>
              </div>
            </div>

            {/* Circular 100% Uptime Gauge */}
            <div className="adm-uptime-gauge-wrap">
              <svg className="adm-uptime-gauge" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="5"
                  strokeDasharray="213.6"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
              </svg>
              <div className="adm-uptime-text-center">
                <span className="adm-uptime-num">100%</span>
                <span className="adm-uptime-lbl">Uptime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. BOTTOM BRAND FOOTER ─────────────────────────── */}
      <footer className="adm-dashboard-footer">
        <div className="adm-footer-left">
          <span className="adm-footer-dash">—</span>
          <span className="adm-footer-quote">
            “ Empowering talent. Enabling opportunities. ”
          </span>
        </div>
        <div className="adm-footer-right">
          TRACK &nbsp; PREPARE &nbsp; APPLY &nbsp; // &nbsp; ADMIN
        </div>
      </footer>
    </div>
  );
}
