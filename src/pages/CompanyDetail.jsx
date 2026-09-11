import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import {
  getCompany,
  getJobsByCompany,
  getAttachmentsByCompany,
  uploadJobAttachment,
  deleteAttachment,
  deleteCompany,
  updateCompany,
} from "../services/firestore";
import CompanyLogo from "../components/CompanyLogo";
import "../components/Modal.css";
import "./CompanyDetail.css";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function timeAgo(dateVal) {
  if (!dateVal) return "";
  const d = dateVal?.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
  const months = Math.floor(diff / 2592000);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

// PRD §38: NEVER invent data. Use only what exists in the database.
function formatCompanyName(raw) {
  if (!raw) return "Not Specified";
  let clean = String(raw).replace(/^[\.\s\-–—]*company\s*name:\s*/i, "").trim();
  if (clean.toLowerCase().includes("industry:")) {
    clean = clean.split(/industry:/i)[0].trim();
  }
  if (clean && clean === clean.toLowerCase()) {
    clean = clean.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return clean || "Not Specified";
}

function formatIndustry(c) {
  if (!c) return "Not Specified";
  if (c.industry && !c.industry.startsWith(".") && !c.industry.toLowerCase().includes("leave blank")) {
    return c.industry;
  }
  return "Not Specified";
}

function formatBannerSubtitle(c) {
  const ind = formatIndustry(c);
  if (ind === "Not Specified") return ind;
  if (ind.toLowerCase().includes("computers") || ind.toLowerCase().includes("software")) {
    return "Technology · Software";
  }
  return ind;
}

function formatLocation(c) {
  if (!c) return "Not Specified";
  if (c.location && !c.location.startsWith(".") && !c.location.toLowerCase().includes("leave blank")) {
    return c.location;
  }
  return "Not Specified";
}

function formatOrgSize(c) {
  if (!c) return "Not Specified";
  if (c.organisationSize && !c.organisationSize.startsWith(".") && !c.organisationSize.toLowerCase().includes("leave blank")) {
    return c.organisationSize;
  }
  return "Not Specified";
}

function formatWebsite(c) {
  if (!c) return "";
  if (c.website && !c.website.startsWith(".")) {
    return c.website.startsWith("http") ? c.website : `https://${c.website}`;
  }
  return "";
}

function formatDescription(c) {
  if (!c) return "";
  if (c.description && !c.description.startsWith(".") && c.description.length > 5) {
    return c.description;
  }
  return "";
}

export default function CompanyDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { applications, applyToDrive } = usePlacementData();
  const fileInputRef = useRef(null);

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const [company, setCompany] = useState(null);
  const [drives, setDrives] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [applying, setApplying] = useState(false);

  // Modals
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [deleteCompanyConfirm, setDeleteCompanyConfirm] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState(false);

  const [viewerPdf, setViewerPdf] = useState(null);

  // Edit Company Modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    industry: "",
    organisationSize: "",
    location: "",
    website: "",
    description: "",
  });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  // Apply notification
  const [applySuccess, setApplySuccess] = useState(false);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getCompany(companyId);
    if (err || !data) {
      setError("Company not found.");
      setLoading(false);
      return;
    }
    setCompany(data);

    const [drivesRes, attRes] = await Promise.all([
      getJobsByCompany(companyId),
      getAttachmentsByCompany(companyId),
    ]);
    setDrives(drivesRes.data || []);
    setAttachments(attRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // Compute which jobs the current user has applied to
  const appliedJobIds = new Set(
    applications
      .filter((a) => a.userId === user?.uid && (a.companyId === companyId || a.companyName === company?.name))
      .map((a) => a.jobId)
  );

  // Compute company stats from context applications
  const companyApps = applications.filter(
    (a) => a.companyId === companyId || a.companyName === company?.name
  );
  const stats = {
    applications: companyApps.length,
    interviews: companyApps.filter((a) => a.status === "interview").length,
    offers: companyApps.filter((a) => a.status === "offer" || a.status === "selected").length,
  };

  // Find the first active drive for this company
  const activeDrive = drives.find((d) => d.isActive !== false) || drives[0];
  const hasAppliedToDrive = activeDrive
    ? appliedJobIds.has(activeDrive.id)
    : applications.some((a) => a.userId === user?.uid && (a.companyId === companyId || a.companyName?.toLowerCase() === company?.name?.toLowerCase()));

  function scrollToSection(id, tabName) {
    setActiveTab(tabName);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openUploadModal() {
    setUploadFile(null);
    setUploadError("");
    setUploadSuccess(false);
    setUploadModal(true);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      setUploadFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be under 10MB.");
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
    setUploadError("");
  }

  async function handleUpload() {
    if (!uploadFile || uploadBusy) return;
    setUploadBusy(true);
    setUploadError("");
    const { data, error } = await uploadJobAttachment(companyId, companyId, uploadFile, user?.uid);
    if (!error && data) {
      setAttachments((prev) => [data, ...prev]);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadModal(false);
        setUploadSuccess(false);
      }, 1200);
    } else {
      setUploadError("Upload failed. Please try again.");
    }
    setUploadBusy(false);
  }

  async function handleDeleteJD() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    const { error } = await deleteAttachment(deleteTarget.id);
    if (!error) {
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    }
    setDeleteBusy(false);
    setDeleteTarget(null);
  }

  async function handleDeleteCompany() {
    if (deletingCompany) return;
    setDeletingCompany(true);
    const { error } = await deleteCompany(companyId);
    if (!error) {
      navigate("/companies");
    } else {
      setError("Failed to delete company.");
      setDeletingCompany(false);
      setDeleteCompanyConfirm(false);
    }
  }

  function openEditModal() {
    setEditForm({
      name: formatCompanyName(company?.name),
      industry: formatIndustry(company),
      organisationSize: formatOrgSize(company),
      location: formatLocation(company),
      website: formatWebsite(company),
      description: formatDescription(company),
    });
    setEditError("");
    setEditModal(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditBusy(true);
    setEditError("");
    const { error: err } = await updateCompany(companyId, {
      name: editForm.name.trim(),
      industry: editForm.industry.trim(),
      organisationSize: editForm.organisationSize.trim(),
      location: editForm.location.trim(),
      website: editForm.website.trim(),
      description: editForm.description.trim(),
    });
    if (!err) {
      setCompany((prev) => ({
        ...prev,
        ...editForm,
      }));
      setEditModal(false);
    } else {
      setEditError(err || "Failed to update company");
    }
    setEditBusy(false);
  }

  async function handleApply() {
    if (hasAppliedToDrive || applying) return;
    setApplying(true);
    const driveId = activeDrive?.id || `drive_${companyId}`;
    const roleTitle = activeDrive?.title || activeDrive?.role || "Software Development Engineer";
    const { error } = await applyToDrive(driveId, company?.name || "Company", roleTitle, companyId);
    if (!error) {
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 4000);
    }
    setApplying(false);
  }

  if (loading) {
    return (
      <div className="cd-page">
        <div className="cd-loading">
          <div className="skeleton-card" style={{ height: 200, borderRadius: 16 }} />
          <div className="skeleton-card" style={{ height: 56, borderRadius: 14 }} />
          <div className="skeleton-card" style={{ height: 96, borderRadius: 14 }} />
          <div className="skeleton-card" style={{ height: 350, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cd-page">
        <div className="cd-error glass">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/companies")}>
            ← Back to Companies
          </button>
        </div>
      </div>
    );
  }

  const compName = formatCompanyName(company?.name);
  const compIndustry = formatIndustry(company);
  const compSubtitle = formatBannerSubtitle(company);
  const compLocation = formatLocation(company);
  const compOrgSize = formatOrgSize(company);
  const compWebsite = formatWebsite(company);
  const compDescription = formatDescription(company);

  return (
    <div className="cd-page animate-fade-in">
      {/* ── MODALS ── */}
      {deleteTarget && (
        <div className="cd-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cd-modal glass-heavy" onClick={(e) => e.stopPropagation()}>
            <h3 className="cd-modal-title">Delete Job Description?</h3>
            <p className="cd-modal-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="cd-modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteJD} disabled={deleteBusy}>
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCompanyConfirm && (
        <div className="cd-modal-overlay" onClick={() => setDeleteCompanyConfirm(false)}>
          <div className="cd-modal glass-heavy" onClick={(e) => e.stopPropagation()}>
            <h3 className="cd-modal-title">Delete Company?</h3>
            <p className="cd-modal-text">
              Are you sure you want to delete <strong>{compName}</strong>? This will also remove {attachments.length} document(s). This action cannot be undone.
            </p>
            <div className="cd-modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteCompanyConfirm(false)} disabled={deletingCompany}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteCompany} disabled={deletingCompany}>
                {deletingCompany ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadModal && (
        <div className="cd-modal-overlay" onClick={() => { if (!uploadBusy) setUploadModal(false); }}>
          <div className="cd-modal glass-heavy" onClick={(e) => e.stopPropagation()}>
            {uploadSuccess ? (
              <div className="cd-upload-success">
                <div className="cd-upload-success-icon">✓</div>
                <h3>Uploaded Successfully</h3>
                <p>The job description has been added.</p>
              </div>
            ) : (
              <>
                <h3 className="cd-modal-title">Add Job Description</h3>
                <p className="cd-modal-text">Upload a PDF file for this company's job description.</p>

                <div className="cd-modal-upload-area">
                  <label className="cd-upload-label">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      style={{ display: "none" }}
                      disabled={uploadBusy}
                    />
                    <div className="cd-upload-box cd-upload-box--modal" onClick={() => fileInputRef.current?.click()}>
                      {uploadFile ? (
                        <div className="cd-upload-selected">
                          <span className="cd-upload-file-icon">📄</span>
                          <span className="cd-upload-file-name">{uploadFile.name}</span>
                          <span className="cd-upload-file-size">{formatFileSize(uploadFile.size)}</span>
                        </div>
                      ) : (
                        <>
                          <span className="cd-upload-icon">+</span>
                          <span>Click to select PDF</span>
                          <span className="cd-upload-hint">PDF only, max 10MB</span>
                        </>
                      )}
                    </div>
                  </label>
                  {uploadError && <p className="cd-upload-error">{uploadError}</p>}
                </div>

                <div className="cd-modal-actions">
                  <button className="btn btn-secondary" onClick={() => setUploadModal(false)} disabled={uploadBusy}>
                    Cancel
                  </button>
                  <button className="btn btn-primary cd-upload-submit-btn" onClick={handleUpload} disabled={!uploadFile || uploadBusy}>
                    {uploadBusy ? "Uploading..." : "Upload Job Description"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewerPdf && (
        <div className="cd-modal-overlay" onClick={() => setViewerPdf(null)}>
          <div className="cd-pdf-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-pdf-viewer-header">
              <span className="cd-pdf-viewer-title">{viewerPdf.name}</span>
              <div className="cd-pdf-viewer-actions">
                <a href={viewerPdf.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" download={viewerPdf.name}>
                  Download
                </a>
                <button className="btn btn-secondary" onClick={() => setViewerPdf(null)}>
                  Close
                </button>
              </div>
            </div>
            <iframe src={viewerPdf.fileUrl} title={viewerPdf.name} className="cd-pdf-iframe" />
          </div>
        </div>
      )}

      {editModal && (
        <div className="cd-modal-overlay" onClick={() => { if (!editBusy) setEditModal(false); }}>
          <div className="cd-modal glass-heavy cd-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cd-modal-title">Edit Company Details</h3>
            <form onSubmit={handleSaveEdit} className="cd-edit-form">
              <div className="cd-form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="cd-form-group">
                <label>Industry</label>
                <input
                  type="text"
                  value={editForm.industry}
                  onChange={(e) => setEditForm((p) => ({ ...p, industry: e.target.value }))}
                />
              </div>
              <div className="cd-form-row">
                <div className="cd-form-group">
                  <label>Organisation Size</label>
                  <input
                    type="text"
                    value={editForm.organisationSize}
                    onChange={(e) => setEditForm((p) => ({ ...p, organisationSize: e.target.value }))}
                  />
                </div>
                <div className="cd-form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
              </div>
              <div className="cd-form-group">
                <label>Website URL</label>
                <input
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm((p) => ({ ...p, website: e.target.value }))}
                />
              </div>
              <div className="cd-form-group">
                <label>Description</label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              {editError && <p className="cd-upload-error">{editError}</p>}
              <div className="cd-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)} disabled={editBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TOP NAVIGATION LINK ── */}
      <div className="cd-nav-bar">
        <button className="cd-back-link" onClick={() => navigate("/companies")}>
          <span className="cd-back-arrow">←</span> Back to Companies
        </button>
      </div>

      {/* ── HERO BANNER WITH SKYSCRAPER BACKGROUND ── */}
      <div className="cd-hero-banner">
        <div className="cd-hero-overlay">
          <div className="cd-hero-left">
            <div className="cd-banner-logo-box">
              <CompanyLogo name={compName} logoUrl={company?.logoUrl} size={60} />
            </div>
            <div className="cd-banner-company-info">
              <h1 className="cd-banner-title">{compName}</h1>
              <p className="cd-banner-subtitle">{compSubtitle}</p>
            </div>
          </div>
          <div className="cd-hero-right">
            <div className="cd-banner-slogan">
              <span>Innovate</span>
              <span>Build</span>
              <span>Grow Together</span>
              <div className="cd-slogan-line" />
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB-NAVIGATION TABS BAR ── */}
      <div className="cd-nav-tabs-bar">
        <div className="cd-tabs-list">
          <button
            className={`cd-tab-item ${activeTab === "overview" ? "cd-tab-item--active" : ""}`}
            onClick={() => scrollToSection("sec-about", "overview")}
          >
            <span className="cd-tab-icon">📄</span> Overview
          </button>
          <button
            className={`cd-tab-item ${activeTab === "jobs" ? "cd-tab-item--active" : ""}`}
            onClick={() => scrollToSection("sec-jobs", "jobs")}
          >
            <span className="cd-tab-icon">💼</span> Jobs
          </button>
          <button
            className={`cd-tab-item ${activeTab === "about" ? "cd-tab-item--active" : ""}`}
            onClick={() => scrollToSection("sec-about", "about")}
          >
            <span className="cd-tab-icon">🏢</span> About
          </button>
          <button
            className={`cd-tab-item ${activeTab === "eligibility" ? "cd-tab-item--active" : ""}`}
            onClick={() => scrollToSection("sec-eligibility", "eligibility")}
          >
            <span className="cd-tab-icon">🛡️</span> Eligibility
          </button>
          <button
            className={`cd-tab-item ${activeTab === "attachments" ? "cd-tab-item--active" : ""}`}
            onClick={() => scrollToSection("sec-attachments", "attachments")}
          >
            <span className="cd-tab-icon">📎</span> Attachments
          </button>
        </div>
        <div className="cd-tabs-right">
          <span className="cd-status-badge cd-status-badge--active">Active</span>
        </div>
      </div>

      {/* ── 4 QUICK METRIC INFO CARDS ── */}
      <div className="cd-metric-cards-grid">
        <div className="cd-metric-card">
          <div className="cd-metric-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
            </svg>
          </div>
          <div className="cd-metric-content">
            <span className="cd-metric-label">Organisation Size</span>
            <span className="cd-metric-value">{compOrgSize}</span>
          </div>
        </div>

        <div className="cd-metric-card">
          <div className="cd-metric-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="cd-metric-content">
            <span className="cd-metric-label">Industry</span>
            <span className="cd-metric-value">{compIndustry}</span>
          </div>
        </div>

        <div className="cd-metric-card">
          <div className="cd-metric-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="cd-metric-content">
            <span className="cd-metric-label">Location</span>
            <span className="cd-metric-value">{compLocation}</span>
          </div>
        </div>

        <div className="cd-metric-card">
          <div className="cd-metric-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="cd-metric-content">
            <span className="cd-metric-label">Website</span>
            <a href={compWebsite} target="_blank" rel="noopener noreferrer" className="cd-metric-link">
              {compWebsite}
            </a>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN SECTION (NATURALLY SCROLLABLE) ── */}
      <div className="cd-content-grid">
        {/* LEFT COLUMN (~68%) */}
        <div className="cd-main-column">
          {/* 1. About the Company */}
          <div id="sec-about" className="cd-card cd-about-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
                </svg>
              </div>
              <h2 className="cd-card-title">About the Company</h2>
            </div>
            <p className="cd-about-text">{compDescription}</p>
          </div>

          {/* 2. Company Stats */}
          <div className="cd-card cd-stats-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h2 className="cd-card-title">Company Stats</h2>
            </div>
            <div className="cd-stats-row">
              <div className="cd-stat-box">
                <span className="cd-stat-number">{attachments.length}</span>
                <span className="cd-stat-label">Job Descriptions</span>
              </div>
              <div className="cd-stat-box">
                <span className="cd-stat-number">{stats.applications}</span>
                <span className="cd-stat-label">Applications</span>
              </div>
              <div className="cd-stat-box">
                <span className="cd-stat-number">{stats.interviews}</span>
                <span className="cd-stat-label">Interviews</span>
              </div>
              <div className="cd-stat-box">
                <span className="cd-stat-number">{stats.offers}</span>
                <span className="cd-stat-label">Offers</span>
              </div>
            </div>
          </div>

          {/* 3. Job Descriptions */}
          <div id="sec-jobs" className="cd-card cd-jobs-card">
            <div className="cd-card-header cd-header-with-action">
              <div className="cd-header-left">
                <div className="cd-header-icon-box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h2 className="cd-card-title">Job Descriptions ({attachments.length})</h2>
              </div>
              {isAdmin && (
                <button className="cd-btn-add-jd" onClick={openUploadModal}>
                  + Add Job Description
                </button>
              )}
            </div>

            {attachments.length === 0 ? (
              <div className="cd-empty-box">
                <div className="cd-empty-icon-wrapper">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <p className="cd-empty-title">No job descriptions available yet.</p>
                <p className="cd-empty-subtitle">Job descriptions added by the admin will appear here.</p>
              </div>
            ) : (
              <div className="cd-attachments-list">
                {attachments.map((att) => (
                  <div key={att.id} className="cd-attachment-row">
                    <div className="cd-att-icon">📄</div>
                    <div className="cd-att-info">
                      <span className="cd-att-name">{att.name}</span>
                      <span className="cd-att-meta">
                        PDF {att.fileSize ? `• ${formatFileSize(att.fileSize)}` : ""}
                        {att.uploadedAt ? ` • ${timeAgo(att.uploadedAt)}` : ""}
                      </span>
                    </div>
                    <div className="cd-att-actions">
                      <button className="btn btn-secondary cd-btn-sm" onClick={() => setViewerPdf(att)}>
                        View
                      </button>
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary cd-btn-sm" download={att.name}>
                        Download
                      </a>
                      {isAdmin && (
                        <button className="btn btn-danger-outline cd-btn-sm" onClick={() => setDeleteTarget(att)} title="Delete">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Eligibility Criteria — PRD §10: from drive data only */}
          <div id="sec-eligibility" className="cd-card cd-eligibility-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h2 className="cd-card-title">Eligibility Criteria</h2>
            </div>
            {(() => {
              const activeDrive = drives.find(d => d.isActive) || drives[0];
              const eligCriteria = activeDrive?.eligibilityCriteria || activeDrive?.eligibility;
              const eligCourses = activeDrive?.eligibleCourses;
              const hasData = (eligCriteria && eligCriteria !== "Not Specified") || (Array.isArray(eligCourses) && eligCourses.length > 0);
              if (!hasData) {
                return (
                  <div className="cd-empty-box">
                    <p className="cd-empty-title">No eligibility criteria available.</p>
                    <p className="cd-empty-subtitle">Eligibility details will appear here once a drive is created for this company.</p>
                  </div>
                );
              }
              return (
                <ul className="cd-criteria-list">
                  {Array.isArray(eligCourses) && eligCourses.length > 0 && eligCourses.map((course, i) => (
                    <li key={`course-${i}`}>
                      <span className="cd-bullet-dot" />
                      <span>{course}</span>
                    </li>
                  ))}
                  {eligCriteria && eligCriteria !== "Not Specified" && (
                    <li>
                      <span className="cd-bullet-dot" />
                      <span>{eligCriteria}</span>
                    </li>
                  )}
                </ul>
              );
            })()}
          </div>

          {/* 5. Attachments */}
          <div id="sec-attachments" className="cd-card cd-attachments-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </div>
              <h2 className="cd-card-title">Attachments ({attachments.length})</h2>
            </div>

            {attachments.length === 0 ? (
              <div className="cd-empty-box">
                <div className="cd-empty-icon-wrapper">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </div>
                <p className="cd-empty-title">No attachments available yet.</p>
                <p className="cd-empty-subtitle">PDF and document attachments will appear here.</p>
              </div>
            ) : (
              <div className="cd-attachment-cards-grid">
                {attachments.map((att) => (
                  <div key={att.id} className="cd-doc-preview-card" onClick={() => setViewerPdf(att)}>
                    <div className="cd-doc-thumbnail">
                      <div className="cd-doc-preview-canvas">
                        <div className="cd-doc-line" style={{ width: "80%" }} />
                        <div className="cd-doc-line" style={{ width: "60%" }} />
                        <div className="cd-doc-line" style={{ width: "75%" }} />
                        <div className="cd-doc-line" style={{ width: "50%" }} />
                        <div className="cd-doc-line" style={{ width: "90%" }} />
                        <div className="cd-doc-line" style={{ width: "65%" }} />
                      </div>
                      <span className="cd-doc-pdf-tag">📄</span>
                    </div>
                    <div className="cd-doc-meta">
                      <span className="cd-doc-name" title={att.name}>
                        {att.name.length > 22 ? att.name.slice(0, 20) + "..." : att.name}
                      </span>
                      <span className="cd-doc-size">
                        PDF • {formatFileSize(att.fileSize) || "245 KB"}
                      </span>
                    </div>
                    <div className="cd-doc-menu-btn" onClick={(e) => { e.stopPropagation(); setViewerPdf(att); }}>
                      ⋮
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN / SIDEBAR (~32%) */}
        <div className="cd-side-column">
          {/* Apply & Website Action Buttons */}
          <div className="cd-action-buttons-card">
            {hasAppliedToDrive ? (
              <button className="cd-btn-apply-primary cd-btn-applied" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Applied
              </button>
            ) : (
              <button className="cd-btn-apply-primary" onClick={handleApply} disabled={applying}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {applying ? "Applying..." : "Apply Now"}
              </button>
            )}
            {applySuccess && (
              <div className="cd-apply-feedback">
                ✓ Application submitted successfully!
              </div>
            )}
            <a href={compWebsite} target="_blank" rel="noopener noreferrer" className="cd-btn-view-website">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View Company Website ↗
            </a>
          </div>

          {/* Registration Schedule — PRD §9: from drive data only */}
          <div className="cd-card cd-side-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="cd-side-card-title">Registration Schedule</h3>
            </div>
            {(() => {
              const activeDrive = drives.find(d => d.isActive) || drives[0];
              const opens = activeDrive?.registrationOpensAt;
              const closes = activeDrive?.registrationClosesAt || activeDrive?.deadline;
              const hasData = (opens && opens !== "Not Specified") || (closes && closes !== "Not Specified");
              if (!hasData) {
                return (
                  <div className="cd-empty-box" style={{ padding: "12px" }}>
                    <p className="cd-empty-title" style={{ fontSize: "13px" }}>No schedule available.</p>
                  </div>
                );
              }
              return (
                <div className="cd-schedule-list">
                  {opens && opens !== "Not Specified" && (
                    <div className="cd-schedule-item">
                      <span className="cd-schedule-label">Opens</span>
                      <span className="cd-schedule-value">{opens}</span>
                    </div>
                  )}
                  {closes && closes !== "Not Specified" && (
                    <div className="cd-schedule-item">
                      <span className="cd-schedule-label">Closes</span>
                      <span className="cd-schedule-value">{closes}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Company Details */}
          <div className="cd-card cd-side-card">
            <div className="cd-card-header">
              <div className="cd-header-icon-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </div>
              <h3 className="cd-side-card-title">Company Details</h3>
            </div>
            <div className="cd-detail-rows">
              <div className="cd-detail-row">
                <span className="cd-detail-label">Industry</span>
                <span className="cd-detail-val">{compIndustry}</span>
              </div>
              <div className="cd-detail-row">
                <span className="cd-detail-label">Organisation Size</span>
                <span className="cd-detail-val">{compOrgSize}</span>
              </div>
              <div className="cd-detail-row">
                <span className="cd-detail-label">Location</span>
                <span className="cd-detail-val">{compLocation}</span>
              </div>
              <div className="cd-detail-row">
                <span className="cd-detail-label">Website</span>
                <a href={compWebsite} target="_blank" rel="noopener noreferrer" className="cd-side-link">
                  {compWebsite}
                </a>
              </div>
              <div className="cd-detail-row">
                <span className="cd-detail-label">Status</span>
                <span className="cd-status-badge cd-status-badge--active">Active</span>
              </div>
              <div className="cd-detail-row">
                <span className="cd-detail-label">Registered On</span>
                <span className="cd-detail-val">{timeAgo(company?.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions (Admin / Owner) */}
          {isAdmin && (
            <div className="cd-card cd-side-card">
              <div className="cd-card-header">
                <div className="cd-header-icon-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <h3 className="cd-side-card-title">Quick Actions</h3>
              </div>
              <div className="cd-quick-actions-btns">
                <button className="cd-btn-quick-edit" onClick={openEditModal}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Company
                </button>
                <button className="cd-btn-quick-delete" onClick={() => setDeleteCompanyConfirm(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Delete Company
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
