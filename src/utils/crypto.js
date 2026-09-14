// ═══════════════════════════════════════════════════════════════
// E2EE KEY MANAGEMENT & ENCRYPTION (ECDH + AES-256-GCM)
// ═══════════════════════════════════════════════════════════════
// Architecture:
//   - P-256 ECDH for shared-secret establishment
//   - AES-256-GCM for message encryption/decryption
//   - Private key stored in IndexedDB (fast local path)
//   - Private key ALSO backed up to Firestore, encrypted with a
//     PBKDF2 wrapping key derived from the user's UID so the
//     same key can be restored on any device after login.
//   - Public key published to Firestore for cross-user exchange.
//
// Cross-device flow:
//   New device login → fetch encryptedPrivateKey from Firestore
//   → derive wrapping key from UID → decrypt → use same ECDH key pair
//   → all old messages decrypt correctly everywhere.
// ═══════════════════════════════════════════════════════════════

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const DB_NAME = "placement-hub-keys";
const STORE_NAME = "ecdh-keypairs";
const DB_VERSION = 1;

// Fixed salt for wrapping key derivation (app-specific, public)
const WRAP_SALT = "placement-hub-key-wrap-v1";

// ═══════ Hex / Base64 helpers ═══════

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
}

function abToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToAb(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ═══════ IndexedDB helpers ═══════

function openKeyDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(key, value) {
  const db = await openKeyDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key) {
  const db = await openKeyDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// ═══════ Wrapping Key (for cross-device private key backup) ═══════

/**
 * Derive a deterministic AES-256-GCM wrapping key from the user's UID.
 * This key is used to encrypt the ECDH private key for Firestore storage.
 * The wrapping key is re-derived on any device from the same UID — no
 * additional secret is needed beyond Firebase Auth (which enforces access).
 */
async function deriveWrappingKey(uid) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(uid),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(WRAP_SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt the ECDH CryptoKey (private) and return a base64 string
 * suitable for storage in Firestore.
 */
async function encryptPrivateKeyForStorage(privateKey, uid) {
  const wrappingKey = await deriveWrappingKey(uid);
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    new TextEncoder().encode(JSON.stringify(jwk))
  );
  // Format: base64(iv):base64(ciphertext)
  return `${abToBase64(iv.buffer)}:${abToBase64(encrypted)}`;
}

/**
 * Decrypt the ECDH private key from Firestore backup string.
 * Returns a CryptoKey, or throws on failure.
 */
async function decryptPrivateKeyFromStorage(encryptedData, uid) {
  const colonIdx = encryptedData.indexOf(":");
  const ivBase64 = encryptedData.slice(0, colonIdx);
  const dataBase64 = encryptedData.slice(colonIdx + 1);
  const iv = new Uint8Array(base64ToAb(ivBase64));
  const data = base64ToAb(dataBase64);
  const wrappingKey = await deriveWrappingKey(uid);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    data
  );
  const jwk = JSON.parse(new TextDecoder().decode(decrypted));
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// ═══════ ECDH Key Pair Management ═══════

/**
 * Ensure the user has a stable ECDH key pair available.
 *
 * Resolution order:
 *   1. IndexedDB (fast local cache)
 *   2. Firestore encryptedPrivateKey (cross-device recovery — any device after login)
 *   3. Generate a brand-new key pair (first-ever login)
 *
 * The private key is NEVER overwritten if one already exists.
 * The encrypted private key backup in Firestore allows any device to restore
 * the same identity key after a fresh login.
 *
 * @returns {Promise<string|null>} Public key as base64, or null on failure
 */
export async function ensureECDHKeys(uid) {
  // ── Step 1: Fast path — check IndexedDB ──
  const existingPrivKey = await idbGet(uid);
  if (existingPrivKey) {
    const existingPub = await idbGet(`${uid}:pub`);
    if (existingPub) {
      // Keys fully present locally — publish public key (idempotent) and return
      await publishPublicKey(uid, existingPrivKey, existingPub).catch(() => {});
      return existingPub;
    }
    // Private key in IndexedDB but no public key — recover from Firestore
    try {
      const snap = await getDoc(doc(db, "userKeys", uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.publicKey) {
          await idbPut(`${uid}:pub`, data.publicKey).catch(() => {});
          return data.publicKey;
        }
      }
    } catch {}
    console.warn(`[E2EE] Public key missing for ${uid} — using V1 fallback.`);
    return null;
  }

  // ── Step 2: Cross-device recovery — check Firestore for encrypted private key ──
  // This fires when the user logs in on a new device/browser that has no local keys yet.
  try {
    const snap = await getDoc(doc(db, "userKeys", uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.encryptedPrivateKey && data.publicKey) {
        console.log("[E2EE] Restoring key pair from Firestore backup (cross-device).");
        const restoredPrivKey = await decryptPrivateKeyFromStorage(data.encryptedPrivateKey, uid);
        // Cache in IndexedDB for fast access on subsequent loads
        await idbPut(uid, restoredPrivKey).catch(() => {});
        await idbPut(`${uid}:pub`, data.publicKey).catch(() => {});
        return data.publicKey;
      }
    }
  } catch (err) {
    console.warn("[E2EE] Could not restore key from Firestore, generating new pair:", err);
  }

  // ── Step 3: First login ever — generate a brand-new key pair ──
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // must be extractable so we can backup to Firestore
    ["deriveKey", "deriveBits"]
  );

  // Store private key locally
  await idbPut(uid, keyPair.privateKey);

  // Derive and store public key
  const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const pubBase64 = abToBase64(rawPub);
  await idbPut(`${uid}:pub`, pubBase64);

  // Publish both public key and encrypted private key to Firestore
  await publishPublicKey(uid, keyPair.privateKey, pubBase64).catch((err) => {
    console.warn("[E2EE] Failed to backup key to Firestore:", err);
  });

  return pubBase64;
}

/**
 * Get or create ECDH keys locally. Returns public key base64.
 */
export async function getOrInitECDHPublicKey(uid) {
  const existingPub = await idbGet(`${uid}:pub`);
  if (existingPub) return existingPub;
  return ensureECDHKeys(uid);
}

/**
 * Get the user's ECDH private key from IndexedDB.
 * Returns a CryptoKey object or null.
 */
export async function getECDHPrivateKey(uid) {
  return idbGet(uid);
}

/**
 * Get the user's cached ECDH public key from IndexedDB.
 * Returns base64 public key or null.
 */
export async function getECDHPublicKey(uid) {
  return idbGet(`${uid}:pub`);
}

// ═══════ Firestore Public Key Exchange ═══════

/**
 * Publish the user's ECDH public key to Firestore `userKeys/{uid}`.
 * Also stores the AES-encrypted private key for cross-device recovery.
 *
 * @param {string} uid
 * @param {CryptoKey|null} privateKey - Pass the CryptoKey to also backup the private key
 * @param {string} pubKeyBase64 - Public key in base64 format
 */
export async function publishPublicKey(uid, privateKey, pubKeyBase64) {
  if (!uid || !pubKeyBase64) return;
  const userKeyRef = doc(db, "userKeys", uid);

  const payload = {
    publicKey: pubKeyBase64,
    updatedAt: serverTimestamp(),
  };

  // Backup encrypted private key if provided (CryptoKey object)
  if (privateKey && typeof privateKey === "object" && privateKey.type === "private") {
    try {
      const encryptedPrivateKey = await encryptPrivateKeyForStorage(privateKey, uid);
      payload.encryptedPrivateKey = encryptedPrivateKey;
    } catch (err) {
      console.warn("[E2EE] Could not encrypt private key for backup:", err);
    }
  }

  await setDoc(userKeyRef, payload, { merge: true });
}

/**
 * Fetch another user's ECDH public key from Firestore `userKeys/{uid}`.
 * Returns the public key as a base64 string, or null if not found.
 * @param {string} uid - The other user's Firebase Auth UID
 * @returns {Promise<string|null>} Public key base64 or null
 */
export async function fetchECDHPublicKey(uid) {
  if (!uid) return null;
  try {
    const userKeyRef = doc(db, "userKeys", uid);
    const snap = await getDoc(userKeyRef);
    if (snap.exists()) {
      return snap.data().publicKey || null;
    }
    return null;
  } catch (err) {
    console.warn(`Failed to fetch public key for ${uid}:`, err);
    return null;
  }
}

// ═══════ Shared Secret Derivation ═══════

async function deriveSharedKey(myPrivateKey, theirPublicKeyBase64) {
  const theirRawPub = base64ToAb(theirPublicKeyBase64);
  const theirPubKey = await crypto.subtle.importKey(
    "raw",
    theirRawPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPubKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ═══════ Encryption / Decryption ═══════

/**
 * Encrypt a plaintext message using ECDH shared secret + AES-256-GCM.
 * @param {string} plaintext - The message text
 * @param {CryptoKey} myPrivateKey - Sender's ECDH private key
 * @param {string} theirPublicKeyBase64 - Recipient's public key (base64)
 * @returns {string} "ivHex:ciphertextHex" format
 */
export async function encryptMessageE2EE(plaintext, myPrivateKey, theirPublicKeyBase64) {
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    new TextEncoder().encode(plaintext)
  );
  const ivHex = bufToHex(iv);
  const encHex = bufToHex(encrypted);
  return `${ivHex}:${encHex}`;
}

/**
 * Decrypt a ciphertext message using ECDH shared secret + AES-256-GCM.
 * @param {string} cipherText - "ivHex:ciphertextHex" format
 * @param {CryptoKey} myPrivateKey - This user's ECDH private key
 * @param {string} theirPublicKeyBase64 - Other party's public key (base64)
 * @returns {string} Decrypted plaintext
 */
export async function decryptMessageE2EE(cipherText, myPrivateKey, theirPublicKeyBase64) {
  const [ivHex, encHex] = cipherText.split(":");
  const iv = hexToBuf(ivHex);
  const data = hexToBuf(encHex);
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKeyBase64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, data);
  return new TextDecoder().decode(decrypted);
}

// ═══════ Session Cache ═══════

const sharedSecretCache = new Map();

function convKey(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}:${uid2}` : `${uid2}:${uid1}`;
}

export async function getSharedKey(uid1, uid2, myPrivateKey, theirPublicKeyBase64) {
  const key = convKey(uid1, uid2);
  if (sharedSecretCache.has(key)) return sharedSecretCache.get(key);
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKeyBase64);
  sharedSecretCache.set(key, sharedKey);
  return sharedKey;
}

export function clearSharedSecretCache() {
  sharedSecretCache.clear();
}
