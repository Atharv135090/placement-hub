import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { logOut } from "../services/auth";
import { updateUserProfile, uploadProfilePicture, uploadResume, getResumeDataUrl, deleteResume } from "../services/firestore";
import { auth, db } from "../config/firebase";
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, deleteDoc, getDocs, query, where, collection, updateDoc, arrayUnion } from "firebase/firestore";
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
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
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
  const [deletingResume, setDeletingResume] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState("");
  const [savedData, setSavedData] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // UI state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showHeroMenu, setShowHeroMenu] = useState(false);
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
      const profileData = {
        name: profile.displayName || user?.displayName || "",
        phone: profile.phoneNumber || profile.phone || "",
        dob: profile.dateOfBirth || profile.dob || "",
        branch: profile.branch || "",
        location: profile.location || "",
        college: profile.institution || profile.college || "",
        about: profile.about || "",
        graduationYear: profile.graduationYear || "",
        placementStatus: profile.placementStatus || "Not set",
        profileVisibility: profile.profileVisibility || "public",
      };
      setName(profileData.name);
      setPhone(profileData.phone);
      setDob(profileData.dob);
      setBranch(profileData.branch);
      setLocation(profileData.location);
      setCollege(profileData.college);
      setAbout(profileData.about);
      setGraduationYear(profileData.graduationYear);
      setPlacementStatus(profileData.placementStatus);
      setProfileVisibility(profileData.profileVisibility);
      setSavedData(profileData);
      if (Array.isArray(profile.skills)) {
        setSkills(profile.skills);
      }
      if (profile.resumeFileName) {
        setResumeFileName(profile.resumeFileName);
      }
      if (profile.resumeChunks && user?.uid) {
        let cancelled = false;
        getResumeDataUrl(user.uid).then((result) => {
          if (!cancelled && result.data) {
            setResumeViewUrl(result.data.dataUrl);
          }
        });
        return () => { cancelled = true; };
      }
    } else if (user) {
      setName(user.displayName || "");
    }
  }, [profile, user]);

  // Track whether form has unsaved changes
  const hasChanges = useMemo(() => {
    if (!savedData) return false;
    return (
      name !== savedData.name ||
      phone !== savedData.phone ||
      dob !== savedData.dob ||
      branch !== savedData.branch ||
      location !== savedData.location ||
      college !== savedData.college ||
      about !== savedData.about ||
      graduationYear !== savedData.graduationYear ||
      placementStatus !== savedData.placementStatus ||
      profileVisibility !== savedData.profileVisibility
    );
  }, [name, phone, dob, branch, location, college, about, graduationYear, placementStatus, profileVisibility, savedData]);

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

    // Name validation
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      setSavedToast("Name cannot be empty.");
      setTimeout(() => setSavedToast(""), 3000);
      return;
    }
    if (trimmedName.length > 100) {
      setSavedToast("Name is too long (max 100 characters).");
      setTimeout(() => setSavedToast(""), 3000);
      return;
    }

    // If nothing changed, just exit edit mode
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const updates = {
        displayName: trimmedName,
        phoneNumber: phone || "",
        phone: phone || "",
        dateOfBirth: dob || "",
        dob: dob || "",
        branch: branch || "",
        location: location || "",
        institution: college || "",
        college: college || "",
        about: about || "",
        graduationYear: graduationYear || "",
        placementStatus: placementStatus || "Not set",
        profileVisibility: profileVisibility || "public",
      };

      // Use the proven updateUserProfile service (same one used by AuthContext)
      const { error: saveErr } = await updateUserProfile(user.uid, updates);
      if (saveErr) throw new Error(saveErr);

      // Name change detection: record history if name actually changed
      const previousName = (profile?.displayName || user?.displayName || "").trim();
      if (trimmedName !== previousName && previousName) {
        const userDocRef = doc(db, "users", user.uid);
        const historyEntry = {
          previousName,
          newName: trimmedName,
          changedAt: new Date().toISOString(),
          actor: user.uid,
          userId: user.uid,
        };
        await updateDoc(userDocRef, {
          usernameHistory: arrayUnion(historyEntry),
        }).catch((histErr) => {
          console.warn("Username history update failed (non-critical):", histErr?.code || histErr?.message);
        });
      }

      // Set originalName if not already set (first-time protection)
      if (!profile?.originalName && previousName) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { originalName: previousName }).catch(() => {});
      }

      // Update local profile context so the rest of the app reflects changes
      setProfile((prev) => ({ ...prev, ...updates }));

      // Update savedData to reflect successful save
      setSavedData({
        name: trimmedName,
        phone,
        dob,
        branch,
        location,
        college,
        about,
        graduationYear,
        placementStatus,
        profileVisibility,
      });

      setIsEditing(false);
      setSavedToast("Profile updated successfully");
      setTimeout(() => setSavedToast(""), 3000);
    } catch (err) {
      console.error("Save profile error:", err?.code || err?.message || err);
      setSavedToast("Unable to save profile changes. Please try again.");
      setTimeout(() => setSavedToast(""), 4000);
      // Stay in edit mode on failure — do NOT set setIsEditing(false)
    } finally {
      setSaving(false);
    }
  }

  function handleEditProfile() {
    setIsEditing(true);
    setShowCancelConfirm(false);
  }

  function handleCancelEdit() {
    if (hasChanges) {
      setShowCancelConfirm(true);
      return;
    }
    performCancelEdit();
  }

  function performCancelEdit() {
    if (savedData) {
      setName(savedData.name);
      setPhone(savedData.phone || "");
      setDob(savedData.dob || "");
      setBranch(savedData.branch || "");
      setLocation(savedData.location || "");
      setCollege(savedData.college || "");
      setAbout(savedData.about || "");
      setGraduationYear(savedData.graduationYear || "");
      setPlacementStatus(savedData.placementStatus || "Not set");
      setProfileVisibility(savedData.profileVisibility || "public");
    }
    setIsEditing(false);
    setShowCancelConfirm(false);
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
    // Use Google photo if available, otherwise null (AuthContext will assign deterministic fallback)
    const defaultPhoto = user?.photoURL || null;
    // Clear photoSource so AuthContext's Google photo sync can manage it again on next login
    await updateUserProfile(user.uid, { photoUrl: defaultPhoto, photoSource: defaultPhoto ? "google" : "auto" });
    setProfile((prev) => ({ ...prev, photoUrl: defaultPhoto }));
  }


  // Resume error state
  const [resumeError, setResumeError] = useState("");

  function handleResumeFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeError("");

    if (file.type !== "application/pdf") {
      setResumeError("Only PDF files are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError("File size must be under 5 MB.");
      e.target.value = "";
      return;
    }

    setResumeFile(file);
    setResumeFileName(file.name);
  }

  async function handleResumeUpload() {
    if (!resumeFile || !user?.uid) return;
    setSaving(true);
    setResumeError("");
    const result = await uploadResume(user.uid, resumeFile);
    if (result.error) {
      setSaving(false);
      setResumeError("Upload failed. Please try again.");
      return;
    }

    const urlResult = await getResumeDataUrl(user.uid);
    setSaving(false);

    if (urlResult.data) {
      setResumeViewUrl(urlResult.data.dataUrl);
    }
    setResumeFileName(result.data.resumeFileName);
    setResumeUploadSuccess(true);
    setTimeout(() => {
      setShowResumeModal(false);
      setResumeFile(null);
      setResumeUploadSuccess(false);
      setResumeError("");
    }, 1500);
  }

  async function handleResumeDelete() {
    if (!user?.uid || deletingResume) return;
    if (!window.confirm("Are you sure you want to delete your resume? This cannot be undone.")) return;
    setDeletingResume(true);
    const result = await deleteResume(user.uid);
    setDeletingResume(false);
    if (result.error) {
      alert("Failed to delete resume. Please try again.");
      return;
    }
    setResumeFileName("");
    setResumeViewUrl(null);
    setShowResumeViewer(false);
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

      // Follows (both directions)
      const followSnap1 = await getDocs(query(collection(db, "follows"), where("fromUserId", "==", uid)));
      await Promise.all(followSnap1.docs.map((d) => deleteDoc(doc(db, "follows", d.id)).catch(() => {})));
      const followSnap2 = await getDocs(query(collection(db, "follows"), where("toUserId", "==", uid)));
      await Promise.all(followSnap2.docs.map((d) => deleteDoc(doc(db, "follows", d.id)).catch(() => {})));

      // Blocks (both directions)
      const blockSnap1 = await getDocs(query(collection(db, "blocks"), where("blockerId", "==", uid)));
      await Promise.all(blockSnap1.docs.map((d) => deleteDoc(doc(db, "blocks", d.id)).catch(() => {})));
      const blockSnap2 = await getDocs(query(collection(db, "blocks"), where("blockedId", "==", uid)));
      await Promise.all(blockSnap2.docs.map((d) => deleteDoc(doc(db, "blocks", d.id)).catch(() => {})));

      // Notifications (both directions)
      const notifSnap1 = await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", uid)));
      await Promise.all(notifSnap1.docs.map((d) => deleteDoc(doc(db, "notifications", d.id)).catch(() => {})));
      const notifSnap2 = await getDocs(query(collection(db, "notifications"), where("senderId", "==", uid)));
      await Promise.all(notifSnap2.docs.map((d) => deleteDoc(doc(db, "notifications", d.id)).catch(() => {})));

      // Applications
      const appSnap = await getDocs(query(collection(db, "applications"), where("userId", "==", uid)));
      await Promise.all(appSnap.docs.map((d) => deleteDoc(doc(db, "applications", d.id)).catch(() => {})));

      // Conversations + Messages
      const convSnap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", uid)));
      for (const conv of convSnap.docs) {
        const msgSnap = await getDocs(query(collection(db, "messages"), where("conversationId", "==", conv.id))).catch(() => ({ docs: [] }));
        await Promise.all(msgSnap.docs.map((m) => deleteDoc(doc(db, "messages", m.id)).catch(() => {})));
        await deleteDoc(doc(db, "conversations", conv.id)).catch(() => {});
      }

      // Admin conversations + messages
      const adminConvSnap = await getDocs(query(collection(db, "adminConversations"), where("participants", "array-contains", uid)));
      for (const conv of adminConvSnap.docs) {
        const adminMsgSnap = await getDocs(query(collection(db, "adminMessages"), where("conversationId", "==", conv.id))).catch(() => ({ docs: [] }));
        await Promise.all(adminMsgSnap.docs.map((m) => deleteDoc(doc(db, "adminMessages", m.id)).catch(() => {})));
        await deleteDoc(doc(db, "adminConversations", conv.id)).catch(() => {});
      }

      // Support tickets + messages
      const ticketSnap = await getDocs(query(collection(db, "supportTickets"), where("userId", "==", uid)));
      for (const ticket of ticketSnap.docs) {
        const ticketMsgSnap = await getDocs(collection(db, "supportTickets", ticket.id, "messages")).catch(() => ({ docs: [] }));
        await Promise.all(ticketMsgSnap.docs.map((m) => deleteDoc(doc(db, "supportTickets", ticket.id, "messages", m.id)).catch(() => {})));
        await deleteDoc(doc(db, "supportTickets", ticket.id)).catch(() => {});
      }

      // UserKeys
      await deleteDoc(doc(db, "userKeys", uid)).catch(() => {});

      // Resume chunks
      const chunkSnap = await getDocs(collection(db, "users", uid, "resumeChunks")).catch(() => ({ docs: [] }));
      await Promise.all(chunkSnap.docs.map((d) => deleteDoc(doc(db, "users", uid, "resumeChunks", d.id)).catch(() => {})));

      // User document (last)
      await deleteDoc(doc(db, "users", uid));

      // Firebase Auth account deletion
      try {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } catch {
        // Reauthentication optional
      }
      try {
        await deleteUser(user);
      } catch {
        // Spark plan fallback
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

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal-panel glass-heavy animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-head">
              <h2 className="modal-title">Discard unsaved changes?</h2>
              <button className="modal-close" onClick={() => setShowCancelConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                You have unsaved modifications. If you leave, your changes will be lost.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCancelConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={performCancelEdit}>
                Discard
              </button>
            </div>
          </div>
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
            onClick={() => handleTabChange("notifications")}
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
          REDESIGNED PROFILE WORKSPACE (DESKTOP + MOBILE)
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="ph-profile-wrapper animate-fade-in">
          {/* 1. PROFILE HERO CARD */}
          <div className="ph-profile-hero">
            <div className="ph-hero-left">
              <div className="ph-avatar-container">
                <UserAvatar
                  user={user}
                  profile={profile}
                  style={{ width: 104, height: 104 }}
                  alt="Profile Avatar"
                />
                <button
                  type="button"
                  className="ph-camera-badge-btn"
                  title="Change Profile Photo"
                  onClick={() => profileFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <span className="camera-spin">⏳</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="ph-hero-info">
                <div className="ph-name-role-row">
                  <h1 className="ph-hero-name">{name || user?.displayName || "Student"}</h1>
                  <span className="ph-role-badge">
                    <span className="role-sparkle">✦</span>
                    <span>{profile?.role === "owner" ? "Owner" : profile?.role === "admin" ? "Admin" : "Student"}</span>
                  </span>
                </div>
                <div className="ph-hero-email">{user?.email || ""}</div>
                <p className="ph-hero-bio">
                  {about || "Passionate about technology, problem solving and building useful products."}
                </p>

                <div className="ph-hero-skills-row">
                  {(skills.length > 0 ? skills.slice(0, 3) : ["Computer Science", "Web Development", "Problem Solving"]).map((sk) => (
                    <span key={sk} className="ph-hero-skill-chip">{sk}</span>
                  ))}
                  <button
                    type="button"
                    className="ph-hero-add-skill-btn"
                    onClick={() => setShowAddSkill(true)}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="ph-hero-right">
              {!isEditing ? (
                <button
                  type="button"
                  className="ph-edit-profile-btn"
                  onClick={handleEditProfile}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="ph-edit-actions-row">
                  <button
                    type="button"
                    className="ph-edit-profile-btn ph-save-btn"
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                  </button>
                  <button
                    type="button"
                    className="ph-edit-profile-btn ph-cancel-btn"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. STATS CARD */}
          <div className="ph-stats-card">
            <div className="ph-stat-col">
              <div className="ph-stat-icon-circle ph-icon-pink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="ph-stat-num">{stats?.total || 0}</div>
              <div className="ph-stat-label">Applications</div>
            </div>

            <div className="ph-stat-col">
              <div className="ph-stat-icon-circle ph-icon-blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div className="ph-stat-num">{stats?.shortlisted || 0}</div>
              <div className="ph-stat-label">Shortlisted</div>
            </div>

            <div className="ph-stat-col">
              <div className="ph-stat-icon-circle ph-icon-green">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="ph-stat-num">{stats?.interview || 0}</div>
              <div className="ph-stat-label">Interviews</div>
            </div>

            <div className="ph-stat-col">
              <div className="ph-stat-icon-circle ph-icon-gold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
                  <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
                </svg>
              </div>
              <div className="ph-stat-num">{stats?.offer || 0}</div>
              <div className="ph-stat-label">Offers</div>
            </div>
          </div>

          {/* 3. TWO COLUMN CONTENT GRID */}
          <div className="ph-content-grid">
            {/* LEFT COLUMN: Personal Information */}
            <div className="ph-grid-left">
              <div className="ph-card">
                <div className="ph-card-header">
                  <div className="ph-header-title">
                    <div className="ph-header-icon-pink">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h3>Personal Information</h3>
                  </div>
                  {!isEditing ? (
                    <button type="button" className="ph-card-action-btn" onClick={handleEditProfile}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  ) : null}
                </div>

                <div className="ph-personal-info-body">
                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span className="ph-info-label">Full Name</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full Name"
                        />
                      ) : (
                        <span>{name || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span className="ph-info-label">Email Address</span>
                    </div>
                    <div className="ph-info-val">
                      <span>{user?.email || "Not Specified"}</span>
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span className="ph-info-label">Phone Number</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                        />
                      ) : (
                        <span>{phone || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="ph-info-label">Date of Birth</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          placeholder="Aug 15, 2002"
                        />
                      ) : (
                        <span>{dob || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="ph-info-label">Location</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Pune, Maharashtra"
                        />
                      ) : (
                        <span>{location || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                      <span className="ph-info-label">Institution</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                          placeholder="Pune University"
                        />
                      ) : (
                        <span>{college || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                      <span className="ph-info-label">Branch / Degree</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          placeholder="B.Tech in Computer Science"
                        />
                      ) : (
                        <span>{branch || "Not Specified"}</span>
                      )}
                    </div>
                  </div>

                  <div className="ph-info-row">
                    <div className="ph-info-label-group">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="ph-info-label">Graduation Year</span>
                    </div>
                    <div className="ph-info-val">
                      {isEditing ? (
                        <input
                          type="text"
                          className="ph-info-input"
                          value={graduationYear}
                          onChange={(e) => setGraduationYear(e.target.value)}
                          placeholder="2026"
                        />
                      ) : (
                        <span>{graduationYear || "Not Specified"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="ph-grid-right">
              {/* ABOUT ME CARD */}
              <div className="ph-card">
                <div className="ph-card-header">
                  <div className="ph-header-title">
                    <div className="ph-header-icon-pink">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h3>About Me</h3>
                  </div>
                  {!isEditing ? (
                    <button type="button" className="ph-card-action-btn" onClick={handleEditProfile}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  ) : null}
                </div>

                <div className="ph-card-body">
                  {isEditing ? (
                    <textarea
                      className="ph-about-textarea"
                      rows="4"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      placeholder="Write your bio..."
                    />
                  ) : (
                    <p className="ph-about-text">
                      {about || "Passionate about technology, problem solving and building useful products. I love working on real-world projects and learning new skills."}
                    </p>
                  )}
                </div>
              </div>

              {/* SKILLS CARD */}
              <div className="ph-card">
                <div className="ph-card-header">
                  <div className="ph-header-title">
                    <div className="ph-header-icon-pink">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    </div>
                    <h3>Skills</h3>
                  </div>
                  <button
                    type="button"
                    className="ph-card-action-btn ph-btn-add-skill"
                    onClick={() => setShowAddSkill((prev) => !prev)}
                  >
                    + Add Skill
                  </button>
                </div>

                <div className="ph-card-body">
                  <div className="ph-skills-chips-wrapper">
                    {(skills.length > 0
                      ? skills
                      : ["C++", "Python", "JavaScript", "React", "Node.js", "Data Structures", "Algorithms", "HTML", "CSS"]
                    ).map((skill) => (
                      <span key={skill} className="ph-skill-chip">
                        <span>{skill}</span>
                        {skills.includes(skill) && (
                          <button
                            type="button"
                            className="ph-skill-remove-btn"
                            onClick={() => handleRemoveSkill(skill)}
                            title="Remove skill"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}

                    {showAddSkill ? (
                      <div className="ph-inline-add-skill-box">
                        <input
                          type="text"
                          className="ph-add-skill-input"
                          placeholder="Skill name..."
                          value={newSkillInput}
                          onChange={(e) => setNewSkillInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                          autoFocus
                        />
                        <button type="button" className="ph-btn-skill-save" onClick={handleAddSkill}>Add</button>
                        <button type="button" className="ph-btn-skill-cancel" onClick={() => setShowAddSkill(false)}>✕</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* RESUME CARD */}
              <div className="ph-card">
                <div className="ph-card-header">
                  <div className="ph-header-title">
                    <div className="ph-header-icon-pink">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <h3>Resume</h3>
                  </div>
                </div>

                <div className="ph-card-body">
                  {!resumeFileName ? (
                    <div className="ph-no-resume-box">
                      <div className="ph-no-resume-title">No resume uploaded yet</div>
                      <p className="ph-no-resume-desc">Upload your resume to get better opportunities</p>
                      <button
                        type="button"
                        className="ph-btn-upload-resume-pink"
                        onClick={() => setShowResumeModal(true)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>Upload Resume</span>
                      </button>
                    </div>
                  ) : (
                    <div className="ph-resume-active-box">
                      <div className="ph-resume-meta-row">
                        <span className="ph-pdf-icon-badge">PDF</span>
                        <div className="ph-resume-details">
                          <strong className="ph-resume-filename">{resumeFileName}</strong>
                          <span className="ph-resume-status-text">Uploaded &amp; verified</span>
                        </div>
                      </div>

                      <div className="ph-resume-actions">
                        {resumeViewUrl && (
                          <button type="button" className="ph-btn-resume-sub" onClick={handleViewResume}>
                            View
                          </button>
                        )}
                        <button
                          type="button"
                          className="ph-btn-upload-resume-pink"
                          onClick={() => setShowResumeModal(true)}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          className="ph-btn-resume-danger"
                          onClick={handleResumeDelete}
                          disabled={deletingResume}
                        >
                          {deletingResume ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
            setResumeError("");
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
                  setResumeError("");
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
                  {resumeError && (
                    <div className="resume-error-msg">{resumeError}</div>
                  )}
                  <div
                    className="resume-drop-zone"
                    onClick={() => resumeFileInputRef.current?.click()}
                  >
                    <input
                      ref={resumeFileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleResumeFileSelect}
                      className="resume-file-input"
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
                        setResumeError("");
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
