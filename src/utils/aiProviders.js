/**
 * Free AI Provider Registry
 *
 * Centralized configuration for all free AI providers.
 * Uses closure-based adapter functions to avoid `this`-binding issues.
 *
 * PRD: §2, §4, §5, §6, §8, §9, §29, §30
 */

import { GoogleGenAI } from "@google/genai";

const COOLDOWN_DURATION_MS = 5 * 60 * 1000;

function log(...args) {
  if (typeof console !== "undefined") {
    console.log("[AI_PROVIDERS]", ...args);
  }
}

function warn(...args) {
  if (typeof console !== "undefined") {
    console.warn("[AI_PROVIDERS]", ...args);
  }
}

function getEnv(name) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch { /* ignore */ }
  try {
    if (typeof process !== "undefined" && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch { /* ignore */ }
  return "";
}

// ─────────────────────────────────────────────
// GEMINI ADAPTER (closure-based, no `this`)
// ─────────────────────────────────────────────

function geminiApiKey() {
  return (getEnv("VITE_GEMINI_API_KEY") || "").trim();
}

function geminiIsAvailable() {
  return Boolean(geminiApiKey());
}

function geminiBuildContents(systemPrompt, history, query) {
  return [
    { role: "user", parts: [{ text: `[System Context: ${systemPrompt}]` }] },
    { role: "model", parts: [{ text: "Understood. I am ready to assist as Placement Hub Assistant!" }] },
    ...history,
    { role: "user", parts: [{ text: query }] },
  ];
}

function geminiBuildBody(systemPrompt, history, query) {
  return {
    contents: geminiBuildContents(systemPrompt, history, query),
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };
}

function geminiHeaders(key) {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  };
}

function geminiStreamUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
}

function geminiNonStreamUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function geminiParseResponse(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function geminiParseStreamLine(line) {
  if (!line.startsWith("data: ")) return null;
  try {
    const data = JSON.parse(line.slice(6));
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

function geminiIsQuotaError(status) {
  return status === 429;
}

function geminiIsAuthError(status, body) {
  return status === 401 || status === 403 || body?.error?.status === "UNAUTHENTICATED";
}

/**
 * Gemini SDK streaming — uses @google/genai which handles auth/CORS properly.
 */
async function geminiSdkStream(systemPrompt, history, query, onChunk, signal) {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const chat = ai.chats.create({
    model: "gemini-3.5-flash",
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
    history: history,
  });

  const stream = await chat.sendMessageStream({ message: query });
  let full = "";

  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const text = chunk.text || "";
    if (text) {
      full += text;
      onChunk(full);
    }
  }

  return full;
}

/**
 * Gemini SDK non-streaming — fallback.
 */
async function geminiSdkNonStream(systemPrompt, history, query) {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const chat = ai.chats.create({
    model: "gemini-3.5-flash",
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
    history: history,
  });

  const response = await chat.sendMessage({ message: query });
  return response.text;
}

// ─────────────────────────────────────────────
// GROQ ADAPTER (closure-based)
// ─────────────────────────────────────────────

function groqApiKey() {
  return (getEnv("VITE_GROQ_API_KEY") || "").trim();
}

function groqIsAvailable() {
  return Boolean(groqApiKey());
}

function groqBuildBody(systemPrompt, history, query, model) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === "model" ? "assistant" : "user",
      content: h.parts?.[0]?.text || "",
    })),
    { role: "user", content: query },
  ];
  return {
    model,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
    stream: true,
  };
}

function groqHeaders(key) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

function groqParseStreamLine(line) {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (raw === "[DONE]") return null;
  try {
    const data = JSON.parse(raw);
    return data?.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

function groqParseResponse(data) {
  return data?.choices?.[0]?.message?.content || "";
}

function groqIsQuotaError(status, body) {
  return status === 429 || body?.error?.code === "rate_limit_exceeded";
}

function groqIsAuthError(status) {
  return status === 401 || status === 403;
}

// ─────────────────────────────────────────────
// OPENROUTER ADAPTER (closure-based)
// ─────────────────────────────────────────────

function openrouterApiKey() {
  return (getEnv("VITE_OPENROUTER_API_KEY") || "").trim();
}

function openrouterIsAvailable() {
  return Boolean(openrouterApiKey());
}

function openrouterBuildBody(systemPrompt, history, query, model) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === "model" ? "assistant" : "user",
      content: h.parts?.[0]?.text || "",
    })),
    { role: "user", content: query },
  ];
  return {
    model,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
    stream: true,
  };
}

