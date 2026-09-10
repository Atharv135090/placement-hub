import "./Placeholder.css";

export default function Placeholder({ title, icon, description }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <span className="placeholder-badge">Coming Soon</span>
    </div>
  );
}
