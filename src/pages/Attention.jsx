import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCompanies, getMyApplications } from "../services/firestore";
import LogoFallback from "../components/LogoFallback";
import "./Attention.css";

export default function Attention() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [compRes, appRes] = await Promise.all([
        getCompanies(), getMyApplications(user.uid),
      ]);
      if (compRes.error) {
        setError("Unable to load attention items. Try again.");
        setLoading(false);
        return;
      }
      setCompanies(compRes.data || []);
      setApplications(appRes.data || []);
      setLoading(false);
    }
    load();
  }, [user.uid]);

  const companyMap = useMemo(() => {
    const map = {};
    companies.forEach((c) => { map[c.id] = c; });
    return map;
  }, [companies]);

  const attentionItems = useMemo(() => {
    const items = [];

    applications.forEach((app) => {
      const company = companies.find(c => c.name === app.companyName || c.id === app.companyId);

      if (app.status === "shortlisted") {
        items.push({
          id: `shortlisted-${app.id}`,
          type: "status",
          urgency: "high",
          title: `${company?.name || app.companyName || "Company"} application shortlisted`,
          desc: "Great! Keep an eye out for further process and interview updates.",
          daysBadge: "Shortlisted",
          company,
        });
      }

      if (app.status === "interview") {
        items.push({
          id: `interview-${app.id}`,
          type: "status",
          urgency: "critical",
          title: `${company?.name || app.companyName || "Company"} interview scheduled`,
          desc: "Prepare well and make sure you're ready for the interview.",
          daysBadge: "Interview",
          company,
        });
      }

      if (app.status === "offer" || app.status === "selected") {
        items.push({
          id: `offer-${app.id}`,
          type: "status",
          urgency: "low",
          title: `${company?.name || app.companyName || "Company"} offer received`,
          desc: "Congratulations! Review the offer details carefully.",
          daysBadge: "Offer",
          company,
        });
      }
    });

    if (filter !== "all") {
      return items.filter((i) => i.type === filter);
    }
    return items;
  }, [applications, companies, filter]);

  if (error) {
    return <div className="at-page"><div className="at-error glass"><p>{error}</p></div></div>;
  }

  return (
    <div className="at-page animate-fade-in">
      <div className="at-header">
        <div>
          <h1 className="page-title">Attention Center</h1>
          <p className="page-subtitle">Critical deadlines, updates, and application status alerts.</p>
        </div>

        <div className="at-filter-pills glass">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "upcoming" ? "active" : ""} onClick={() => setFilter("upcoming")}>Upcoming</button>
          <button className={filter === "deadlines" ? "active" : ""} onClick={() => setFilter("deadlines")}>Deadlines</button>
          <button className={filter === "status" ? "active" : ""} onClick={() => setFilter("status")}>Status Updates</button>
        </div>
      </div>

      {loading ? (
        <div className="at-list">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" style={{ height: 80 }} />)}
        </div>
      ) : attentionItems.length === 0 ? (
        <div className="at-empty glass">
          <div className="empty-icon">✓</div>
          <h3>All clear!</h3>
          <p>No urgent reminders or pending action items at this moment.</p>
        </div>
      ) : (
        <div className="at-list">
          {attentionItems.map((item) => (
            <Link to={`/companies/${item.jobId}`} key={item.id} className={`at-card glass at-${item.urgency}`} state={{ from: "/attention" }}>
              <div className="at-card-left">
                <span className={`at-urgency-dot dot-${item.urgency}`} />
                <div className="at-logo-box">
                  {item.company?.logoUrl ? (
                    <img src={item.company.logoUrl} alt="" className="at-logo" />
                  ) : (
                    <LogoFallback name={item.company?.name || "C"} size={32} />
                  )}
                </div>
                <div className="at-info">
                  <h3 className="at-title">{item.title}</h3>
                  <p className="at-desc">{item.desc}</p>
                </div>
              </div>

              <div className="at-card-right">
                <span className={`days-pill pill-${item.urgency}`}>{item.daysBadge}</span>
                <span className="at-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
