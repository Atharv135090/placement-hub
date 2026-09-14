// ═══════════════════════════════════════════════════════════════
// AVATAR / PROFILE PHOTO RESOLUTION
// ═══════════════════════════════════════════════════════════════
// Priority order for every user's displayed photo:
//   1. profile.photoUrl  — custom uploaded photo (base64 data URL)
//   2. profile.photoURL  — alternate Firestore casing (some docs use capital URL)
//   3. user.photoURL     — Google / provider photo from Firebase Auth
//   4. Deterministic car fallback — hash(targetUser.uid) → stable index
//
// CRITICAL RULES:
//   • Fallback is based on TARGET USER'S uid, never the viewer's uid.
//   • Same uid → same car image, always, for all viewers.
//   • No Math.random() is ever used.
// ═══════════════════════════════════════════════════════════════

export const CAR_IMAGES = [
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
 * Deterministic hash for a string. Always produces the same number for the same input.
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
 * Get a deterministic car fallback image URL for a user.
 *
 * IMPORTANT: Always pass the TARGET USER's uid/email — never the viewer's.
 * The same uid always returns the same image, for all viewers, on all devices.
 *
 * @param {{ uid?: string, email?: string } | null} targetUser
 * @returns {string} URL of the deterministic car image
 */
export function getAvatarFallback(targetUser) {
  const seed = targetUser?.uid || targetUser?.email || "default_user_seed";
  const index = hashString(seed) % CAR_IMAGES.length;
  return CAR_IMAGES[index];
}

/**
 * Resolve a user's profile photo URL.
 *
 * Priority:
 *   1. profile.photoUrl  (lowercase l — our canonical Firestore field for custom/Google synced photo)
 *   2. profile.photoURL  (capital URL — alternate casing that may appear in some Firestore docs)
 *   3. user.photoURL     (Firebase Auth Google/provider photo — passed as the auth user object)
 *   4. getAvatarFallback(user) — deterministic car image based on target user's UID
 *
 * @param {{ uid?: string, photoURL?: string } | null} user - The TARGET user object (not the viewer)
 * @param {{ photoUrl?: string, photoURL?: string } | null} profile - Firestore profile doc of the TARGET user
 * @returns {string} Resolved photo URL
 */
export function getAvatarUrl(user, profile) {
  // Priority 1: Custom uploaded photo (lowercase l — our standard Firestore field)
  if (profile?.photoUrl && typeof profile.photoUrl === "string" && profile.photoUrl.trim().length > 0) {
    return profile.photoUrl;
  }
  // Priority 2: Alternate casing (capital URL) — covers docs written with photoURL field
  if (profile?.photoURL && typeof profile.photoURL === "string" && profile.photoURL.trim().length > 0) {
    return profile.photoURL;
  }
  // Priority 3: Firebase Auth Google / provider photo (passed via the user prop)
  if (user?.photoURL && typeof user.photoURL === "string" && user.photoURL.trim().length > 0) {
    return user.photoURL;
  }
  // Priority 4: Deterministic car fallback — based on target user's UID
  return getAvatarFallback(user);
}

/**
 * Get the deterministic car fallback image that should be assigned to a user on first sign-up.
 * Used when auto-assigning a profile photo (no Google photo available).
 *
 * @param {{ uid?: string, email?: string } | null} targetUser
 * @returns {string} Car fallback URL
 */
export function getAutoAssignedPhoto(targetUser) {
  return getAvatarFallback(targetUser);
}

/**
 * Return true if the given URL is one of the auto-assigned car fallback images.
 * Used by AuthContext to detect "auto-assigned" photos vs user-uploaded photos.
 *
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isAutoFallbackPhoto(url) {
  if (!url || typeof url !== "string") return false;
  return CAR_IMAGES.some((carUrl) => url.startsWith(carUrl.split("?")[0]));
}
