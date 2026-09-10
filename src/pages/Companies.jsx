import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePlacementData } from "../contexts/PlacementDataContext";
import CompanyLogo from "../components/CompanyLogo";
import "./Companies.css";

export default function Companies() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const { companies: firestoreCompanies, applications, loading } = usePlacementData();

  const [viewMode, setViewMode] = useState("cards");
  const [search, setSearch] = useState(initialSearch);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("name_asc");

  const companies = useMemo(() => {
    const appStatusMap = {};
    (applications || []).forEach((app) => {
      const key = (app.companyName || app.company?.name || "").toLowerCase().trim();
      if (key) {
        if (app.status === "shortlisted") appStatusMap[key] = "Shortlisted";
        else if (app.status === "selected" || app.status === "offer") appStatusMap[key] = "Selected";
        else if (app.status === "applied" || app.status === "registered") appStatusMap[key] = "Applied";
        else if (app.status === "rejected") appStatusMap[key] = "Rejected";
      }
    });

    return (firestoreCompanies || []).map((fc) => {
      const normName = (fc.name || "").toLowerCase().trim();
      const derivedStatus = appStatusMap[normName] || fc.status || "Not Applied";
      return {
        id: fc.id,
        name: fc.name || "Unnamed Company",
        industry: fc.industry || "",
        location: fc.location || "",
        website: fc.website || "",
        contactEmail: fc.contactEmail || "",
        description: fc.description || "",
        logoUrl: fc.logoUrl || null,
        isActive: fc.isActive !== false,
        status: derivedStatus === "active" ? "Not Applied" : derivedStatus,
        organisationSize: fc.organisationSize || "",
      };
    });
  }, [firestoreCompanies, applications]);

  const industriesList = useMemo(() => {
    const set = new Set(companies.map((c) => c.industry).filter(Boolean));
    return Array.from(set);
  }, [companies]);

  const locationsList = useMemo(() => {
    const set = new Set(companies.map((c) => c.location).filter(Boolean));
    return Array.from(set);
  }, [companies]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (industryFilter !== "all" && c.industry.toLowerCase() !== industryFilter.toLowerCase()) return false;
      if (locationFilter !== "all" && !c.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    }).sort((a, b) => {
      if (sortOption === "name_asc") return a.name.localeCompare(b.name);
      if (sortOption === "name_desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [companies, search, sortOption, industryFilter, locationFilter, statusFilter]);

  const handleCardClick = (company) => {
    navigate(`/companies/${company.id}`);
  };

  return (
    <div className="companies-page animate-fade-in">
      <div className="comps-page-header">
        <div className="comps-page-title-group">
          <h1 className="comps-page-title">Companies</h1>
          <p className="comps-page-subtitle">Discover, track and manage company information.</p>
        </div>

        <div className="comps-page-actions">
          <div className="comps-view-segmented" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`comps-view-tab ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Cards View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`comps-view-tab ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="1.5" />
                <circle cx="4" cy="12" r="1.5" />
                <circle cx="4" cy="18" r="1.5" />
              </svg>
              <span>List</span>
            </button>
          </div>

          <button
            type="button"
            className="comps-add-company-btn"
            onClick={() => navigate("/companies/new")}
            title="Add New Company"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Company</span>
          </button>
        </div>
      </div>

      <div className="comps-filter-row">
        <div className="comps-filter-dropdowns">
          <div className="comps-select-wrap">
            <select
              className="comps-filter-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              aria-label="Sort companies"
            >
              <option value="name_asc">Name (A to Z)</option>
              <option value="name_desc">Name (Z to A)</option>
            </select>
            <span className="comps-select-arrow">⌵</span>
          </div>

          <div className="comps-select-wrap">
            <select
              className="comps-filter-select"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              aria-label="Filter by industry"
            >
              <option value="all">All Industries</option>
              {industriesList.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            <span className="comps-select-arrow">⌵</span>
          </div>

          <div className="comps-select-wrap">
            <select
              className="comps-filter-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Filter by location"
            >
              <option value="all">All Locations</option>
              {locationsList.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <span className="comps-select-arrow">⌵</span>
          </div>

          <div className="comps-select-wrap">
            <select
              className="comps-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="Applied">Applied</option>
              <option value="Not Applied">Not Applied</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Selected">Selected</option>
            </select>
            <span className="comps-select-arrow">⌵</span>
          </div>
        </div>

        <div className="comps-search-wrap">
          <svg className="comps-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="comps-search-input"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="comps-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading && filtered.length === 0 ? (
        <div className="comps-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="comps-card-skeleton" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="comps-empty-state glass">
          <div className="comps-empty-icon">🏢</div>
          <h3>No companies yet</h3>
          <p>Add your first company to start tracking placement opportunities.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/admin/companies")}
          >
            + Add Company
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="comps-empty-state glass">
          <div className="comps-empty-icon">🔍</div>
          <h3>No companies match your filters</h3>
          <p>Try adjusting your search or filter criteria.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearch("");
              setIndustryFilter("all");
              setLocationFilter("all");
              setStatusFilter("all");
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="comps-grid">
          {filtered.map((c) => {
            const statusClass =
              c.status === "Applied"
                ? "status-registered"
                : c.status === "Shortlisted"
                ? "status-shortlisted"
                : c.status === "Selected"
                ? "status-selected"
                : "status-not-applied";

            return (
              <div
                key={c.id}
                className="comp-card"
                onClick={() => handleCardClick(c)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(c);
                  }
                }}
              >
                <div className="comp-card-top">
                  <div className="comp-card-brand-group">
                    <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={44} />
                    <div className="comp-card-titles">
                      <h2 className="comp-card-name">{c.name}</h2>
                      {c.industry && <span className="comp-card-role">{c.industry}</span>}
                    </div>
                  </div>
                  <span className={`comp-status-pill ${statusClass}`}>
                    {c.status}
                  </span>
                </div>

                <div className="comp-card-bottom">
                  <div className="comp-card-meta-list">
                    {c.location && (
                      <div className="comp-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{c.location}</span>
                      </div>
                    )}
                    {c.organisationSize && (
                      <div className="comp-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{c.organisationSize}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="comps-list-container">
          <table className="comps-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Location</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => handleCardClick(c)}>
                  <td>
                    <div className="comps-list-brand">
                      <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={36} />
                      <strong>{c.name}</strong>
                    </div>
                  </td>
                  <td>{c.industry || "—"}</td>
                  <td>{c.location || "—"}</td>
                  <td>
                    <span className={`comp-status-pill ${c.status === "Applied" ? "status-registered" : c.status === "Shortlisted" ? "status-shortlisted" : c.status === "Selected" ? "status-selected" : "status-not-applied"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="comps-table-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(c);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
