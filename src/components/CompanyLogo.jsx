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
  { match: (n) => n.includes("nvidia"), bg: "#ffffff", label: "nvidia", color: "#76b900", weight: 900, customSvg: "nvidia", border: "#e2e8f0" },
  { match: (n) => n.includes("noovosoft"), bg: "#11141d", label: ":T", color: "#ffffff", weight: 900 },
  { match: (n) => n.includes("eq") || n.includes("technologic"), bg: "#11141d", label: ":T", color: "#f43f5e", weight: 900 },
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
    if (brand.customSvg === "nvidia") {
      return (
        <div
          className={`company-brand-logo ${className}`}
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
            padding: 3,
          }}
          title={name}
        >
          <svg width={size * 0.7} height={size * 0.45} viewBox="0 0 100 70" fill="none">
            <path d="M45 10C28 10 15 22 15 37C15 50 26 60 41 60C45 60 49 59 52 57C48 54 45 49 45 43C45 35 52 28 60 28C63 28 66 29 68 31C67 19 57 10 45 10Z" fill="#76B900" />
            <path d="M44 20C33 20 25 28 25 38C25 46 32 52 41 52C44 52 47 51 49 49C46 47 44 43 44 38C44 33 48 29 53 29C54 29 56 29 57 30C55 24 50 20 44 20Z" fill="#ffffff" />
            <path d="M43 28C38 28 34 32 34 37C34 41 37 44 42 44C43 44 45 43 46 42C44 41 43 39 43 37C43 34 45 32 47 32C48 32 49 32 50 33C49 30 46 28 43 28Z" fill="#76B900" />
          </svg>
          <span style={{ fontSize: size * 0.18, fontWeight: 900, color: "#111827", letterSpacing: "-0.04em", marginTop: -2, fontFamily: "system-ui, sans-serif" }}>
            nVIDIA
          </span>
        </div>
      );
    }
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
        <span style={{ color: brand.color, fontWeight: brand.weight, fontSize: size * 0.44, letterSpacing: "-0.04em", fontFamily: "system-ui, sans-serif" }}>
          {brand.label}
        </span>
      </div>
    );
  }

  return getInitialFallback(name, size);
}
