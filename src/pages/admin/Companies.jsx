import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCompanies, addCompany, updateCompany, deleteCompany, getAllApplications } from "../../services/firestore";
import Modal from "../../components/Modal";
import CompanyLogo from "../../components/CompanyLogo";
import "./Companies.css";

const EMPTY = {
  name: "",
  industry: "",
  organisationSize: "",
  website: "",
  logoUrl: "",
  description: "",
  location: "",
  contactEmail: "",
  isActive: true,
};

// ─── ICONS ──────────────────────────────────────────────────
const HeaderOfficeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M12 6h.01" /><path d="M16 6h.01" />
    <path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" />
    <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
  </svg>
);

const StatsBuildingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M16 6h.01" />
    <path d="M8 11h.01" /><path d="M16 11h.01" />
  </svg>
);

const StatsCheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

const StatsInactiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const FilterFunnelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const StatusCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const SortArrowsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 16 4 4 4-4" /><path d="M7 20V4" />
    <path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IndustryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M16 6h.01" />
    <path d="M8 10h.01" /><path d="M16 10h.01" />
    <path d="M8 14h.01" /><path d="M16 14h.01" />
  </svg>
);

const OrgSizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const LocationPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ApplicantsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const MoreVerticalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const ToggleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
    <circle cx="16" cy="12" r="3" />
  </svg>
);

function formatCompanyName(raw) {
  if (!raw) return "Company";
  let clean = String(raw).trim();
  if (/from\s*pod\s*company/i.test(clean)) {
    const m = clean.match(/company\s*name:\s*([^Company\n]+?)(?:Company\s*Logo|Organisation|$)/i);
    if (m && m[1]) clean = m[1].trim();
  }
  clean = clean.replace(/^[\.\s\-–—]*company\s*name:\s*/i, "").trim();
  if (clean.toLowerCase().includes("industry:")) {
    clean = clean.split(/industry:/i)[0].trim();
  }
  if (clean.toLowerCase().includes("organisation description:")) {
    clean = clean.split(/organisation description:/i)[0].trim();
  }
  if (clean.toLowerCase().includes("company logo:")) {
    clean = clean.split(/company logo:/i)[0].trim();
  }
  return clean || "Company";
}

function formatCompanyDescription(c) {
  if (c.description && !c.description.startsWith(".") && c.description.length > 5) {
    return c.description;
  }
  return "";
}

function formatCompanyIndustry(c) {
  if (c.industry && !c.industry.startsWith(".")) return c.industry;
  return "";
}

function formatCompanyOrgSize(c) {
  if (c.organisationSize && !c.organisationSize.startsWith(".")) return c.organisationSize;
  return "";
}

function formatCompanyLocation(c) {
  if (c.location && !c.location.startsWith(".")) return c.location;
  return "";
}

function formatCompanyWebsite(c) {
  if (c.website && !c.website.startsWith(".")) return c.website;
  return "";
}