function openrouterHeaders(key) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
    "X-Title": "Placement Hub Assistant",
  };
}

function openrouterParseStreamLine(line) {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (raw === "[DONE]") return null;
  try {
    const data = JSON.parse(raw);
    return data?.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

function openrouterParseResponse(data) {
  return data?.choices?.[0]?.message?.content || "";
}

function openrouterIsQuotaError(status, body) {
  return status === 429 || body?.error?.code === "rate_limit_exceeded";
}

function openrouterIsAuthError(status) {
  return status === 401 || status === 403;
}

// ─────────────────────────────────────────────
// GENERIC OPENAI-COMPATIBLE ADAPTER
// Reusable for Cerebras, Mistral, DeepSeek, xAI, etc.
// ─────────────────────────────────────────────

function createOpenAICompatibleAdapter(config) {
  const { envKey, baseUrl, defaultModel } = config;

  function apiKey() {
    return (getEnv(envKey) || "").trim();
  }

  function isAvailable() {
    return Boolean(apiKey());
  }

  function buildBody(systemPrompt, history, query, model) {
    return {
      model: model || defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({
          role: h.role === "model" ? "assistant" : "user",
          content: h.parts?.[0]?.text || "",
        })),
        { role: "user", content: query },
      ],
      max_tokens: 2048,
      temperature: 0.7,
      stream: true,
    };
  }

  function headers(key) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };
  }

  function streamUrl() {
    return baseUrl;
  }

  function nonStreamUrl() {
    return baseUrl;
  }

  function parseResponse(data) {
    return data?.choices?.[0]?.message?.content || "";
  }

  function parseStreamLine(line) {
    if (!line.startsWith("data: ")) return null;
    const raw = line.slice(6).trim();
    if (raw === "[DONE]") return null;
    try {
      const data = JSON.parse(raw);
      return data?.choices?.[0]?.delta?.content || null;
    } catch {
      return null;
    }
  }

  function isQuotaError(status, body) {
    return status === 429 || body?.error?.code === "rate_limit_exceeded";
  }

  function isAuthError(status) {
    return status === 401 || status === 403;
  }

  return {
    apiKey,
    isAvailable,
    buildBody,
    headers,
    streamUrl,
    nonStreamUrl,
    parseResponse,
    parseStreamLine,
    isQuotaError,
    isAuthError,
  };
}

// ─────────────────────────────────────────────
// CEREBRAS ADAPTER
// ─────────────────────────────────────────────

const cerebrasAdapter = createOpenAICompatibleAdapter({
  id: "cerebras",
  name: "Cerebras",
  envKey: "VITE_CEREBRAS_API_KEY",
  baseUrl: "https://api.cerebras.ai/v1/chat/completions",
  defaultModel: "llama-3.3-70b",
});

// ─────────────────────────────────────────────
// MISTRAL ADAPTER
// ─────────────────────────────────────────────

const mistralAdapter = createOpenAICompatibleAdapter({
  id: "mistral",
  name: "Mistral",
  envKey: "VITE_MISTRAL_API_KEY",
  baseUrl: "https://api.mistral.ai/v1/chat/completions",
  defaultModel: "mistral-small-latest",
});

// ─────────────────────────────────────────────
// DEEPSEEK ADAPTER
// ─────────────────────────────────────────────

const deepseekAdapter = createOpenAICompatibleAdapter({
  id: "deepseek",
  name: "DeepSeek",
  envKey: "VITE_DEEPSEEK_API_KEY",
  baseUrl: "https://api.deepseek.com/v1/chat/completions",
  defaultModel: "deepseek-chat",
});

// ─────────────────────────────────────────────
// xAI (GROK) ADAPTER
// ─────────────────────────────────────────────

