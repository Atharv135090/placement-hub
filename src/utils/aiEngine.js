/**
 * AI Engine — Placement Hub Assistant
 *
 * Public interface for the AI system.
 * Routes through multi-provider free AI router with automatic fallback.
 *
 * PRD: §2, §5, §22, §23, §66
 */

import { generateResponse, isAnyProviderConfigured, getProviderStatus, resetProviderCooldowns } from "./aiRouter";
import { FREE_PROVIDERS } from "./aiProviders";

function log(...args) {
  if (typeof console !== "undefined") {
    console.log("[AI_ENGINE]", ...args);
  }
}

// ─── Backward-compatible exports ───

/**
 * Get the Gemini API key (kept for backward compatibility).
 */
export function getGeminiApiKey() {
  const key =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.VITE_GEMINI_API_KEY);
  return (key || "").trim();
}

/**
 * Check if AI is configured (any free provider available).
 */
export function isAIConfigured() {
  return isAnyProviderConfigured();
}

/**
 * Build placement context from user data.
 * Identical to the original implementation.
 */
export function getPlacementContext(applications, companies, savedIds, profile, user) {
  const savedCompanies = (companies || []).filter((c) => (savedIds || []).includes(c.id));
  const interviews = (applications || []).filter((a) => a.status === "interview");
  const shortlisted = (applications || []).filter((a) => a.status === "shortlisted");
  const applied = (applications || []).filter((a) => a.status === "applied");
  const offers = (applications || []).filter((a) => a.status === "offer" || a.status === "selected");
  const rejected = (applications || []).filter((a) => a.status === "rejected");

  return {
    totalApplications: (applications || []).length,
    applied: applied.length,
    shortlisted: shortlisted.length,
    interviews: interviews.length,
    offers: offers.length,
    rejected: rejected.length,
    applicationDetails: (applications || []).map((a) => `${a.companyName || "Company"} — ${a.role || "N/A"} (${a.status || "Applied"})`),
    savedCompanyNames: savedCompanies.map((c) => c.name || "Company"),
    totalCompanies: (companies || []).length,
    companyList: (companies || []).map((c) => `${c.name || "Company"} (${c.role || "Role"}, Package: ${c.package || "N/A"})`),
    branch: (profile && profile.branch) || "Not specified",
    gradYear: (profile && profile.gradYear) || "Not specified",
    userName: (profile && profile.displayName) || (user && user.displayName) || "Student",
  };
}

/**
 * Primary streaming entry point.
 * Routes through the multi-provider free AI router with automatic fallback.
 */
export async function generateSmartResponseStream(query, ctx, messages, onChunk, signal) {
  if (!isAIConfigured()) {
    const configured = FREE_PROVIDERS.filter((p) => p.isAvailable()).map((p) => p.name);
    const missing = FREE_PROVIDERS.filter((p) => !p.isAvailable()).map((p) => p.name);
    log("No providers configured");
    log("  Configured:", configured.length > 0 ? configured.join(", ") : "none");
    log("  Missing:", missing.length > 0 ? missing.join(", ") : "none");

    const err = "⚠️ **AI Not Configured**: No free AI provider API key found. Please add at least one API key to your `.env` file:\n\n- `VITE_GEMINI_API_KEY` — Get from [Google AI Studio](https://aistudio.google.com/apikey)\n- `VITE_GROQ_API_KEY` — Get from [Groq Console](https://console.groq.com/keys)\n- `VITE_OPENROUTER_API_KEY` — Get from [OpenRouter](https://openrouter.ai/keys)\n\nThen restart the dev server.";
    onChunk(err);
    return err;
  }

  return generateResponse(query, ctx, messages, onChunk, signal);
}

/**
 * Non-streaming entry point (kept for backward compatibility).
 */
export async function generateSmartResponse(query, ctx, messages) {
  if (!isAIConfigured()) {
    return "⚠️ **AI Not Configured**: No free AI provider API key found. Please add at least one API key to your `.env` file and restart the dev server.";
  }

  let result = "";
  const text = await generateResponse(
    query,
    ctx,
    messages,
    (accumulated) => { result = accumulated; },
    null
  );
  return text || result;
}

/**
 * Get provider status for diagnostics.
 */
export function getAIDiagnostics() {
  return getProviderStatus();
}

/**
 * Reset all provider cooldowns (for manual retry).
 */
export function resetAICooldowns() {
  resetProviderCooldowns();
}
