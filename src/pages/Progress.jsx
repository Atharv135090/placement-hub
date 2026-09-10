import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getJobs, getMyApplications } from "../services/firestore";
import "./Progress.css";

export default function Progress() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeFilter, setTimeFilter] = useState("this_year");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [jobRes, appRes] = await Promise.all([
        getJobs(), getMyApplications(user.uid),
      ]);
      if (jobRes.error) {
        setError("Unable to load progress data. Try again.");
        setLoading(false);
        return;
      }
      setJobs(jobRes.data || []);
      setApplications(appRes.data || []);
      setLoading(false);
    }
    load();
  }, [user.uid]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const submitted = applications.filter((a) => ["applied", "shortlisted", "offer", "selected"].includes(a.status)).length;
    const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
    const offer = applications.filter((a) => a.status === "offer" || a.status === "selected").length;
    const rejected = applications.filter((a) => a.status === "rejected").length;
    const notApplied = Math.max(0, total - submitted);
    return { total, submitted, shortlisted, offer, selected: offer, rejected, notApplied };
  }, [jobs, applications]);

  // Package distribution calculation
  const packageDist = useMemo(() => {
    const buckets = { "< 4": 0, "4-6": 0, "6-8": 0, "8-10": 0, "> 10": 0 };
    jobs.forEach((j) => {
      const match = (j.ctc || "").match(/(\d+(\.\d+)?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val < 4) buckets["< 4"]++;
        else if (val <= 6) buckets["4-6"]++;
        else if (val <= 8) buckets["6-8"]++;
        else if (val <= 10) buckets["8-10"]++;
        else buckets["> 10"]++;
      } else {
        buckets["4-6"]++; // fallback default representation
      }
    });
    return buckets;
  }, [jobs]);

  if (error) {
    return <div className="pg-page"><div className="pg-error glass"><p>{error}</p></div></div>;
  }

  return (
    <div className="pg-page animate-fade-in">
      <div className="pg-header">
        <div>
          <h1 className="page-title">My Progress</h1>
          <p className="page-subtitle">Your placement journey in numbers.</p>
        </div>

        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="select-field">
          <option value="this_year">This Year</option>
          <option value="all_time">All Time</option>
        </select>
      </div>

      {loading ? (
        <div className="pg-loading">
          <div className="skeleton-card" style={{ height: 100 }} />
          <div className="skeleton-card" style={{ height: 260 }} />
        </div>
      ) : (
        <>
          {/* Top 4 Stat Cards */}
          <div className="pg-stats-grid">
            <div className="pg-stat-card glass">
              <div className="pg-stat-val">{stats.total}</div>
              <div className="pg-stat-lbl">Companies Tracked</div>
            </div>
            <div className="pg-stat-card glass">
              <div className="pg-stat-val emerald">{stats.submitted}</div>
              <div className="pg-stat-lbl">Applications Submitted</div>
            </div>
            <div className="pg-stat-card glass">
              <div className="pg-stat-val amber">{stats.shortlisted}</div>
              <div className="pg-stat-lbl">Shortlisted</div>
            </div>
            <div className="pg-stat-card glass">
              <div className="pg-stat-val purple">{stats.selected}</div>
              <div className="pg-stat-lbl">Selected</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="pg-charts-grid">
            {/* Left Donut Ring Chart */}
            <div className="pg-chart-card glass">
              <h3 className="chart-title">Application Status</h3>
              
              <div className="donut-wrapper">
                <div className="donut-visual">
                  <div className="donut-center">
                    <span className="dc-val">{stats.total}</span>
                    <span className="dc-lbl">Total</span>
                  </div>
                </div>

                <div className="donut-legend">
                  <div className="legend-item">
                    <span className="legend-dot dot-not-applied" />
                    <span className="legend-name">Not Applied</span>
                    <span className="legend-val">{stats.notApplied}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-submitted" />
                    <span className="legend-name">Submitted</span>
                    <span className="legend-val">{stats.submitted}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-shortlisted" />
                    <span className="legend-name">Shortlisted</span>
                    <span className="legend-val">{stats.shortlisted}</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot dot-selected" />
                    <span className="legend-name">Selected</span>
                    <span className="legend-val">{stats.selected}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Bar Chart Visual */}
            <div className="pg-chart-card glass">
              <h3 className="chart-title">Package Distribution</h3>

              <div className="bar-chart-visual">
                {Object.entries(packageDist).map(([range, count]) => {
                  const maxCount = Math.max(...Object.values(packageDist), 1);
                  const heightPct = Math.round((count / maxCount) * 100);

                  return (
                    <div key={range} className="bar-col">
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ height: `${Math.max(heightPct, 15)}%` }}
                        />
                      </div>
                      <span className="bar-label">{range} LPA</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Motivational Bottom Banner */}
          <div className="pg-banner glass">
            <span>Progress is a series of small wins. Keep going.</span>
            <span className="banner-arrow">➔</span>
          </div>
        </>
      )}
    </div>
  );
}