const xaiAdapter = createOpenAICompatibleAdapter({
  id: "xai",
  name: "xAI (Grok)",
  envKey: "VITE_XAI_API_KEY",
  baseUrl: "https://api.x.ai/v1/chat/completions",
  defaultModel: "grok-4",
});

// ─────────────────────────────────────────────
// CLOUDFLARE WORKERS AI ADAPTER
// ─────────────────────────────────────────────

function cloudflareApiKey() {
  return (getEnv("VITE_CLOUDFLARE_API_TOKEN") || "").trim();
}

function cloudflareAccountId() {
  return (getEnv("VITE_CLOUDFLARE_ACCOUNT_ID") || "").trim();
}

function cloudflareIsAvailable() {
  return Boolean(cloudflareApiKey()) && Boolean(cloudflareAccountId());
}

function cloudflareBuildBody(systemPrompt, history, query, model) {
  return {
    model: model || "@cf/meta/llama-3.3-70b-instruct-fp16",
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.parts?.[0]?.text || "",
      })),
      { role: "user", content: query },
    ],
    max_tokens: 2048,
    temperature: 0.7,
    stream: true,
  };
}

function cloudflareHeaders(key) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

function cloudflareStreamUrl() {
  const accountId = cloudflareAccountId();
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
}

function cloudflareParseResponse(data) {
  return data?.choices?.[0]?.message?.content || "";
}

