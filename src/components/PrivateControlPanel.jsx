import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivateControl } from "../contexts/PrivateControlContext";
import "./PrivateControlPanel.css";

const PRIVATE_ACTIONS = [
  {
    id: "add_company",
    label: "Add Company",
    icon: "🏢",
    description: "Add a new company",
    path: "/companies/new",
  },
  {
    id: "add_attachment",
    label: "Add Attachment",
    icon: "📎",
    description: "Upload placement documents",
    path: null,
  },
  {
    id: "chatbot",
    label: "Placement Assistant",
    icon: "🤖",
    description: "Chat-based company management",
    path: "/assistant",
  },
];

export default function PrivateControlPanel() {
  const { isPrivateMode, showControlPanel, exitPrivateMode, toggleControlPanel } = usePrivateControl();
  const navigate = useNavigate();
  const [minimized, setMinimized] = useState(false);

  if (!isPrivateMode) return null;

  function handleAction(action) {
    if (action.path) {
      navigate(action.path);
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        className="pcp-fab glass-heavy"
        onClick={toggleControlPanel}
        title="Private Controls"
      >
        <span className="pcp-fab-icon">◆</span>
        <span className="pcp-fab-pulse" />
      </button>

      {/* Control Panel */}
      {showControlPanel && (
        <div className={`pcp-panel glass-heavy ${minimized ? "pcp-panel--minimized" : ""}`}>
          <div className="pcp-panel-header">
            <div className="pcp-panel-title-row">
              <span className="pcp-panel-icon">◆</span>
              <h3 className="pcp-panel-title">Private Controls</h3>
            </div>
            <div className="pcp-panel-actions">
              <button
                className="pcp-panel-btn"
                onClick={() => setMinimized(!minimized)}
                title={minimized ? "Expand" : "Minimize"}
              >
                {minimized ? "□" : "—"}
              </button>
              <button
                className="pcp-panel-btn pcp-panel-btn--exit"
                onClick={exitPrivateMode}
                title="Exit Private Mode"
              >
                ✕
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="pcp-panel-body">
              {PRIVATE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  className="pcp-action-card"
                  onClick={() => handleAction(action)}
                >
                  <span className="pcp-action-icon">{action.icon}</span>
                  <div className="pcp-action-info">
                    <span className="pcp-action-label">{action.label}</span>
                    <span className="pcp-action-desc">{action.description}</span>
                  </div>
                  <span className="pcp-action-arrow">→</span>
                </button>
              ))}

              <div className="pcp-panel-footer">
                <button className="btn btn-danger-outline pcp-exit-btn" onClick={exitPrivateMode}>
                  Exit Private Mode
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
