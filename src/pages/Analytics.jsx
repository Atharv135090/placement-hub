import { useMemo } from "react";
import { usePlacementData } from "../contexts/PlacementDataContext";
import "./Analytics.css";

export default function Analytics() {
  const { applications, stats, conversionMetrics } = usePlacementData();

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    return months.slice(0, now.getMonth() + 1).map((m, i) => {
      const count = applications.filter(a => {
        const d = new Date(a.appliedAt);
        return !isNaN(d.getTime()) && d.getMonth() === i && d.getFullYear() === now.getFullYear();
      }).length;
      return { month: m, count };
    });
  }, [applications]);

  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  const companyBreakdown = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      const name = a.companyName || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [applications]);

  const displayStats = useMemo(() => stats, [stats]);

  const displayConversions = useMemo(() => conversionMetrics, [conversionMetrics]);

  return (
    <div className="analytics-page animate-fade-in">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <div className="analytics-icon-badge">📊</div>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Track your placement performance, conversion funnel, and insights.</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="analytics-metrics-grid">
        <div className="metric-card glass">
          <span className="metric-label">Total Applications</span>
          <strong className="metric-value">{displayStats.total}</strong>
        </div>
        <div className="metric-card glass">
          <span className="metric-label">Shortlisted</span>
          <strong className="metric-value text-emerald">{displayStats.shortlisted}</strong>
        </div>
        <div className="metric-card glass">
          <span className="metric-label">Interviews</span>
          <strong className="metric-value text-blue">{displayStats.interview}</strong>
        </div>
        <div className="metric-card glass">
          <span className="metric-label">Offers</span>
          <strong className="metric-value text-amber">{displayStats.offer}</strong>
        </div>
        <div className="metric-card glass">
          <span className="metric-label">In Review</span>
          <strong className="metric-value text-red">{displayStats.applied}</strong>
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="analytics-section glass">
        <h3 className="section-heading">Conversion Metrics</h3>
        <div className="conversion-grid">
          <div className="conversion-item">
            <span className="conv-label">Application → Shortlist</span>
            <div className="conv-bar-wrap">
              <div className="conv-bar" style={{ width: `${displayConversions.applicationToShortlist}%` }} />
            </div>
            <span className="conv-pct">{displayConversions.applicationToShortlist}%</span>
          </div>
          <div className="conversion-item">
            <span className="conv-label">Shortlist → Interview</span>
            <div className="conv-bar-wrap">
              <div className="conv-bar" style={{ width: `${displayConversions.shortlistToInterview}%` }} />
            </div>
            <span className="conv-pct">{displayConversions.shortlistToInterview}%</span>
          </div>
          <div className="conversion-item">
            <span className="conv-label">Interview → Offer</span>
            <div className="conv-bar-wrap">
              <div className="conv-bar" style={{ width: `${displayConversions.interviewToOffer}%` }} />
            </div>
            <span className="conv-pct">{displayConversions.interviewToOffer}%</span>
          </div>
        </div>
      </div>

      {/* Placement Funnel */}
      <div className="analytics-section glass">
        <h3 className="section-heading">Placement Funnel</h3>
        <div className="funnel-visual">
          {[
            { label: "Applied", count: displayStats.applied, width: "100%" },
            { label: "Shortlisted", count: displayStats.shortlisted, width: `${Math.max((displayStats.shortlisted / (displayStats.total || 1)) * 100, 15)}%` },
            { label: "Interview", count: displayStats.interview, width: `${Math.max((displayStats.interview / (displayStats.total || 1)) * 100, 12)}%` },
            { label: "Offer", count: displayStats.offer, width: `${Math.max((displayStats.offer / (displayStats.total || 1)) * 100, 10)}%` },
          ].map((step, i) => (
            <div key={i} className="funnel-step">
              <div className="funnel-bar-wrap">
                <div className="funnel-bar" style={{ width: step.width }}>
                  <span className="funnel-count">{step.count}</span>
                </div>
              </div>
              <span className="funnel-label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Application Trends */}
      <div className="analytics-section glass">
        <h3 className="section-heading">Monthly Applications</h3>
        <div className="bar-chart-wrap">
          {monthlyData.map((m, i) => (
            <div key={i} className="bar-col">
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${(m.count / maxMonthly) * 100}%` }} />
              </div>
              <span className="bar-label">{m.month}</span>
              <span className="bar-count">{m.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Company Breakdown */}
      <div className="analytics-section glass">
        <h3 className="section-heading">Applications by Company</h3>
        <div className="company-breakdown-list">
          {companyBreakdown.map(([name, count], i) => (
            <div key={i} className="cb-row">
              <span className="cb-rank">#{i + 1}</span>
              <span className="cb-name">{name}</span>
              <div className="cb-bar-wrap">
                <div className="cb-bar" style={{ width: `${(count / (companyBreakdown[0]?.[1] || 1)) * 100}%` }} />
              </div>
              <span className="cb-count">{count}</span>
            </div>
          ))}
          {companyBreakdown.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.84rem" }}>No application data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
