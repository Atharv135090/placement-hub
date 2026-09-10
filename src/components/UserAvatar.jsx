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
    }
  };

  return (
    <img
      src={imgSrc || fallbackUrl}
      alt={alt}
      className={className}
      style={{ objectFit: "cover", borderRadius: "50%", ...style }}
      onClick={onClick}
      title={title}
      onError={handleError}
    />
  );
}
