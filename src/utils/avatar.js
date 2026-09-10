const CAR_IMAGES = [
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1542362567-b07e54358753?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1471479917193-f00955256257?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=200&h=200&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=200&h=200&fit=crop&crop=center",
];

/**
 * Deterministically hash a string (e.g. user UID or email) to a consistent number.
 */
function hashString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get the consistent fallback default avatar URL for a given user.
 */
export function getAvatarFallback(user) {
  const seed = user?.uid || user?.email || "default_user_seed";
  const index = hashString(seed) % CAR_IMAGES.length;
  return CAR_IMAGES[index];
}

/**
 * Get the user's avatar URL (actual Google photo if available, otherwise deterministic fallback).
 */
export function getAvatarUrl(user, profile) {
  const photo = user?.photoURL || profile?.photoUrl;
  if (photo && typeof photo === "string" && photo.trim().length > 0) {
    return photo;
  }
  return getAvatarFallback(user);
}
