import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCompanies, getJobs, getAllApplications } from "../../services/firestore";
import "./Dashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("6m");

  useEffect(() => {
    async function load() {
      const [compRes, jobsRes, appRes] = await Promise.all([
        getCompanies(),
        getJobs(),
        getAllApplications(),
      ]);
      setCompanies(compRes.data || []);
      setDrives(jobsRes.data || []);
      setApplications(appRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    return {
      companiesCount: companies.length > 0 ? companies.length : 1,
      drivesCount: drives.length,
      applicationsCount: applications.length,
      offersCount: applications.filter(a => a.status === "offer" || a.status === "selected").length,
    };
  }, [companies, drives, applications]);

  // Current formatted date matching the reference chip: "Tue, 9 Sep 2025"
  const formattedDate = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const day = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${weekday}, ${day} ${month} ${year}`;
  }, []);

  // Last 6 months for chart axis
  const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];

  return (
    <div className="adm-dashboard animate-fade-in">
      {/* ─── HEADER ROW ─────────────────────────────────────── */}
      <div className="adm-header-row">
        <div className="adm-header-title-wrap">
          <h1 className="adm-page-title">Dashboard</h1>
          <p className="adm-page-subtitle">Overview of your placement platform.</p>
        </div>

        <div className="adm-date-chip glass">
          <span className="adm-date-icon">📅</span>
          <span className="adm-date-text">{formattedDate}</span>
        </div>
      </div>

      {/* ─── 4 STAT CARDS ROW ───────────────────────────────── */}
      <div className="adm-stats-row">
        {/* Card 1: Companies */}
        <div className="adm-stat-card glass-card" onClick={() => navigate("/admin/companies")}>
          <div className="adm-stat-top">
            <div className="adm-stat-icon-wrap icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                <path d="M9 22v-4h6v4"/>
                <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
                <path d="M12 10h.01"/><path d="M12 14h.01"/>
                <path d="M16 10h.01"/><path d="M16 14h.01"/>
                <path d="M8 10h.01"/><path d="M8 14h.01"/>
              </svg>
            </div>
            <span className="adm-stat-chevron">›</span>
          </div>
          <div className="adm-stat-val">{stats.companiesCount}</div>
          <div className="adm-stat-lbl">Companies</div>
        </div>

        {/* Card 2: Drives */}
        <div className="adm-stat-card glass-card" onClick={() => navigate("/admin/drives")}>
          <div className="adm-stat-top">
            <div className="adm-stat-icon-wrap icon-purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <span className="adm-stat-chevron">›</span>
          </div>
          <div className="adm-stat-val">{stats.drivesCount}</div>
          <div className="adm-stat-lbl">Drives</div>
        </div>

        {/* Card 3: Applications */}
        <div className="adm-stat-card glass-card" onClick={() => navigate("/admin/applications")}>
          <div className="adm-stat-top">
            <div className="adm-stat-icon-wrap icon-orange">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <span className="adm-stat-chevron">›</span>
          </div>
          <div className="adm-stat-val">{stats.applicationsCount}</div>
          <div className="adm-stat-lbl">Applications</div>
        </div>

        {/* Card 4: Offers */}
        <div className="adm-stat-card glass-card" onClick={() => navigate("/admin/applications")}>
          <div className="adm-stat-top">
            <div className="adm-stat-icon-wrap icon-green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/>
                <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-12 0V6a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            <span className="adm-stat-chevron">›</span>
          </div>
          <div className="adm-stat-val">{stats.offersCount}</div>
          <div className="adm-stat-lbl">Offers</div>
        </div>
      </div>

      {/* ─── APPLICATIONS OVERVIEW CARD ─────────────────────── */}
      <div className="adm-chart-card glass">
        <div className="adm-chart-head">
          <div className="adm-chart-title-group">
            <div className="adm-chart-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <h3 className="adm-chart-heading">Applications Overview</h3>
              <p className="adm-chart-sub">Number of applications over time.</p>
            </div>
          </div>

          <div className="adm-chart-dropdown-wrap">
            <select
              className="adm-chart-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="6m">Last 6 Months</option>
              <option value="3m">Last 3 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>

        <div className="adm-chart-body">
          {/* Y-Axis Labels */}
          <div className="adm-y-axis">
            <span>5</span>
            <span>4</span>
            <span>3</span>
            <span>2</span>
            <span>1</span>
            <span>0</span>
          </div>

          {/* Chart Plot Area with Grid Lines */}
          <div className="adm-plot-area">
            <div className="adm-grid-line line-5" />
            <div className="adm-grid-line line-4" />
            <div className="adm-grid-line line-3" />
            <div className="adm-grid-line line-2" />
            <div className="adm-grid-line line-1" />
            <div className="adm-grid-line line-0" />

            {/* Empty State Centered in Plot */}
            <div className="adm-empty-overlay">
              <div className="adm-empty-glow-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h4 className="adm-empty-title">No application data yet</h4>
              <p className="adm-empty-sub">Applications will appear here once students start applying.</p>
            </div>
          </div>
        </div>

        {/* X-Axis Months Row */}
        <div className="adm-x-axis">
          {monthLabels.map((m) => (
            <span key={m} className="adm-x-month">{m}</span>
          ))}
        </div>
      </div>

      {/* ─── GET STARTED CARD ───────────────────────────────── */}
      <div className="adm-get-started-banner glass">
        <div className="adm-gs-left">
          <div className="adm-gs-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <h4 className="adm-gs-heading">Get started</h4>
            <p className="adm-gs-sub">Add companies and drives to begin tracking applications.</p>
          </div>
        </div>

        <button
          className="btn btn-primary adm-gs-btn"
          onClick={() => navigate("/companies/new")}
        >
          + Add Company
        </button>
      </div>
    </div>
  );
}
