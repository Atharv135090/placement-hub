/**
 * Free AI Router
 *
 * Multi-provider fallback with SDK primary path for Gemini,
 * REST streaming fallback, and comprehensive diagnostic logging.
 *
 * PRD: §3, §5, §6, §7, §14, §16, §17, §31, §33, §39
 */

import { FREE_PROVIDERS, providerStatus, selectBestModel, logProviderStatus } from "./aiProviders";

const MAX_PROVIDER_ATTEMPTS = 3;

function log(...args) {
  if (typeof console !== "undefined") {
    console.log("[AI_ROUTER]", ...args);
  }
}

function warn(...args) {
  if (typeof console !== "undefined") {
    console.warn("[AI_ROUTER]", ...args);
  }
}

// Log provider status on module load (once)
if (typeof window !== "undefined") {
  logProviderStatus();
}

// ─────────────────────────────────────────────
// HISTORY COMPRESSION
// ─────────────────────────────────────────────

export function compressHistory(messages, maxMessages = 20) {
  if (!Array.isArray(messages) || messages.length <= 1) return [];
  const recent = messages.slice(-maxMessages);
  return recent.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: (m.text || "").trim() }],
  }));
}

// ─────────────────────────────────────────────
// QUERY COMPLEXITY
// ─────────────────────────────────────────────

function classifyQueryComplexity(query) {
  const q = (query || "").toLowerCase().trim();

  if (/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|bye|good morning|good night|how are you|what'?s up|\?{1,3})$/i.test(q)) {
    return "lightweight";
  }

  if (q.length < 20) return "lightweight";

  const complexKeywords = [
    "explain", "implement", "build", "debug", "optimize", "compare",
    "architecture", "design pattern", "algorithm", "system design",
    "complex", "advanced", "detailed", "comprehensive", "thorough",
    "code review", "refactor", "trade-off", "pros and cons",
    "step by step", "in depth", "write a program", "write code",
    "solve", "approach", "solution", "strategy",
  ];

  if (complexKeywords.some((kw) => q.includes(kw))) return "best";
  return "best";
}

// ─────────────────────────────────────────────
// STREAMING HANDLERS
// ─────────────────────────────────────────────

async function handleSSEStream(res, parseLine, onChunk, signal) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const text = parseLine(line);
      if (text) {
        full += text;
        onChunk(full);
      }
    }
  }

  return full;
}

// ─────────────────────────────────────────────
// PROVIDER ATTEMPTS
// ─────────────────────────────────────────────

/**
 * Try Gemini using the @google/genai SDK (primary path).
 * The SDK handles auth, CORS, and streaming properly.
 */
async function tryGeminiSdk(provider, systemPrompt, history, query, onChunk, signal) {
  if (!provider.sdkStream) throw new Error("SDK not available for this provider");

  log(`  [${provider.id}] Attempting SDK stream...`);
  const startTime = Date.now();

  try {
    const text = await provider.sdkStream(systemPrompt, history, query, onChunk, signal);
    const elapsed = Date.now() - startTime;

    if (text && text.trim()) {
      log(`  [${provider.id}] SDK stream SUCCESS (${elapsed}ms, ${text.length} chars)`);
      return text.trim();
    }
    warn(`  [${provider.id}] SDK stream returned empty (${elapsed}ms)`);
    throw new Error("EMPTY_RESPONSE");
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const msg = err?.message || String(err);
    warn(`  [${provider.id}] SDK stream FAILED (${elapsed}ms): ${msg}`);
    throw err;
  }
}

/**
 * Try Gemini using REST streaming (fallback if SDK fails).
 */
async function tryGeminiRestStream(provider, model, systemPrompt, history, query, onChunk, signal) {
  const apiKey = provider.apiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const body = provider.buildBody(systemPrompt, history, query);
  body.stream = true;

  const url = provider.streamUrl(model.id);
  const headers = provider.headers(apiKey);

  log(`  [${provider.id}] Attempting REST stream: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  log(`  [${provider.id}] REST response: HTTP ${res.status}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || "";
    const errStatus = errBody?.error?.status || "";
    warn(`  [${provider.id}] REST error: status=${res.status} msg="${errMsg}" errStatus="${errStatus}"`);

    if (provider.isQuotaError(res.status, errBody)) throw new Error("RATE_LIMIT");
    if (provider.isAuthError(res.status, errBody)) throw new Error("AUTH_FAILED");
    throw new Error(errMsg || `HTTP ${res.status}`);
  }

  return await handleSSEStream(res, provider.parseStreamLine, onChunk, signal);
}

/**
 * Try a non-OpenAI-compatible provider using REST non-streaming.
 */
