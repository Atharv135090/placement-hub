import { useState, useMemo } from "react";
import { usePlacementData } from "../contexts/PlacementDataContext";
import CompanyLogo from "../components/CompanyLogo";
import "./Analytics.css";

function timeAgo(dateVal) {
  if (!dateVal) return "recently";
  const d = dateVal?.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
  if (isNaN(d.getTime())) return "recently";
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Analytics() {
  const { applications, stats, companies } = usePlacementData();

  const [dateRange, setDateRange] = useState("Aug 2026 - Sep 2026");
  const [funnelPeriod, setFunnelPeriod] = useState("This Period");
  const [trendRange, setTrendRange] = useState("Last 8 Months");

  const displayStats = useMemo(() => {
    return {
      total: stats?.total || 0,
      shortlisted: stats?.shortlisted || 0,
      interview: stats?.interview || 0,
      offer: stats?.offer || stats?.selected || 0,
      applied: stats?.applied || 0,
    };
  }, [stats]);

  // Real monthly data for last 9 months
  const monthlyData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const now = new Date();
    const currentYear = now.getFullYear();

    return monthNames.map((m, idx) => {
      const count = (applications || []).filter((a) => {
        const rawDate = a.appliedAt || a.createdAt;
        if (!rawDate) return false;
        const d = rawDate?.seconds ? new Date(rawDate.seconds * 1000) : new Date(rawDate);
        return !isNaN(d.getTime()) && d.getMonth() === idx && d.getFullYear() === currentYear;
      }).length;

      return {
        month: m,
        count: count || 0,
      };
    });
  }, [applications]);

  const maxMonthlyCount = useMemo(() => {
    const max = Math.max(...monthlyData.map((m) => m.count), 0);
    return max > 0 ? max : 20; // 20 default grid scale matching reference
  }, [monthlyData]);

  // Real applications grouped by company
  const companyApplications = useMemo(() => {
    const map = {};
    (applications || []).forEach((a) => {
      const name = a.companyName || a.company?.name || "Unknown Company";
      if (!map[name]) {
        const matchedComp = (companies || []).find(
          (c) => (c.name || "").toLowerCase() === name.toLowerCase()
        );
        map[name] = {
          name,
          count: 0,
          logoUrl: matchedComp?.logoUrl || a.companyLogo || null,
          status: a.status || "Applied",
        };
      }
      map[name].count += 1;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [applications, companies]);

  // Real recent activity events
  const recentActivities = useMemo(() => {
    return [...(applications || [])]
      .sort((a, b) => {
        const tA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || a.appliedAt || 0).getTime();
        const tB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || b.appliedAt || 0).getTime();
        return tB - tA;
      })
      .slice(0, 5);
  }, [applications]);

  const totalApps = displayStats.total || 0;
  const shortlistedPct = totalApps > 0 ? Math.round((displayStats.shortlisted / totalApps) * 100) : 0;
  const interviewPct = totalApps > 0 ? Math.round((displayStats.interview / totalApps) * 100) : 0;
  const offerPct = totalApps > 0 ? Math.round((displayStats.offer / totalApps) * 100) : 0;
  const appliedPct = totalApps > 0 ? Math.round((displayStats.applied / totalApps) * 100) : 0;

  return (
    <div className="analytics-workspace animate-fade-in">
      {/* ── 1. ANALYTICS HEADER ── */}
      <div className="an-header-card">
        <div className="an-header-left">
          <div className="an-header-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="an-header-text">
            <span className="an-tag">ANALYTICS</span>
            <h1 className="an-title">
              Your Placement Journey in <span className="an-title-highlight">Insights</span>
            </h1>
            <p className="an-subtitle">Track progress. Find patterns. Make better decisions.</p>
          </div>
        </div>

        {/* Subtle Automotive Wave & Motto */}
        <div className="an-header-center">
          <div className="an-airflow-wave" />
          <div className="an-motto-block">
            <div className="an-motto-line" />
            <div className="an-motto-text">
              <span>DISCIPLINE</span>
              <span>CREATES</span>
              <span>OPPORTUNITIES</span>
            </div>
          </div>
        </div>

        {/* Right Range Selector & Quote */}
        <div className="an-header-right">
          <div className="an-date-selector">
            <span className="an-cal-icon">📅</span>
            <span className="an-date-text">{dateRange}</span>
            <span className="an-select-arrow">▾</span>
          </div>
          <div className="an-header-quote-block">
            <p className="an-header-quote">"Data turns effort into direction."</p>
            <div className="an-header-quote-bar" />
          </div>
        </div>
      </div>

      {/* ── 2. KPI CARDS (5 METRIC CARDS WITH SPARKLINES) ── */}
      <div className="an-kpi-grid">
        {/* Total Applications */}
        <div className="an-kpi-card an-kpi-pink">
          <div className="an-kpi-top">
            <span className="an-kpi-label">Total Applications</span>
            <div className="an-kpi-icon-box an-kpi-icon-pink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          </div>
          <div className="an-kpi-value">{displayStats.total}</div>
          <div className="an-kpi-bottom">
            <div className="an-kpi-trend">
              <span className="an-trend-arrow">↗</span> +0% <span className="an-trend-sub">vs last period</span>
            </div>
            <div className="an-kpi-sparkline">
              <svg viewBox="0 0 80 24" fill="none" className="an-spark-svg">
                <path d="M0 20 C20 18, 40 22, 60 14 C70 10, 75 8, 80 6" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Shortlisted */}
        <div className="an-kpi-card an-kpi-green">
          <div className="an-kpi-top">
            <span className="an-kpi-label">Shortlisted</span>
            <div className="an-kpi-icon-box an-kpi-icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className="an-kpi-value">{displayStats.shortlisted}</div>
          <div className="an-kpi-bottom">
            <div className="an-kpi-trend">
              <span className="an-trend-arrow">↗</span> +0% <span className="an-trend-sub">vs last period</span>
            </div>
            <div className="an-kpi-sparkline">
              <svg viewBox="0 0 80 24" fill="none" className="an-spark-svg">
                <path d="M0 22 C25 20, 45 22, 65 15 C72 12, 76 9, 80 6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Interviews */}
        <div className="an-kpi-card an-kpi-blue">
          <div className="an-kpi-top">
            <span className="an-kpi-label">Interviews</span>
            <div className="an-kpi-icon-box an-kpi-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="an-kpi-value">{displayStats.interview}</div>
          <div className="an-kpi-bottom">
            <div className="an-kpi-trend">
              <span className="an-trend-arrow">↗</span> +0% <span className="an-trend-sub">vs last period</span>
            </div>
            <div className="an-kpi-sparkline">
              <svg viewBox="0 0 80 24" fill="none" className="an-spark-svg">
                <path d="M0 20 C20 22, 40 18, 60 16 C70 12, 75 9, 80 6" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Offers */}
        <div className="an-kpi-card an-kpi-orange">
          <div className="an-kpi-top">
            <span className="an-kpi-label">Offers</span>
            <div className="an-kpi-icon-box an-kpi-icon-orange">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
              </svg>
            </div>
          </div>
          <div className="an-kpi-value">{displayStats.offer}</div>
          <div className="an-kpi-bottom">
            <div className="an-kpi-trend">
              <span className="an-trend-arrow">↗</span> +0% <span className="an-trend-sub">vs last period</span>
            </div>
            <div className="an-kpi-sparkline">
              <svg viewBox="0 0 80 24" fill="none" className="an-spark-svg">
                <path d="M0 22 C25 22, 45 20, 65 14 C72 10, 76 7, 80 5" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* In Review */}
        <div className="an-kpi-card an-kpi-purple">
          <div className="an-kpi-top">
            <span className="an-kpi-label">In Review</span>
            <div className="an-kpi-icon-box an-kpi-icon-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="an-kpi-value">{displayStats.applied}</div>
          <div className="an-kpi-bottom">
            <div className="an-kpi-trend">
              <span className="an-trend-arrow">↗</span> +0% <span className="an-trend-sub">vs last period</span>
            </div>
            <div className="an-kpi-sparkline">
              <svg viewBox="0 0 80 24" fill="none" className="an-spark-svg">
                <path d="M0 22 C20 18, 45 24, 65 16 C72 11, 76 8, 80 6" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. MIDDLE ROW: APPLICATION FUNNEL & APPLICATION TREND ── */}
      <div className="an-middle-grid">
        {/* Left Card: 3D Application Funnel */}
        <div className="an-panel-card an-funnel-card">
          <div className="an-panel-header">
            <div className="an-panel-header-left">
              <div className="an-header-icon-badge an-badge-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </div>
              <div>
                <h3 className="an-panel-title">Application Funnel</h3>
                <p className="an-panel-sub">From application to offer — see where you stand.</p>
              </div>
            </div>
            <div className="an-panel-select-pill">
              <span>{funnelPeriod}</span>
              <span className="an-select-arrow">▾</span>
            </div>
          </div>

          <div className="an-funnel-body">
            {/* 3D Stacked Funnel Graphic */}
            <div className="an-funnel-visual-col">
              <div className="an-3d-funnel-wrapper">
                {/* Stage 1: Applied (Top, Rose Red) */}
                <div className="an-funnel-stage an-stage-applied">
                  <span className="an-stage-count">{displayStats.total || displayStats.applied || 0}</span>
                </div>
                {/* Stage 2: Shortlisted (Orange Coral) */}
                <div className="an-funnel-stage an-stage-shortlisted">
                  <span className="an-stage-count">{displayStats.shortlisted}</span>
                </div>
                {/* Stage 3: Interview (Cyan Blue) */}
                <div className="an-funnel-stage an-stage-interview">
                  <span className="an-stage-count">{displayStats.interview}</span>
                </div>
                {/* Stage 4: Offer (Purple Violet) */}
                <div className="an-funnel-stage an-stage-offer">
                  <span className="an-stage-count">{displayStats.offer}</span>
                </div>
                {/* Base Glow Platform */}
                <div className="an-funnel-base-glow" />
              </div>
            </div>

            {/* Funnel Legend Breakdown */}
            <div className="an-funnel-legend-col">
              <div className="an-legend-item">
                <div className="an-legend-left">
                  <span className="an-dot an-dot-applied" />
                  <span className="an-legend-name">Applied</span>
                </div>
                <div className="an-legend-right">
                  <span className="an-legend-count">{displayStats.total || displayStats.applied || 0}</span>
                  <span className="an-legend-pct">{totalApps > 0 ? "100%" : "0%"}</span>
                </div>
              </div>

              <div className="an-legend-item">
                <div className="an-legend-left">
                  <span className="an-dot an-dot-shortlisted" />
                  <span className="an-legend-name">Shortlisted</span>
                </div>
                <div className="an-legend-right">
                  <span className="an-legend-count">{displayStats.shortlisted}</span>
                  <span className="an-legend-pct">{shortlistedPct}%</span>
                </div>
              </div>

              <div className="an-legend-item">
                <div className="an-legend-left">
                  <span className="an-dot an-dot-interview" />
                  <span className="an-legend-name">Interview</span>
                </div>
                <div className="an-legend-right">
                  <span className="an-legend-count">{displayStats.interview}</span>
                  <span className="an-legend-pct">{interviewPct}%</span>
                </div>
              </div>

              <div className="an-legend-item">
                <div className="an-legend-left">
                  <span className="an-dot an-dot-offer" />
                  <span className="an-legend-name">Offer</span>
                </div>
                <div className="an-legend-right">
                  <span className="an-legend-count">{displayStats.offer}</span>
                  <span className="an-legend-pct">{offerPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Modern 3D Depth Application Trend Bar Chart */}
        <div className="an-panel-card an-trend-card">
          <div className="an-panel-header">
            <div className="an-panel-header-left">
              <div className="an-header-icon-badge an-badge-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div>
                <h3 className="an-panel-title">Application Trend</h3>
                <p className="an-panel-sub">Your application activity over time.</p>
              </div>
            </div>
            <div className="an-panel-select-pill">
              <span>{trendRange}</span>
              <span className="an-select-arrow">▾</span>
            </div>
          </div>

          <div className="an-trend-chart-area">
            {/* Y-Axis Ticks & Horizontal Grid Lines */}
            <div className="an-chart-y-axis">
              <div className="an-y-tick"><span>20</span><div className="an-grid-line" /></div>
              <div className="an-y-tick"><span>15</span><div className="an-grid-line" /></div>
              <div className="an-y-tick"><span>10</span><div className="an-grid-line" /></div>
              <div className="an-y-tick"><span>5</span><div className="an-grid-line" /></div>
              <div className="an-y-tick"><span>0</span><div className="an-grid-line" /></div>
            </div>

            {/* Vertical Columns Container */}
            <div className="an-chart-columns-row">
              {monthlyData.map((m, idx) => {
                const heightPct = (m.count / maxMonthlyCount) * 100;
                return (
                  <div key={idx} className="an-chart-col">
                    <span className="an-bar-count-label">{m.count}</span>
                    <div className="an-bar-3d-track">
                      <div
                        className="an-bar-3d-fill"
                        style={{ height: m.count > 0 ? `${Math.max(heightPct, 8)}%` : "0%" }}
                      />
                    </div>
                    <span className="an-bar-month-label">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. LOWER ROW (3 CARDS SPLIT) ── */}
      <div className="an-lower-grid">
        {/* Status Distribution */}
        <div className="an-panel-card an-donut-card">
          <div className="an-panel-header-simple">
            <div className="an-header-icon-badge an-badge-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="an-panel-title">Status Distribution</h3>
              <p className="an-panel-sub">Breakdown of your application statuses.</p>
            </div>
          </div>

          <div className="an-donut-body">
            {/* 3D Glass Donut Ring */}
            <div className="an-donut-canvas-wrap">
              <div className="an-3d-glass-donut">
                <svg width="140" height="140" viewBox="0 0 140 140" className="an-donut-svg">
                  {/* Background Track */}
                  <circle cx="70" cy="70" r="52" fill="none" stroke="rgba(226, 232, 240, 0.6)" strokeWidth="18" />
                  {/* Subtle Red Arc */}
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke="url(#donutRedGrad)"
                    strokeWidth="18"
                    strokeDasharray="326"
                    strokeDashoffset={totalApps > 0 ? `${326 - (326 * appliedPct) / 100}` : "260"}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="donutRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#e11d48" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="an-donut-center">
                  <span className="an-donut-center-num">{displayStats.total}</span>
                  <span className="an-donut-center-lbl">Total</span>
                </div>
              </div>
            </div>

            {/* Status Breakdown Legend */}
            <div className="an-donut-legend">
              <div className="an-dist-item">
                <div className="an-dist-left"><span className="an-dot an-dot-applied" /> Applied</div>
                <div className="an-dist-right"><span>{displayStats.applied}</span> <span>{appliedPct}%</span></div>
              </div>
              <div className="an-dist-item">
                <div className="an-dist-left"><span className="an-dot an-dot-shortlisted" /> Shortlisted</div>
                <div className="an-dist-right"><span>{displayStats.shortlisted}</span> <span>{shortlistedPct}%</span></div>
              </div>
              <div className="an-dist-item">
                <div className="an-dist-left"><span className="an-dot an-dot-interview" /> Interview</div>
                <div className="an-dist-right"><span>{displayStats.interview}</span> <span>{interviewPct}%</span></div>
              </div>
              <div className="an-dist-item">
                <div className="an-dist-left"><span className="an-dot an-dot-offer" /> Offer</div>
                <div className="an-dist-right"><span>{displayStats.offer}</span> <span>{offerPct}%</span></div>
              </div>
              <div className="an-dist-item">
                <div className="an-dist-left"><span className="an-dot an-dot-review" /> In Review</div>
                <div className="an-dist-right"><span>{displayStats.applied}</span> <span>{appliedPct}%</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="an-panel-card an-response-card">
          <div className="an-panel-header-simple">
            <div className="an-header-icon-badge an-badge-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="an-panel-title">Response Time</h3>
              <p className="an-panel-sub">Average time taken at each stage.</p>
            </div>
          </div>

          <div className="an-response-grid">
            <div className="an-response-box">
              <span className="an-resp-val an-resp-red">0 days</span>
              <span className="an-resp-lbl">Application → Shortlist</span>
            </div>
            <div className="an-response-box">
              <span className="an-resp-val an-resp-orange">0 days</span>
              <span className="an-resp-lbl">Shortlist → Interview</span>
            </div>
            <div className="an-response-box">
              <span className="an-resp-val an-resp-blue">0 days</span>
              <span className="an-resp-lbl">Interview → Offer</span>
            </div>
            <div className="an-response-box">
              <span className="an-resp-val an-resp-purple">0 days</span>
              <span className="an-resp-lbl">Overall (Applied → Offer)</span>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div className="an-panel-card an-insights-card">
          <div className="an-panel-header-simple">
            <div className="an-header-icon-badge an-badge-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="9" y1="18" x2="15" y2="18" />
                <line x1="10" y1="22" x2="14" y2="22" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
              </svg>
            </div>
            <div>
              <h3 className="an-panel-title">Key Insights</h3>
              <p className="an-panel-sub">AI-powered insights from your activity.</p>
            </div>
          </div>

          <div className="an-insight-banner">
            <div className="an-insight-icon">✨</div>
            <div className="an-insight-content">
              <h4 className="an-insight-title">Keep going!</h4>
              <p className="an-insight-text">
                Start applying to companies to see personalized insights, trends and recommendations here.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. APPLICATIONS BY COMPANY & RECENT ACTIVITY (NATURAL VERTICAL SCROLL) ── */}
      <div className="an-scroll-grid">
        {/* Applications by Company */}
        <div className="an-panel-card an-companies-card">
          <div className="an-panel-header-simple">
            <div className="an-header-icon-badge an-badge-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
              </svg>
            </div>
            <div>
              <h3 className="an-panel-title">Applications by Company</h3>
              <p className="an-panel-sub">Companies you have engaged with and your current progress.</p>
            </div>
          </div>

          {companyApplications.length === 0 ? (
            <div className="an-empty-state-box">
              <div className="an-empty-icon-wrap">🏢</div>
              <p className="an-empty-title">No company applications yet.</p>
              <p className="an-empty-desc">When you apply to companies, their breakdown and conversion will display here.</p>
            </div>
          ) : (
            <div className="an-company-list">
              {companyApplications.map((comp, idx) => (
                <div key={idx} className="an-company-row">
                  <div className="an-comp-left">
                    <CompanyLogo name={comp.name} logoUrl={comp.logoUrl} size={36} />
                    <div className="an-comp-meta">
                      <span className="an-comp-name">{comp.name}</span>
                      <span className="an-comp-status">{comp.status}</span>
                    </div>
                  </div>
                  <div className="an-comp-right">
                    <span className="an-comp-count">{comp.count}</span>
                    <span className="an-comp-unit">applied</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="an-panel-card an-activity-card">
          <div className="an-panel-header-simple">
            <div className="an-header-icon-badge an-badge-red">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h3 className="an-panel-title">Recent Activity</h3>
              <p className="an-panel-sub">Timeline of applications, interviews, and progress.</p>
            </div>
          </div>

          {recentActivities.length === 0 ? (
            <div className="an-empty-state-box">
              <div className="an-empty-icon-wrap">⚡</div>
              <p className="an-empty-title">No recent activity yet.</p>
              <p className="an-empty-desc">Application submissions, interviews, and status updates will be logged here.</p>
            </div>
          ) : (
            <div className="an-timeline-list">
              {recentActivities.map((act) => (
                <div key={act.id} className="an-timeline-item">
                  <div className="an-timeline-dot" />
                  <div className="an-timeline-info">
                    <span className="an-timeline-title">Applied to {act.companyName}</span>
                    <span className="an-timeline-time">{timeAgo(act.appliedAt || act.createdAt)}</span>
                  </div>
                  <span className="an-timeline-badge">{act.status || "Applied"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 6. FOOTER SLOGAN ── */}
      <div className="an-footer-bar">
        <div className="an-footer-left">
          <div className="an-footer-red-line" />
          <span className="an-footer-motto">KEEP MOVING FORWARD.</span>
        </div>
        <div className="an-footer-right">
          <span>PLACEMENT HUB</span>
          <span className="an-footer-dot">×</span>
          <span>TRACK</span>
          <span>LEARN</span>
          <span>ACHIEVE</span>
        </div>
      </div>
    </div>
  );
}
