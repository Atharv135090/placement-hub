import { useState, useCallback, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { logOut } from "../services/auth";
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from "../services/firestore";
import PlacementLogo from "./PlacementLogo";
import UserAvatar from "./UserAvatar";
import "./AdminLayout.css";
import "./TopHeader.css";

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

const ReportsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const MessagesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ADMIN_NAV = [
  { to: "/admin",           icon: DashboardIcon, label: "Dashboard",         end: true },
  { to: "/admin/chatbot",   icon: ChatbotIcon,   label: "Admin Assistant" },
  { to: "/admin/analytics", icon: AnalyticsIcon, label: "Website Analytics" },
  { to: "/admin/users",     icon: UsersIcon,     label: "Users" },
  { to: "/admin/reports",   icon: ReportsIcon,   label: "Reports" },
  { to: "/admin/chat",      icon: MessagesIcon,  label: "Messages" },
  { to: "/admin/companies", icon: CompaniesIcon, label: "Companies" },
];

export default function AdminLayout() {
  const { user, profile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const notifPanelRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setAdminNotifications);
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifPanelOpen(false);
      }
    }
    if (notifPanelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifPanelOpen]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  function toggleTheme() {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  }

  async function handleLogout() {
    setUserDropdownOpen(false);
    sessionStorage.removeItem("admin_authenticated");
    await logOut();
    navigate("/login");
  }

  async function handleAdminMarkRead(notifId) {
    await markNotificationRead(notifId, user.uid);
    setAdminNotifications((prev) => prev.filter((n) => n.id !== notifId));
  }

  async function handleAdminMarkAllRead() {
    await markAllNotificationsRead(user.uid);
    setAdminNotifications([]);
  }

  const displayName = profile?.displayName || user?.displayName || "Admin";

  const [searchQuery, setSearchQuery] = useState("");

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
      {mobileDrawerOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      {/* ─── SIDEBAR ─────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${collapsed ? "admin-sidebar--collapsed" : ""} ${mobileDrawerOpen ? "admin-sidebar--open" : ""}`}>
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
                  `admin-sidebar-link ${isActive ? "admin-sidebar-link--active" : ""}`
                }
                onClick={() => setMobileDrawerOpen(false)}
                title={collapsed ? item.label : undefined}
              >
                <span className="admin-sidebar-icon">
                  <Icon />
                </span>
                {!collapsed && <span className="admin-sidebar-label">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Glowing Rocket card banner matching reference media_1789141317680.jpg */}
        {!collapsed && (
          <div className="admin-sidebar-rocket-card">
            <div className="admin-rocket-text">
              <span className="admin-rocket-title">Better People<br />Brighter Futures</span>
              <span className="admin-rocket-sub">Admin Panel</span>
            </div>
            <div className="admin-rocket-graphic">
              🚀
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
              <span className="admin-user-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 8 21 12 17 16" />
                  <polyline points="7 8 3 12 7 16" />
                </svg>
              </span>
            )}
          </div>

          <button className="admin-logout-btn" onClick={handleLogout} title="Logout">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT VIEWPORT ───────────────────────────── */}
      <div className={`admin-main-viewport ${collapsed ? "admin-main--expanded" : ""}`}>
        {/* Admin Top Header matching reference UI */}
        <header className="admin-top-bar">
          <div className="admin-top-bar-left">
            <button
              type="button"
              className="admin-mobile-hamburger"
              onClick={() => setMobileDrawerOpen(true)}
              title="Open Admin Navigation"
              aria-label="Open Admin Navigation"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
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
              placeholder="Search users, companies, applications, or reports..."
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

            {/* Notification Bell with Panel */}
            <div className="admin-notif-wrapper" ref={notifPanelRef}>
              <button
                className="admin-header-btn admin-bell-btn"
                title="Notifications"
                onClick={() => setNotifPanelOpen(!notifPanelOpen)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {adminNotifications.length > 0 && (
                  <span className="admin-bell-badge">{adminNotifications.length}</span>
                )}
              </button>

              {notifPanelOpen && (
                <div className="admin-notif-panel glass">
                  <div className="notif-panel-header">
                    <span>Notifications</span>
                    {adminNotifications.length > 0 && (
                      <button className="notif-mark-all" onClick={handleAdminMarkAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="notif-panel-body">
                    {adminNotifications.length === 0 ? (
                      <p className="notif-empty">No new notifications</p>
                    ) : (
                      adminNotifications.map((n) => (
                        <div key={n.id} className="notif-item" onClick={() => {
                          handleAdminMarkRead(n.id);
                          let target;
                          if (n.type === "admin_message" || n.type === "admin_warning") {
                            target = n.link || "/admin/chat";
                          } else {
                            target = n.senderId ? `/admin/users?q=${n.senderId}` : n.link;
                          }
                          if (target) navigate(target);
                          setNotifPanelOpen(false);
                        }}>
                          <div className="notif-item-dot" />
                          <div className="notif-item-content">
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <span className="notif-item-time">{n.createdAt?.toDate ? new Date(n.createdAt.toDate()).toLocaleString() : ""}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Chat Button matching global PRD */}
            <button className="admin-header-chat-btn" onClick={() => navigate("/admin/chat")} title="Admin Chat">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Chat</span>
            </button>

            {/* User Avatar Chip with Dropdown */}
            <div className="admin-header-user" ref={userDropdownRef}>
              <div className="admin-header-user-pill" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                <div className="admin-header-avatar">
                  <UserAvatar user={user} profile={profile} alt="Avatar" />
                </div>
                <span className="admin-header-user-name">{displayName}</span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`profile-arrow ${userDropdownOpen ? "open" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {userDropdownOpen && (
                <div className="admin-profile-dropdown glass" role="menu">
                  <div className="profile-dropdown-header" onClick={() => { setUserDropdownOpen(false); navigate("/profile"); }} role="button" tabIndex={0}>
                    <div className="profile-dropdown-avatar">
                      <UserAvatar user={user} profile={profile} alt="Profile" />
                    </div>
                    <div className="profile-dropdown-info">
                      <span className="profile-dropdown-name">{displayName}</span>
                      <span className="profile-dropdown-email">{profile?.email || user?.email || ""}</span>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item" role="menuitem" onClick={() => { setUserDropdownOpen(false); navigate("/profile"); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    My Profile
                  </button>
                  <button className="profile-dropdown-item" role="menuitem" onClick={() => { setUserDropdownOpen(false); navigate("/settings"); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Settings & Preferences
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item profile-dropdown-item--danger" role="menuitem" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Logout
                  </button>
                </div>
              )}
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
