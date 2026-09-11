import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from "../services/firestore";
import { logOut } from "../services/auth";
import { useLongPress } from "../contexts/PrivateControlContext";
import PlacementLogo from "./PlacementLogo";
import UserAvatar from "./UserAvatar";
import "./TopHeader.css";

export default function TopHeader() {
  const { user, profile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const logoLongPress = useLongPress(() => {
    window.dispatchEvent(new CustomEvent("open-admin-prompt"));
  }, { delay: 1000 });
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const panelRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setNotifications);
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleTheme() {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
  }

  async function handleMarkRead(notifId) {
    await markNotificationRead(notifId, user.uid);
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(user.uid);
    setNotifications([]);
  }

  async function handleLogout() {
    setProfileOpen(false);
    await logOut();
    navigate("/login");
  }

  const displayName = profile?.displayName || user?.displayName || "Student";

  return (
    <header className="top-header glass">
      <div
        className="top-header-left"
        {...logoLongPress}
        onClick={() => navigate("/")}
        title="Hold logo to open Admin Controls"
      >
        <PlacementLogo size={32} />
        <div className="h-brand-info">
          <span className="h-brand-name">Placement Hub</span>
          <span className="h-brand-sub">Track · Prepare · Apply</span>
        </div>
      </div>

      <div className="top-header-center">
        <form className="top-header-search" onSubmit={(e) => {
          e.preventDefault();
          const q = e.target.elements.searchInput?.value?.trim();
          if (q) navigate(`/companies?search=${encodeURIComponent(q)}`);
        }}>
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            name="searchInput"
            type="text"
            placeholder="Search companies, locations..."
          />
          <kbd className="top-header-kbd">Ctrl K</kbd>
        </form>
      </div>

      <div className="top-header-right">
        <button className="header-icon-btn" onClick={toggleTheme} title={`Switch to ${themeMode === "dark" ? "Light" : "Dark"} Mode`} aria-label="Toggle Theme">
          {themeMode === "dark" ? (
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
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <div className="notif-wrapper" ref={panelRef}>
          <button className="header-icon-btn notif-btn" onClick={() => setPanelOpen(!panelOpen)} title="Notifications" aria-label="Notifications">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && <span className="notif-count-badge">{notifications.length}</span>}
          </button>

          {panelOpen && (
            <div className="notif-panel glass">
              <div className="notif-panel-header">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <button className="notif-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
                )}
              </div>
              <div className="notif-panel-body">
                {notifications.length === 0 ? (
                  <p className="notif-empty">No new notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="notif-item" onClick={() => {
                      handleMarkRead(n.id);
                      let target;
                      if (n.type === "admin_message" || n.type === "admin_warning") {
                        target = n.link || "/chat";
                      } else {
                        target = n.senderId ? `/students/${n.senderId}` : n.link;
                      }
                      if (target) navigate(target);
                      setPanelOpen(false);
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

        <div className="profile-wrapper" ref={profileRef}>
          <div className="header-user-pill">
            <button
              className="header-user-card"
              onClick={() => {
                setProfileOpen(false);
                navigate("/profile");
              }}
              title="View Profile"
              aria-label="View Profile"
            >
              <div className="header-avatar-wrap">
                <UserAvatar user={user} profile={profile} alt="Profile" />
              </div>
              <span className="header-user-name">{displayName}</span>
            </button>
            <button
              className="header-user-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setProfileOpen((v) => !v);
              }}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
              title="Profile menu options"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`profile-arrow ${profileOpen ? "open" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {profileOpen && (
            <div className="profile-dropdown glass" role="menu">
              <div
                className="profile-dropdown-header"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/profile");
                }}
                title="View Profile"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setProfileOpen(false);
                    navigate("/profile");
                  }
                }}
              >
                <div className="profile-dropdown-avatar">
                  <UserAvatar user={user} profile={profile} alt="Profile" />
                </div>
                <div className="profile-dropdown-info">
                  <span className="profile-dropdown-name">{displayName}</span>
                  <span className="profile-dropdown-email">{profile?.email || user?.email || ""}</span>
                </div>
              </div>

              <div className="profile-dropdown-divider" />

              <button
                className="profile-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/profile");
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </button>

              <button
                className="profile-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/settings");
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings & Preferences
              </button>

              <div className="profile-dropdown-divider" />

              <button className="profile-dropdown-item profile-dropdown-item--danger" role="menuitem" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
