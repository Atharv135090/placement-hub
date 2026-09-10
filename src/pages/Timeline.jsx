import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCompanies } from "../services/firestore";
import LogoFallback from "../components/LogoFallback";
import "./Timeline.css";

export default function Timeline() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const compRes = await getCompanies();
      if (compRes.error) {
        setError("Unable to load data. Try again.");
        setLoading(false);
        return;
      }
      setCompanies(compRes.data || []);
      setLoading(false);
    }
    load();
  }, [user.uid]);

  if (loading) {
    return (
      <div className="timeline-page animate-fade-in">
        <div className="timeline-loading">
          <div className="skeleton-card" style={{ height: 120 }} />
          <div className="skeleton-card" style={{ height: 120 }} />
          <div className="skeleton-card" style={{ height: 120 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timeline-page animate-fade-in">
        <div className="timeline-error glass">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-page animate-fade-in">
      <div className="timeline-header">
        <h1 className="page-title">Companies</h1>
        <p className="page-subtitle">Browse all available companies.</p>
      </div>

      {companies.length === 0 ? (
        <div className="timeline-empty glass">
          <h3>No companies found</h3>
          <p>Add companies through the Admin Assistant or Companies page.</p>
        </div>
      ) : (
        <div className="timeline-list">
          {companies.map(c => (
            <Link key={c.id} to={`/companies/${c.id}`} className="timeline-item glass">
              <div className="timeline-item-left">
                <LogoFallback name={c.name} size={40} />
                <div>
                  <h4>{c.name}</h4>
                  <span>{c.industry || "N/A"} • {c.location || "N/A"}</span>
                </div>
              </div>
              <span className={`timeline-status ${c.isActive !== false ? "timeline-status--active" : "timeline-status--inactive"}`}>
                {c.isActive !== false ? "Active" : "Inactive"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
