import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { logOut } from "../services/auth";
import { updateUserProfile, uploadProfilePicture, uploadResume } from "../services/firestore";
import { auth, db } from "../config/firebase";
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, deleteDoc, getDocs, query, where, collection } from "firebase/firestore";
import UserAvatar from "../components/UserAvatar";
import "../components/Modal.css";
import "./Settings.css";

const MOTIVATIONAL_QUOTES = [
  "SMALL PROGRESS EACH DAY LEADS TO BIG RESULTS.",
  "CONSISTENCY IS THE BRIDGE BETWEEN DREAMS AND REALITY.",
  "DISCIPLINE TURNS EFFORT INTO DIRECTION AND OPPORTUNITY.",
  "EVERY EXPERT WAS ONCE A BEGINNER WHO REFUSED TO QUIT.",
  "PREPARATION MEETS MOMENTUM WHEN YOU SHOW UP DAILY.",
  "FOCUS ON PROGRESS, NOT PERFECTION.",
  "BUILD SKILLS TODAY TO COMMAND OPPORTUNITIES TOMORROW.",
];

export default function Settings() {
  const { user, profile, setProfile } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { stats } = usePlacementData();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const getInitialTab = () => {
    const params = new URLSearchParams(routerLocation.search);
    const tabParam = params.get("tab");
    if (tabParam && ["profile", "preferences", "security", "social", "notifications"].includes(tabParam)) {
      return tabParam;
    }
    if (routerLocation.pathname === "/settings") return "preferences";
    return "profile";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const tabParam = params.get("tab");
    if (tabParam && ["profile", "preferences", "security", "social", "notifications"].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (routerLocation.pathname === "/settings") {
      setActiveTab("preferences");
    } else if (routerLocation.pathname === "/profile") {
      setActiveTab("profile");
    }
  }, [routerLocation.pathname, routerLocation.search]);

  // Profile fields
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [location, setLocation] = useState("");
  const [college, setCollege] = useState("");
  const [about, setAbout] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [placementStatus, setPlacementStatus] = useState("Not set");
  const [profileVisibility, setProfileVisibility] = useState("public");

  // Skills
  const [skills, setSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [showAddSkill, setShowAddSkill] = useState(false);

  // Resume
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState(false);
  const [resumeViewUrl, setResumeViewUrl] = useState(null);
  const [showResumeViewer, setShowResumeViewer] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showHeroMenu, setShowHeroMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Rotating Quote state
  const [quoteIndex, setQuoteIndex] = useState(() => {
    const stored = sessionStorage.getItem("ph_profile_quote_idx");
    if (stored !== null) {
      const idx = (parseInt(stored, 10) + 1) % MOTIVATIONAL_QUOTES.length;
      sessionStorage.setItem("ph_profile_quote_idx", idx.toString());
      return idx;
    }
    sessionStorage.setItem("ph_profile_quote_idx", "0");
    return 0;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => {
        const next = (prev + 1) % MOTIVATIONAL_QUOTES.length;
        sessionStorage.setItem("ph_profile_quote_idx", next.toString());
        return next;
      });
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const resumeFileInputRef = useRef(null);
  const profileFileInputRef = useRef(null);
  const heroMenuRef = useRef(null);

  // Close hero menu on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (heroMenuRef.current && !heroMenuRef.current.contains(e.target)) {
        setShowHeroMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Populate data from profile / user
  useEffect(() => {
    if (profile) {
      setName(profile.displayName || user?.displayName || "");
      setBranch(profile.branch || "");
      setLocation(profile.location || "");
      setCollege(profile.college || "");
      setAbout(profile.about || "");
      setGraduationYear(profile.graduationYear || "");
      setPlacementStatus(profile.placementStatus || "Not set");
      setProfileVisibility(profile.profileVisibility || "public");
      if (Array.isArray(profile.skills)) {
        setSkills(profile.skills);
      }
      if (profile.resumeUrl) {
        setResumeViewUrl(profile.resumeUrl);
      }
      if (profile.resumeFileName) {
        setResumeFileName(profile.resumeFileName);
      }
    } else if (user) {
      setName(user.displayName || "");
    }
  }, [profile, user]);

  // Profile completion calculation
  const profileCompletion = useMemo(() => {
    let score = 0;
    if (name?.trim()) score += 15;
    if (branch?.trim()) score += 15;
    if (graduationYear?.trim()) score += 15;
    if (location?.trim()) score += 15;
    if (about?.trim()) score += 15;
    if (skills && skills.length > 0) score += 15;
    if (resumeViewUrl) score += 10;
    return Math.min(100, score);
  }, [name, branch, graduationYear, location, about, skills, resumeViewUrl]);

  // Format account member since
  const memberSince = useMemo(() => {
    if (user?.metadata?.creationTime) {
      const d = new Date(user.metadata.creationTime);
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    if (profile?.createdAt?.toMillis) {
      const d = new Date(profile.createdAt.toMillis());
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    }
    return "10 Sep 2026";
  }, [user, profile]);

  // Handlers
  async function handleSaveProfile(e) {
    if (e) e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: name,
        branch,
        location,
        college,
        about,
        graduationYear,
        placementStatus,
        skills,
        profileVisibility,
      });
      setSavedToast("Profile changes saved successfully!");
      setIsEditing(false);
      setTimeout(() => setSavedToast(""), 3000);
    } catch (err) {
      console.error("Save profile error:", err);
      setSavedToast("Failed to save changes. Please try again.");
      setTimeout(() => setSavedToast(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  function handleAddSkill() {
    const s = newSkillInput.trim();
    if (s && !skills.includes(s)) {
      const updated = [...skills, s];
      setSkills(updated);
      setNewSkillInput("");
      setShowAddSkill(false);
      if (user?.uid) {
        updateUserProfile(user.uid, { skills: updated }).catch(console.error);
      }
    }
  }

  function handleRemoveSkill(s) {
    const updated = skills.filter((item) => item !== s);
    setSkills(updated);
    if (user?.uid) {
      updateUserProfile(user.uid, { skills: updated }).catch(console.error);
    }
  }

  async function handleProfilePictureSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setUploadingPhoto(true);
    try {
      const result = await uploadProfilePicture(user.uid, file);
      if (!result.error) {
        setProfile((prev) => ({ ...prev, photoUrl: result.data.photoUrl }));
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRestoreDefaultPhoto() {
    if (!user?.uid) return;
    const defaultPhoto = user?.photoURL || null;
    await updateUserProfile(user.uid, { photoUrl: defaultPhoto });
    setProfile((prev) => ({ ...prev, photoUrl: defaultPhoto }));
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
    if (result.error) return;

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
    } else if (tab === "social") {
      navigate("/students");
    } else {
      navigate(`/settings?tab=${tab}`, { replace: true });
    }
  }

  function copyAccountId() {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid).then(() => {
      setSavedToast("Account ID copied to clipboard!");
      setTimeout(() => setSavedToast(""), 3000);
    });
  }

  async function handleLogout() {
    await logOut();
    navigate("/login");
  }

  async function handleSelfDelete() {
    if (!user || deletingAccount || deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const uid = user.uid;

      const followSnap1 = await getDocs(query(collection(db, "follows"), where("fromUserId", "==", uid)));
      await Promise.all(followSnap1.docs.map((d) => deleteDoc(doc(db, "follows", d.id))));

      const followSnap2 = await getDocs(query(collection(db, "follows"), where("toUserId", "==", uid)));
      await Promise.all(followSnap2.docs.map((d) => deleteDoc(doc(db, "follows", d.id))));

      const blockSnap1 = await getDocs(query(collection(db, "blocks"), where("blockerId", "==", uid)));
      await Promise.all(blockSnap1.docs.map((d) => deleteDoc(doc(db, "blocks", d.id))));

      const blockSnap2 = await getDocs(query(collection(db, "blocks"), where("blockedId", "==", uid)));
      await Promise.all(blockSnap2.docs.map((d) => deleteDoc(doc(db, "blocks", d.id))));

      const notifSnap = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", uid)));
      await Promise.all(notifSnap.docs.map((d) => deleteDoc(doc(db, "notifications", d.id))));

      await deleteDoc(doc(db, "users", uid));

      try {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } catch {
        // Reauthentication might fail if popup is blocked; proceed anyway
      }

      try {
        await deleteUser(user);
      } catch {
        // Auth deletion may fail on Spark plan or if reauth failed
        // The Firestore data is already cleaned up
      }

      await logOut();
      navigate("/login");
    } catch (err) {
      console.error("Self-delete error:", err);
      setDeletingAccount(false);
    }
  }

  return (
    <div className="profile-page-root animate-fade-in">
      {/* Toast feedback */}
      {savedToast && (
        <div className="profile-floating-toast glass-card animate-fade-in">
          <span>✓ {savedToast}</span>
        </div>
      )}

      {/* Hidden file input for avatar upload */}
      <input
        ref={profileFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfilePictureSelect}
      />

      {/* ═══════════════════════════════════════════════════════════
          1. TOP HEADER (PROFILE & SETTINGS)
          ═══════════════════════════════════════════════════════════ */}
      <div className="profile-hero-banner glass">
        <div className="banner-left-content">
          <div className="banner-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>

          <div className="banner-text-group">
            <span className="banner-tagline-label">PROFILE &amp; SETTINGS</span>
            <h1 className="banner-main-title">
              Manage Your <span className="title-crimson-gradient">Journey</span>
            </h1>
            <p className="banner-subtitle-text">
              Update your profile, preferences, and account.
            </p>
            <div className="banner-micro-motto">
              SAME DISCIPLINE. BRIGHTER TOMORROWS.
            </div>
          </div>
        </div>

        <div className="banner-right-visual">
          {/* Tilted 3D floating glass card layers */}
          <div className="banner-glass-cards-layer">
            <div className="floating-glass-card card-rear"></div>
            <div className="floating-glass-card card-mid"></div>
            <div className="floating-glass-card card-front"></div>
          </div>

          <div className="banner-vertical-divider"></div>

          <div className="banner-vertical-motto">
            <span>LEARN</span>
            <span>BUILD</span>
            <span>CONNECT</span>
            <span className="motto-green-accent">ACHIEVE</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2. TOP PROFILE HERO (AVATAR, BIO, STATS)
          ═══════════════════════════════════════════════════════════ */}
      <div className="profile-hero-card glass">
        <div className="hero-top-left">
          {/* Avatar with crimson ring & camera button */}
          <div className="hero-avatar-wrapper">
            <div className="avatar-glowing-ring">
              <UserAvatar
                user={user}
                profile={profile}
                style={{ width: 104, height: 104 }}
                alt="Profile Avatar"
              />
            </div>
            <button
              className="avatar-camera-btn"
              title="Change Profile Photo"
              onClick={() => profileFileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <span className="camera-spin">⏳</span>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
          </div>

          {/* Identity block */}
          <div className="hero-identity-block">
            <div className="hero-name-row">
              <h2 className="hero-name-text">{name || "Student"}</h2>
              <span className="hero-verified-badge" title="Verified Account">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#e11d48">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </span>
              <span className="hero-online-status-pill">
                <span className="online-green-pulse"></span>
                <span>Online</span>
              </span>
            </div>

            <div className="hero-email-text">{user?.email || "No email"}</div>

            <div className="hero-meta-pills-row">
              {location && (
                <span className="hero-meta-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{location}</span>
                </span>
              )}

              {graduationYear && (
                <span className="hero-meta-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{graduationYear.includes("Year") ? graduationYear : `Class of ${graduationYear}`}</span>
                </span>
              )}

              {branch && (
                <span className="hero-meta-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <span>{branch}</span>
                </span>
              )}
            </div>

            <p className="hero-about-excerpt">
              {about || "Passionate about technology, problem solving and building useful products."}
            </p>
          </div>
        </div>

        {/* Hero right: Edit Profile button & 4 Stat Cards */}
        <div className="hero-top-right">
          <div className="hero-actions-bar">
            <button
              className="btn btn-primary hero-edit-profile-btn"
              onClick={() => setIsEditing((prev) => !prev)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>{isEditing ? "Done Editing" : "Edit Profile"}</span>
            </button>

            <div className="hero-menu-container" ref={heroMenuRef}>
              <button
                className="hero-three-dots-btn"
                onClick={() => setShowHeroMenu((prev) => !prev)}
                title="Options"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.75" />
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="12" cy="19" r="1.75" />
                </svg>
              </button>

              {showHeroMenu && (
                <div className="hero-dropdown-menu glass-heavy animate-fade-in">
                  <button
                    className="menu-option-btn"
                    onClick={() => {
                      setShowHeroMenu(false);
                      profileFileInputRef.current?.click();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>Change Photo</span>
                  </button>

                  <button
                    className="menu-option-btn"
                    onClick={() => {
                      setShowHeroMenu(false);
                      handleRestoreDefaultPhoto();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span>Restore Default Avatar</span>
                  </button>

                  <button
                    className="menu-option-btn"
                    onClick={() => {
                      setShowHeroMenu(false);
                      copyAccountId();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Account ID</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4 Compact Glass Application Stat Cards */}
          <div className="hero-stat-cards-grid">
            <div className="compact-glass-stat stat-applications">
              <div className="stat-icon-badge red-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="stat-count-value">{stats?.total || 0}</div>
              <div className="stat-label-text">Applications</div>
            </div>

            <div className="compact-glass-stat stat-shortlisted">
              <div className="stat-icon-badge blue-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div className="stat-count-value">{stats?.shortlisted || 0}</div>
              <div className="stat-label-text">Shortlisted</div>
            </div>

            <div className="compact-glass-stat stat-interviews">
              <div className="stat-icon-badge green-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="stat-count-value">{stats?.interview || 0}</div>
              <div className="stat-label-text">Interviews</div>
            </div>

            <div className="compact-glass-stat stat-offers">
              <div className="stat-icon-badge orange-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
                  <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
                </svg>
              </div>
              <div className="stat-count-value">{stats?.offer || 0}</div>
              <div className="stat-label-text">Offers</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. NAVIGATION TABS & PROFILE COMPLETION ROW
          ═══════════════════════════════════════════════════════════ */}
      <div className="profile-nav-completion-bar">
        {/* Futuristic segmented glass control */}
        <div className="profile-segmented-tabs glass">
          <button
            className={`seg-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => handleTabChange("profile")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>My Profile</span>
          </button>

          <button
            className={`seg-tab-btn ${activeTab === "preferences" ? "active" : ""}`}
            onClick={() => handleTabChange("preferences")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Preferences</span>
          </button>

          <button
            className={`seg-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => handleTabChange("security")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Security</span>
          </button>

          <button
            className="seg-tab-btn"
            onClick={() => handleTabChange("social")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Social</span>
          </button>

          <button
            className="seg-tab-btn"
            onClick={() => navigate("/profile")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifications</span>
          </button>
        </div>

        {/* Profile Completion Gauge */}
        <div className="profile-completion-widget glass">
          <div className="completion-top-row">
            <span className="completion-label">Profile Completion</span>
            <span className="completion-pct-value">{profileCompletion}%</span>
          </div>
          <div className="completion-progress-track">
            <div
              className="completion-progress-fill"
              style={{ width: `${profileCompletion}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: MY PROFILE (MAIN FUTURISTIC CONTENT)
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="profile-tab-body">
          {/* 4. PERSONAL DETAILS CARD */}
          <div className="futuristic-card glass personal-details-card">
            <div className="card-header-row">
              <div className="card-header-left">
                <div className="card-header-icon-badge user-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 className="card-section-title">Personal Details</h3>
                  <p className="card-section-subtitle">Keep your information up to date.</p>
                </div>
              </div>

              <div className="card-header-actions">
                <button
                  type="button"
                  className="btn btn-secondary card-edit-toggle-btn"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>{saving ? "Saving..." : "Save Details"}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="personal-details-grid">
              {/* Left Column: Input Fields */}
              <div className="form-fields-column">
                <div className="futuristic-input-field">
                  <label className="field-label">Full Name</label>
                  <div className="field-input-wrapper">
                    <span className="field-prefix-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="glass-text-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Email Address</label>
                  <div className="field-input-wrapper disabled-wrap">
                    <span className="field-prefix-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      className="glass-text-input disabled"
                      value={user?.email || ""}
                      disabled
                      title="Email is linked to authentication"
                    />
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Branch / Degree</label>
                  <div className="field-input-wrapper">
                    <span className="field-prefix-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="glass-text-input"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Computer Science Engineering"
                    />
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Graduation Year</label>
                  <div className="field-input-wrapper">
                    <span className="field-prefix-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="glass-text-input"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder="e.g. 2026"
                    />
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Location</label>
                  <div className="field-input-wrapper">
                    <span className="field-prefix-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      className="glass-text-input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Pune, Maharashtra"
                    />
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Placement Status</label>
                  <div className="field-input-wrapper">
                    <select
                      className="glass-text-input glass-select"
                      value={placementStatus}
                      onChange={(e) => setPlacementStatus(e.target.value)}
                    >
                      <option value="Not set">Not set</option>
                      <option value="Actively Looking">Actively Looking</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Placed">Placed</option>
                      <option value="Higher Studies">Higher Studies</option>
                    </select>
                  </div>
                </div>

                <div className="futuristic-input-field">
                  <label className="field-label">Profile Visibility</label>
                  <div className="field-input-wrapper">
                    <select
                      className="glass-text-input glass-select"
                      value={profileVisibility}
                      onChange={(e) => setProfileVisibility(e.target.value)}
                    >
                      <option value="public">Public - Anyone can view your profile</option>
                      <option value="private">Private - Require follow approval</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: About You textarea */}
              <div className="about-column">
                <div className="futuristic-input-field about-field-full">
                  <div className="about-header-label">
                    <label className="field-label">About You</label>
                    <span className="about-counter-pill">{about.length}/500</span>
                  </div>
                  <textarea
                    className="glass-textarea"
                    rows="9"
                    maxLength={500}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Passionate about technology, problem solving and building useful products."
                  ></textarea>
                </div>
              </div>
            </form>

            {/* Rotating Motivational Quote Highlight */}
            <div className="personal-details-quote-strip">
              <span className="quote-mark-icon">“</span>
              <span className="quote-content-text">
                {MOTIVATIONAL_QUOTES[quoteIndex]}
              </span>
              <span className="quote-mark-icon">”</span>
            </div>
          </div>

          {/* 5. SKILLS & EXPERTISE CARD */}
          <div className="futuristic-card glass skills-card-section">
            <div className="card-header-row">
              <div className="card-header-left">
                <div className="card-header-icon-badge grid-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="card-section-title">Skills &amp; Expertise</h3>
                  <p className="card-section-subtitle">Showcase your skills to connect with the right opportunities.</p>
                </div>
              </div>

              <div className="card-header-actions">
                <button
                  type="button"
                  className="btn btn-secondary card-add-skill-btn"
                  onClick={() => setShowAddSkill((prev) => !prev)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add Skill</span>
                </button>
              </div>
            </div>

            <div className="skills-content-layout">
              <div className="skills-pills-cloud">
                {skills.map((skill) => (
                  <span key={skill} className="futuristic-skill-pill">
                    <span>{skill}</span>
                    <button
                      type="button"
                      className="skill-remove-cross"
                      onClick={() => handleRemoveSkill(skill)}
                      title="Remove skill"
                    >
                      ✕
                    </button>
                  </span>
                ))}

                {showAddSkill ? (
                  <div className="add-skill-inline-pill">
                    <input
                      type="text"
                      className="skill-inline-input"
                      placeholder="e.g. Python"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                      autoFocus
                    />
                    <button type="button" className="btn-skill-save" onClick={handleAddSkill}>Add</button>
                    <button type="button" className="btn-skill-cancel" onClick={() => setShowAddSkill(false)}>✕</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="skill-pill-plus-trigger"
                    onClick={() => setShowAddSkill(true)}
                    title="Add skill"
                  >
                    +
                  </button>
                )}
              </div>

              {/* Right 3D Isometric Glass Cube Graphic */}
              <div className="skills-3d-visual-pane">
                <div className="isometric-glass-cube">
                  <div className="cube-face face-top"></div>
                  <div className="cube-face face-left"></div>
                  <div className="cube-face face-right"></div>
                  <div className="cube-glow-core"></div>
                </div>

                <div className="visual-slogan-col">
                  <span>SKILLS</span>
                  <span>CREATE</span>
                  <span>OPPORTUNITIES</span>
                  <div className="slogan-crimson-underline"></div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. RESUME / CV CARD */}
          <div className="futuristic-card glass resume-card-section">
            <div className="card-header-row">
              <div className="card-header-left">
                <div className="card-header-icon-badge doc-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h3 className="card-section-title">Resume / CV</h3>
                  <p className="card-section-subtitle">Upload your latest resume to help others know you better.</p>
                </div>
              </div>
            </div>

            <div className="resume-content-layout">
              <div className="resume-file-display-box glass-card">
                <div className="resume-box-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>

                <div className="resume-box-info">
                  <strong className="resume-file-name-text">
                    {resumeFileName || "No resume uploaded yet"}
                  </strong>
                  <span className="resume-file-hint-text">
                    {resumeFileName
                      ? "PDF • Updated recently"
                      : "Upload your resume in PDF format (Max 5 MB)"}
                  </span>
                </div>

                <div className="resume-box-actions">
                  {resumeViewUrl && (
                    <button
                      type="button"
                      className="btn btn-secondary resume-action-btn"
                      onClick={handleViewResume}
                    >
                      View
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary resume-action-btn"
                    onClick={() => setShowResumeModal(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>{resumeFileName ? "Update Resume" : "Upload Resume"}</span>
                  </button>
                </div>
              </div>

              {/* Right 3D Glowing Document Stack Graphic */}
              <div className="resume-3d-visual-pane">
                <div className="layered-doc-stack">
                  <div className="doc-page doc-page-3"></div>
                  <div className="doc-page doc-page-2"></div>
                  <div className="doc-page doc-page-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                </div>

                <div className="visual-slogan-col">
                  <span>YOUR STORY</span>
                  <span>OPENS</span>
                  <span>DOORS</span>
                  <div className="slogan-crimson-underline"></div>
                </div>
              </div>
            </div>
          </div>

          {/* 7. ACCOUNT INFORMATION CARD */}
          <div className="futuristic-card glass account-info-card-section">
            <div className="card-header-row">
              <div className="card-header-left">
                <div className="card-header-icon-badge shield-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="card-section-title">Account Information</h3>
                  <p className="card-section-subtitle">View your account details and role.</p>
                </div>
              </div>
            </div>

            <div className="account-info-layout">
              <div className="account-info-metrics-row">
                <div className="account-meta-col">
                  <span className="account-meta-label">Account Role</span>
                  <div className="account-meta-pill role-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#e11d48">
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                    </svg>
                    <span>{profile?.role === "admin" ? "Admin" : profile?.role === "owner" ? "Owner" : "Student"}</span>
                  </div>
                </div>

                <div className="account-meta-col">
                  <span className="account-meta-label">Member Since</span>
                  <div className="account-meta-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                    <span>{memberSince}</span>
                  </div>
                </div>

                <div className="account-meta-col">
                  <span className="account-meta-label">Account ID</span>
                  <div className="account-meta-pill uid-pill" onClick={copyAccountId} title="Click to copy full Account ID">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="7" y1="8" x2="17" y2="8" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                    </svg>
                    <span>{user?.uid ? `${user.uid.slice(0, 14)}...` : "N/A"}</span>
                    <button type="button" className="uid-copy-inline-btn" title="Copy Account ID">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 3D Glowing Security Shield Graphic */}
              <div className="account-3d-visual-pane">
                <div className="holographic-shield">
                  <div className="shield-outer-ring"></div>
                  <div className="shield-inner-plate">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                </div>

                <div className="visual-slogan-col">
                  <span>SECURE</span>
                  <span>LEARN</span>
                  <span>GROW</span>
                  <div className="slogan-crimson-underline"></div>
                </div>
              </div>
            </div>
          </div>

          {/* 8. MOTIVATIONAL PANORAMIC FOOTER BANNER */}
          <div className="motivational-panoramic-card glass">
            <img
              src="/profile_keep_growing_banner.jpg"
              alt="Keep Growing"
              className="panoramic-banner-bg-img"
            />
            <div className="panoramic-banner-overlay"></div>

            <div className="panoramic-content-left">
              <h2 className="panoramic-banner-title">
                Keep <span className="panoramic-crimson-gradient">Growing</span>
              </h2>
              <p className="panoramic-banner-desc">
                Update your profile, showcase your skills, and stay ready for the next big opportunity.
              </p>
              <div className="panoramic-brand-tag">
                PLACEMENT HUB
              </div>
            </div>

            <div className="panoramic-content-right">
              <div className="panoramic-slogan-col">
                <span>SAME PEOPLE</span>
                <span>BRIGHTER</span>
                <span>TOMORROWS</span>
                <div className="panoramic-slogan-bar"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: PREFERENCES (THEME & APPEARANCE)
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "preferences" && (
        <div className="preferences-tab-content animate-fade-in">
          <div className="futuristic-card glass pref-card">
            <h3 className="card-section-title">Theme &amp; Appearance</h3>
            <p className="card-section-subtitle">Choose between sleek dark mode or crisp light mode.</p>
            <div className="theme-toggle-row">
              <button
                className={`theme-choice-btn ${themeMode === "dark" ? "active" : ""}`}
                onClick={() => setThemeMode("dark")}
              >
                <span className="theme-icon">🌙</span>
                <strong>Dark Mode</strong>
                <span>Obsidian &amp; Red Neon</span>
              </button>
              <button
                className={`theme-choice-btn ${themeMode === "light" ? "active" : ""}`}
                onClick={() => setThemeMode("light")}
              >
                <span className="theme-icon">☀️</span>
                <strong>Light Mode</strong>
                <span>Frosted White &amp; Crimson</span>
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

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: SECURITY & ACCOUNT ACTIONS
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "security" && (
        <div className="security-tab-content animate-fade-in">
          <div className="futuristic-card glass sec-card">
            <h3 className="card-section-title">Account Security</h3>
            <p className="card-section-subtitle">Manage your session, authentication and account safety.</p>

            <div className="security-item-row">
              <div>
                <strong>Connected Email</strong>
                <p>{user?.email}</p>
              </div>
              <span className="sec-tag">Google Verified</span>
            </div>

            <div className="security-item-row">
              <div>
                <strong>Session State</strong>
                <p>Logged in on this device</p>
              </div>
              <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>

          <div className="futuristic-card glass sec-card" style={{ marginTop: 16 }}>
            <h3 className="card-section-title" style={{ color: "var(--rose)" }}>Danger Zone</h3>
            <p className="card-section-subtitle">Permanent actions that cannot be undone.</p>

            <div className="security-item-row">
              <div>
                <strong>Delete Account</strong>
                <p>Permanently delete your Placement HUB account and all associated data.</p>
              </div>
              <button className="btn btn-danger" onClick={() => { setShowDeleteAccount(true); setDeleteConfirmText(""); }}>
                Delete Account
              </button>
            </div>
          </div>

          {showDeleteAccount && (
            <div className="modal-overlay" onClick={() => { if (!deletingAccount) { setShowDeleteAccount(false); setDeleteConfirmText(""); } }}>
              <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-head">
                  <h2 className="modal-title" style={{ color: "var(--rose)" }}>Delete Account</h2>
                  <button className="modal-close" onClick={() => { if (!deletingAccount) { setShowDeleteAccount(false); setDeleteConfirmText(""); } }}>✕</button>
                </div>
                <div className="modal-body">
                  <p style={{ marginBottom: 12, color: "var(--text-primary)" }}>
                    Are you sure you want to delete your account <strong>{user?.email}</strong>?
                  </p>
                  <p style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    This will permanently delete your profile, follows, notifications, and all associated data. This action cannot be undone.
                  </p>
                  <p style={{ marginBottom: 8, fontWeight: 700, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                    Type <span style={{ color: "var(--rose)" }}>DELETE</span> to confirm.
                  </p>
                  <input
                    type="text"
                    className="input-field"
                    placeholder='Type "DELETE" to confirm'
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={deletingAccount}
                    autoFocus
                    style={{ width: "100%" }}
                  />
                </div>
                <div className="modal-actions">
                  <button className="modal-btn modal-btn--secondary" onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); }} disabled={deletingAccount}>Cancel</button>
                  <button className="modal-btn modal-btn--danger" onClick={handleSelfDelete} disabled={deletingAccount || deleteConfirmText !== "DELETE"}>
                    {deletingAccount ? "Deleting..." : "Delete My Account"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          COPYRIGHT & LEGAL SECTION
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "security" && (
        <div className="copyright-legal-section animate-fade-in">
          <div className="futuristic-card glass copyright-card">
            <div className="card-header-row">
              <div className="card-header-left">
                <div className="card-header-icon-badge copyright-icon-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M14.83 14.83a4 4 0 1 1 0-5.66"/>
                  </svg>
                </div>
                <div>
                  <h3 className="card-section-title">Copyright &amp; Legal</h3>
                  <p className="card-section-subtitle">Ownership, licensing, and legal information.</p>
                </div>
              </div>
            </div>

            <div className="copyright-content">
              <div className="copyright-notice">
                <span className="copyright-symbol">©</span>
                <span className="copyright-year">2026</span>
                <span className="copyright-brand">Placement Hub</span>
                <span className="copyright-tagline">— All rights reserved.</span>
              </div>

              <div className="copyright-details">
                <div className="copyright-detail-row">
                  <span className="copyright-detail-label">Product</span>
                  <span className="copyright-detail-value">Placement Hub — Campus Placement Management Platform</span>
                </div>
                <div className="copyright-detail-row">
                  <span className="copyright-detail-label">Owner</span>
                  <span className="copyright-detail-value">Atharv Shinde &amp; Placement Hub Contributors</span>
                </div>
                <div className="copyright-detail-row">
                  <span className="copyright-detail-label">License</span>
                  <span className="copyright-detail-value">Proprietary — All rights reserved. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.</span>
                </div>
              </div>

              <div className="copyright-disclaimer">
                <h4 className="copyright-disclaimer-title">Third-Party Materials</h4>
                <p className="copyright-disclaimer-text">
                  This application may include third-party libraries, fonts, icons, or assets that are owned by their respective creators. Placement Hub does not claim ownership of any third-party materials. All trademarks, registered trademarks, product names, and logos are the property of their respective owners.
                </p>
              </div>

              <div className="copyright-disclaimer">
                <h4 className="copyright-disclaimer-title">Disclaimer</h4>
                <p className="copyright-disclaimer-text">
                  This software is provided "as is" without warranty of any kind, express or implied. Placement Hub is not responsible for any damages arising from the use of this platform. Placement data, company information, and drive details are provided for informational purposes and may not reflect real-time accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="profile-footer-slogan">
        <div className="slogan-rule-left">
          <span className="slogan-crimson-dash"></span>
          <span className="slogan-motto-text">TRACK PREPARE APPLY</span>
        </div>
        <div className="slogan-rule-right">
          PLACEMENT HUB <span className="slogan-cross">×</span> PROFILE
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODALS: RESUME UPLOAD & RESUME VIEWER
          ═══════════════════════════════════════════════════════════ */}
      {showResumeModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowResumeModal(false);
            setResumeFile(null);
            setResumeUploadSuccess(false);
          }}
        >
          <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">Update Resume</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowResumeModal(false);
                  setResumeFile(null);
                  setResumeUploadSuccess(false);
                }}
              >
                ✕
              </button>
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
                      <strong>Current: {resumeFileName || "None"}</strong>
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
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowResumeModal(false);
                        setResumeFile(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleResumeUpload}
                      disabled={!resumeFile || saving}
                    >
                      {saving ? "Uploading..." : "Replace Resume"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showResumeViewer && resumeViewUrl && (
        <div className="modal-overlay" onClick={() => setShowResumeViewer(false)}>
          <div className="modal-panel modal-panel--wide glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">{resumeFileName || "Resume"}</h2>
              <button className="modal-close" onClick={() => setShowResumeViewer(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body resume-viewer-body">
              <iframe src={resumeViewUrl} title="Resume Preview" className="resume-iframe" />
              <div className="modal-actions">
                <a
                  href={resumeViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  download={resumeFileName}
                >
                  Download
                </a>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowResumeViewer(false);
                    setShowResumeModal(true);
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
