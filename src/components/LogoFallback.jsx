export default function LogoFallback({ name, size = 40 }) {
  const initial = (name || "?")[0].toUpperCase();
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className="logo-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: `hsl(${hue}, 60%, 18%)`,
        color: `hsl(${hue}, 70%, 65%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