function cloudflareParseStreamLine(line) {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (raw === "[DONE]") return null;
  try {
    const data = JSON.parse(raw);
    return data?.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

function cloudflareIsQuotaError(status, body) {
  return status === 429 || body?.error?.code === "rate_limit_exceeded";
}

function cloudflareIsAuthError(status) {
  return status === 401 || status === 403;
}

// ─────────────────────────────────────────────
// PROVIDER REGISTRY
// ─────────────────────────────────────────────

export const FREE_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    priority: 1,
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", tier: "best" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (lightweight)", tier: "lightweight" },
    ],
    isAvailable: geminiIsAvailable,
    apiKey: geminiApiKey,
    buildBody: geminiBuildBody,
    headers: geminiHeaders,
    streamUrl: geminiStreamUrl,
    nonStreamUrl: geminiNonStreamUrl,
    parseResponse: geminiParseResponse,
    parseStreamLine: geminiParseStreamLine,
    isQuotaError: geminiIsQuotaError,
    isAuthError: geminiIsAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
    sdkStream: geminiSdkStream,
    sdkNonStream: geminiSdkNonStream,
    useSdk: true,
  },
  {
    id: "groq",
    name: "Groq",
    priority: 2,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tier: "best" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", tier: "lightweight" },
    ],
    isAvailable: groqIsAvailable,
    apiKey: groqApiKey,
    buildBody: groqBuildBody,
    headers: groqHeaders,
    streamUrl: () => "https://api.groq.com/openai/v1/chat/completions",
    nonStreamUrl: () => "https://api.groq.com/openai/v1/chat/completions",
    parseResponse: groqParseResponse,
    parseStreamLine: groqParseStreamLine,
    isQuotaError: groqIsQuotaError,
    isAuthError: groqIsAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    priority: 3,
    models: [
      { id: "openrouter/free", label: "OpenRouter Free Router", tier: "best" },
      { id: "openrouter/free", label: "OpenRouter Free Router (lightweight)", tier: "lightweight" },
    ],
    isAvailable: openrouterIsAvailable,
    apiKey: openrouterApiKey,
    buildBody: openrouterBuildBody,
    headers: openrouterHeaders,
    streamUrl: () => "https://openrouter.ai/api/v1/chat/completions",
    nonStreamUrl: () => "https://openrouter.ai/api/v1/chat/completions",
    parseResponse: openrouterParseResponse,
    parseStreamLine: openrouterParseStreamLine,
    isQuotaError: openrouterIsQuotaError,
    isAuthError: openrouterIsAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    priority: 4,
    models: [
      { id: "llama-3.3-70b", label: "Cerebras Llama 3.3 70B", tier: "best" },
      { id: "qwen3-32b", label: "Cerebras Qwen3 32B", tier: "lightweight" },
    ],
    isAvailable: cerebrasAdapter.isAvailable,
    apiKey: cerebrasAdapter.apiKey,
    buildBody: cerebrasAdapter.buildBody,
    headers: cerebrasAdapter.headers,
    streamUrl: cerebrasAdapter.streamUrl,
    nonStreamUrl: cerebrasAdapter.nonStreamUrl,
    parseResponse: cerebrasAdapter.parseResponse,
    parseStreamLine: cerebrasAdapter.parseStreamLine,
    isQuotaError: cerebrasAdapter.isQuotaError,
    isAuthError: cerebrasAdapter.isAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "mistral",
    name: "Mistral",
    priority: 5,
    models: [
      { id: "mistral-small-latest", label: "Mistral Small", tier: "best" },
      { id: "mistral-tiny-latest", label: "Mistral Tiny", tier: "lightweight" },
    ],
    isAvailable: mistralAdapter.isAvailable,
    apiKey: mistralAdapter.apiKey,
    buildBody: mistralAdapter.buildBody,
    headers: mistralAdapter.headers,
    streamUrl: mistralAdapter.streamUrl,
    nonStreamUrl: mistralAdapter.nonStreamUrl,
    parseResponse: mistralAdapter.parseResponse,
    parseStreamLine: mistralAdapter.parseStreamLine,
    isQuotaError: mistralAdapter.isQuotaError,
    isAuthError: mistralAdapter.isAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    priority: 6,
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3", tier: "best" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", tier: "lightweight" },
    ],
    isAvailable: deepseekAdapter.isAvailable,
    apiKey: deepseekAdapter.apiKey,
    buildBody: deepseekAdapter.buildBody,
    headers: deepseekAdapter.headers,
    streamUrl: deepseekAdapter.streamUrl,
    nonStreamUrl: deepseekAdapter.nonStreamUrl,
    parseResponse: deepseekAdapter.parseResponse,
    parseStreamLine: deepseekAdapter.parseStreamLine,
    isQuotaError: deepseekAdapter.isQuotaError,
    isAuthError: deepseekAdapter.isAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    priority: 7,
    models: [
      { id: "grok-4", label: "Grok 4", tier: "best" },
      { id: "grok-4-fast", label: "Grok 4 Fast", tier: "lightweight" },
    ],
    isAvailable: xaiAdapter.isAvailable,
    apiKey: xaiAdapter.apiKey,
    buildBody: xaiAdapter.buildBody,
    headers: xaiAdapter.headers,
    streamUrl: xaiAdapter.streamUrl,
    nonStreamUrl: xaiAdapter.nonStreamUrl,
    parseResponse: xaiAdapter.parseResponse,
    parseStreamLine: xaiAdapter.parseStreamLine,
    isQuotaError: xaiAdapter.isQuotaError,
    isAuthError: xaiAdapter.isAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    priority: 8,
    models: [
      { id: "@cf/meta/llama-3.3-70b-instruct-fp16", label: "Cloudflare Llama 3.3 70B", tier: "best" },
      { id: "@cf/meta/llama-3.1-8b-instruct-fp16", label: "Cloudflare Llama 3.1 8B", tier: "lightweight" },
    ],
    isAvailable: cloudflareIsAvailable,
    apiKey: cloudflareApiKey,
    buildBody: cloudflareBuildBody,
    headers: cloudflareHeaders,
    streamUrl: cloudflareStreamUrl,
    nonStreamUrl: cloudflareStreamUrl,
    parseResponse: cloudflareParseResponse,
    parseStreamLine: cloudflareParseStreamLine,
    isQuotaError: cloudflareIsQuotaError,
    isAuthError: cloudflareIsAuthError,
    cooldownDuration: COOLDOWN_DURATION_MS,
  },
];

// ─────────────────────────────────────────────
// PROVIDER STATUS TRACKER
// ─────────────────────────────────────────────

class ProviderStatusTracker {
  constructor() {
    this._status = {};
    for (const p of FREE_PROVIDERS) {
      this._status[p.id] = {
        available: true,
        cooldownUntil: 0,
        lastError: null,
        lastSuccess: null,
        consecutiveFailures: 0,
      };
    }
  }

