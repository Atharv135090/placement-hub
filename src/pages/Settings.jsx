import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { logOut } from "../services/auth";
import { updateUserProfile, uploadProfilePicture, uploadResume } from "../services/firestore";
import UserAvatar from "../components/UserAvatar";
import "../components/Modal.css";
import "./Settings.css";

export default function Settings() {
  const { user, profile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { stats } = usePlacementData();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const getInitialTab = () => {
    const params = new URLSearchParams(routerLocation.search);
    const tabParam = params.get("tab");
    if (tabParam && ["profile", "preferences", "security"].includes(tabParam)) {
      return tabParam;
    }
    if (routerLocation.pathname === "/settings") return "preferences";
    return "profile";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const tabParam = params.get("tab");
    if (tabParam && ["profile", "preferences", "security"].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (routerLocation.pathname === "/settings") {
      setActiveTab("preferences");
    } else if (routerLocation.pathname === "/profile") {
      setActiveTab("profile");
    }
  }, [routerLocation.pathname, routerLocation.search]);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState(false);
  const [resumeViewUrl, setResumeViewUrl] = useState(null);
  const [showResumeViewer, setShowResumeViewer] = useState(false);
  const resumeFileInputRef = useRef(null);
  const profileFileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || user?.displayName || "");
      setBranch(profile.branch || "");
      setLocation(profile.location || "");
      if (profile.skills && Array.isArray(profile.skills)) {
        setSkills(profile.skills);
      }
      if (profile.resumeUrl) {
        setResumeViewUrl(profile.resumeUrl);
      }
      if (profile.resumeFileName) {
        setResumeFileName(profile.resumeFileName);
      }
    } else {
      setName(user?.displayName || "");
      setBranch("");
    }
  }, [profile, user]);

  async function handleSaveProfile(e) {
    e?.preventDefault();
    setSaving(true);
    if (user?.uid) {
      await updateUserProfile(user.uid, {
        displayName: name,
        branch,
        location,
        skills,
      });
    }
    setSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  }

  function handleAddSkill() {
    const s = newSkillInput.trim();
    if (s && !skills.includes(s)) {
      const updated = [...skills, s];
      setSkills(updated);
      setNewSkillInput("");
      setShowAddSkill(false);
      if (user?.uid) {
        updateUserProfile(user.uid, { skills: updated });
      }
    }
  }

  function handleRemoveSkill(s) {
    const updated = skills.filter((item) => item !== s);
    setSkills(updated);
    if (user?.uid) {
      updateUserProfile(user.uid, { skills: updated });
    }
  }

  async function handleLogout() {
    await logOut();
    navigate("/login");
  }

  async function handleProfilePictureSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setUploadingPhoto(true);
    const result = await uploadProfilePicture(user.uid, file);
    setUploadingPhoto(false);
    if (!result.error) {
      window.location.reload();
    }
  }

  function handleResumeFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setResumeFileName(file.name);
    }
  }

  async function handleResumeUpload() {
    if (!resumeFile || !user?.uid) return;
    setSaving(true);
    const result = await uploadResume(user.uid, resumeFile);
    setSaving(false);
    if (result.error) {
      return;
    }
    setResumeViewUrl(result.data.resumeUrl);
    setResumeFileName(result.data.resumeFileName);
    setResumeUploadSuccess(true);
    setTimeout(() => {
      setShowResumeModal(false);
      setResumeFile(null);
      setResumeUploadSuccess(false);
    }, 1500);
  }

  function handleViewResume() {
    if (resumeViewUrl) {
      setShowResumeViewer(true);
    } else {
      setShowResumeModal(true);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === "profile") {
      navigate("/profile", { replace: true });
    } else {
      navigate(`/settings?tab=${tab}`, { replace: true });
    }
  }

  return (
    <div className="settings-page animate-fade-in">
      {/* 1. Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <div className="settings-icon-badge">⚙️</div>
          <div>
            <h1 className="page-title">Profile & Settings</h1>
            <p className="page-subtitle">Manage your profile, preferences, and account.</p>
          </div>
        </div>

        {/* Tab Toggle: My Profile, Preferences, Security */}
        <div className="settings-tabs glass">
          <button
            className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => handleTabChange("profile")}
          >
            My Profile
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
            onClick={() => handleTabChange("preferences")}
          >
            Preferences
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => handleTabChange("security")}
          >
            Security
          </button>
        </div>
      </div>

      {savedToast && (
        <div className="save-toast glass animate-fade-in">
          <span>✓ Profile settings saved successfully!</span>
        </div>
      )}

      {/* 2. My Profile Tab */}
      {activeTab === "profile" && (
        <div className="profile-tab-content">
          {/* Main User Card */}
          <div className="user-overview-card glass">
            <div className="user-overview-head">
              <div
                className="user-big-avatar"
                style={{ cursor: "pointer", position: "relative" }}
                onClick={() => profileFileInputRef.current?.click()}
              >
                <UserAvatar user={user} profile={profile} alt="Avatar" />
                <div className="avatar-overlay">
                  {uploadingPhoto ? "..." : "\uD83D\uDCF7"}
                </div>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureSelect}
                  style={{ display: "none" }}
                />
              </div>
              <div className="user-main-info">
                <h2 className="user-full-name">{name}</h2>
                <span className="user-branch-text">{branch}</span>
                <span className="user-location-text">📍 {location}</span>
                <span className="user-email-text">{user?.email || ""}</span>
              </div>
            </div>

            {/* Placement Quick Counts */}
            <div className="user-stats-strip glass">
              <div className="uss-item">
                <strong>{stats.total}</strong>
                <span>Applications</span>
              </div>
              <div className="uss-sep" />
              <div className="uss-item">
                <strong className="text-amber">{stats.shortlisted}</strong>
                <span>Shortlisted</span>
              </div>
              <div className="uss-sep" />
              <div className="uss-item">
                <strong className="text-red">{stats.interview}</strong>
                <span>Interviews</span>
              </div>
              <div className="uss-sep" />
              <div className="uss-item">
                <strong className="text-emerald">{stats.selected}</strong>
                <span>Offers</span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <form className="profile-form-card glass" onSubmit={handleSaveProfile}>
            <h3 className="section-heading">Personal Details</h3>
            <div className="form-grid-2">
              <div className="field-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>Branch / Degree</label>
                <input
                  type="text"
                  className="input-field"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>Location</label>
                <input
                  type="text"
                  className="input-field"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  value={user?.email || ""}
                  disabled
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Profile Changes"}
            </button>
          </form>

          {/* Skills Section */}
          <div className="skills-card glass">
            <h3 className="section-heading">Skills & Expertise</h3>
            <div className="skills-cloud">
              {skills.map((skill) => (
                <span key={skill} className="skill-tag glass">
                  <span>{skill}</span>
                  <button
                    type="button"
                    className="skill-remove-btn"
                    onClick={() => handleRemoveSkill(skill)}
                  >
                    ×
                  </button>
                </span>
              ))}

              {!showAddSkill ? (
                <button
                  type="button"
                  className="btn btn-secondary add-skill-btn"
                  onClick={() => setShowAddSkill(true)}
                >
                  + Add Skill
                </button>
              ) : (
                <div className="add-skill-inline">
                  <input
                    type="text"
                    className="input-field skill-inline-input"
                    placeholder="e.g. Python"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddSkill}>
                    Add
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddSkill(false)}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Resume Section */}
          <div className="resume-card glass">
            <h3 className="section-heading">Resume / CV</h3>
            <div className="resume-file-box glass-card">
              <div className="resume-left">
                <span className="pdf-icon">📄</span>
                <div>
                  <strong>{resumeFileName || "No resume uploaded yet"}</strong>
                  <span className="file-size">{resumeFileName ? "PDF • Updated recently" : "Upload your resume in PDF format"}</span>
                </div>
              </div>

              <div className="resume-actions">
                {resumeViewUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleViewResume}
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowResumeModal(true)}
                >
                  {resumeFileName ? "Update" : "Upload Resume"}
                </button>
              </div>
            </div>
          </div>

          {/* Resume Upload Modal */}
          {showResumeModal && (
            <div className="modal-overlay" onClick={() => { setShowResumeModal(false); setResumeFile(null); setResumeUploadSuccess(false); }}>
              <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2 className="modal-title">Update Resume</h2>
                  <button className="modal-close" onClick={() => { setShowResumeModal(false); setResumeFile(null); setResumeUploadSuccess(false); }}>✕</button>
                </div>
                <div className="modal-body">
                  {resumeUploadSuccess ? (
                    <div className="resume-upload-success">
                      <div className="resume-success-icon">✓</div>
                      <h3>Resume Updated!</h3>
                      <p>Your resume has been replaced successfully.</p>
                    </div>
                  ) : (
                    <>
                      <div className="resume-current-file">
                        <span className="pdf-icon">📄</span>
                        <div>
                          <strong>Current: {resumeFileName}</strong>
                          <span className="file-size">PDF</span>
                        </div>
                      </div>

                      <div
                        className="resume-drop-zone"
                        onClick={() => resumeFileInputRef.current?.click()}
                      >
                        <input
                          ref={resumeFileInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handleResumeFileSelect}
                          style={{ display: "none" }}
                        />
                        {resumeFile ? (
                          <div className="resume-selected-file">
                            <span className="pdf-icon">📄</span>
                            <div>
                              <strong>{resumeFile.name}</strong>
                              <span className="file-size">PDF • {formatFileSize(resumeFile.size)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="resume-drop-prompt">
                            <span className="drop-icon">+</span>
                            <p>Click to select a PDF file</p>
                            <span className="drop-hint">PDF only, max 5MB</span>
                          </div>
                        )}
                      </div>

                      <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => { setShowResumeModal(false); setResumeFile(null); }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleResumeUpload} disabled={!resumeFile}>
                          Replace Resume
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Resume Viewer Modal */}
          {showResumeViewer && resumeViewUrl && (
            <div className="modal-overlay" onClick={() => setShowResumeViewer(false)}>
              <div className="modal-panel modal-panel--wide glass-heavy" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <h2 className="modal-title">{resumeFileName}</h2>
                  <button className="modal-close" onClick={() => setShowResumeViewer(false)}>✕</button>
                </div>
                <div className="modal-body resume-viewer-body">
                  <iframe
                    src={resumeViewUrl}
                    title="Resume Preview"
                    className="resume-iframe"
                  />
                  <div className="modal-actions">
                    <a href={resumeViewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" download={resumeFileName}>
                      Download
                    </a>
                    <button className="btn btn-primary" onClick={() => { setShowResumeViewer(false); setShowResumeModal(true); }}>
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="preferences-tab-content">
          <div className="pref-card glass">
            <h3 className="section-heading">Theme & Appearance</h3>
            <p className="pref-desc">Choose between sleek dark mode or crisp light mode.</p>
            <div className="theme-toggle-row">
              <button
                className={`theme-choice-btn ${themeMode === "dark" ? "active" : ""}`}
                onClick={() => setThemeMode("dark")}
              >
                <span className="theme-icon">🌙</span>
                <strong>Dark Mode</strong>
                <span>Obsidian & Red Neon</span>
              </button>

              <button
                className={`theme-choice-btn ${themeMode === "light" ? "active" : ""}`}
                onClick={() => setThemeMode("light")}
              >
                <span className="theme-icon">☀️</span>
                <strong>Light Mode</strong>
                <span>Frosted White & Crimson</span>
              </button>

              <button
                className={`theme-choice-btn ${themeMode === "system" ? "active" : ""}`}
                onClick={() => setThemeMode("system")}
              >
                <span className="theme-icon">💻</span>
                <strong>System</strong>
                <span>Auto detect OS mode</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Security Tab */}
      {activeTab === "security" && (
        <div className="security-tab-content">
          <div className="security-card glass">
            <h3 className="section-heading">Account Session</h3>
            <p className="pref-desc">Signed in as {user?.email || "student"}.</p>
            <div className="sec-actions-row">
              <button className="btn btn-secondary" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
