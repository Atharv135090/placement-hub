import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getCompany,
  getAllApplications,
  getAttachmentsByCompany,
  uploadJobAttachment,
  deleteAttachment,
  deleteCompany,
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

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = dateStr?.seconds ? new Date(dateStr.seconds * 1000) : new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function CompanyDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileInputRef = useRef(null);

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const [company, setCompany] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [stats, setStats] = useState({ applications: 0, interviews: 0, offers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    const [attRes, appsRes] = await Promise.all([
      getAttachmentsByCompany(companyId),
      getAllApplications(),
    ]);
    setAttachments(attRes.data || []);

    const apps = (appsRes.data || []).filter(a => a.companyId === companyId || a.companyName === data.name);
    setStats({
      applications: apps.length,
      interviews: apps.filter(a => a.status === "interview").length,
      offers: apps.filter(a => a.status === "offer" || a.status === "selected").length,
    });
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

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
      setAttachments(prev => [data, ...prev]);
      setUploadSuccess(true);
      setTimeout(() => { setUploadModal(false); setUploadSuccess(false); }, 1200);
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
      setAttachments(prev => prev.filter(a => a.id !== deleteTarget.id));
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

  if (loading) {
    return (
      <div className="cd-page">
        <div className="cd-loading">
          <div className="skeleton-card" style={{ height: 140 }} />
          <div className="skeleton-card" style={{ height: 100 }} />
          <div className="skeleton-card" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cd-page">
        <div className="cd-error glass">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => navigate("/companies")}>← Back to Companies</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-page animate-fade-in">
      {deleteTarget && (
        <div className="cd-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cd-modal glass-heavy" onClick={e => e.stopPropagation()}>
            <h3 className="cd-modal-title">Delete Job Description?</h3>
            <p className="cd-modal-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="cd-modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteJD} disabled={deleteBusy}>
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCompanyConfirm && (
        <div className="cd-modal-overlay" onClick={() => setDeleteCompanyConfirm(false)}>
          <div className="cd-modal glass-heavy" onClick={e => e.stopPropagation()}>
            <h3 className="cd-modal-title">Delete Company?</h3>
            <p className="cd-modal-text">
              Are you sure you want to delete <strong>{company?.name}</strong>?
              This will also remove {attachments.length} document(s). This action cannot be undone.
            </p>
            <div className="cd-modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteCompanyConfirm(false)} disabled={deletingCompany}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteCompany} disabled={deletingCompany}>
                {deletingCompany ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadModal && (
        <div className="cd-modal-overlay" onClick={() => { if (!uploadBusy) setUploadModal(false); }}>
          <div className="cd-modal glass-heavy" onClick={e => e.stopPropagation()}>
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
                  <button className="btn btn-secondary" onClick={() => setUploadModal(false)} disabled={uploadBusy}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpload} disabled={!uploadFile || uploadBusy}>
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
          <div className="cd-pdf-viewer-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-pdf-viewer-header">
              <span className="cd-pdf-viewer-title">{viewerPdf.name}</span>
              <div className="cd-pdf-viewer-actions">
                <a href={viewerPdf.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" download={viewerPdf.name}>Download</a>
                <button className="btn btn-secondary" onClick={() => setViewerPdf(null)}>Close</button>
              </div>
            </div>
            <iframe src={viewerPdf.fileUrl} title={viewerPdf.name} className="cd-pdf-iframe" />
          </div>
        </div>
      )}

      <div className="cd-top-bar">
        <button className="btn btn-secondary" onClick={() => navigate("/companies")}>← Back</button>
        {isAdmin && (
          <div className="cd-top-actions">
            <button className="btn btn-danger-outline" onClick={() => setDeleteCompanyConfirm(true)}>Delete Company</button>
          </div>
        )}
      </div>

      <div className="cd-hero glass">
        <div className="cd-hero-left">
          <div className="cd-logo-box">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="" className="cd-logo" onError={e => { e.target.style.display = "none"; }} />
            ) : null}
            <CompanyLogo name={company?.name} logoUrl={company?.logoUrl} size={64} />
          </div>
          <div className="cd-hero-info">
            <h1 className="cd-company-name">{company?.name}</h1>
            {company?.industry && <p className="cd-industry">{company.industry}</p>}
            {company?.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="cd-website-link">
                {company.website.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
          </div>
        </div>
        <div className="cd-hero-right">
          <span className={`cd-reg-status cd-reg-status--${company?.isActive !== false ? "open" : "closed"}`}>
            {company?.isActive !== false ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="cd-stats-strip glass">
        <div className="cd-stat-item">
          <strong>{attachments.length}</strong>
          <span>Job Descriptions</span>
        </div>
        <div className="cd-stat-sep" />
        <div className="cd-stat-item">
          <strong>{stats.applications}</strong>
          <span>Applications</span>
        </div>
        <div className="cd-stat-sep" />
        <div className="cd-stat-item">
          <strong className="text-amber">{stats.interviews}</strong>
          <span>Interviews</span>
        </div>
        <div className="cd-stat-sep" />
        <div className="cd-stat-item">
          <strong className="text-emerald">{stats.offers}</strong>
          <span>Offers</span>
        </div>
      </div>

      <div className="cd-overview-grid">
        <div className="cd-main-col">
          {company?.description && (
            <div className="cd-section glass">
              <h2 className="cd-section-title">About</h2>
              <p className="cd-section-text">{company.description}</p>
            </div>
          )}

          <div className="cd-section glass">
            <div className="cd-section-header">
              <h2 className="cd-section-title">Job Descriptions ({attachments.length})</h2>
              {isAdmin && (
                <button className="btn btn-primary cd-add-jd-btn" onClick={openUploadModal}>
                  + Add Job Description
                </button>
              )}
            </div>

            {attachments.length === 0 ? (
              <p className="cd-section-text cd-empty-text">No job descriptions uploaded yet.</p>
            ) : (
              <div className="cd-attachments-list">
                {attachments.map(att => (
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
                      <button className="btn btn-secondary" onClick={() => setViewerPdf(att)}>View</button>
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" download={att.name}>Download</a>
                      {isAdmin && (
                        <button className="btn btn-danger-outline" onClick={() => setDeleteTarget(att)} title="Delete">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cd-side-col">
          <div className="cd-side-card glass">
            <h3 className="cd-side-title">Company Details</h3>
            {company?.location && (
              <div className="sched-row"><span>Location</span><strong>{company.location}</strong></div>
            )}
            {company?.organisationSize && (
              <div className="sched-row"><span>Org Size</span><strong>{company.organisationSize}</strong></div>
            )}
            {company?.contactEmail && (
              <div className="sched-row"><span>Contact</span><strong>{company.contactEmail}</strong></div>
            )}
            {company?.website && (
              <div className="sched-row">
                <span>Website</span>
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="cd-side-link">
                  {company.website.replace(/^https?:\/\//, "")} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
