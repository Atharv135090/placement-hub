import { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLongPress } from "../contexts/PrivateControlContext";
import { useAdmin } from "../hooks/useAdmin";
import { logOut } from "../services/auth";
import TopHeader from "./TopHeader";
import UserAvatar from "./UserAvatar";
import PlacementLogo from "./PlacementLogo";
import Modal from "./Modal";
import "./AppShell.css";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/companies",
    label: "Companies",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    ),
  },
  {
    to: "/applications",
    label: "Applications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: "/students",
    label: "Students",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    to: "/ats",
    label: "ATS",
    badge: "Soon",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.3V16c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    to: "/assistant",
    label: "Assistant",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <line x1="10" y1="22" x2="14" y2="22" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function AppShell() {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [adminVerifyOpen, setAdminVerifyOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState("");

  const ADMIN_PIN = "5090";

  const handleAdminLongPress = useCallback(() => {
    setAdminVerifyOpen(true);
  }, []);

  const logoLongPressHandlers = useLongPress(handleAdminLongPress, { delay: 1000 });

  useEffect(() => {
    function handleOpenPrompt() {
      setAdminVerifyOpen(true);
    }
    window.addEventListener("open-admin-prompt", handleOpenPrompt);
    return () => window.removeEventListener("open-admin-prompt", handleOpenPrompt);
  }, []);

  function handleAdminVerify() {
    if (adminPin === ADMIN_PIN) {
      sessionStorage.setItem("admin_authenticated", "true");
      setAdminVerifyOpen(false);
      setAdminPin("");
      setAdminError("");
      navigate("/admin");
    } else {
      setAdminError("Incorrect password");
      setAdminPin("");
    }
  }

  async function handleLogout() {
    await logOut();
    navigate("/login");
  }

  const currentNavItems = useMemo(() => NAV_ITEMS, []);

  return (
    <div className="app-shell">
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} glass`}>
        <div className="sidebar-head">
          <div
            className="sidebar-brand-click"
            {...(isAdmin ? logoLongPressHandlers : {})}
            onClick={() => navigate("/")}
            title={isAdmin ? "Hold to open Admin Controls" : "Placement Hub"}
          >
            <PlacementLogo size={34} />
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="brand-title">Placement Hub</span>
                <span className="brand-tag">Track · Prepare · Apply</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {currentNavItems.map((item) => {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `sidebar-link ${isActive || (item.to === "/students" && location.pathname.startsWith("/chat")) ? "sidebar-link--active" : ""}`
                }
                title={item.label}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="sidebar-label">{item.label}</span>
                    {item.badge && <span className="sidebar-soon-badge">{item.badge}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-foot">
          <div
            className={`sidebar-user ${location.pathname === "/profile" || location.pathname === "/settings" ? "sidebar-user--active" : ""}`}
            onClick={() => navigate("/profile")}
            title="View Profile"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/profile");
              }
            }}
          >
            <div className="sidebar-avatar">
              <UserAvatar user={user} profile={profile} alt="Avatar" />
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {profile?.displayName || user?.displayName || "Student"}
                </span>
                <span className="sidebar-user-email">
                  {profile?.role === "owner" ? "Owner" : profile?.role === "admin" ? "Admin" : (profile?.role || user?.email || "")}
                </span>
              </div>
            )}
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── MAIN VIEWPORT ── */}
      <div className="main-viewport">
        <TopHeader />
        <main key={location.pathname} className="main-content animate-page-enter">
          <Outlet />
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-nav-dock glass" aria-label="Mobile Navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `mobile-nav-btn ${isActive ? "active" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/companies"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? "active" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
          </svg>
          <span>Companies</span>
        </NavLink>

        <NavLink
          to="/applications"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? "active" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Apps</span>
        </NavLink>

        <NavLink
          to="/assistant"
          className={({ isActive }) => `mobile-nav-btn ${isActive ? "active" : ""}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
          <span>Assistant</span>
        </NavLink>

        <button
          className={`mobile-nav-btn ${moreDrawerOpen ? "active" : ""}`}
          onClick={() => setMoreDrawerOpen(!moreDrawerOpen)}
          aria-label="More Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
          <span>More</span>
        </button>
      </nav>

      {/* ── MOBILE MORE DRAWER ── */}
      {moreDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMoreDrawerOpen(false)}>
          <div className="mobile-drawer-sheet glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-header">
              <h3>All Navigation</h3>
              <button className="drawer-close-btn" onClick={() => setMoreDrawerOpen(false)}>✕</button>
            </div>
            <div className="drawer-grid">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="drawer-item glass"
                  onClick={() => setMoreDrawerOpen(false)}
                >
                  <span className="drawer-item-icon">{item.icon}</span>
                  <span className="drawer-item-label">
                    {item.label}
                    {item.badge && <span className="drawer-soon-badge">{item.badge}</span>}
                  </span>
                </NavLink>
              ))}
              <NavLink
                to="/profile"
                className="drawer-item glass"
                onClick={() => setMoreDrawerOpen(false)}
              >
                <span className="drawer-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="drawer-item-label">Profile</span>
              </NavLink>
              <NavLink
                to="/chat"
                className="drawer-item glass"
                onClick={() => setMoreDrawerOpen(false)}
              >
                <span className="drawer-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="drawer-item-label">Chat</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN ACCESS MODAL ── */}
      <Modal
        open={adminVerifyOpen}
        onClose={() => { setAdminVerifyOpen(false); setAdminPin(""); setAdminError(""); }}
        title="Enter Admin Password"
      >
        <p className="modal-confirm-text" style={{ fontSize: "0.86rem", color: "var(--text-secondary)", marginBottom: 14 }}>
          Please enter the admin password to access the Control Center.
        </p>
        <div className="modal-field">
          <input
            type="password"
            className="input-field"
            placeholder="Enter password"
            value={adminPin}
            onChange={(e) => {
              setAdminPin(e.target.value);
              if (adminError) setAdminError("");
            }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAdminVerify(); }}
            style={{ textAlign: "center", letterSpacing: "4px", fontSize: "1.1rem" }}
          />
        </div>
        {adminError && (
          <p style={{ color: "var(--accent)", fontSize: "0.84rem", marginTop: 8, fontWeight: 600, textAlign: "center" }}>
            {adminError}
          </p>
        )}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button
            className="modal-btn modal-btn--secondary"
            onClick={() => { setAdminVerifyOpen(false); setAdminPin(""); setAdminError(""); }}
          >
            Cancel
          </button>
          <button className="modal-btn modal-btn--primary" onClick={handleAdminVerify}>
            Open Admin Panel
          </button>
        </div>
      </Modal>
    </div>
  );
}
