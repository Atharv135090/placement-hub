import { useState, useEffect, useRef } from "react";
import { getAvatarUrl, getAvatarFallback } from "../utils/avatar";

/**
 * Centralized user avatar component.
 *
 * Photo resolution priority (handled by getAvatarUrl in avatar.js):
 *   1. profile.photoUrl  — custom uploaded photo
 *   2. profile.photoURL  — alternate Firestore casing
 *   3. user.photoURL     — Google / provider photo
 *   4. Deterministic car fallback based on user.uid
 *
 * IMPORTANT: Always pass the TARGET user's uid, not the viewer's uid.
 * The same uid always resolves to the same image for all viewers.
 */
export default function UserAvatar({
  user,
  profile,
  className = "",
  style = {},
  alt = "Profile avatar",
  onClick,
  title,
}) {
  // Keep a ref to the current props so handleError always accesses the latest user uid
  // even if it's called asynchronously after the img src has been set.
  const latestUserRef = useRef(user);
  const latestProfileRef = useRef(profile);

  useEffect(() => {
    latestUserRef.current = user;
    latestProfileRef.current = profile;
  });

  const [imgSrc, setImgSrc] = useState(() => getAvatarUrl(user, profile));

  // Update imgSrc whenever user or profile changes (e.g. after data loads from Firestore)
  useEffect(() => {
    setImgSrc(getAvatarUrl(user, profile));
  }, [user?.uid, user?.photoURL, profile?.photoUrl, profile?.photoURL]);

  const handleError = () => {
    // Always compute the fallback from the LATEST user ref so we never use a stale closure value.
    // This is the fix for the stale-fallbackUrl bug where an initial undefined uid could
    // lock in the wrong car for the lifetime of this component instance.
    const freshFallback = getAvatarFallback(latestUserRef.current);
    if (imgSrc !== freshFallback) {
      setImgSrc(freshFallback);
    } else {
      // Fallback itself failed — show initials
      setImgSrc(null);
    }
  };

  if (!imgSrc) {
    const name = profile?.displayName || profile?.email || "?";
    const initial = name.charAt(0).toUpperCase();
    // Deterministic hue from name so the same user always gets the same color
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
