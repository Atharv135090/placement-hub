import React, { useId } from "react";

export default function PlacementLogo({ size = 34, glow = true, className = "" }) {
  const rawId = useId();
  const gradId = `logoGrad_${rawId.replace(/:/g, "_")}`;
  const svgSize = Math.round(size * 0.65);

  return (
    <div
      className={`placement-logo-emblem ${glow ? "placement-logo-glow" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: Math.round(size * 0.28),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(244, 63, 94, 0.28) 0%, rgba(225, 29, 72, 0.18) 100%)",
        border: "1px solid rgba(244, 63, 94, 0.5)",
        boxShadow: glow ? "0 0 14px rgba(225, 29, 72, 0.4), inset 0 0 6px rgba(244, 63, 94, 0.25)" : "none",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", flexShrink: 0 }}
      >
        <path
          d="M12 2L14.2 8.5C14.6 9.7 15.6 10.7 16.8 11.1L23.3 13.3L16.8 15.5C15.6 15.9 14.6 16.9 14.2 18.1L12 24.6L9.8 18.1C9.4 16.9 8.4 15.9 7.2 15.5L0.7 13.3L7.2 11.1C8.4 10.7 9.4 9.7 9.8 8.5L12 2Z"
          fill={`url(#${gradId})`}
        />
        <circle cx="12" cy="13.3" r="2" fill="#ffffff" />
        <defs>
          <linearGradient id={gradId} x1="0" y1="2" x2="24" y2="25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#ff6b81" />
            <stop offset="1" stopColor="#e11d48" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
