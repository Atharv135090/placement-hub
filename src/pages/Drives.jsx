import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { getJobs } from "../services/firestore";
import CompanyLogo from "../components/CompanyLogo";
import "./Drives.css";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "Open";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Drives() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companies, applications, applyToDrive, toggleSaveItem, isSaved, loading } = usePlacementData();
  const [firestoreJobs, setFirestoreJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await getJobs();
      if (!cancelled) {
        setFirestoreJobs(data || []);
        setJobsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const allDrives = useMemo(() => firestoreJobs || [], [firestoreJobs]);

  const appliedMap = useMemo(() => {
    const map = {};
    applications.forEach((a) => {
      if (a.jobId) map[a.jobId] = a;
    });
    return map;
  }, [applications]);

  const filteredDrives = useMemo(() => {
    return allDrives.filter((job) => {
      const compName = job.company?.name || job.companyName || "";
      const roleName = job.title || job.role || "";
      const mode = job.workMode || "";
      const deadline = job.registrationClose || job.registrationClosesAt || job.deadline;
      const days = daysUntil(deadline);

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const match =
          compName.toLowerCase().includes(q) ||
          roleName.toLowerCase().includes(q) ||
          (job.ctc || "").toLowerCase().includes(q) ||
          (job.location || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // Dropdown filters
      if (companyFilter !== "all" && compName.toLowerCase() !== companyFilter.toLowerCase()) return false;
      if (roleFilter !== "all" && !roleName.toLowerCase().includes(roleFilter.toLowerCase())) return false;
      if (modeFilter !== "all" && mode.toLowerCase() !== modeFilter.toLowerCase()) return false;

      // Tab filters
      if (activeTab === "upcoming" && (days === null || days < 0)) return false;
      if (activeTab === "ongoing" && (days === null || days < 0 || days > 7)) return false;
      if (activeTab === "past" && (days === null || days >= 0)) return false;

      return true;
    });
  }, [allDrives, search, companyFilter, roleFilter, modeFilter, activeTab]);

  async function handleApply(job, e) {
    e.preventDefault();
    e.stopPropagation();
    if (appliedMap[job.id]) return;
    const compName = job.companyName || job.company?.name || "Company";
    const role = job.role || job.title || "Open Role";
    await applyToDrive(job.id, compName, role);
  }

  return (
    <div className="drives-page animate-fade-in">
      {/* 1. Header */}
      <div className="drives-header">
        <div className="drives-header-left">
          <div className="header-icon-box">🎯</div>
          <div>
            <h1 className="page-title">Placement Drives</h1>
            <p className="page-subtitle">Track active campus recruitment, eligibility criteria, and deadlines.</p>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="drives-filter-bar glass">
        <div className="drives-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search drives, companies, roles or CTC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="drives-dropdowns">
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="select-field">
            <option value="all">All Companies</option>
            {[...new Set(allDrives.map(j => j.companyName || j.company?.name).filter(Boolean))].map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="select-field">
            <option value="all">All Roles</option>
            <option value="software">Software Engineer</option>
            <option value="intern">Internship</option>
            <option value="ninja">Ninja</option>
          </select>

          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="select-field">
            <option value="all">All Modes</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On Campus">On Campus</option>
          </select>
        </div>
      </div>

      {/* 3. Tabs Navigation */}
      <div className="drives-tabs-row">
        <div className="drives-tabs glass">
          <button
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Drives
          </button>
          <button
            className={`tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming
          </button>
          <button
            className={`tab-btn ${activeTab === "ongoing" ? "active" : ""}`}
            onClick={() => setActiveTab("ongoing")}
          >
            Ongoing
          </button>
          <button
            className={`tab-btn ${activeTab === "past" ? "active" : ""}`}
            onClick={() => setActiveTab("past")}
          >
            Past
          </button>
        </div>
      </div>

      {/* 4. Split Grid: Drives List + Skyscraper Motivational Card */}
      <div className="drives-layout-split">
        <div className="drives-main-col">
          {loading ? (
            <div className="drives-loading-list">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-card" style={{ height: 80 }} />
              ))}
            </div>
          ) : filteredDrives.length === 0 ? (
            <div className="drives-empty glass">
              <div className="empty-icon">🎯</div>
              <h3>No matching placement drives</h3>
              <p>Try resetting your search query or filters.</p>
              <button
                className="btn btn-secondary"
                onClick={() => { setSearch(""); setCompanyFilter("all"); setRoleFilter("all"); setModeFilter("all"); setActiveTab("all"); }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="drives-cards-stack">
              {filteredDrives.map((job) => {
                const compName = job.company?.name || job.companyName || "Company";
                const role = job.role || job.title || "Open Role";
                const deadline = job.registrationClose || job.registrationClosesAt || job.deadline;
                const days = daysUntil(deadline);
                const hasApplied = Boolean(appliedMap[job.id]);

                return (
                  <div key={job.id} className="drive-row-card glass-card">
                    {/* Left Brand Badge */}
                    <div className="drive-row-brand">
                      <div className="drive-brand-logo">
                        <CompanyLogo name={compName} size={32} />
                      </div>
                      <div className="drive-brand-text">
                        <h3 className="drive-comp-title">{compName}</h3>
                        <span className="drive-role-sub">{role}</span>
                      </div>
                    </div>

                    {/* Middle Specs */}
                    <div className="drive-specs-strip">
                      <span className="spec-pill spec-type">{job.employmentType || "Full-Time"}</span>
                      {job.location && <span className="spec-pill spec-loc">{job.location}</span>}
                      {job.ctc && <span className="spec-pill spec-ctc">{job.ctc}</span>}
                    </div>

                    {/* Right Timeline & Apply Button */}
                    <div className="drive-right-action">
                      <div className="drive-date-box">
                        <span className="drive-deadline">{formatDate(deadline)}</span>
                        {days !== null && (
                          <span className={`drive-days-left ${days <= 3 ? "urgent" : ""}`}>
                            {days < 0 ? "Expired" : days === 0 ? "Today" : `${days} days left`}
                          </span>
                        )}
                      </div>

                      <button
                        className="drive-save-btn"
                        onClick={(e) => { e.stopPropagation(); toggleSaveItem(job.id); }}
                        title={isSaved(job.id) ? "Saved drive (Click to remove)" : "Save drive"}
                        aria-label="Save drive"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px",
                          display: "flex",
                          alignItems: "center",
                          color: isSaved(job.id) ? "var(--accent)" : "var(--text-muted)",
                          transition: "color 0.15s ease",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved(job.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>

                      {hasApplied ? (
                        <button className="btn btn-secondary applied-btn" disabled>
                          ✓ Applied
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary apply-btn"
                          onClick={(e) => handleApply(job, e)}
                        >
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side Opportunity Card matching Step 1 & Step 2 */}
        <aside className="drives-side-col">
          <div className="opportunity-skyscraper-card glass">
            <div className="skyscraper-visual">
              <img
                src="/assets/skyscraper.jpg"
                alt="City skyscrapers"
                className="skyscraper-img"
              />
              <div className="skyscraper-overlay" />
            </div>

            <div className="skyscraper-content">
              <span className="opp-tag">PLACEMENT OPPORTUNITIES</span>
              <h2 className="opp-headline">OPPORTUNITIES<br />DON'T WAIT.<br /><span className="opp-red">BE READY.</span></h2>
              <p className="opp-sub">
                Top tier technology and product companies are recruiting now. Prepare your resume and mock interviews.
              </p>
              <button
                className="btn btn-primary opp-cta-btn"
                onClick={() => navigate("/assistant")}
              >
                <span>Ask Placement Assistant ➔</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
