export default function CompanyLogo({ name = "", logoUrl, size = 46, className = "" }) {
  const normalized = (name || "").toLowerCase().trim();

  if (logoUrl) {
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
          onError={(e) => { e.target.style.display = "none"; }}
        />
      </div>
    );
  }

  // 1. TCS
  if (normalized.includes("tcs") || normalized.includes("tata consultancy")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#0070ad",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0, 112, 173, 0.25)",
        }}
        title="Tata Consultancy Services"
      >
        <span style={{ color: "#ffffff", fontWeight: 800, fontSize: size * 0.4, letterSpacing: "-0.04em", fontFamily: "system-ui, sans-serif" }}>
          tcs
        </span>
      </div>
    );
  }

  // 2. Accenture
  if (normalized.includes("accenture")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#7928ca",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(121, 40, 202, 0.25)",
        }}
        title="Accenture"
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 4L18 12L6 20"
            stroke="#ffffff"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  // 3. Deloitte
  if (normalized.includes("deloitte")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.35)",
        }}
        title="Deloitte"
      >
        <span style={{ color: "#ffffff", fontWeight: 900, fontSize: size * 0.44, letterSpacing: "-0.05em", fontFamily: "system-ui, sans-serif" }}>
          D<span style={{ color: "#86bc25" }}>.</span>
        </span>
      </div>
    );
  }

  // 4. Infosys
  if (normalized.includes("infosys")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#007cc3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 2,
          boxShadow: "0 2px 6px rgba(0, 124, 195, 0.25)",
        }}
        title="Infosys"
      >
        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: size * 0.26, letterSpacing: "-0.02em", fontFamily: "system-ui, sans-serif" }}>
          Infosys
        </span>
      </div>
    );
  }

  // 5. Capgemini
  if (normalized.includes("capgemini")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
        }}
        title="Capgemini"
      >
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="#0070ad">
          <path d="M12 2C8.5 7 4 10.5 4 14.5c0 3.5 3 5.5 6 4.5-.5 2-1.5 3-3 3h10c-1.5 0-2.5-1-3-3 3 1 6-1 6-4.5C20 10.5 15.5 7 12 2z" />
        </svg>
      </div>
    );
  }

  // 6. Wipro
  if (normalized.includes("wipro")) {
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
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
          padding: 2,
        }}
        title="Wipro"
      >
        <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 32 32">
          <circle cx="16" cy="6" r="2.8" fill="#f59e0b" />
          <circle cx="23" cy="9" r="2.8" fill="#ef4444" />
          <circle cx="26" cy="16" r="2.8" fill="#ec4899" />
          <circle cx="23" cy="23" r="2.8" fill="#8b5cf6" />
          <circle cx="16" cy="26" r="2.8" fill="#3b82f6" />
          <circle cx="9" cy="23" r="2.8" fill="#06b6d4" />
          <circle cx="6" cy="16" r="2.8" fill="#10b981" />
          <circle cx="9" cy="9" r="2.8" fill="#84cc16" />
        </svg>
        <span style={{ fontSize: size * 0.2, fontWeight: 700, color: "#1e293b", marginTop: 1, letterSpacing: "-0.02em" }}>
          wipro
        </span>
      </div>
    );
  }

  // 7. Cognizant
  if (normalized.includes("cognizant")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#000048",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0, 0, 72, 0.35)",
        }}
        title="Cognizant"
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <path
            d="M17 7.5A6.5 6.5 0 1 0 17 16.5"
            stroke="#00a3e0"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M14 10A3 3 0 1 0 14 14"
            stroke="#185a9d"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 8. Tech Mahindra
  if (normalized.includes("tech mahindra") || normalized.includes("mahindra")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#e41f26",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(228, 31, 38, 0.3)",
        }}
        title="Tech Mahindra"
      >
        <span style={{ color: "#ffffff", fontWeight: 900, fontSize: size * 0.44, letterSpacing: "-0.04em", fontFamily: "system-ui, sans-serif" }}>
          m
        </span>
      </div>
    );
  }

  // 9. Google
  if (normalized.includes("google")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid #e2e8f0",
        }}
        title="Google"
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
        </svg>
      </div>
    );
  }

  // 10. Microsoft
  if (normalized.includes("microsoft")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#181d2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
        title="Microsoft"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, width: size * 0.5, height: size * 0.5 }}>
          <div style={{ background: "#f25022", borderRadius: 1 }} />
          <div style={{ background: "#7fba00", borderRadius: 1 }} />
          <div style={{ background: "#00a4ef", borderRadius: 1 }} />
          <div style={{ background: "#ffb900", borderRadius: 1 }} />
        </div>
      </div>
    );
  }

  // 11. Amazon
  if (normalized.includes("amazon")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.35)",
        }}
        title="Amazon"
      >
        <span style={{ color: "#ffffff", fontWeight: 900, fontSize: size * 0.44, fontFamily: "system-ui, sans-serif" }}>
          a<span style={{ color: "#ff9900" }}>✓</span>
        </span>
      </div>
    );
  }

  // 12. eQ Technologic
  if (normalized.includes("eq") || normalized.includes("technologic")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#7c3aed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(124, 58, 237, 0.35)",
        }}
        title="eQ Technologic"
      >
        <span style={{ color: "#ffffff", fontWeight: 900, fontSize: size * 0.38, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.04em" }}>
          eQ
        </span>
      </div>
    );
  }

  // 13. Intel
  if (normalized.includes("intel")) {
    return (
      <div
        className={`company-brand-logo ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: "#0068b5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0, 104, 181, 0.3)",
        }}
        title="Intel"
      >
        <span style={{ color: "#ffffff", fontWeight: 800, fontSize: size * 0.28, fontFamily: "system-ui, sans-serif", letterSpacing: "-0.02em" }}>
          intel
        </span>
      </div>
    );
  }

  // Fallback: Elegant monogram squircle
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = (name || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`company-brand-logo ${className}`}
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