export default function AdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  // UI Interactive States
  const [openMenuId, setOpenMenuId] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [applicantsTarget, setApplicantsTarget] = useState(null);
  const [applicantsData, setApplicantsData] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const menuRef = useRef(null);

  // Close 3-dots menu and add dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
      if (!e.target.closest('.ac-add-btn-wrap')) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch real companies and applications from Firestore
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [companiesRes, appsRes] = await Promise.all([
        getCompanies(),
        getAllApplications(),
      ]);
      setCompanies(companiesRes.data || []);
      setApplications(appsRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Compute applicant counts per company from real application data
  const applicantCounts = useMemo(() => {
    const counts = {};
    applications.forEach((app) => {
      if (app.companyId) {
        counts[app.companyId] = (counts[app.companyId] || 0) + 1;
      }
    });
    return counts;
  }, [applications]);

  // Compute stats from real data
  const totalCompaniesCount = companies.length;
  const activeCompaniesCount = companies.filter((c) => c.isActive !== false).length;
  const inactiveCompaniesCount = companies.filter((c) => c.isActive === false).length;

  // Derive industry list
  const industries = useMemo(() => {
    const list = new Set();
    companies.forEach((c) => {
      if (c.industry && typeof c.industry === "string" && c.industry.trim()) {
        list.add(c.industry.trim());
      }
    });
    return Array.from(list);
  }, [companies]);

  // Filter & Sort
  const filtered = useMemo(() => {
    let result = [...companies];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.industry || "").toLowerCase().includes(q) ||
          (c.location || "").toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
      );
    }
    if (industryFilter !== "all") {
      result = result.filter((c) => (c.industry || "").toLowerCase() === industryFilter.toLowerCase());
    }
    if (statusFilter === "active") {
      result = result.filter((c) => c.isActive !== false);
    }
    if (statusFilter === "inactive") {
      result = result.filter((c) => c.isActive === false);
    }

    if (sortBy === "newest") {
      result.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bTime - aTime;
      });
    } else if (sortBy === "oldest") {
      result.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return aTime - bTime;
      });
    } else if (sortBy === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return result;
  }, [companies, search, industryFilter, statusFilter, sortBy]);

  // Paginated list
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setFeedback("");
    setModalOpen(true);
  }

  function openEdit(company) {
    setEditing(company);
    setForm({
      name: company.name || "",
      industry: company.industry || "",
      organisationSize: company.organisationSize || company.size || "",
      website: company.website || "",
      logoUrl: company.logoUrl || "",
      description: company.description || "",
      location: company.location || "",
      contactEmail: company.contactEmail || "",
      isActive: company.isActive !== false,
    });
    setFeedback("");
    setOpenMenuId(null);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFeedback("");

    if (editing) {
      const { error: err } = await updateCompany(editing.id, form);
      if (err) {
        setFeedback("Failed to update company.");
      } else {
        setFeedback("Company updated successfully!");
        setCompanies((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c)));
        setTimeout(() => {
          setModalOpen(false);
          setFeedback("");
        }, 800);
      }
    } else {
      const { data, error: err } = await addCompany(form);
      if (err) {
        setFeedback("Failed to add company.");
      } else {
        setFeedback("Company added successfully!");
        setCompanies((prev) => [{ id: data.id, ...form, createdAt: new Date() }, ...prev]);
        setTimeout(() => {
          setModalOpen(false);
          setFeedback("");
        }, 800);
      }
    }
    setSaving(false);
  }

  // Toggle company active status
  async function handleToggleActive(company) {
    const nextStatus = company.isActive === false;
    const { error: err } = await updateCompany(company.id, { isActive: nextStatus });
    if (!err) {
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, isActive: nextStatus } : c)));
    }
    setOpenMenuId(null);
  }

  // Delete Company - show confirmation modal
  function handleDeleteClick(company) {
    setDeleteTarget(company);
    setOpenMenuId(null);
  }

  // Confirm Delete - perform real Firebase deletion
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteCompany(deleteTarget.id);
    if (!error) {
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  // See Applicants - fetch real application data from Firebase
  async function handleApplicantsClick(company) {
    setApplicantsTarget(company);
    setApplicantsLoading(true);
    setOpenMenuId(null);
    const { data: allApps } = await getAllApplications();
    const companyApps = (allApps || []).filter((app) => app.companyId === company.id);
    setApplicantsData(companyApps);
    setApplicantsLoading(false);
  }

  return (
    <div className="admin-companies-page">
      {/* Background ambient lighting */}
      <div className="ac-ambient-glow" aria-hidden="true" />

      {/* ─── 3. PAGE HEADER ────────────────────────────────────────── */}
      <div className="ac-top-header">
        <div className="ac-brand-title-wrap">
          <div className="ac-title-icon-badge">
            <HeaderOfficeIcon />
          </div>
          <div>
            <h1 className="ac-main-title">Companies</h1>
            <p className="ac-main-subtitle">Manage the company database</p>
          </div>
        </div>

        <div className="ac-header-actions">
          {/* 5. COMPANY STATISTICS */}
          <div className="ac-stats-capsule">
            <div className="ac-stat-cell">
              <div className="ac-stat-icon-wrap ac-stat-icon--companies">
                <StatsBuildingIcon />
              </div>
              <div className="ac-stat-details">
                <span className="ac-stat-val">{loading ? "..." : totalCompaniesCount}</span>
                <span className="ac-stat-lbl">Total Companies</span>
              </div>
            </div>

            <div className="ac-stat-divider" />

            <div className="ac-stat-cell">
              <div className="ac-stat-icon-wrap ac-stat-icon--active">
                <StatsCheckIcon />
              </div>
              <div className="ac-stat-details">
                <span className="ac-stat-val">{loading ? "..." : activeCompaniesCount}</span>
                <span className="ac-stat-lbl">Active</span>
              </div>
            </div>

            <div className="ac-stat-divider" />

            <div className="ac-stat-cell">
              <div className="ac-stat-icon-wrap ac-stat-icon--inactive">
                <StatsInactiveIcon />
              </div>
              <div className="ac-stat-details">
                <span className="ac-stat-val">{loading ? "..." : inactiveCompaniesCount}</span>
                <span className="ac-stat-lbl">Inactive</span>
              </div>
            </div>
          </div>

          {/* + Add Company dropdown */}
          <div className="ac-add-btn-wrap">
            <button className="ac-btn-add-company" onClick={() => setAddMenuOpen((v) => !v)}>
              <PlusIcon />
              <span>Add Company</span>
            </button>
            {addMenuOpen && (
              <div className="ac-add-dropdown">
                <button onClick={() => { setAddMenuOpen(false); openAdd(); }}>
                  Add Manually
                </button>
                <button onClick={() => { setAddMenuOpen(false); navigate("/admin/chatbot"); }}>
                  Add from POD.ai
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 6. SEARCH / FILTER BAR ─────────────────────────────────── */}
      <div className="ac-search-filter-bar">
        <div className="ac-search-input-wrap">
          <span className="ac-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="ac-search-field"
            placeholder="Search companies by name, industry, location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="ac-filters-wrap">
          {/* Industry Filter */}
          <div className="ac-filter-pill">
            <FilterFunnelIcon />
            <select
              value={industryFilter}
              onChange={(e) => {
                setIndustryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ac-filter-select"
            >
              <option value="all">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
            <ChevronDownIcon />
          </div>

          {/* Status Filter */}
          <div className="ac-filter-pill">
            <StatusCircleIcon />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ac-filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDownIcon />
          </div>

          {/* Sort Dropdown */}
          <div className="ac-filter-pill">
            <SortArrowsIcon />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="ac-filter-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      {/* ─── 7. COMPANY CARDS LIST ─────────────────────────────────── */}
      {loading ? (
        <div className="ac-cards-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ac-skeleton-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ac-empty-container">
          <div className="ac-empty-icon-box">
            <HeaderOfficeIcon />
          </div>
          <h3 className="ac-empty-title">{search ? "No matching companies found" : "No companies added yet"}</h3>
          <p className="ac-empty-desc">
            {search
              ? "Try adjusting your search query or filter criteria to find what you need."
              : "Add your first company to kick off placement drives and build your company database."}
          </p>
          {!search && (
            <div className="ac-add-btn-wrap">
              <button className="ac-btn-add-company" onClick={() => setAddMenuOpen((v) => !v)}>
                <PlusIcon />
                <span>Add Company</span>
              </button>
              {addMenuOpen && (
                <div className="ac-add-dropdown">
                  <button onClick={() => { setAddMenuOpen(false); openAdd(); }}>
                    Add Manually
                  </button>
                  <button onClick={() => { setAddMenuOpen(false); navigate("/admin/chatbot"); }}>
                    Add from POD.ai
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="ac-cards-list" ref={menuRef}>
          {paginatedList.map((company) => {
            const formattedName = formatCompanyName(company.name);
            const orgSize = formatCompanyOrgSize(company);
            const location = formatCompanyLocation(company);
            const industry = formatCompanyIndustry(company);
            const desc = formatCompanyDescription(company);
            const websiteUrl = formatCompanyWebsite(company);
            const applicantCount = applicantCounts[company.id] || 0;

            return (
              <div key={company.id} className="ac-company-card">
                {/* ── LEFT SECTION ── */}
                <div className="ac-card-left">
                  <div className="ac-card-logo-box">
                    <CompanyLogo name={formattedName} logoUrl={company.logoUrl} size={48} />
                  </div>

                  <div className="ac-card-info-col">
                    <div className="ac-card-title-row">
                      <h3 className="ac-card-company-name">{formattedName}</h3>
                      <span className={`ac-status-badge ${company.isActive !== false ? "ac-status--active" : "ac-status--inactive"}`}>
                        {company.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="ac-card-description">{desc}</p>

                    {websiteUrl && (
                      <a
                        href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ac-card-website-link"
                      >
                        <LinkIcon />
                        <span>{websiteUrl}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* ── MIDDLE SECTION ── */}
                <div className="ac-card-middle">
                  <div className="ac-meta-cell">
                    <span className="ac-meta-icon">
                      <IndustryIcon />
                    </span>
                    <div className="ac-meta-text-wrap">
                      <span className="ac-meta-label">Industry</span>
                      <span className="ac-meta-val">{industry}</span>
                    </div>
                  </div>

                  <div className="ac-meta-cell">
                    <span className="ac-meta-icon">
                      <OrgSizeIcon />
                    </span>
                    <div className="ac-meta-text-wrap">
                      <span className="ac-meta-label">Organisation Size</span>
                      <span className="ac-meta-val">{orgSize}</span>
                    </div>
                  </div>

                  <div className="ac-meta-cell">
                    <span className="ac-meta-icon">
                      <LocationPinIcon />
                    </span>
                    <div className="ac-meta-text-wrap">
                      <span className="ac-meta-label">Location</span>
                      <span className="ac-meta-val">{location}</span>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT SECTION ── */}
                <div className="ac-card-right">
                  <div className="ac-card-divider" />

                  {/* 8. See Applicants Button */}
                  <button
                    type="button"
                    className="ac-btn-applicants"
                    onClick={() => handleApplicantsClick(company)}
                    title="See Applicants"
                  >
                    <ApplicantsIcon />
                    <span>See Applicants ({applicantCount})</span>
                  </button>

                  {/* 9. Delete Button */}
                  <button
                    type="button"
                    className="ac-btn-delete"
                    onClick={() => handleDeleteClick(company)}
                    title="Delete company"
                  >
                    <TrashIcon />
                    <span>Delete</span>
                  </button>

                  {/* 10. Three-Dot Menu */}
                  <div className="ac-dots-wrap">
                    <button
                      type="button"
                      className="ac-btn-dots"
                      onClick={() => setOpenMenuId(openMenuId === company.id ? null : company.id)}
                      title="More actions"
                      aria-label="More options"
                    >
                      <MoreVerticalIcon />
                    </button>

                    {openMenuId === company.id && (
                      <div className="ac-dropdown-menu">
                        <button
                          type="button"
                          className="ac-dropdown-item"
                          onClick={() => openEdit(company)}
                        >
                          <PencilIcon />
                          <span>Edit Company</span>
                        </button>
                        <button
                          type="button"
                          className="ac-dropdown-item"
                          onClick={() => handleToggleActive(company)}
                        >
                          <ToggleIcon />
                          <span>Mark {company.isActive !== false ? "Inactive" : "Active"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 12. BOTTOM PAGINATION & WATERMARK ───────────────────────── */}
      <div className="ac-bottom-bar">
        <span className="ac-showing-text">
          Showing {paginatedList.length} of {filtered.length} companies
        </span>

        <div className="ac-pagination-controls">
          <button
            type="button"
            className="ac-page-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous Page"
          >
            ←
          </button>
          <span className="ac-page-number-active">{currentPage}</span>
          <button
            type="button"
            className="ac-page-nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next Page"
          >
            →
          </button>
        </div>

        {/* Reference watermark */}
        <div className="ac-brand-watermark">
          <span className="ac-wm-text">CONNECT</span>
          <span className="ac-wm-text">LEARN</span>
          <span className="ac-wm-text">GROW</span>
        </div>
      </div>

      {/* ─── ADD / EDIT COMPANY MODAL (Preserving real functionality) ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Company" : "Add Company"}>
        <form onSubmit={handleSave} className="ac-modal-form">
          {feedback && (
            <div className={`ac-modal-feedback ${feedback.includes("Failed") ? "error" : "success"}`}>
              {feedback}
            </div>
          )}

          <div className="ac-modal-grid">
            <div className="modal-field">
              <label>Company Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. NVIDIA, eQ Technologic"
                required
              />
            </div>

            <div className="modal-field">
              <label>Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="e.g. IT / Computers - Software"
              />
            </div>

            <div className="modal-field">
              <label>Organisation Size</label>
              <input
                type="text"
                value={form.organisationSize}
                onChange={(e) => setForm({ ...form, organisationSize: e.target.value })}
                placeholder="e.g. 2,001 - 10,000 or 10,000+"
              />
            </div>

            <div className="modal-field">
              <label>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Pune, India or Remote Working"
              />
            </div>

            <div className="modal-field">
              <label>Website URL</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.company.com"
              />
            </div>

            <div className="modal-field">
              <label>Logo URL</label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://... logo image URL"
              />
            </div>

            <div className="modal-field">
              <label>Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="careers@company.com"
              />
            </div>
          </div>

          <div className="modal-field full-width">
            <label>Organisation Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the organisation..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Company"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── DELETE CONFIRMATION MODAL ────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Company">
        <div className="ac-notice-content">
          <p>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?</p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            This action cannot be undone. All associated data will be removed.
          </p>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="modal-btn modal-btn--danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── APPLICANTS VIEWER MODAL ──────────────────────────────── */}
      <Modal open={!!applicantsTarget} onClose={() => { setApplicantsTarget(null); setApplicantsData([]); }} title={`Applicants for ${applicantsTarget?.name || ""}`}>
        <div className="ac-notice-content">
          {applicantsLoading ? (
            <p>Loading applicants...</p>
          ) : applicantsData.length === 0 ? (
            <p>No applicants found for this company.</p>
          ) : (
            <div className="ac-applicants-list">
              <p style={{ marginBottom: "0.75rem", color: "var(--text-muted)" }}>
                {applicantsData.length} applicant{applicantsData.length !== 1 ? "s" : ""}
              </p>
              {applicantsData.map((app) => (
                <div key={app.id} className="ac-applicant-row">
                  <div className="ac-applicant-info">
                    <span className="ac-applicant-name">{app.studentName || app.userName || "Unknown Student"}</span>
                    <span className="ac-applicant-email">{app.studentEmail || app.userEmail || ""}</span>
                  </div>
                  <span className={`ac-applicant-status ac-status--${(app.status || "applied").toLowerCase()}`}>
                    {app.status || "Applied"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--primary" onClick={() => { setApplicantsTarget(null); setApplicantsData([]); }}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