  isInCooldown(providerId) {
    const s = this._status[providerId];
    if (!s) return false;
    if (Date.now() < s.cooldownUntil) return true;
    if (!s.available && s.cooldownUntil > 0 && Date.now() >= s.cooldownUntil) {
      s.available = true;
      s.cooldownUntil = 0;
      log(`Provider "${providerId}" cooldown expired — re-enabled`);
    }
    return false;
  }

  markQuotaExceeded(providerId, error) {
    const provider = FREE_PROVIDERS.find((p) => p.id === providerId);
    const cooldownMs = provider?.cooldownDuration || COOLDOWN_DURATION_MS;
    this._status[providerId] = {
      ...this._status[providerId],
      available: false,
      cooldownUntil: Date.now() + cooldownMs,
      lastError: { type: "quota", message: error, time: Date.now() },
      consecutiveFailures: (this._status[providerId]?.consecutiveFailures || 0) + 1,
    };
    warn(`Provider "${providerId}" → COOLDOWN (${cooldownMs / 1000}s) | error: ${error}`);
  }

  markAuthError(providerId, error) {
    this._status[providerId] = {
      ...this._status[providerId],
      available: false,
      cooldownUntil: Infinity,
      lastError: { type: "auth", message: error, time: Date.now() },
      consecutiveFailures: (this._status[providerId]?.consecutiveFailures || 0) + 1,
    };
    warn(`Provider "${providerId}" → AUTH_ERROR (permanent) | error: ${error}`);
  }

  markSuccess(providerId) {
    this._status[providerId] = {
      ...this._status[providerId],
      available: true,
      cooldownUntil: 0,
      lastSuccess: Date.now(),
      lastError: null,
      consecutiveFailures: 0,
    };
    log(`Provider "${providerId}" → SUCCESS`);
  }

  getAvailableProviders() {
    return FREE_PROVIDERS.filter((p) => {
      if (!p.isAvailable()) return false;
      if (this.isInCooldown(p.id)) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  getAllConfiguredProviders() {
    return FREE_PROVIDERS.filter((p) => p.isAvailable());
  }

  resetAll() {
    for (const p of FREE_PROVIDERS) {
      this._status[p.id] = {
        available: true,
        cooldownUntil: 0,
        lastError: null,
        lastSuccess: null,
        consecutiveFailures: 0,
      };
    }
    log("All provider cooldowns reset");
  }

  resetProvider(providerId) {
    const s = this._status[providerId];
    if (s) {
      s.available = true;
      s.cooldownUntil = 0;
      s.lastError = null;
      s.consecutiveFailures = 0;
      log(`Provider "${providerId}" manually reset`);
    }
  }

  getStatus() {
    const result = {};
    for (const p of FREE_PROVIDERS) {
      const s = this._status[p.id];
      result[p.id] = {
        configured: p.isAvailable(),
        available: s.available && p.isAvailable(),
        inCooldown: this.isInCooldown(p.id),
        cooldownUntil: s.cooldownUntil,
        lastError: s.lastError,
        lastSuccess: s.lastSuccess,
        consecutiveFailures: s.consecutiveFailures,
      };
    }
    return result;
  }
}

export const providerStatus = new ProviderStatusTracker();

/**
 * Select the best model for a given complexity level.
 * Returns { provider, model } or null.
 */
export function selectBestModel(complexity = "best") {
  const available = providerStatus.getAvailableProviders();

  if (available.length === 0) {
    warn("No available providers for selection");
    return null;
  }

  for (const provider of available) {
    const model = provider.models.find((m) => m.tier === complexity) || provider.models[0];
    if (model) {
      log(`Selected: ${provider.name} / ${model.id} (tier=${model.tier}, complexity=${complexity})`);
      return { provider, model };
    }
  }

  return null;
}

/**
 * Log which providers are configured at startup.
 */
export function logProviderStatus() {
  const configured = FREE_PROVIDERS.filter((p) => p.isAvailable());
  const notConfigured = FREE_PROVIDERS.filter((p) => !p.isAvailable());

  log("=== Provider Status ===");
  for (const p of configured) {
    log(`  [OK] ${p.name} (${p.id}) — configured, priority=${p.priority}`);
  }
  for (const p of notConfigured) {
    log(`  [--] ${p.name} (${p.id}) — NOT configured (no API key)`);
  }
  log("=======================");
}
