import { useState, useMemo } from "react";
import { usePlacementData } from "../contexts/PlacementDataContext";
import LogoFallback from "../components/LogoFallback";
import "../components/Modal.css";
import "./Calendar.css";

const EVENT_COLORS = {
  test: "red",
  oa: "amber",
  interview: "blue",
  technical: "blue",
  hr: "purple",
  deadline: "red",
  other: "gray",
};

export default function Calendar() {
  const { applications } = usePlacementData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const calendarEvents = useMemo(() => {
    const defaultEvents = [];

    const dynamicEvents = [];

    applications.forEach((app, idx) => {
      const baseDate = app.appliedAt ? new Date(app.appliedAt) : new Date();
      
      // If interview status, schedule interview event
      if (app.status === "interview") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (idx % 3 + 2));
        dynamicEvents.push({
          id: `int_${app.id}`,
          title: `Interview — ${app.companyName}`,
          time: "02:30 PM",
          day: d.getDate(),
          month: d.getMonth(),
          year: d.getFullYear(),
          type: "interview",
          company: app.companyName,
          role: app.role,
          color: EVENT_COLORS.interview,
          location: "Online",
        });
      }

      // If shortlisted status, schedule online assessment
      if (app.status === "shortlisted") {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (idx % 2 + 1));
        dynamicEvents.push({
          id: `oa_${app.id}`,
          title: `OA — ${app.companyName}`,
          time: "06:00 PM",
          day: d.getDate(),
          month: d.getMonth(),
          year: d.getFullYear(),
          type: "oa",
          company: app.companyName,
          role: app.role,
          color: EVENT_COLORS.oa,
          location: "HackerEarth / Mettl",
        });
      }
    });

    return [...defaultEvents, ...dynamicEvents];
  }, [applications, month, year]);

  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }
  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function goToToday() { setCurrentDate(new Date()); }

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({ dayNumber: daysInPrevMonth - i, isCurrentMonth: false, month: month - 1, year });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = calendarEvents.filter(e => e.day === d && e.month === month && e.year === year);
    calendarDays.push({ dayNumber: d, isCurrentMonth: true, month, year, events: dayEvents });
  }
  const remaining = 35 - calendarDays.length;
  if (remaining > 0) {
    for (let d = 1; d <= remaining; d++) {
      calendarDays.push({ dayNumber: d, isCurrentMonth: false, month: month + 1, year });
    }
  }

  const isToday = (cell) => cell.isCurrentMonth && cell.dayNumber === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="calendar-page animate-fade-in">
      <div className="calendar-header">
        <div className="cal-header-left">
          <div className="cal-icon-badge">📅</div>
          <div>
            <h1 className="page-title">Placement Calendar</h1>
            <p className="page-subtitle">Stay on top of your interviews, tests and deadlines.</p>
          </div>
        </div>
        <div className="cal-view-toggle glass">
          <button className={`toggle-btn ${viewMode === "month" ? "active" : ""}`} onClick={() => setViewMode("month")}>Month</button>
          <button className={`toggle-btn ${viewMode === "week" ? "active" : ""}`} onClick={() => setViewMode("week")}>Week</button>
          <button className={`toggle-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>List</button>
        </div>
      </div>

      <div className="cal-controls-bar glass">
        <div className="cal-nav-left">
          <button className="btn btn-secondary today-btn" onClick={goToToday}>Today</button>
          <div className="cal-arrows">
            <button className="arrow-btn" onClick={prevMonth}>‹</button>
            <button className="arrow-btn" onClick={nextMonth}>›</button>
          </div>
          <h2 className="current-month-heading">{monthNames[month]} {year}</h2>
        </div>
        <div className="cal-legend">
          <span className="legend-item"><span className="legend-dot dot-red" /> Tests & Deadlines</span>
          <span className="legend-item"><span className="legend-dot dot-amber" /> Assessments</span>
          <span className="legend-item"><span className="legend-dot dot-blue" /> Interviews</span>
        </div>
      </div>

      {viewMode === "month" && (
        <div className="calendar-grid-wrapper glass">
          <div className="weekday-header">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
          <div className="month-cells-grid">
            {calendarDays.map((cell, idx) => (
              <div key={idx} className={`cal-day-cell ${cell.isCurrentMonth ? "in-month" : "out-month"} ${isToday(cell) ? "today-cell" : ""}`}>
                <div className="day-number-row">
                  <span className={`day-number ${isToday(cell) ? "today-marker" : ""}`}>{cell.dayNumber}</span>
                </div>
                <div className="day-events-list">
                  {cell.events?.map((evt) => (
                    <div key={evt.id} className={`event-chip chip-${evt.color}`} onClick={() => setSelectedEvent(evt)}>
                      <span className="chip-title">{evt.title}</span>
                      <span className="chip-time">{evt.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {calendarEvents.length === 0 && (
            <p style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "0.84rem" }}>
              No upcoming placement events. Events will appear when you have application deadlines or drives.
            </p>
          )}
        </div>
      )}

      {viewMode !== "month" && (
        <div className="calendar-list-view glass">
          <h3>Scheduled Events for {monthNames[month]} {year}</h3>
          <div className="cal-list-items">
            {calendarEvents.filter(e => e.month === month && e.year === year).map((evt) => (
              <div key={evt.id} className="cal-list-item glass-card" onClick={() => setSelectedEvent(evt)}>
                <div className="list-date-badge">
                  <span className="ldb-day">{evt.day}</span>
                  <span className="ldb-month">{monthNames[evt.month].slice(0, 3)}</span>
                </div>
                <div className="list-info">
                  <h4>{evt.title}</h4>
                  <p>{evt.role} • {evt.location}</p>
                </div>
                <div className="list-time-badge">
                  <span>{evt.time}</span>
                </div>
              </div>
            ))}
            {calendarEvents.filter(e => e.month === month && e.year === year).length === 0 && (
              <p style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
                {calendarEvents.length === 0
                  ? "No placement events yet. Events will appear when you have application deadlines or drives."
                  : "No events this month."}
              </p>
            )}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-panel glass-heavy" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">{selectedEvent.title}</h2>
              <button className="modal-close" onClick={() => setSelectedEvent(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <LogoFallback name={selectedEvent.company} size={40} />
                <div>
                  <strong style={{ fontSize: "1rem" }}>{selectedEvent.company}</strong>
                  <span style={{ display: "block", fontSize: "0.82rem", color: "var(--text-muted)" }}>{selectedEvent.role}</span>
                </div>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong>Time:</strong> {selectedEvent.time}, {selectedEvent.day} {monthNames[selectedEvent.month]} {selectedEvent.year}<br />
                <strong>Location:</strong> {selectedEvent.location}<br />
                <strong>Type:</strong> {selectedEvent.type}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setSelectedEvent(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
