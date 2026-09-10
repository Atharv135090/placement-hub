import { useState, useMemo } from "react";
import "./Resources.css";

const RESOURCE_ITEMS = [
  {
    id: "res-dsa",
    title: "DSA Roadmap",
    category: "DSA",
    description: "Complete DSA preparation plan with topic-wise problem sets and milestones.",
    type: "PDF",
    meta: "PDF • 12 MB",
    badgeColor: "#ef4444",
    linkText: "Download Plan",
  },
  {
    id: "res-aptitude",
    title: "Aptitude Notes",
    category: "Aptitude",
    description: "Important formulas, speed math shortcuts, and previous placement questions.",
    type: "PDF",
    meta: "PDF • 8 MB",
    badgeColor: "#3b82f6",
    linkText: "Download Notes",
  },
  {
    id: "res-resume",
    title: "Resume Guide",
    category: "Interview",
    description: "Build a strong ATS-compliant resume with industry-approved templates.",
    type: "PDF",
    meta: "PDF • 5 MB",
    badgeColor: "#10b981",
    linkText: "Download Guide",
  },
  {
    id: "res-interview-exp",
    title: "Interview Experiences",
    category: "Interview",
    description: "Real interview walkthroughs and round-by-round tips from placed alumni.",
    type: "Article",
    meta: "Article • 8 min read",
    badgeColor: "#8b5cf6",
    linkText: "Read Experience",
  },
  {
    id: "res-company-wise",
    title: "Company Wise Questions",
    category: "Interview",
    description: "Frequently repeated coding, aptitude, and managerial questions by company.",
    type: "Article",
    meta: "Article • 12 min read",
    badgeColor: "#06b6d4",
    linkText: "View Questions",
  },
  {
    id: "res-system-design",
    title: "System Design Basics",
    category: "System Design",
    description: "Learn core architectural concepts: scalability, load balancers, caching & SQL/NoSQL.",
    type: "Article",
    meta: "Article • 15 min read",
    badgeColor: "#f59e0b",
    linkText: "Read Article",
  },
];

const CATEGORIES = ["All", "DSA", "Aptitude", "Interview", "System Design"];

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [downloadModal, setDownloadModal] = useState(null);

  const filtered = useMemo(() => {
    return RESOURCE_ITEMS.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, search]);

  return (
    <div className="resources-page animate-fade-in">
      {/* ─── Header ─── */}
      <div className="resources-header">
        <div className="resources-title-group">
          <div className="resources-icon-badge">📚</div>
          <div>
            <h1 className="resources-title">Resources</h1>
            <p className="resources-subtitle">Prepare. Learn. Get Placed.</p>
          </div>
        </div>

        {/* Search */}
        <div className="resources-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search guides, notes, articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Category Filter Pills ─── */}
      <div className="resources-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`resources-cat-btn ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ─── Resource Cards Grid ─── */}
      <div className="resources-grid">
        {filtered.map((item) => (
          <div key={item.id} className="resource-card glass">
            <div className="resource-card-top">
              <div
                className="resource-card-icon"
                style={{ background: `${item.badgeColor}18`, color: item.badgeColor }}
              >
                {item.type === "PDF" ? "📄" : "📖"}
              </div>
              <span
                className="resource-card-cat-badge"
                style={{ background: `${item.badgeColor}18`, color: item.badgeColor }}
              >
                {item.category}
              </span>
            </div>

            <h3 className="resource-card-title">{item.title}</h3>
            <p className="resource-card-desc">{item.description}</p>

            <div className="resource-card-footer">
              <span className="resource-card-meta">{item.meta}</span>
              <button
                type="button"
                className="resource-action-btn"
                onClick={() => setDownloadModal(item)}
              >
                {item.linkText} ➔
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Modal / Notification ─── */}
      {downloadModal && (
        <div className="modal-overlay" onClick={() => setDownloadModal(null)}>
          <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">{downloadModal.title}</h2>
              <button className="modal-close" onClick={() => setDownloadModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>
                {downloadModal.type === "PDF" ? "📥" : "📖"}
              </div>
              <h3 style={{ margin: "0 0 8px 0" }}>{downloadModal.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "20px" }}>
                {downloadModal.description}
              </p>
              <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: "9999px", background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.82rem", fontWeight: "600", marginBottom: "24px" }}>
                {downloadModal.meta}
              </div>
              <div className="modal-actions" style={{ justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setDownloadModal(null)}>
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    alert(`Starting download for ${downloadModal.title}`);
                    setDownloadModal(null);
                  }}
                >
                  Download Resource
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
