import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAllStudents, getFollowStatus, sendFollowRequest, unfollowUser, cancelFollowRequest } from "../services/social";
import UserAvatar from "../components/UserAvatar";
import "./Students.css";

export default function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [followStatuses, setFollowStatuses] = useState({});

  useEffect(() => {
    async function load() {
      const { data } = await getAllStudents();
      const list = (data || []).filter((s) => s.id !== user?.uid);
      setStudents(list);

      const statuses = {};
      await Promise.all(
        list.map(async (s) => {
          const { data } = await getFollowStatus(user?.uid, s.id);
          if (data) statuses[s.id] = data.status;
        })
      );
      setFollowStatuses(statuses);
      setLoading(false);
    }
    load();
  }, [user?.uid]);

  const branches = useMemo(() => {
    const set = new Set(students.map((s) => s.branch).filter(Boolean));
    return [...set].sort();
  }, [students]);

  const years = useMemo(() => {
    const set = new Set(students.map((s) => s.graduationYear).filter(Boolean));
    return [...set].sort();
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = !search ||
        (s.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.email || "").toLowerCase().includes(search.toLowerCase());
      const matchBranch = !branchFilter || s.branch === branchFilter;
      const matchYear = !yearFilter || s.graduationYear === yearFilter;
      return matchSearch && matchBranch && matchYear;
    });
  }, [students, search, branchFilter, yearFilter]);

  async function handleFollow(studentId) {
    const status = followStatuses[studentId];
    if (status === "accepted" || status === "pending") {
      if (status === "accepted") {
        await unfollowUser(user.uid, studentId);
      } else {
        await cancelFollowRequest(user.uid, studentId);
      }
      setFollowStatuses((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    } else {
      const { data } = await sendFollowRequest(user.uid, studentId);
      if (data) {
        setFollowStatuses((prev) => ({ ...prev, [studentId]: data.status }));
      }
    }
  }

  function getFollowLabel(status) {
    if (status === "accepted") return "Following";
    if (status === "pending") return "Requested";
    return "Follow";
  }

  if (loading) {
    return (
      <div className="students-page animate-fade-in">
        <div className="skeleton-card" style={{ height: 60 }} />
        <div className="students-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card" style={{ height: 180 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="students-page animate-fade-in">
      <div className="students-header glass">
        <div className="students-title-group">
          <div className="students-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1 className="students-page-title">Students</h1>
            <p className="students-page-subtitle">{students.length} registered students</p>
          </div>
        </div>
      </div>

      <div className="students-filter-row glass">
        <div className="students-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="students-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="students-search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="students-filter-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="students-filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="students-empty glass">
          <div className="students-empty-icon">👤</div>
          <h3>No students found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="students-grid">
          {filtered.map((s) => (
            <div key={s.id} className="student-card glass">
              <div className="student-card-top">
                <div className="student-card-avatar" onClick={() => navigate(`/students/${s.id}`)}>
                  <UserAvatar user={{ uid: s.id }} profile={s} style={{ width: 56, height: 56 }} />
                </div>
                <div className="student-card-info">
                  <div className="student-card-name" onClick={() => navigate(`/students/${s.id}`)}>
                    {s.displayName || "Student"}
                  </div>
                  <div className="student-card-email">{s.email || ""}</div>
                </div>
              </div>
              <div className="student-card-meta">
                {s.branch && <span className="student-tag">{s.branch}</span>}
                {s.graduationYear && <span className="student-tag">Class of {s.graduationYear}</span>}
                {s.college && <span className="student-tag">{s.college}</span>}
              </div>
              {s.skills && s.skills.length > 0 && (
                <div className="student-card-skills">
                  {s.skills.slice(0, 3).map((sk, i) => (
                    <span key={i} className="student-skill-chip">{sk}</span>
                  ))}
                  {s.skills.length > 3 && <span className="student-skill-chip student-skill-more">+{s.skills.length - 3}</span>}
                </div>
              )}
              <div className="student-card-actions">
                <button
                  className={`btn student-follow-btn ${followStatuses[s.id] === "accepted" ? "btn-following" : followStatuses[s.id] === "pending" ? "btn-requested" : "btn-primary"}`}
                  onClick={() => handleFollow(s.id)}
                >
                  {getFollowLabel(followStatuses[s.id])}
                </button>
                <button
                  className="btn btn-ghost student-view-btn"
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