async function tryRestNonStream(provider, model, systemPrompt, history, query) {
  const apiKey = provider.apiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const body = provider.buildBody(systemPrompt, history, query, model.id);
  delete body.stream;

  const url = provider.nonStreamUrl(model.id);
  const headers = provider.headers(apiKey);

  log(`  [${provider.id}] Attempting REST non-stream: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  log(`  [${provider.id}] REST non-stream response: HTTP ${res.status}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || "";
    warn(`  [${provider.id}] REST non-stream error: status=${res.status} msg="${errMsg}"`);

    if (provider.isQuotaError(res.status, errBody)) throw new Error("RATE_LIMIT");
    if (provider.isAuthError(res.status, errBody)) throw new Error("AUTH_FAILED");
    throw new Error(errMsg || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = provider.parseResponse(data);
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text;
}

/**
 * Try an OpenAI-compatible provider using SSE streaming (Groq, OpenRouter).
 */
async function tryOpenAIStream(provider, model, systemPrompt, history, query, onChunk, signal) {
  const apiKey = provider.apiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const body = provider.buildBody(systemPrompt, history, query, model.id);
  body.stream = true;

  const url = provider.streamUrl(model.id);
  const headers = provider.headers(apiKey);

  log(`  [${provider.id}] Attempting OpenAI SSE stream: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  log(`  [${provider.id}] SSE response: HTTP ${res.status}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || "";
    warn(`  [${provider.id}] SSE error: status=${res.status} msg="${errMsg}"`);

    if (provider.isQuotaError(res.status, errBody)) throw new Error("RATE_LIMIT");
    if (provider.isAuthError(res.status, errBody)) throw new Error("AUTH_FAILED");
    throw new Error(errMsg || `HTTP ${res.status}`);
  }

  return await handleSSEStream(res, provider.parseStreamLine, onChunk, signal);
}

/**
 * Try an OpenAI-compatible provider using REST non-streaming (fallback).
 */
async function tryOpenAINonStream(provider, model, systemPrompt, history, query) {
  const apiKey = provider.apiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const body = provider.buildBody(systemPrompt, history, query, model.id);
  body.stream = false;

  const url = provider.nonStreamUrl(model.id);
  const headers = provider.headers(apiKey);

  log(`  [${provider.id}] Attempting OpenAI non-stream: ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  log(`  [${provider.id}] OpenAI non-stream response: HTTP ${res.status}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error?.message || "";
    warn(`  [${provider.id}] OpenAI non-stream error: status=${res.status} msg="${errMsg}"`);

    if (provider.isQuotaError(res.status, errBody)) throw new Error("RATE_LIMIT");
    if (provider.isAuthError(res.status, errBody)) throw new Error("AUTH_FAILED");
    throw new Error(errMsg || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = provider.parseResponse(data);
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text;
}

// ─────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────

function handleProviderError(providerId, err) {
  const msg = err?.message || String(err);

  if (msg === "RATE_LIMIT") {
    providerStatus.markQuotaExceeded(providerId, msg);
    return "RATE_LIMIT";
  }
  if (msg === "AUTH_FAILED") {
    providerStatus.markAuthError(providerId, msg);
    return "AUTH_FAILED";
  }
  if (msg === "NO_API_KEY") {
    providerStatus.markAuthError(providerId, msg);
    return "NO_API_KEY";
  }
  if (msg === "EMPTY_RESPONSE") {
    providerStatus.markQuotaExceeded(providerId, msg);
    return "EMPTY_RESPONSE";
  }

  // Network, timeout, unknown errors
  providerStatus.markQuotaExceeded(providerId, msg);
  return "OTHER";
}

// ─────────────────────────────────────────────
// MAIN RESPONSE GENERATOR
// ─────────────────────────────────────────────

export async function generateResponse(query, ctx, messages, onChunk, signal) {
  const systemPrompt = buildSystemPrompt(ctx);
  const complexity = classifyQueryComplexity(query);
  const history = compressHistory(messages);

  log(`=== REQUEST: "${query.slice(0, 50)}" (complexity=${complexity}) ===`);

  const configured = providerStatus.getAllConfiguredProviders();
  if (configured.length === 0) {
    warn("No providers configured — cannot generate response");
    const errMsg = "No free AI provider is configured for this deployment. Please add at least one API key to your `.env` file.";
    onChunk(errMsg);
    return errMsg;
  }

  // Track which providers succeeded (none yet)
  let succeeded = false;

  // ── PHASE 1: Try streaming with each provider ──
  const streamingAttempted = new Set();

  for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt++) {
    if (succeeded) break;

    const selection = selectBestModel(complexity);
    if (!selection) {
      warn("selectBestModel returned null — no providers available for streaming");
      break;
    }

    const { provider, model } = selection;

    if (streamingAttempted.has(provider.id)) {
      log(`  [${provider.id}] Already attempted streaming — skipping`);
      continue;
    }
    streamingAttempted.add(provider.id);

    log(`  [${provider.id}] Trying streaming (model=${model.id})...`);

    try {
      let text;

      // Gemini: try SDK first, then REST
      if (provider.useSdk && provider.sdkStream) {
        try {
          text = await tryGeminiSdk(provider, systemPrompt, history, query, onChunk, signal);
        } catch (sdkErr) {
          const sdkMsg = sdkErr?.message || String(sdkErr);
          warn(`  [${provider.id}] SDK failed: ${sdkMsg} — falling back to REST`);
          text = await tryGeminiRestStream(provider, model, systemPrompt, history, query, onChunk, signal);
        }
      }
      // Groq / OpenRouter: OpenAI-compatible SSE
      else {
        text = await tryOpenAIStream(provider, model, systemPrompt, history, query, onChunk, signal);
      }

      if (text && text.trim()) {
        providerStatus.markSuccess(provider.id);
        log(`=== RESULT: ${provider.name} SUCCESS (streaming) ===`);
        succeeded = true;
        return text.trim();
      }

      warn(`  [${provider.id}] Returned empty response`);
      handleProviderError(provider.id, { message: "EMPTY_RESPONSE" });
    } catch (err) {
      if (signal?.aborted) {
        log("=== REQUEST ABORTED ===");
        throw err;
      }

      const result = handleProviderError(provider.id, err);
      log(`  [${provider.id}] → ${result} — trying next provider`);

      if (result === "AUTH_FAILED" || result === "NO_API_KEY") {
        continue;
      }
    }
  }

  // ── PHASE 2: Try non-streaming as last resort ──
  // Try ALL configured providers, even those in streaming cooldown
  // (non-streaming may use different quota/rate limits)
  if (!succeeded) {
    log("  Phase 2: Trying non-streaming fallback...");

    for (const provider of FREE_PROVIDERS) {
      if (succeeded) break;
      if (!provider.isAvailable()) continue;

      const model = provider.models[0];
      log(`  [${provider.id}] Trying non-streaming...`);

      try {
        let text;

        if (provider.useSdk && provider.sdkNonStream) {
          try {
            text = await provider.sdkNonStream(systemPrompt, history, query);
          } catch {
            text = await tryRestNonStream(provider, model, systemPrompt, history, query);
          }
        } else {
          text = await tryOpenAINonStream(provider, model, systemPrompt, history, query);
        }

        if (text && text.trim()) {
          providerStatus.markSuccess(provider.id);
          log(`=== RESULT: ${provider.name} SUCCESS (non-streaming) ===`);
          succeeded = true;
          return text.trim();
        }
      } catch (err) {
        handleProviderError(provider.id, err);
      }
    }
  }

  // ── FINAL: All providers failed ──
  if (!succeeded) {
    const status = providerStatus.getStatus();
    const details = Object.entries(status)
      .map(([id, s]) => `${id}: configured=${s.configured} available=${s.available} cooldown=${s.inCooldown}`)
      .join(", ");
    warn(`=== ALL PROVIDERS FAILED === ${details}`);

    const finalMsg = "Free AI services are temporarily unavailable. Please try again in a moment.";
    onChunk(finalMsg);
    return finalMsg;
  }
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  let prompt = `You are Placement Hub Assistant — an intelligent, helpful, and friendly AI placement copilot and general-purpose AI assistant.

Role & Capabilities:
- You are an expert general AI assistant. You can answer ANY query: general greetings ("hi", "hello"), personal questions ("what's your name?", "what are you doing?", "why?"), technical explanations ("explain binary search"), career & interview prep ("give me interview tips"), creative writing ("tell me a joke"), coding, DSA, science, math, translations, and general conversation.
- Your name is "Placement Hub Assistant" (or AI placement copilot).
- When asked "what's your name?" or "who are you?", introduce yourself as Placement Hub Assistant, your AI placement copilot.
- Respond naturally, conversationally, and informatively.
- Use Markdown formatting for headings, bullet points, and code blocks.
- Do NOT restrict yourself only to placement topics. Answer any question the user asks.`;

  if (ctx) {
    prompt += `\n\nUser Profile & Placement Data:
- User Name: ${ctx.userName}
- Branch: ${ctx.branch}
- Graduation Year: ${ctx.gradYear}
- Total Applications: ${ctx.totalApplications}
- Application Breakdown: ${ctx.applied} Applied, ${ctx.shortlisted} Shortlisted, ${ctx.interviews} Interviews, ${ctx.offers} Offers, ${ctx.rejected} Rejected
- Application List: ${ctx.applicationDetails.length > 0 ? ctx.applicationDetails.join("; ") : "No applications logged yet"}
- Saved Companies: ${ctx.savedCompanyNames.length > 0 ? ctx.savedCompanyNames.join(", ") : "None"}
- Available Companies in Hub (${ctx.totalCompanies}): ${ctx.companyList.length > 0 ? ctx.companyList.slice(0, 15).join("; ") : "None"}`;
  }

  return prompt;
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

export function isAnyProviderConfigured() {
  return FREE_PROVIDERS.some((p) => p.isAvailable());
}

export function getProviderStatus() {
  return providerStatus.getStatus();
}

export function resetProviderCooldowns() {
  providerStatus.resetAll();
}
