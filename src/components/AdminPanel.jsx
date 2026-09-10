import { useNavigate } from "react-router-dom";
import { useAdmin } from "../hooks/useAdmin";
import "./AdminPanel.css";

const ADMIN_ACTIONS = [
  {
    section: "Company Management",
    items: [
      { label: "Add Company", icon: "+", path: "/companies/new" },
      { label: "Manage Companies", icon: "◈", path: "/admin/companies" },
    ],
  },
  {
    section: "Data Management",
    items: [
      { label: "Applications", icon: "△", path: "/admin/applications" },
      { label: "Announcements", icon: "◎", path: "/admin/announcements" },
      { label: "Users", icon: "⊙", path: "/admin/users" },
    ],
  },
];

export default function AdminPanel({ open, onClose }) {
  const navigate = useNavigate();
  const { isAdmin, isOwner } = useAdmin();

  if (!open || !isAdmin) return null;

  function handleNavigate(path) {
    onClose();
    navigate(path);
  }

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-head">
          <div className="admin-panel-title-group">
            <span className="admin-panel-icon">◆</span>
            <div>
              <h2 className="admin-panel-title">Admin Controls</h2>
              <span className="admin-panel-sub">{isOwner ? "Owner Access" : "Admin Access"}</span>
            </div>
          </div>
          <button className="admin-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-panel-body">
          {ADMIN_ACTIONS.map((section) => (
            <div key={section.section} className="admin-panel-section">
              <span className="admin-section-label">{section.section}</span>
              <div className="admin-section-items">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    className="admin-action-btn"
                    onClick={() => handleNavigate(item.path)}
                  >
                    <span className="admin-action-icon">{item.icon}</span>
                    <span className="admin-action-label">{item.label}</span>
                    <span className="admin-action-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="admin-panel-section">
            <span className="admin-section-label">Quick Access</span>
            <div className="admin-section-items">
              <button
                className="admin-action-btn admin-action-danger"
                onClick={() => handleNavigate("/admin")}
              >
                <span className="admin-action-icon">⬡</span>
                <span className="admin-action-label">Admin Dashboard</span>
                <span className="admin-action-arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="admin-panel-foot">
          <span className="admin-foot-note">Hold logo 2.5s to open</span>
        </div>
      </div>
    </div>
  );
}
