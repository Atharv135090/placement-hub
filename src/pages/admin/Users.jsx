import { useState, useEffect, useMemo } from "react";
import { getAllUsers, updateUserProfile, getAllApplications } from "../../services/firestore";
import Modal from "../../components/Modal";
import UserAvatar from "../../components/UserAvatar";
import "./Users.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [feedback, setFeedback] = useState("");

  const [roleModal, setRoleModal] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);

  const [activityModal, setActivityModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [userRes, appRes] = await Promise.all([
        getAllUsers(),
        getAllApplications(),
      ]);
      setUsers(userRes.data || []);
      setAllApps(appRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = [...users];
    if (roleFilter !== "all") result = result.filter((u) => (u.role || "student") === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, search, roleFilter]);

  function getUserApps(userId) {
    return allApps.filter(a => a.userId === userId);
  }

  function openRoleModal(user) {
    setRoleModal(user);
    setNewRole(user.role || "student");
  }

  async function handleRoleSave() {
    if (!roleModal || newRole === (roleModal.role || "student")) { setRoleModal(null); return; }
    setSaving(true);
    const { error: err } = await updateUserProfile(roleModal.id, { role: newRole });
    if (!err) {
      setUsers((prev) => prev.map((u) => u.id === roleModal.id ? { ...u, role: newRole } : u));
      setFeedback("Role updated successfully.");
    } else {
      setFeedback("Failed to update role.");
    }
    setSaving(false);
    setRoleModal(null);
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleDisableUser() {
    if (!deleteModal) return;
    const { error: err } = await updateUserProfile(deleteModal.id, { disabled: true });
    if (!err) {
      setUsers((prev) => prev.map(u => u.id === deleteModal.id ? { ...u, disabled: true } : u));
      setFeedback("User disabled.");
    }
    setDeleteModal(null);
    setTimeout(() => setFeedback(""), 3000);
  }

  function getStatusBadge(status) {
    switch (status) {
      case "shortlisted": return <span className="admin-chip admin-chip--amber">Shortlisted</span>;
      case "interview": return <span className="admin-chip admin-chip--violet">Interview</span>;
      case "offer":
      case "selected": return <span className="admin-chip admin-chip--green">Offer</span>;
      case "rejected": return <span className="admin-chip admin-chip--red">Rejected</span>;
      default: return <span className="admin-chip admin-chip--accent">Applied</span>;
    }
  }

  const roleChips = {
    owner: "au-role--owner",
    admin: "au-role--admin",
    student: "au-role--student",
  };

  return (
    <div className="au">
      <div className="au-header">
        <div className="au-header-left">
          <div className="au-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h1 className="au-title">User Management</h1>
            <p className="au-subtitle">Manage users and view their placement activity</p>
          </div>
        </div>
        <div className="au-stats-row">
          <div className="au-mini-stat">
            <span className="au-mini-val">{users.length}</span>
            <span className="au-mini-label">Total</span>
          </div>
          <div className="au-mini-stat au-mini-stat--accent">
            <span className="au-mini-val">{users.filter(u => u.role === "admin" || u.role === "owner").length}</span>
            <span className="au-mini-label">Admins</span>
          </div>
          <div className="au-mini-stat au-mini-stat--blue">
            <span className="au-mini-val">{users.filter(u => (u.role || "student") === "student").length}</span>
            <span className="au-mini-label">Students</span>
          </div>
        </div>
      </div>

      <div className="au-toolbar glass">
        <div className="au-search-wrap">
          <svg className="au-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="au-search"
          />
        </div>
        <div className="au-filter-group">
          <div className="au-filter-icon-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="au-select">
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="student">Student</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div className="au-feedback">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="au-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="au-skeleton-row">
              <div className="au-skeleton-avatar" />
              <div className="au-skeleton-lines">
                <div className="au-skeleton-line au-skeleton-line--long" />
                <div className="au-skeleton-line au-skeleton-line--short" />
              </div>
              <div className="au-skeleton-chip" />
              <div className="au-skeleton-numbers">
                <div className="au-skeleton-num" />
                <div className="au-skeleton-num" />
                <div className="au-skeleton-num" />
              </div>
              <div className="au-skeleton-actions">
                <div className="au-skeleton-btn" />
                <div className="au-skeleton-btn" />
                <div className="au-skeleton-btn" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="au-empty glass">
          <div className="au-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="8"/></svg>
          </div>
          <p>{search ? "No matches found" : "No users found"}</p>
          <span>{search ? "Try a different search term" : "Users will appear here once they register"}</span>
        </div>
      ) : (
        <div className="au-table-wrap glass">
          <div className="au-table-header">
            <span className="au-th au-th--user">User</span>
            <span className="au-th au-th--role">Role</span>
            <span className="au-th au-th--stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Apps
            </span>
            <span className="au-th au-th--stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Interviews
            </span>
            <span className="au-th au-th--stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Offers
            </span>
            <span className="au-th au-th--actions">Actions</span>
          </div>

          {filtered.map((u, idx) => {
            const userApps = getUserApps(u.id);
            const interviews = userApps.filter(a => a.status === "interview").length;
            const offers = userApps.filter(a => a.status === "offer" || a.status === "selected").length;

            return (
              <div key={u.id} className="au-row" style={{ animationDelay: `${idx * 0.04}s` }}>
                <span className="au-cell au-cell--user">
                  <div className="au-avatar">
                    <UserAvatar user={u} profile={u} className="au-avatar-img" />
                    {u.disabled && <div className="au-avatar-disabled-dot" />}
                  </div>
                  <div className="au-user-info">
                    <span className="au-user-name">{u.displayName || "Unnamed"}</span>
                    <span className="au-user-email">{u.email}</span>
                  </div>
                </span>

                <span className="au-cell au-cell--role">
                  <span className={`au-role-badge ${roleChips[u.role] || "au-role--student"}`}>
                    {(u.role || "student").charAt(0).toUpperCase() + (u.role || "student").slice(1)}
                  </span>
                </span>

                <span className="au-cell au-cell--stat">{userApps.length}</span>
                <span className="au-cell au-cell--stat">{interviews}</span>
                <span className="au-cell au-cell--stat">{offers}</span>

                <span className="au-cell au-cell--actions">
                  <button className="au-action-btn" onClick={() => setActivityModal(u)} title="View Activity">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button className="au-action-btn" onClick={() => openRoleModal(u)} title="Change role">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="au-action-btn au-action-btn--danger" onClick={() => setDeleteModal(u)} title="Disable user">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Modal */}
      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title="Change Role">
        <div className="au-modal-user">
          <div className="au-modal-avatar">
            <UserAvatar user={roleModal} profile={roleModal} className="au-modal-avatar-img" />
          </div>
          <div>
            <p className="au-modal-name">{roleModal?.displayName || "Unnamed"}</p>
            <p className="au-modal-email">{roleModal?.email}</p>
          </div>
        </div>
        <div className="au-modal-field">
          <label className="au-modal-label">Assign Role</label>
          <div className="au-modal-select-wrap">
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="au-modal-select">
              <option value="student">Student</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <svg className="au-modal-select-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div className="au-modal-actions">
          <button className="btn btn-secondary" onClick={() => setRoleModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleRoleSave} disabled={saving}>
            {saving ? (
              <span className="au-modal-saving">
                <span className="au-modal-spinner" /> Saving...
              </span>
            ) : "Update Role"}
          </button>
        </div>
      </Modal>

      {/* Activity Modal */}
      <Modal open={!!activityModal} onClose={() => setActivityModal(null)} title={`Activity — ${activityModal?.displayName || activityModal?.email}`}>
        {activityModal && (() => {
          const userApps = getUserApps(activityModal.id);
          return (
            <div className="au-activity">
              <div className="au-activity-summary">
                <div className="au-activity-stat">
                  <span className="au-activity-stat-val">{userApps.length}</span>
                  <span className="au-activity-stat-label">Applications</span>
                </div>
                <div className="au-activity-stat au-activity-stat--amber">
                  <span className="au-activity-stat-val">{userApps.filter(a => a.status === "shortlisted").length}</span>
                  <span className="au-activity-stat-label">Shortlisted</span>
                </div>
                <div className="au-activity-stat au-activity-stat--violet">
                  <span className="au-activity-stat-val">{userApps.filter(a => a.status === "interview").length}</span>
                  <span className="au-activity-stat-label">Interviews</span>
                </div>
                <div className="au-activity-stat au-activity-stat--green">
                  <span className="au-activity-stat-val">{userApps.filter(a => a.status === "offer" || a.status === "selected").length}</span>
                  <span className="au-activity-stat-label">Offers</span>
                </div>
              </div>
              {userApps.length === 0 ? (
                <div className="au-activity-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>No applications yet</span>
                </div>
              ) : (
                <div className="au-activity-list">
                  {userApps.map(app => (
                    <div key={app.id} className="au-activity-row">
                      <div className="au-activity-info">
                        <span className="au-activity-company">{app.companyName}</span>
                        <span className="au-activity-role">{app.role || "General"}</span>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Disable Modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Disable User">
        <div className="au-modal-danger">
          <div className="au-modal-danger-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <p className="au-modal-danger-text">
            Are you sure you want to disable <strong>{deleteModal?.displayName || deleteModal?.email}</strong>?
          </p>
          <p className="au-modal-danger-sub">They will no longer be able to sign in.</p>
        </div>
        <div className="au-modal-actions">
          <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDisableUser}>Disable User</button>
        </div>
      </Modal>
    </div>
  );
}
