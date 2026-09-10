import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlacementData } from "../contexts/PlacementDataContext";
import { getJobs } from "../services/firestore";
import CompanyLogo from "../components/CompanyLogo";
import "./Saved.css";

export default function Saved() {
  const navigate = useNavigate();
  const { companies, savedIds, toggleSaveItem } = usePlacementData();
  const [allDrives, setAllDrives] = useState([]);
  const [activeTab, setActiveTab] = useState("companies");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await getJobs();
      if (!cancelled) setAllDrives(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const savedCompanies = useMemo(() => {
    return companies.filter((c) => savedIds.includes(c.id));
  }, [companies, savedIds]);

  const savedDrives = useMemo(() => {
    return allDrives.filter((d) => savedIds.includes(d.id));
  }, [allDrives, savedIds]);

  const filteredCompanies = useMemo(() => {
    return savedCompanies.filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (item.name || "").toLowerCase().includes(q) || (item.industry || "").toLowerCase().includes(q);
    });
  }, [savedCompanies, search]);

  const filteredDrives = useMemo(() => {
    return savedDrives.filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const comp = item.companyName || item.company?.name || "";
      const role = item.role || item.title || "";
      return comp.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    });
  }, [savedDrives, search]);

  function handleRemoveBookmark(id, e) {
    e.stopPropagation();
    toggleSaveItem(id);
  }

  return (
    <div className="saved-page animate-fade-in">
      {/* 1. Header */}
      <div className="saved-header">
        <div className="saved-header-left">
          <div className="saved-icon-badge">🔖</div>
          <div>
            <h1 className="page-title">Saved Opportunities</h1>
            <p className="page-subtitle">Your personal shortlist of bookmarked companies and placement drives.</p>
          </div>
        </div>

        <div className="saved-tabs glass">
          <button
            className={`saved-tab-btn ${activeTab === "companies" ? "active" : ""}`}
            onClick={() => setActiveTab("companies")}
          >
            Saved Companies ({savedCompanies.length})
          </button>
          <button
            className={`saved-tab-btn ${activeTab === "drives" ? "active" : ""}`}
            onClick={() => setActiveTab("drives")}
          >
            Saved Drives ({savedDrives.length})
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="saved-filter-bar glass">
        <div className="saved-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={activeTab === "companies" ? "Search saved companies..." : "Search saved drives..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Content Grid */}
      {activeTab === "companies" ? (
        <div className="saved-grid">
          {filteredCompanies.length === 0 ? (
            <div className="saved-empty glass" style={{ gridColumn: "1 / -1" }}>
              <div className="saved-empty-icon">🏢</div>
              <h3>No saved companies</h3>
              <p>Bookmark high-target organizations from the Companies directory.</p>
              <button className="btn btn-secondary" onClick={() => navigate("/companies")}>
                Browse Companies
              </button>
            </div>
          ) : (
            filteredCompanies.map((item) => (
              <div key={item.id} className="saved-card glass-card" onClick={() => navigate(`/companies/${item.id}`)} style={{ cursor: "pointer" }}>
                <div className="saved-card-top">
                  <div className="saved-logo-wrap">
                    <CompanyLogo name={item.name} size={32} />
                  </div>
                  <div className="saved-card-info" style={{ flex: 1, marginLeft: 12 }}>
                    <h3 className="saved-card-name" style={{ fontSize: "1rem", fontWeight: 700 }}>{item.name}</h3>
                    <span className="saved-card-meta" style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>{item.industry || ""}</span>
                  </div>
                  <button
                    className="bookmark-ribbon-btn"
                    onClick={(e) => handleRemoveBookmark(item.id, e)}
                    title="Remove from saved"
                    aria-label="Remove bookmark"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
                <div className="saved-card-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  {item.location && <span className="spec-pill" style={{ fontSize: "0.72rem" }}>📍 {item.location}</span>}
                  <span className="spec-pill" style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.72rem" }}>
                    {item.ctcRange || ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="saved-grid">
          {filteredDrives.length === 0 ? (
            <div className="saved-empty glass" style={{ gridColumn: "1 / -1" }}>
              <div className="saved-empty-icon">🎯</div>
              <h3>No saved drives</h3>
              <p>Bookmark upcoming recruitment drives from the Drives page to track them here.</p>
              <button className="btn btn-secondary" onClick={() => navigate("/drives")}>
                Explore Placement Drives
              </button>
            </div>
          ) : (
            filteredDrives.map((d) => {
              const comp = d.companyName || d.company?.name || "Company";
              const role = d.role || d.title || "Open Role";
              return (
                <div key={d.id} className="saved-card glass-card" onClick={() => navigate("/drives")} style={{ cursor: "pointer" }}>
                  <div className="saved-card-top">
                    <div className="saved-logo-wrap">
                      <CompanyLogo name={comp} size={32} />
                    </div>
                    <div className="saved-card-info" style={{ flex: 1, marginLeft: 12 }}>
                      <h3 className="saved-card-name" style={{ fontSize: "1rem", fontWeight: 700 }}>{comp}</h3>
                      <span className="saved-card-meta" style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>{role}</span>
                    </div>
                    <button
                      className="bookmark-ribbon-btn"
                      onClick={(e) => handleRemoveBookmark(d.id, e)}
                      title="Remove from saved"
                      aria-label="Remove bookmark"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  </div>
                  <div className="saved-card-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span className="spec-pill" style={{ fontSize: "0.72rem" }}>💼 {d.employmentType || "Full-Time"}</span>
                    <span className="spec-pill" style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.72rem" }}>
                      {d.ctc}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Sleek Banner matching blueprint */}
      <div className="dash-hero-banner glass" style={{ marginTop: 24 }}>
        <div className="hero-left-col">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
            YOUR SHORTLISTED GOALS.<br />
            <span style={{ color: "var(--accent)" }}>STAY PREPARED.</span>
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 6 }}>
            Consistently practice test patterns and review interview notes for all your saved organizations.
          </p>
        </div>
        <div className="hero-car-card">
          <img src="/assets/car_banner.jpg" alt="Performance" className="hero-car-img" />
          <div className="hero-car-overlay" />
          <div className="hero-car-quote">
            <span>STAY FOCUSED</span>
            <strong>EXECUTE WITH PRECISION ↗</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
