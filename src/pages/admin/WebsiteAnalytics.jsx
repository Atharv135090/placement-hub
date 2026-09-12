import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../config/firebase";
import UserAvatar from "../../components/UserAvatar";
import "./WebsiteAnalytics.css";

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CompanyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
);

const ApplicationIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

const InterviewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <circle cx="12" cy="10" r="2" />
    <line x1="8" x2="8" y1="2" y2="4" />
    <line x1="16" x2="16" y1="2" y2="4" />
  </svg>
);

const OfferIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
    <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2" />
    <path d="M18 12a2 2 0 0 1 2-2" />
    <path d="M18 12v4" />
    <path d="M4 6v4" />
  </svg>
);

const LiveIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <circle cx="5" cy="5" r="5" opacity="0.3">
      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="r" values="4;5;4" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="5" cy="5" r="3" />
  </svg>
);

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M13 2v7h7" />
    <path d="M10 13h4" />
    <path d="M10 17h4" />
  </svg>
);

export default function WebsiteAnalytics() {
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      try {
        const [companiesSnap, appsSnap, usersSnap, notifSnap] = await Promise.all([
          getDocs(collection(db, "companies")),
          getDocs(query(collection(db, "applications"), orderBy("createdAt", "desc"), limit(500))),
          getDocs(query(collection(db, "users"), limit(500))),
          getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(200))),
        ]);
        if (cancelled) return;
        setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setApplications(appsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setNotifications(notifSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } catch (err) {
        console.error("Failed to load analytics:", err);
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.lastLogin >= weekAgo || u.updatedAt >= weekAgo).length,
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => c.isActive !== false).length,
      totalApplications: applications.length,
      applied: applications.filter(a => a.status === "applied").length,
      shortlisted: applications.filter(a => a.status === "shortlisted").length,
      interviews: applications.filter(a => a.status === "interview").length,
      offers: applications.filter(a => a.status === "offer" || a.status === "selected").length,
      rejected: applications.filter(a => a.status === "rejected").length,
      appsThisMonth: applications.filter(a => a.createdAt >= monthAgo).length,
      totalSaved: companies.reduce((sum, c) => sum + (c.savedCount || 0), 0),
      totalNotifications: notifications.length,
    };
  }, [users, companies, applications, notifications]);

  const companyBreakdown = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      const name = a.companyName || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [applications]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    return months.slice(0, now.getMonth() + 1).map((m, i) => {
      const count = applications.filter(a => {
        const d = new Date(a.createdAt);
        return !isNaN(d.getTime()) && d.getMonth() === i && d.getFullYear() === now.getFullYear();
      }).length;
      return { month: m, count };
    });
  }, [applications]);

  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  const statusDistribution = useMemo(() => {
    const total = applications.length || 1;
    return [
      { label: "Applied", count: stats.applied, pct: Math.round((stats.applied / total) * 100), color: "#60a5fa", gradient: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)" },
      { label: "Shortlisted", count: stats.shortlisted, pct: Math.round((stats.shortlisted / total) * 100), color: "#fbbf24", gradient: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)" },
      { label: "Interview", count: stats.interviews, pct: Math.round((stats.interviews / total) * 100), color: "#a78bfa", gradient: "linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)" },
      { label: "Offer", count: stats.offers, pct: Math.round((stats.offers / total) * 100), color: "#34d399", gradient: "linear-gradient(90deg, #10b981 0%, #34d399 100%)" },
      { label: "Rejected", count: stats.rejected, pct: Math.round((stats.rejected / total) * 100), color: "#f87171", gradient: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)" },
    ];
  }, [stats, applications]);

  if (loading) {
    return (
      <div className="wa-page">
        <div className="wa-header">
          <div className="wa-header-left">
            <h1 className="wa-title">Website Analytics</h1>
            <p className="wa-subtitle">Platform-wide usage and placement statistics</p>
          </div>
        </div>
        <div className="wa-stats-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="wa-stat-card glass">
              <div className="skeleton-card" style={{ height: 90 }} />
            </div>
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="wa-section glass" style={{ marginTop: 16 }}>
            <div className="skeleton-card" style={{ height: 180 }} />
          </div>
        ))}
      </div>
    );
  }

  const cardConfig = [
    { icon: <UsersIcon />, value: stats.totalUsers, label: "Total Users", accent: "var(--accent)", glow: "var(--accent-glow)" },
    { icon: <CompanyIcon />, value: stats.totalCompanies, label: "Total Companies", accent: "#60a5fa", glow: "rgba(96,165,250,0.3)" },
    { icon: <ApplicationIcon />, value: stats.totalApplications, label: "Total Applications", accent: "#a78bfa", glow: "rgba(167,139,250,0.3)" },
    { icon: <InterviewIcon />, value: stats.interviews, label: "Interviews", accent: "var(--amber)", glow: "rgba(245,158,11,0.3)" },
    { icon: <OfferIcon />, value: stats.offers, label: "Offers", accent: "var(--emerald)", glow: "rgba(16,185,129,0.3)" },
  ];

  return (
    <div className="wa-page">
      <div className="wa-header">
        <div className="wa-header-left">
          <h1 className="wa-title">Website Analytics</h1>
          <p className="wa-subtitle">Platform-wide usage and placement statistics</p>
        </div>
        <div className="wa-live-badge">
          <LiveIcon />
          <span>Live Data</span>
        </div>
      </div>

      <div className="wa-stats-grid">
        {cardConfig.map((c, i) => (
          <div
            key={i}
            className="wa-stat-card glass"
            style={{ "--card-accent": c.accent, "--card-glow": c.glow, animationDelay: `${i * 0.07}s` }}
          >
            <div className="wa-stat-top">
              <div className="wa-stat-icon-wrap">{c.icon}</div>
            </div>
            <span className="wa-stat-value">{c.value}</span>
            <span className="wa-stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="wa-two-col">
        <div className="wa-section glass">
          <h3 className="wa-section-title">
            <span className="wa-section-dot" />
            Application Funnel
          </h3>
          {applications.length === 0 ? (
            <div className="wa-empty">
              <EmptyIcon />
              <p>No application data yet</p>
            </div>
          ) : (
            <div className="wa-funnel">
              {statusDistribution.map((step, i) => (
                <div key={i} className="wa-funnel-step">
                  <span className="wa-funnel-label">{step.label}</span>
                  <div className="wa-funnel-track">
                    <div
                      className="wa-funnel-bar"
                      style={{
                        width: `${Math.max(step.pct, step.count > 0 ? 10 : 0)}%`,
                        background: step.gradient,
                        "--funnel-w": `${Math.max(step.pct, step.count > 0 ? 10 : 0)}%`,
                        boxShadow: `0 0 12px ${step.color}33`,
                      }}
                    >
                      <span className="wa-funnel-count">{step.count}</span>
                    </div>
                  </div>
                  <span className="wa-funnel-pct" style={{ color: step.color }}>{step.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="wa-section glass">
          <h3 className="wa-section-title">
            <span className="wa-section-dot" />
            Monthly Applications
          </h3>
          {applications.length === 0 ? (
            <div className="wa-empty">
              <EmptyIcon />
              <p>No application data yet</p>
            </div>
          ) : (
            <div className="wa-bar-chart">
              {monthlyData.map((m, i) => (
                <div key={i} className="wa-bar-col">
                  <span className="wa-bar-count">{m.count || ""}</span>
                  <div className="wa-bar-track">
                    <div
                      className="wa-bar-fill"
                      style={{ height: `${(m.count / maxMonthly) * 100}%`, "--bar-h": `${(m.count / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="wa-bar-label">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="wa-two-col">
        <div className="wa-section glass">
          <h3 className="wa-section-title">
            <span className="wa-section-dot" />
            Company Breakdown
          </h3>
          {companyBreakdown.length === 0 ? (
            <div className="wa-empty">
              <EmptyIcon />
              <p>No company data yet</p>
            </div>
          ) : (
            <div className="wa-company-list">
              {companyBreakdown.map(([name, count], i) => (
                <div key={i} className="wa-company-row">
                  <span className="wa-company-rank">#{i + 1}</span>
                  <span className="wa-company-name">{name}</span>
                  <div className="wa-company-track">
                    <div
                      className="wa-company-bar"
                      style={{ width: `${(count / (companyBreakdown[0]?.[1] || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="wa-company-count">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="wa-section glass">
          <h3 className="wa-section-title">
            <span className="wa-section-dot" />
            Recent Users
          </h3>
          {users.length === 0 ? (
            <div className="wa-empty">
              <EmptyIcon />
              <p>No users yet</p>
            </div>
          ) : (
            <div className="wa-users-list">
              {users.slice(0, 10).map((u) => (
                <div key={u.id} className="wa-user-row">
                  <div className="wa-user-avatar">
                    <UserAvatar user={u} profile={u} alt={u.displayName || "User"} />
                  </div>
                  <div className="wa-user-info">
                    <span className="wa-user-name">{u.displayName || "Unnamed"}</span>
                    <span className="wa-user-email">{u.email}</span>
                  </div>
                  <span className={`wa-user-role wa-role-${u.role || "student"}`}>
                    {u.role || "student"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
