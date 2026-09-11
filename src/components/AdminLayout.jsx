import { useState, useCallback, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { logOut } from "../services/auth";
import { subscribeToNotifications } from "../services/firestore";
import PlacementLogo from "./PlacementLogo";
import UserAvatar from "./UserAvatar";
import "./AdminLayout.css";

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ChatbotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CompaniesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </svg>
);

const DrivesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const ReportsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ADMIN_NAV = [
  { to: "/admin",           icon: DashboardIcon, label: "Dashboard",         end: true },
  { to: "/admin/chatbot",   icon: ChatbotIcon,   label: "Admin Assistant" },
  { to: "/admin/analytics", icon: AnalyticsIcon, label: "Website Analytics" },
  { to: "/admin/users",     icon: UsersIcon,     label: "Users" },
  { to: "/admin/reports",   icon: ReportsIcon,   label: "Reports" },
  { to: "/admin/companies", icon: CompaniesIcon, label: "Companies" },
];

export default function AdminLayout() {
  const { user, profile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setAdminNotifications);
    return () => unsub?.();
  }, [user?.uid]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  function toggleTheme() {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  }

  async function handleLogout() {
    sessionStorage.removeItem("admin_authenticated");
    await logOut();
    navigate("/login");
  }

  const displayName = profile?.displayName || user?.displayName || "Admin";

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useState(null);

  // Ctrl+K keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const inputEl = document.querySelector(".admin-search-input");
        if (inputEl) inputEl.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="admin-shell">
      {/* ─── SIDEBAR ─────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${collapsed ? "admin-sidebar--collapsed" : ""}`}>
        <div className="admin-sidebar-head">
          <NavLink to="/admin" className="admin-brand" title="Placement Hub Admin">
            <PlacementLogo size={30} />
            {!collapsed && (
              <div className="admin-brand-info">
                <span className="admin-brand-title">Placement Hub</span>
                <span className="admin-brand-tag">Track · Prepare · Apply</span>
              </div>
            )}
          </NavLink>

          <button
            className="admin-sidebar-toggle"
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Navigation list matching reference UI */}
        <nav className="admin-sidebar-nav">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? "admin-nav-link--active" : ""}`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="admin-nav-icon"><Icon /></span>
                {!collapsed && <span className="admin-nav-label">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Futuristic sidebar watermark section matching reference */}
        {!collapsed && (
          <div className="admin-sidebar-watermark">
            <div className="admin-sidebar-motto">
              <span>BUILD</span>
              <span>BETTER</span>
              <span>OPPORTUNITIES.</span>
            </div>
          </div>
        )}

        {/* Footer with User profile & Logout */}
        <div className="admin-sidebar-foot">
          <div
            className="admin-user-card"
            onClick={() => navigate("/profile")}
            title="View Profile"
          >
            <div className="admin-avatar">
              <UserAvatar user={user} profile={profile} alt="Avatar" />
            </div>
            {!collapsed && (
              <div className="admin-user-info">
                <span className="admin-user-name">{displayName}</span>
                <span className="admin-user-role">{profile?.role === "owner" ? "Owner" : "Admin"}</span>
              </div>
            )}
            {!collapsed && (
              <span className="admin-user-chevron">‹›</span>
            )}
          </div>

          <button className="admin-logout-btn" onClick={handleLogout} title="Logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>

          {!collapsed && (
            <div className="admin-sidebar-bottom-badge">
              <span className="admin-badge-star">✦</span>
              <span>PLACEMENT HUB ADMIN PANEL</span>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT VIEWPORT ───────────────────────────── */}
      <div className={`admin-main-viewport ${collapsed ? "admin-main--expanded" : ""}`}>
        {/* Admin Top Header matching reference UI */}
        <header className="admin-top-bar">
          <div className="admin-top-bar-left">
            <button
              className="admin-exit-student-btn"
              onClick={() => navigate("/")}
              title="Return to Student Portal"
            >
              ← Student View
            </button>
          </div>

          {/* Central Omnibar Search matching reference image */}
          <div className="admin-search-wrapper">
            <svg className="admin-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search users, companies, drives, applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  navigate(`/admin/users?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
            />
            <span className="admin-search-kbd">Ctrl K</span>
          </div>

          <div className="admin-top-bar-right">
            {/* Theme Toggle */}
            <button
              className="admin-header-btn"
              onClick={toggleTheme}
              title={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle Theme"
            >
              {themeMode === "dark" ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>

            {/* Notification Bell with Badge 3 */}
            <button className="admin-header-btn admin-bell-btn" title="Notifications" onClick={() => navigate("/profile")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {adminNotifications.length > 0 && (
                <span className="admin-bell-badge">{adminNotifications.length}</span>
              )}
            </button>

            {/* User Avatar Chip */}
            <div className="admin-header-user" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
              <div className="admin-header-avatar">
                <UserAvatar user={user} profile={profile} alt="Avatar" />
              </div>
              <span className="admin-header-user-name">{displayName}</span>
              <span className="admin-header-user-arrow">▾</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
