import { useState, useEffect } from "react";
import { getAvatarUrl, getAvatarFallback } from "../utils/avatar";

export default function UserAvatar({
  user,
  profile,
  className = "",
  style = {},
  alt = "Profile avatar",
  onClick,
  title,
}) {
  const primaryUrl = getAvatarUrl(user, profile);
  const fallbackUrl = getAvatarFallback(user);
  const [imgSrc, setImgSrc] = useState(primaryUrl);

  useEffect(() => {
    setImgSrc(getAvatarUrl(user, profile));
  }, [user, profile]);

  const handleError = () => {
    if (imgSrc !== fallbackUrl) {
      setImgSrc(fallbackUrl);
    } else {
      setImgSrc(null);
    }
  };

  if (!imgSrc) {
    const name = profile?.displayName || profile?.email || "?";
    const initial = name.charAt(0).toUpperCase();
    const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return (
      <div
        className={className}
        style={{
          width: style.width || 40,
          height: style.height || 40,
          borderRadius: "50%",
          background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 40) % 360}, 75%, 35%))`,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: (style.width || 40) * 0.4,
          flexShrink: 0,
          ...style,
        }}
        onClick={onClick}
        title={title}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={{ objectFit: "cover", borderRadius: "50%", ...style }}
      onClick={onClick}
      title={title}
      onError={handleError}
    />
  );
}
