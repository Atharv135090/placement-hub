import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { subscribeToFollowers, subscribeToFollowing, subscribeToPendingFollowRequests, blockUser, reportUser, subscribeToUserPresence, sendFollowRequest } from "../services/social";
import UserAvatar from "./UserAvatar";
import Modal from "./Modal";
import "./IntegratedStudentsChat.css";

// ─── SVG ICONS ──────────────────────────────────────────────
const UsersHeaderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const PlusEditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FunnelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const ListModeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const GridModeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ThreeDotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BellOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
    <path d="M18 8a6 6 0 0 0-9.33-5" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const BanIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const FlagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const EmojiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const SendAirplaneIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const DoubleCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

const ChatEmptyIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// Quick suggestions
const QUICK_REPLIES = [
  "Hi!",
  "Are you applying?",
  "Let's connect",
  "Can you share resources?",
  "Great!",
];

export default function IntegratedStudentsChat({
  activeStudentId,
  onSelectStudent,
  students = [],
  currentUser,
  followStatuses = {},
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    startConversation,
    messages,
    sendChatMessage,
    markRead,
    activeConversation,
    setActiveConversation,
    sending,
  } = useChat();

  // Active tab in Students list
  const [activeTab, setActiveTab] = useState("all"); // "all" | "followers" | "following" | "requests"
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("list");

  const [composerText, setComposerText] = useState("");
  const chatBottomRef = useRef(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const chatMenuRef = useRef(null);

  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [requestsList, setRequestsList] = useState([]);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [partnerPresence, setPartnerPresence] = useState({ online: false, lastSeenAt: null });

  const followersCount = followersList.length;
  const followingCount = followingList.length;
  const pendingRequestsCount = requestsList.length;

  // Close chat menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setChatMenuOpen(false);
      }
    }
    if (chatMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [chatMenuOpen]);

  // Close chat menu when active student changes
  useEffect(() => {
    setChatMenuOpen(false);
  }, [activeStudentId]);

  // Realtime subscriptions for followers, following, requests
  useEffect(() => {
    if (!user?.uid) return;
    let unsub1, unsub2, unsub3;
    unsub1 = subscribeToFollowers(user.uid, (list) => setFollowersList(list || []));
    unsub2 = subscribeToFollowing(user.uid, (list) => setFollowingList(list || []));
    unsub3 = subscribeToPendingFollowRequests(user.uid, (list) => setRequestsList(list || []));
    return () => { unsub1?.(); unsub2?.(); unsub3?.(); };
  }, [user?.uid]);

  // Start/reuse Firebase conversation when activeStudentId changes
  useEffect(() => {
    if (activeStudentId && user?.uid) {
      // Check mutual follow before starting conversation
      const status = followStatuses[activeStudentId];
      if (status !== "accepted") {
        // Don't create conversation — but keep activeConversation null so the
        // right panel shows the follow gate instead of chat messages
        return;
      }
      (async () => {
        const conv = await startConversation(activeStudentId);
        if (conv) setActiveConversation(conv);
      })();
    }
  }, [activeStudentId, user?.uid, startConversation, setActiveConversation, followStatuses]);

  // Mark read when viewing messages
  useEffect(() => {
    if (activeConversation?.id) {
      markRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages.length, markRead]);

  // Auto-scroll chat body on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Determine selected student from students list or active conversation
  const selectedStudent = useMemo(() => {
    if (!activeStudentId) return null;
    return students.find((s) => s.id === activeStudentId)
      || activeConversation?.otherUser
      || { id: activeStudentId };
  }, [students, activeStudentId, activeConversation?.otherUser]);

  // Subscribe to selected student's presence
  useEffect(() => {
    if (!selectedStudent?.id) return;
    const unsub = subscribeToUserPresence(selectedStudent.id, setPartnerPresence);
    return () => unsub();
  }, [selectedStudent?.id]);

  function formatLastSeen(lastSeenAt) {
    if (!lastSeenAt) return "";
    const d = lastSeenAt.toDate ? lastSeenAt.toDate() : new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Last seen just now";
    if (diffMin < 60) return `Last seen ${diffMin} min ago`;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const seenDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (today.getTime() === seenDay.getTime()) {
      return `Last seen today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (seenDay.getTime() === yesterday.getTime()) {
      return `Last seen yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    return `Last seen ${d.toLocaleDateString()}`;
  }

  // Format Firebase timestamp for display
  function formatMessageTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Handle follow to message
  async function handleFollowToMessage() {
    if (!user?.uid || !activeStudentId || followLoading) return;
    setFollowLoading(true);
    try {
      await sendFollowRequest(user.uid, activeStudentId);
    } catch (err) {
      console.error("Follow request failed:", err);
    } finally {
      setFollowLoading(false);
    }
  }

  // Check if mutually connected
  const isMutuallyConnected = followStatuses[activeStudentId] === "accepted";
  const followStatus = followStatuses[activeStudentId];

  // Handle sending a message via Firebase
  async function handleSendMessage(textToSend) {
    const text = (textToSend || composerText).trim();
    if (!text || !activeConversation?.id || sending) return;
    try {
      await sendChatMessage(activeConversation.id, text);
      setComposerText("");
    } catch (err) {
      console.error("Message send failed:", err);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // Filter students
  const filteredStudents = useMemo(() => {
    let list = [...students];

    // Exclude logged in user
    if (currentUser?.uid) {
      list = list.filter((s) => s.id !== currentUser.uid);
    }

    // Tab filter
    if (activeTab === "followers") {
      const followerIds = new Set(followersList.map((f) => f.id));
      list = list.filter((s) => followerIds.has(s.id));
    } else if (activeTab === "following") {
      const followingIds = new Set(followingList.map((f) => f.id));
      list = list.filter((s) => followingIds.has(s.id));
    } else if (activeTab === "requests") {
      const requestIds = new Set(requestsList.map((r) => r.id));
      list = list.filter((s) => requestIds.has(s.id));
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const name = (s.displayName || s.name || "").toLowerCase();
        const branch = (s.branch || "").toLowerCase();
        const skills = Array.isArray(s.skills) ? s.skills.join(" ").toLowerCase() : "";
        return name.includes(q) || branch.includes(q) || skills.includes(q);
      });
    }

    // Branch filter
    if (branchFilter !== "all") {
      list = list.filter((s) => s.branch === branchFilter);
    }

    // Year filter
    if (yearFilter !== "all") {
      list = list.filter((s) => s.graduationYear === yearFilter);
    }

    // Ensure selectedStudent is in the list if not current user
    if (
      selectedStudent &&
      !list.some((s) => s.id === selectedStudent.id) &&
      selectedStudent.id !== currentUser?.uid
    ) {
      list.unshift(selectedStudent);
    }

    return list;
  }, [students, currentUser?.uid, searchQuery, branchFilter, yearFilter, sortBy, selectedStudent, activeTab, followersList, followingList, requestsList]);

  // Unique branches & years
  const branches = useMemo(() => {
    const set = new Set(students.map((s) => s.branch).filter(Boolean));
    return [...set].sort();
  }, [students]);

  const years = useMemo(() => {
    const set = new Set(students.map((s) => s.graduationYear).filter(Boolean));
    return [...set].sort();
  }, [students]);

  // Status helper (online, in-class, offline)
  function getStudentStatus(student, index) {
    if (student.status) return student.status;
    if (index % 5 === 3) return "in-class";
    if (index % 6 === 4) return "offline";
    return "online";
  }

  async function handleSubmitReport() {
    if (!reportReason || !user?.uid || !selectedStudent?.id || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await reportUser(user.uid, selectedStudent.id, reportReason, reportDetails);
      setReportSent(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSent(false);
        setReportReason("");
        setReportDetails("");
      }, 2000);
    } catch (err) {
      console.error("Report error:", err);
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="isc-workspace-wrapper animate-fade-in">
      {/* ═══════════════════════════════════════════════════════════════
          LEFT PANEL: STUDENTS DIRECTORY
         ═══════════════════════════════════════════════════════════════ */}
      <section className="isc-left-panel">
        {/* Header */}
        <div className="isc-left-header">
          <div className="isc-left-title-block">
            <div className="isc-icon-badge">
              <UsersHeaderIcon />
            </div>
            <div>
              <h1 className="isc-main-title">Students</h1>
              <p className="isc-main-subtitle">Connect with students, collaborate and grow together.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="isc-tabs-bar">
          <button
            className={`isc-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Students
          </button>
          <button
            className={`isc-tab-btn ${activeTab === "followers" ? "active" : ""}`}
            onClick={() => setActiveTab("followers")}
          >
            My Followers <span className="isc-tab-badge">{followersCount}</span>
          </button>
          <button
            className={`isc-tab-btn ${activeTab === "following" ? "active" : ""}`}
            onClick={() => setActiveTab("following")}
          >
            Following <span className="isc-tab-badge">{followingCount}</span>
          </button>
          <button
            className={`isc-tab-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Requests <span className="isc-tab-badge">{pendingRequestsCount}</span>
          </button>
        </div>

        {/* Search & Secondary Filter Dropdowns */}
        <div className="isc-filter-controls">
          <div className="isc-search-input-wrap">
            <span className="isc-search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="isc-search-input"
              placeholder="Search students by name, branch, skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="button" className="isc-filter-funnel-btn" title="Advanced filters">
              <FunnelIcon />
            </button>
          </div>

          <div className="isc-dropdowns-row">
            <select
              className="isc-select-pill"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              className="isc-select-pill"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  Class of {y}
                </option>
              ))}
            </select>

            <select
              className="isc-select-pill"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="name">Name (A-Z)</option>
            </select>

            <div className="isc-view-toggles">
              <button
                type="button"
                className={`isc-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <ListModeIcon />
              </button>
              <button
                type="button"
                className={`isc-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <GridModeIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Students List */}
        <div className="isc-students-list">
          {filteredStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: "0.86rem" }}>
              No students found matching your criteria.
            </div>
          ) : (
            filteredStudents.map((s, idx) => {
              const isSelected = selectedStudent?.id === s.id;
              const status = getStudentStatus(s, idx);
              const initialLetter = (s.displayName || s.name || "S").charAt(0).toUpperCase();

              return (
                <div
                  key={s.id}
                  className={`isc-student-row ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectStudent(s.id)}
                >
                  <div className="isc-row-avatar-wrap">
                    {s.photoUrl ? (
                      <UserAvatar user={{ uid: s.id }} profile={s} style={{ width: 44, height: 44 }} />
                    ) : (
                      <div className="isc-avatar-circle" style={{ backgroundColor: isSelected ? "#ea580c" : "#f97316" }}>
                        {initialLetter}
                      </div>
                    )}
                    <span className="isc-avatar-dot" />
                  </div>

                  <div className="isc-row-info">
                    <div className="isc-row-name-line">
                      <h4 className="isc-row-name">{s.displayName || s.name || "Student"}</h4>
                      <span className={`isc-status-indicator ${status}`}>
                        <span className="isc-status-dot" />
                        {status === "in-class" ? "In Class" : status === "offline" ? "Offline" : "Online"}
                      </span>
                    </div>

                    <div className="isc-row-badges">
                      <span className="isc-badge-pill">
                        {s.role === "admin" || s.role === "owner" ? "Admin" : "Student"}
                      </span>
                      <span className="isc-badge-pill skills">
                        {Array.isArray(s.skills) && s.skills.length > 0 ? s.skills.slice(0, 2).join(", ") : "No skills listed"}
                      </span>
                    </div>
                  </div>

                  <div className="isc-row-actions">
                    <button
                      type="button"
                      className="isc-msg-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStudent(s.id);
                      }}
                    >
                      Message
                    </button>

                    <button
                      type="button"
                      className="isc-dots-menu-btn"
                      title="More options"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/students/${s.id}`);
                      }}
                    >
                      <ThreeDotsIcon />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT PANEL: SELECTED STUDENT'S CHAT
         ═══════════════════════════════════════════════════════════════ */}
      <section className="isc-right-panel">
        {!selectedStudent ? (
          /* PRD Section 8: No selected student empty state */
          <div className="isc-empty-state-panel">
            <div className="isc-empty-icon-wrap">
              <ChatEmptyIcon />
            </div>
            <h3 className="isc-empty-title">Select a student to start a conversation</h3>
            <p className="isc-empty-subtitle">
              Choose a student from the list on the left to start messaging, collaborate on drives, and share resources.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="isc-chat-header">
              <div className="isc-chat-user-meta">
                <button
                  type="button"
                  className="isc-mobile-back-btn"
                  onClick={() => onSelectStudent(null)}
                  title="Back to conversation list"
                  aria-label="Back to conversation list"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>

                {selectedStudent.photoUrl ? (
                  <UserAvatar
                    user={{ uid: selectedStudent.id }}
                    profile={selectedStudent}
                    style={{ width: 44, height: 44 }}
                  />
                ) : (
                  <div className="isc-chat-header-avatar">
                    {(selectedStudent.displayName || selectedStudent.name || "D").charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="isc-chat-user-details">
                  <div className="isc-chat-user-top">
                    <h3 className="isc-chat-user-name">
                      {selectedStudent.displayName || selectedStudent.name || "Student"}
                    </h3>
                    <span className={`isc-status-indicator ${partnerPresence.online ? "online" : "offline"}`}>
                      <span className="isc-status-dot" />
                      {partnerPresence.online ? "Online" : formatLastSeen(partnerPresence.lastSeenAt)}
                    </span>
                  </div>

                  <div className="isc-chat-user-tags">
                    <span className="isc-chat-tag admin-badge">
                      {selectedStudent.role === "admin" || selectedStudent.role === "owner" ? "Admin" : "Student"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Only Info and 3-dot menu */}
              <div className="isc-chat-header-actions">
                <button
                  type="button"
                  className="isc-action-icon-btn"
                  title="View Student Profile"
                  onClick={() => navigate(`/students/${selectedStudent.id}`)}
                >
                  <InfoIcon />
                </button>

                <div className="isc-menu-anchor" ref={chatMenuRef}>
                  <button
                    type="button"
                    className={`isc-action-icon-btn ${chatMenuOpen ? "active" : ""}`}
                    title="Conversation options"
                    onClick={() => setChatMenuOpen((prev) => !prev)}
                    aria-expanded={chatMenuOpen}
                  >
                    <ThreeDotsIcon />
                  </button>

                  {chatMenuOpen && (
                    <div className="isc-dropdown-menu animate-fade-in">
                      <button
                        type="button"
                        className="isc-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                          navigate(`/students/${selectedStudent.id}`);
                        }}
                      >
                        <UserIcon />
                        <span>Student Profile</span>
                      </button>

                      <button
                        type="button"
                        className="isc-dropdown-item"
                        onClick={() => {
                          setIsMuted((prev) => !prev);
                          setChatMenuOpen(false);
                        }}
                      >
                        <BellOffIcon />
                        <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                      </button>

                      <button
                        type="button"
                        className="isc-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                          onSelectStudent(null);
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Close Chat</span>
                      </button>

                      <button
                        type="button"
                        className="isc-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Disappearing Messages</span>
                      </button>

                      <button
                        type="button"
                        className="isc-dropdown-item"
                        onClick={() => {
                          setChatMenuOpen(false);
                        }}
                      >
                        <TrashIcon />
                        <span>Clear Chat</span>
                      </button>

                      <div className="isc-dropdown-divider" />

                      <button
                        type="button"
                        className="isc-dropdown-item isc-dropdown-item--danger"
                        onClick={async () => {
                          setChatMenuOpen(false);
                          if (!user?.uid || !selectedStudent?.id) return;
                          try {
                            await blockUser(user.uid, selectedStudent.id);
                          } catch (err) {
                            console.error("Block error:", err);
                          }
                        }}
                      >
                        <BanIcon />
                        <span>Block</span>
                      </button>

                      <button
                        type="button"
                        className="isc-dropdown-item isc-dropdown-item--danger"
                        onClick={() => {
                          setChatMenuOpen(false);
                          setShowReportModal(true);
                        }}
                      >
                        <FlagIcon />
                        <span>Report</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="isc-chat-body">
              <div className="isc-date-divider">
                <span className="isc-date-pill">Today</span>
              </div>

              {messages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#64748b" }}>
                    No messages yet with {selectedStudent.displayName || "this student"}.
                  </p>
                  <p style={{ margin: 0, fontSize: "0.82rem" }}>Type a message below to start collaborating!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isSent = m.senderId === user?.uid;
                  return (
                    <div key={m.id} className={`isc-bubble-row ${isSent ? "sent" : "received"}`}>
                      {!isSent && (
                        <div className="isc-bubble-avatar">
                          {(selectedStudent.displayName || selectedStudent.name || "S").charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className={`isc-bubble-box ${isSent ? "sent" : "received"}`}>
                        <p className="isc-bubble-text">{m.text}</p>
                        <div className="isc-bubble-footer">
                          <span className="isc-bubble-time">{formatMessageTime(m.createdAt)}</span>
                          {isSent && (
                            <span className="isc-check-mark" title="Delivered">
                              <DoubleCheckIcon />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Composer Container — gated by mutual follow */}
            {!isMutuallyConnected ? (
              <div className="isc-follow-gate">
                <div className="isc-follow-gate-content">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <p className="isc-follow-gate-text">
                    You need to follow each other before you can send messages.
                  </p>
                  {followStatus === "pending" ? (
                    <button className="btn isc-follow-gate-btn isc-follow-gate-btn--requested" disabled>
                      Requested
                    </button>
                  ) : followStatus === "incoming_pending" ? (
                    <button
                      className="btn isc-follow-gate-btn isc-follow-gate-btn--accept"
                      disabled={followLoading}
                      onClick={async () => {
                        setFollowLoading(true);
                        try {
                          const { acceptFollowRequest } = await import("../services/social");
                          await acceptFollowRequest(activeStudentId, user.uid);
                        } catch (err) {
                          console.error("Accept failed:", err);
                        } finally {
                          setFollowLoading(false);
                        }
                      }}
                    >
                      {followLoading ? "Accepting..." : "Accept Request"}
                    </button>
                  ) : (
                    <button
                      className="btn isc-follow-gate-btn"
                      disabled={followLoading}
                      onClick={handleFollowToMessage}
                    >
                      {followLoading ? "Sending..." : "Follow to Message"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
            <div className="isc-composer-container">
              <div className="isc-composer-capsule">
                <button
                  type="button"
                  className="isc-composer-tool-btn"
                  title="Attach file"
                  disabled
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                >
                  <PaperclipIcon />
                </button>

                <input
                  type="text"
                  className="isc-composer-input"
                  placeholder="Type a message..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />

                <button
                  type="button"
                  className="isc-composer-tool-btn"
                  title="Insert emoji"
                  onClick={() => setComposerText((prev) => prev + " 😊 ")}
                >
                  <EmojiIcon />
                </button>

                <button
                  type="button"
                  className="isc-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!composerText.trim() || sending}
                  title="Send message"
                >
                  <SendAirplaneIcon />
                </button>
              </div>

              {/* Quick Suggestion Pills */}
              <div className="isc-quick-pills-row">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    className="isc-quick-pill"
                    onClick={() => handleSendMessage(reply)}
                  >
                    {reply}
                  </button>
                ))}
                <button
                  type="button"
                  className="isc-quick-pill"
                  title="More suggestions"
                  onClick={() => handleSendMessage("Let's connect soon!")}
                >
                  ...
                </button>
              </div>
            </div>
            )}
          </>
        )}
      </section>

      <Modal open={showReportModal} onClose={() => { setShowReportModal(false); setReportSent(false); setReportReason(""); setReportDetails(""); }} title={`Report ${selectedStudent?.displayName || "Student"}`}>
        {reportSent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontWeight: 600, color: "#10b981" }}>Report submitted. Thank you.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Reason</label>
              <select
                className="input-field"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: "0.88rem" }}
              >
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="fake_profile">Fake Profile</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Details (optional)</label>
              <textarea
                className="input-field"
                rows="3"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Provide any additional details..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: "0.88rem", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowReportModal(false); setReportReason(""); setReportDetails(""); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitReport}
                disabled={!reportReason || reportSubmitting}
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
