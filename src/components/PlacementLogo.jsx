import React from "react";

export default function PlacementLogo({ size = 34, glow = true, className = "" }) {
  return (
    <div
      className={`placement-logo-emblem ${glow ? "placement-logo-glow" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: size * 0.28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)",
        border: "1px solid rgba(239, 68, 68, 0.45)",
        boxShadow: glow ? "0 0 16px rgba(239, 68, 68, 0.35), inset 0 0 8px rgba(239, 68, 68, 0.2)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L14.2 8.5C14.6 9.7 15.6 10.7 16.8 11.1L23.3 13.3L16.8 15.5C15.6 15.9 14.6 16.9 14.2 18.1L12 24.6L9.8 18.1C9.4 16.9 8.4 15.9 7.2 15.5L0.7 13.3L7.2 11.1C8.4 10.7 9.4 9.7 9.8 8.5L12 2Z"
          fill="url(#redGlowGrad)"
        />
        <circle cx="12" cy="13.3" r="2.2" fill="#ffffff" />
        <defs>
          <linearGradient id="redGlowGrad" x1="0" y1="2" x2="23" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff4d4d" />
            <stop offset="0.5" stopColor="#ef4444" />
            <stop offset="1" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
