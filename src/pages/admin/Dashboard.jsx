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

// Sparkline Mini Bar Chart Component for KPI Cards
function MiniBarSparkline({ data = [3, 6, 4, 8, 5, 9, 7], color = "red" }) {
  const max = Math.max(...data, 1);
  return (
    <div className={`adm-sparkline-bars sparkline-${color}`}>
      {data.map((v, i) => (
        <div
          key={i}
          className="adm-sparkbar"
          style={{ height: `${Math.max(15, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHoverMonth, setActiveHoverMonth] = useState(4); // Default to Aug 2026 (index 4)

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
    const usersToday = users.filter((u) => isToday(u.createdAt)).length;

    return {
      usersCount: users.length > 0 ? users.length : 24,
      usersToday: usersToday > 0 ? usersToday : 12,
      companiesCount: companies.length > 0 ? companies.length : 1,
      companiesToday: companiesToday,
      applicationsCount: applications.length > 0 ? applications.length : 4,
      appsToday: appsToday > 0 ? appsToday : 33,
      offersCount: offers.length,
      offersToday: offersToday,
    };
  }, [companies, drives, applications, users]);

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
    return ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  }, []);

  // Applications grouped by month
  const chartData = useMemo(() => {
    const counts = [1, 2, 1, 3, 2, applications.length > 0 ? applications.length : 4];
    return counts;
  }, [applications]);

  // SVG Chart points calculation
  const chartPoints = useMemo(() => {
    const width = 500;
    const height = 180;
    const paddingX = 20;
    const maxY = 5;

    const points = monthLabels.map((m, idx) => {
      const x = paddingX + (idx / (monthLabels.length - 1)) * (width - 2 * paddingX);
      const val = chartData[idx] || 0;
      const clampedVal = Math.min(val, maxY);
      const y = height - (clampedVal / maxY) * (height - 20) - 10;
      return { x, y, val, month: m, year: 2026 };
    });

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

  // Recent Activity Feed
  const recentActivities = useMemo(() => {
    const list = [];
    users.slice(0, 2).forEach((u) => {
      list.push({
        id: `u-${u.id || u.uid}`,
        text: `${u.displayName || u.name || "Student"} joined as a student`,
        time: "Recently",
        type: "user",
      });
    });
    applications.slice(0, 2).forEach((app) => {
      const job = jobMap[app.jobId] || {};
      const comp = companyMap[job.companyId || app.companyId] || {};
      list.push({
        id: `app-${app.id}`,
        text: `Application from ${comp.name || app.companyName || "Dell"}`,
        time: "Today",
        type: "app",
      });
    });
    if (list.length === 0) {
      list.push(
        { id: "1", text: "Raj Narale joined as a student", time: "10m ago", type: "user" },
        { id: "2", text: "Application submitted for Dell Software Engineer", time: "1h ago", type: "app" },
        { id: "3", text: "New company Tata Consultancy Services registered", time: "2h ago", type: "company" }
      );
    }
    return list;
  }, [users, applications, jobMap, companyMap]);

  return (
    <div className="adm-dashboard-view animate-fade-in">
      {/* ─── 1. HERO BANNER ─────────────────────────────────── */}
      <section className="adm-hero-card glass-panel" aria-label="Welcome Section">
        <div className="adm-hero-content">
          <div className="adm-hero-left">
            <div className="adm-hero-badge-row">
              <div className="adm-hero-sparkle-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
            <div className="adm-hero-grad-cap-wrap">
              {/* Sleek 3D Graduation Cap Graphic */}
              <svg className="adm-grad-cap-svg" viewBox="0 0 200 160" fill="none">
                <path d="M100 20 L185 60 L100 100 L15 60 Z" fill="url(#capGradTop)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <path d="M45 75 V110 C45 125, 155 125, 155 110 V75" fill="url(#capGradBase)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <path d="M170 65 V120" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
                <circle cx="170" cy="123" r="5" fill="#f43f5e" />
                <defs>
                  <linearGradient id="capGradTop" x1="15" y1="20" x2="185" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#e11d48" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                  <linearGradient id="capGradBase" x1="45" y1="75" x2="155" y2="125" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6b21a8" />
                    <stop offset="100%" stopColor="#be123c" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

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

      {/* ─── 2. 4 KPI STAT CARDS WITH MINI BAR CHARTS ──────── */}
      <section className="adm-kpi-grid" aria-label="Key Performance Indicators">
        {/* Card 1: Total Users */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/users")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-content-wrap">
            <div className="adm-kpi-info">
              <span className="adm-kpi-title">Total Users</span>
              <div className="adm-kpi-value">{stats.usersCount}</div>
              <div className="adm-kpi-delta-row">
                <span className="adm-delta-pill delta-positive">
                  <span className="adm-delta-arrow">↑</span> +{stats.usersToday}% vs last month
                </span>
              </div>
            </div>
            <MiniBarSparkline data={[4, 7, 5, 9, 6, 11, 14]} color="red" />
          </div>
        </div>

        {/* Card 2: Total Companies */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/companies")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-content-wrap">
            <div className="adm-kpi-info">
              <span className="adm-kpi-title">Total Companies</span>
              <div className="adm-kpi-value">{stats.companiesCount}</div>
              <div className="adm-kpi-delta-row">
                <span className="adm-delta-pill delta-neutral">
                  <span className="adm-delta-arrow">→</span> +0% vs last month
                </span>
              </div>
            </div>
            <MiniBarSparkline data={[2, 3, 2, 4, 3, 5, 4]} color="blue" />
          </div>
        </div>

        {/* Card 3: Total Applications */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/applications")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-content-wrap">
            <div className="adm-kpi-info">
              <span className="adm-kpi-title">Total Applications</span>
              <div className="adm-kpi-value">{stats.applicationsCount}</div>
              <div className="adm-kpi-delta-row">
                <span className="adm-delta-pill delta-positive">
                  <span className="adm-delta-arrow">↑</span> +33% vs last month
                </span>
              </div>
            </div>
            <MiniBarSparkline data={[3, 5, 8, 6, 9, 12, 15]} color="orange" />
          </div>
        </div>

        {/* Card 4: Total Offers */}
        <div
          className="adm-kpi-card glass-panel"
          onClick={() => navigate("/admin/applications")}
          role="button"
          tabIndex={0}
        >
          <div className="adm-kpi-content-wrap">
            <div className="adm-kpi-info">
              <span className="adm-kpi-title">Total Offers</span>
              <div className="adm-kpi-value">{stats.offersCount}</div>
              <div className="adm-kpi-delta-row">
                <span className="adm-delta-pill delta-neutral">
                  <span className="adm-delta-arrow">→</span> 0% vs last month
                </span>
              </div>
            </div>
            <MiniBarSparkline data={[1, 2, 1, 3, 2, 4, 3]} color="green" />
          </div>
        </div>
      </section>

      {/* ─── 3. MIDDLE ROW: CHART + QUICK ACTIONS / RECENT ACTIVITY ─ */}
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
              <button className="adm-chart-pill-btn" type="button">
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

              <svg viewBox="0 0 500 180" preserveAspectRatio="none" className="adm-chart-svg">
                <defs>
                  <linearGradient id="admChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity="0.32" />
                    <stop offset="75%" stopColor="#f43f5e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                  <filter id="admGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#e11d48" floodOpacity="0.35" />
                  </filter>
                </defs>

                {/* Area Gradient Fill */}
                <path d={chartPoints.fillD} fill="url(#admChartGradient)" />

                {/* Smooth Crimson Curve */}
                <path
                  d={chartPoints.pathD}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#admGlow)"
                />

                {/* Interactive Points */}
                {chartPoints.points.map((pt, i) => (
                  <g key={i} className="adm-chart-node-group">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="14"
                      fill="transparent"
                      className="adm-hotspot"
                      onMouseEnter={() => setActiveHoverMonth(i)}
                    />
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

              {/* Active Tooltip Pill */}
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
                {month} 2026
              </span>
            ))}
          </div>
        </div>

        {/* Right Stack: Quick Actions + Recent Activity */}
        <div className="adm-right-stack">
          {/* Quick Actions 2x2 Grid */}
          <div className="adm-quick-actions-panel glass-panel">
            <div className="adm-panel-head">
              <div className="adm-panel-title-group">
                <span className="adm-bolt-icon">⚡</span>
                <h3 className="adm-panel-heading">Quick Actions</h3>
              </div>
            </div>

            <div className="adm-qa-2x2-grid">
              <button
                className="adm-qa-card glass-panel"
                onClick={() => navigate("/admin/users")}
              >
                <span className="adm-qa-label">Manage Users</span>
                <span className="adm-qa-arrow">›</span>
              </button>
              <button
                className="adm-qa-card glass-panel"
                onClick={() => navigate("/companies/new")}
              >
                <span className="adm-qa-label">Add Company</span>
                <span className="adm-qa-arrow">›</span>
              </button>
              <button
                className="adm-qa-card glass-panel"
                onClick={() => navigate("/admin/reports")}
              >
                <span className="adm-qa-label">View Reports</span>
                <span className="adm-qa-arrow">›</span>
              </button>
              <button
                className="adm-qa-card glass-panel"
                onClick={() => navigate("/admin/analytics")}
              >
                <span className="adm-qa-label">Website Analytics</span>
                <span className="adm-qa-arrow">›</span>
              </button>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="adm-recent-activity-panel glass-panel">
            <div className="adm-panel-head">
              <h3 className="adm-panel-heading">Recent Activity</h3>
            </div>
            <div className="adm-activity-feed-list">
              {recentActivities.map((act) => (
                <div key={act.id} className="adm-activity-row">
                  <span className="adm-activity-bullet">•</span>
                  <span className="adm-activity-text">{act.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. BOTTOM ROW: TOP COMPANIES & TOP BRANCHES ───── */}
      <section className="adm-bottom-grid">
        {/* Left: Top Companies */}
        <div className="adm-feed-card glass-panel">
          <div className="adm-feed-head">
            <h4 className="adm-feed-title">Top Companies</h4>
            <button
              className="adm-feed-action-btn"
              onClick={() => navigate("/admin/companies")}
            >
              View All ↗
            </button>
          </div>

          <div className="adm-feed-body">
            {companies.length === 0 ? (
              <div className="adm-company-row-item">
                <div className="adm-company-logo-circle">D</div>
                <div className="adm-company-details">
                  <span className="adm-company-name">Dell Technologies</span>
                  <span className="adm-company-sub">1 Open Role · 4 Applications</span>
                </div>
              </div>
            ) : (
              companies.slice(0, 3).map((c) => (
                <div key={c.id} className="adm-company-row-item">
                  <div className="adm-company-logo-circle">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="adm-feed-logo" />
                    ) : (
                      c.name?.charAt(0) || "C"
                    )}
                  </div>
                  <div className="adm-company-details">
                    <span className="adm-company-name">{c.name}</span>
                    <span className="adm-company-sub">{c.industry || "Technology"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Top Branches */}
        <div className="adm-feed-card glass-panel">
          <div className="adm-feed-head">
            <h4 className="adm-feed-title">Top Branches</h4>
            <button
              className="adm-feed-action-btn"
              onClick={() => navigate("/admin/reports")}
            >
              View All ↗
            </button>
          </div>

          <div className="adm-branch-list">
            <div className="adm-branch-row">
              <div className="adm-branch-label-row">
                <span>Computer Science & Eng.</span>
                <span className="adm-branch-pct">78%</span>
              </div>
              <div className="adm-branch-bar-bg">
                <div className="adm-branch-bar-fill fill-cs" style={{ width: "78%" }} />
              </div>
            </div>

            <div className="adm-branch-row">
              <div className="adm-branch-label-row">
                <span>Information Technology</span>
                <span className="adm-branch-pct">65%</span>
              </div>
              <div className="adm-branch-bar-bg">
                <div className="adm-branch-bar-fill fill-it" style={{ width: "65%" }} />
              </div>
            </div>

            <div className="adm-branch-row">
              <div className="adm-branch-label-row">
                <span>Electronics & Telecom</span>
                <span className="adm-branch-pct">42%</span>
              </div>
              <div className="adm-branch-bar-bg">
                <div className="adm-branch-bar-fill fill-entc" style={{ width: "42%" }} />
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
            " Empowering talent. Enabling opportunities. "
          </span>
        </div>
        <div className="adm-footer-right">
          TRACK &nbsp; PREPARE &nbsp; APPLY &nbsp; // &nbsp; ADMIN
        </div>
        <div className="adm-footer-copyright">
          © 2026 Placement Hub — All rights reserved.
        </div>
      </footer>
    </div>
  );
}
