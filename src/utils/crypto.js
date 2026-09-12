// ═══════════════════════════════════════════════════════════════
// E2EE KEY MANAGEMENT & ENCRYPTION (ECDH + AES-256-GCM)
// ═══════════════════════════════════════════════════════════════
// Uses P-256 ECDH for key establishment + AES-256-GCM for
// message encryption. Private keys stored in IndexedDB.
// Public keys published to Firestore for cross-user exchange.
// ═══════════════════════════════════════════════════════════════

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const DB_NAME = "placement-hub-keys";
const STORE_NAME = "ecdh-keypairs";
const DB_VERSION = 1;

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

// ═══════ ECDH Key Pair Management ═══════

/**
 * Generate an ECDH P-256 key pair for the given user.
 * Stores private key in IndexedDB, public key in IndexedDB under `${uid}:pub`.
 * Also publishes the public key to Firestore `userKeys/{uid}` for cross-user exchange.
 * Returns the public key as a base64 string.
 */
export async function ensureECDHKeys(uid) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  await idbPut(uid, keyPair.privateKey);

  const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const pubBase64 = abToBase64(rawPub);
  await idbPut(`${uid}:pub`, pubBase64);

  // Publish public key to Firestore for cross-user E2EE
  await publishPublicKey(uid, pubBase64).catch((err) => {
    console.warn("Failed to publish public key to Firestore:", err);
  });

  return pubBase64;
}

/**
 * Get or create ECDH keys locally. Returns public key base64.
 * Private key stays in IndexedDB; public key also cached in IndexedDB.
 * Use fetchECDHPublicKey() for cross-user key exchange.
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

// ═══════ Firestore Public Key Exchange ═══════

/**
 * Publish the user's ECDH public key to Firestore `userKeys/{uid}`.
 * This allows other users to fetch this user's public key for E2EE.
 * @param {string} uid - Firebase Auth UID
 * @param {string} pubKeyBase64 - Public key in base64 format
 */
export async function publishPublicKey(uid, pubKeyBase64) {
  if (!uid || !pubKeyBase64) return;
  const userKeyRef = doc(db, "userKeys", uid);
  await setDoc(userKeyRef, {
    publicKey: pubKeyBase64,
    updatedAt: serverTimestamp(),
  });
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
