import { useState } from "react";

const KNOWN_BRANDS = [
  { match: (n) => n.includes("tcs") || n.includes("tata consultancy"), bg: "#0070ad", label: "tcs", color: "#fff", weight: 800 },
  { match: (n) => n.includes("accenture"), bg: "#7928ca", label: "A", color: "#fff", weight: 800, svg: "accenture" },
  { match: (n) => n.includes("deloitte"), bg: "#000000", label: "D.", color: "#fff", weight: 900 },
  { match: (n) => n.includes("infosys"), bg: "#007cc3", label: "Infosys", color: "#fff", weight: 700 },
  { match: (n) => n.includes("capgemini"), bg: "#ffffff", label: "cap", color: "#0070ad", weight: 700, border: "#e2e8f0" },
  { match: (n) => n.includes("wipro"), bg: "#ffffff", label: "wipro", color: "#1e293b", weight: 700, border: "#e2e8f0" },
  { match: (n) => n.includes("cognizant"), bg: "#000048", label: "C", color: "#00a3e0", weight: 800 },
  { match: (n) => n.includes("tech mahindra") || n.includes("mahindra"), bg: "#e41f26", label: "m", color: "#fff", weight: 900 },
  { match: (n) => n.includes("google"), bg: "#ffffff", label: "G", color: "#4285F4", weight: 800, border: "#e2e8f0" },
  { match: (n) => n.includes("microsoft"), bg: "#181d2a", label: "M", color: "#00a4ef", weight: 800 },
  { match: (n) => n.includes("amazon"), bg: "#000000", label: "a", color: "#ff9900", weight: 900 },
  { match: (n) => n.includes("eq") || n.includes("technologic"), bg: "#7c3aed", label: "eQ", color: "#fff", weight: 900 },
  { match: (n) => n.includes("intel"), bg: "#0068b5", label: "intel", color: "#fff", weight: 800 },
];

function getInitialFallback(name, size) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 40) % 360}, 75%, 35%))`,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.38,
        letterSpacing: "-0.03em",
        flexShrink: 0,
        boxShadow: `0 2px 8px hsla(${hue}, 60%, 40%, 0.3)`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

export default function CompanyLogo({ name = "", logoUrl, size = 46, className = "" }) {
  const normalized = (name || "").toLowerCase().trim();
  const [imgFailed, setImgFailed] = useState(false);

  if (logoUrl && !imgFailed) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <img
          src={logoUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  const brand = KNOWN_BRANDS.find((b) => b.match(normalized));
  if (brand) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: brand.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: brand.border ? `1px solid ${brand.border}` : undefined,
          boxShadow: `0 2px 6px rgba(0,0,0,0.15)`,
        }}
        title={name}
      >
        <span style={{ color: brand.color, fontWeight: brand.weight, fontSize: size * 0.4, letterSpacing: "-0.04em", fontFamily: "system-ui, sans-serif" }}>
          {brand.label}
        </span>
      </div>
    );
  }

  return getInitialFallback(name, size);
}
