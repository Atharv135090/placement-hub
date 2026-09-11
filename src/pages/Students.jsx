import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import {
  subscribeToStudents,
  sendFollowRequest,
  unfollowUser,
  cancelFollowRequest,
  acceptFollowRequest,
  subscribeToAllFollowStatuses,
  blockUser,
} from "../services/social";
import { createNotification } from "../services/firestore";
import UserAvatar from "../components/UserAvatar";
import "./Students.css";

export default function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startConversation } = useChat();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const [followStatuses, setFollowStatuses] = useState({});
  const [followLoading, setFollowLoading] = useState({});
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const menuRef = useRef(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let unsubStudents = null;
    let unsubFollowStatuses = null;

    unsubStudents = subscribeToStudents((allUsers) => {
      const list = (allUsers || []).filter((s) => s.id !== user?.uid);
      setStudents(list);
      setLoading(false);
    });

    if (user?.uid) {
      unsubFollowStatuses = subscribeToAllFollowStatuses(user.uid, (statuses) => {
        setFollowStatuses(statuses || {});
      });
    }

    return () => {
      unsubStudents?.();
      unsubFollowStatuses?.();
    };
  }, [user?.uid]);

  // Unique branches & years for filters
  const branches = useMemo(() => {
    const set = new Set(students.map((s) => s.branch).filter(Boolean));
    return [...set].sort();
  }, [students]);

  const years = useMemo(() => {
    const set = new Set(students.map((s) => s.graduationYear).filter(Boolean));
    return [...set].sort();
  }, [students]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let list = students.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.displayName || "").toLowerCase().includes(q) ||
        (s.branch || "").toLowerCase().includes(q) ||
        (Array.isArray(s.skills) && s.skills.some((sk) => sk.toLowerCase().includes(q)));

      const matchBranch = !branchFilter || s.branch === branchFilter;
      const matchYear = !yearFilter || s.graduationYear === yearFilter;

      return matchSearch && matchBranch && matchYear;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === "name_asc") {
        return (a.displayName || "").localeCompare(b.displayName || "");
      }
      if (sortBy === "name_desc") {
        return (b.displayName || "").localeCompare(a.displayName || "");
      }
      if (sortBy === "oldest") {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tA - tB;
      }
      // default "newest"
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    return list;
  }, [students, search, branchFilter, yearFilter, sortBy]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, branchFilter, yearFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Follow handler
  async function handleFollow(studentId) {
    if (followLoading[studentId] || !user?.uid) return;
    setFollowLoading((prev) => ({ ...prev, [studentId]: true }));
    try {
      const status = followStatuses[studentId];
      if (status === "accepted") {
        if (!window.confirm("Are you sure you want to unfollow this student?")) {
          setFollowLoading((prev) => ({ ...prev, [studentId]: false }));
          return;
        }
        await unfollowUser(user.uid, studentId);
      } else if (status === "pending") {
        await cancelFollowRequest(user.uid, studentId);
      } else if (status === "incoming_pending") {
        await acceptFollowRequest(studentId, user.uid);
        createNotification({
          title: "Follow Request Accepted",
          message: `${user.displayName || "Someone"} accepted your follow request.`,
          type: "follow_accepted",
          link: `/students/${user.uid}`,
          targetUserId: studentId,
          senderId: user.uid,
          relatedUserId: studentId,
        }).catch(() => {});
      } else {
        const { data, error } = await sendFollowRequest(user.uid, studentId);
        if (error === "blocked") {
          setToastMsg("Cannot follow this student. They may have blocked you.");
          setTimeout(() => setToastMsg(""), 3000);
          return;
        }
        if (error === "already_exists") {
          setToastMsg("Follow request already exists.");
          setTimeout(() => setToastMsg(""), 3000);
          return;
        }
        if (error === "cannot_follow_self") {
          setToastMsg("You cannot follow yourself.");
          setTimeout(() => setToastMsg(""), 3000);
          return;
        }
        if (data) {
          setFollowStatuses((prev) => ({ ...prev, [studentId]: data.status }));
          if (data.status === "pending") {
            createNotification({
              title: "Follow Request",
              message: `${user.displayName || "Someone"} wants to follow you.`,
              type: "follow_request",
              link: `/students/${user.uid}`,
              targetUserId: studentId,
              senderId: user.uid,
              relatedUserId: user.uid,
              followRequestId: data.id,
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Follow error:", err);
      setToastMsg("Something went wrong. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
    } finally {
      setFollowLoading((prev) => ({ ...prev, [studentId]: false }));
    }
  }

  // Direct chat handler
  async function handleStartChat(studentId) {
    setActiveMenuId(null);
    try {
      navigate(`/chat?student=${studentId}`);
    } catch (err) {
      console.error("Chat error:", err);
    }
  }

  // Copy profile link
  function handleCopyLink(studentId) {
    setActiveMenuId(null);
    const link = `${window.location.origin}/students/${studentId}`;
    navigator.clipboard.writeText(link).then(() => {
      setToastMsg("Profile link copied to clipboard!");
      setTimeout(() => setToastMsg(""), 3000);
    });
  }

  // Block student
  async function handleBlockStudent(studentId) {
    setActiveMenuId(null);
    if (!window.confirm("Are you sure you want to block this student?")) return;
    try {
      await blockUser(user.uid, studentId);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setToastMsg("Student blocked.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err) {
      console.error("Block error:", err);
    }
  }

  // Format graduation year into clean student tag
  function formatStudentYear(year) {
    if (!year) return null;
    const str = String(year).trim();
    if (str.toLowerCase().includes("year")) return str;
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      const currentYear = new Date().getFullYear();
      const diff = num - currentYear;
      if (diff === 0) return "Final Year";
      if (diff === 1) return "3rd Year";
      if (diff === 2) return "2nd Year";
      if (diff === 3) return "1st Year";
      if (diff < 0) return `Alumni (${str})`;
      return `Class of ${str}`;
    }
    return str;
  }

  if (loading) {
    return (
      <div className="students-page animate-fade-in">
        <div className="skeleton-card" style={{ height: 110, borderRadius: 20 }} />
        <div className="skeleton-card" style={{ height: 58, borderRadius: 16 }} />
        <div className="students-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card" style={{ height: 260, borderRadius: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="students-page animate-fade-in">
      {/* Toast feedback */}
      {toastMsg && (
        <div className="students-toast glass-card animate-fade-in">
          <span>✓ {toastMsg}</span>
        </div>
      )}

      {/* 1. Header / Hero Section */}
      <div className="students-hero-card glass">
        <div className="students-hero-left">
          <div className="students-hero-icon-wrap">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <div className="students-hero-text">
            <h1 className="students-hero-title">Students</h1>
            <div className="students-hero-tagline">Connect • Collaborate • Grow Together</div>
            <p className="students-hero-desc">
              Find and connect with fellow students, explore profiles, and build your network.
            </p>
          </div>
        </div>

        <div className="students-hero-right">
          {/* Subtle floating avatar badges matching reference */}
          <div className="students-floating-group">
            <div className="students-float-circle bubble-1" title="Community">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="students-float-circle bubble-2" title="Peers">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
              </svg>
            </div>
            <div className="students-float-circle bubble-3" title="Connections">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>

          <div className="students-hero-divider"></div>

          {/* Vertical motto: BETTER PEOPLE BRIGHTER FUTURES */}
          <div className="students-hero-motto">
            <span>BETTER</span>
            <span>PEOPLE</span>
            <span>BRIGHTER</span>
            <span className="motto-accent">FUTURES</span>
          </div>
        </div>
      </div>

      {/* 2. Search + Filters Bar */}
      <div className="students-controls-card glass">
        <div className="students-search-field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="students-search-ico">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="students-search-box"
            placeholder="Search by name, skills, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="students-clear-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="students-filter-group">
          {/* Branch Filter */}
          <div className="students-select-wrap">
            <select
              className="students-select"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="students-select-wrap">
            <select
              className="students-select"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="students-select-wrap">
            <select
              className="students-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="students-view-toggle">
            <button
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Students Listing */}
      {filteredStudents.length === 0 ? (
        <div className="students-empty-state glass">
          <div className="students-empty-avatar">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
          <h3>No students found</h3>
          <p>Try clearing your search term or adjusting branch and year filters.</p>
          {(search || branchFilter || yearFilter) && (
            <button
              className="btn btn-secondary clear-filters-btn"
              onClick={() => { setSearch(""); setBranchFilter(""); setYearFilter(""); }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === "grid" ? "students-grid" : "students-list"}>
          {paginatedStudents.map((s) => {
            const status = followStatuses[s.id];
            const isFollowing = status === "accepted";
            const isRequested = status === "pending";
            const isIncomingPending = status === "incoming_pending";
            const isPrivate = s.profileVisibility === "private";
            const isProtected = isPrivate && !isFollowing;
            const menuOpen = activeMenuId === s.id;

            return (
              <div key={s.id} className="student-profile-card glass">
                {/* Card Top Row: Avatar with green dot + Privacy Lock + 3-Dot Menu */}
                <div className="student-card-top-bar">
                  <div className="student-avatar-container" onClick={() => navigate(`/students/${s.id}`)}>
                    <UserAvatar
                      user={{ uid: s.id }}
                      profile={s}
                      style={{ width: 56, height: 56 }}
                    />
                    {/* Online status indicator dot matching reference */}
                    <span className="student-online-dot" title="Active student" />
                  </div>

                  <div className="student-card-top-right">
                    {/* Privacy lock icon badge matching reference */}
                    {isPrivate && (
                      <span
                        className="student-lock-badge"
                        title={isFollowing ? "Private profile (You are connected)" : "Private profile"}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                    )}

                    {/* Three-dots menu button */}
                    <div className="student-menu-wrapper" ref={menuOpen ? menuRef : null}>
                      <button
                        className="student-dots-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(menuOpen ? null : s.id);
                        }}
                        title="More options"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="6" r="1.75" />
                          <circle cx="12" cy="12" r="1.75" />
                          <circle cx="12" cy="18" r="1.75" />
                        </svg>
                      </button>

                      {menuOpen && (
                        <div className="student-dropdown-menu glass-heavy animate-fade-in" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="dropdown-item"
                            onClick={() => { setActiveMenuId(null); navigate(`/students/${s.id}`); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="8" r="4" />
                              <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                            </svg>
                            <span>View Full Profile</span>
                          </button>

                          {(!isPrivate || isFollowing) && (
                            <button
                              className="dropdown-item"
                              onClick={() => handleStartChat(s.id)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              <span>Send Message</span>
                            </button>
                          )}

                          <button
                            className="dropdown-item"
                            onClick={() => handleCopyLink(s.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy Profile Link</span>
                          </button>

                          <button
                            className="dropdown-item"
                            onClick={() => { setActiveMenuId(null); navigate(`/students/${s.id}?report=1`); }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                              <line x1="4" y1="22" x2="4" y2="15" />
                            </svg>
                            <span>Report Student</span>
                          </button>

                          <button
                            className="dropdown-item danger"
                            onClick={() => handleBlockStudent(s.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                            <span>Block Student</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Identity */}
                <div className="student-identity-block">
                  <div
                    className="student-name-text"
                    onClick={() => navigate(`/students/${s.id}`)}
                    title={s.displayName || "Student"}
                  >
                    {s.displayName || "Student"}
                  </div>
                </div>

                {/* Details Row: Year, Branch, Location */}
                <div className="student-meta-tags-row">
                  <span className="student-meta-user-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                    </svg>
                  </span>
                  {s.graduationYear && (
                    <span className="student-meta-pill">{formatStudentYear(s.graduationYear)}</span>
                  )}
                  {s.branch && (
                    <span className="student-meta-pill">{s.branch}</span>
                  )}
                  {s.location && (
                    <span className="student-meta-pill">{s.location}</span>
                  )}
                  {!s.graduationYear && !s.branch && !s.location && (
                    <span className="student-meta-pill">Student</span>
                  )}
                </div>

                {/* Skills Row or Privacy Shield */}
                <div className="student-skills-section">
                  {isProtected ? (
                    <div className="student-protected-badge" title="Follow student to see full skill details">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Private profile details</span>
                    </div>
                  ) : s.skills && Array.isArray(s.skills) && s.skills.length > 0 ? (
                    <div className="student-skills-pills">
                      {s.skills.slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="student-skill-tag" title={skill}>
                          {skill}
                        </span>
                      ))}
                      {s.skills.length > 3 && (
                        <span className="student-skill-tag student-skill-more">
                          +{s.skills.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="student-skills-pills">
                      <span className="student-skill-tag student-skill-muted">No skills listed</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="student-card-actions">
                  <button
                    className={`btn student-action-btn ${
                      isFollowing
                        ? "btn-following-state"
                        : isRequested
                        ? "btn-requested-state"
                        : isIncomingPending
                        ? "btn-follow-state"
                        : "btn-follow-state"
                    }`}
                    onClick={() => handleFollow(s.id)}
                    disabled={followLoading[s.id]}
                  >
                    {isFollowing ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                        <span>Following</span>
                      </>
                    ) : isRequested ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Requested</span>
                      </>
                    ) : isIncomingPending ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Accept</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                        <span>Follow</span>
                      </>
                    )}
                  </button>

                  <button
                    className="btn student-view-profile-btn"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Pagination matching reference */}
      {filteredStudents.length > 0 && (
        <div className="students-pagination-bar">
          <div className="students-pagination-counter">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
          </div>

          <div className="students-pagination-controls">
            <button
              className="page-nav-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous Page"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                className={`page-num-btn ${currentPage === pageNum ? "active" : ""}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}

            <button
              className="page-nav-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              title="Next Page"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* 5. Brand Slogan Footer */}
      <div className="students-footer-slogan">
        <div className="slogan-rule-left">
          <span className="slogan-crimson-dash"></span>
          <span className="slogan-motto-text">LEARN CONNECT GROW</span>
        </div>
        <div className="slogan-rule-right">
          PLACEMENT HUB <span className="slogan-cross">×</span> STUDENTS
        </div>
      </div>
    </div>
  );
}
