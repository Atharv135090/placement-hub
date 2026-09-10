import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlacementData } from "../contexts/PlacementDataContext";
import LogoFallback from "../components/LogoFallback";
import "./AddCompany.css";

const INITIAL_STATE = {
  name: "",
  industry: "",
  location: "",
  website: "",
  contactEmail: "",
  organisationSize: "",
  description: "",
};

export default function AddCompany() {
  const navigate = useNavigate();
  const { addNewCompany } = usePlacementData();
  const [form, setForm] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Company name is required";
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      errs.website = "Enter a valid URL starting with http:// or https://";
    }
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errs.contactEmail = "Enter a valid email address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function getCompanyLogoUrl(name, website) {
    if (website) {
      try {
        const url = new URL(website.startsWith("http") ? website : `https://${website}`);
        const domain = url.hostname.replace("www.", "");
        return `https://logo.clearbit.com/${domain}`;
      } catch { /* ignore */ }
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e1e2e&color=ef4444&bold=true&size=128`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    const logoUrl = getCompanyLogoUrl(form.name.trim(), form.website.trim());
    const result = await addNewCompany({
      name: form.name.trim(),
      industry: form.industry.trim(),
      location: form.location.trim(),
      website: form.website.trim(),
      contactEmail: form.contactEmail.trim(),
      organisationSize: form.organisationSize.trim(),
      description: form.description.trim(),
      logoUrl,
      isActive: true,
    });
    setSaving(false);

    if (result.error) {
      if (result.error === "exists") {
        setErrors({ submit: "A company with this name already exists." });
      } else {
        setErrors({ submit: "Failed to save. Please try again." });
      }
      return;
    }

    navigate(`/companies/${result.data.id}`);
  }

  return (
    <div className="add-company-page animate-fade-in">
      <div className="ac-header">
        <div>
          <h1 className="page-title">Add Company</h1>
          <p className="page-subtitle">Add a new company to the placement portal.</p>
        </div>
      </div>

      <form className="ac-form glass" onSubmit={handleSubmit}>
        {errors.submit && <div className="ac-error-banner">{errors.submit}</div>}

        <div className="ac-section">
          <h2 className="ac-section-title">
            <span className="ac-section-num">1</span> Company Information
          </h2>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Company Name *</label>
              <input
                type="text"
                className={`input-field ${errors.name ? "ac-input-error" : ""}`}
                placeholder="Enter company name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {errors.name && <span className="ac-field-error">{errors.name}</span>}
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Industry</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. IT / Software, Finance, Manufacturing"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              />
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Location</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Pune, Bangalore, Remote"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Website</label>
              <input
                type="url"
                className={`input-field ${errors.website ? "ac-input-error" : ""}`}
                placeholder="https://company.com"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
              {errors.website && <span className="ac-field-error">{errors.website}</span>}
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Contact Email</label>
              <input
                type="email"
                className={`input-field ${errors.contactEmail ? "ac-input-error" : ""}`}
                placeholder="hr@company.com"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
              {errors.contactEmail && <span className="ac-field-error">{errors.contactEmail}</span>}
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Organisation Size</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1000+, 50-200"
                value={form.organisationSize}
                onChange={(e) => set("organisationSize", e.target.value)}
              />
            </div>
          </div>

          <div className="ac-row">
            <div className="ac-field ac-field--grow">
              <label className="ac-label">Description</label>
              <textarea
                className="input-field ac-textarea"
                placeholder="Brief description about the company..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="ac-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/companies")}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Add Company"}
          </button>
        </div>
      </form>
    </div>
  );
}
