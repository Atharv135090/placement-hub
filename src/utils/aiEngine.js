import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash";

export function getGeminiApiKey() {
  const key =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.VITE_GEMINI_API_KEY);
  return (key || "").trim();
}

export function isAIConfigured() {
  const key = getGeminiApiKey();
  return Boolean(key);
}

if (typeof window !== "undefined") {
  console.log("[Placement AI Engine] Gemini API Key configured:", isAIConfigured());
}

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

/**
 * Format and sanitize multi-turn conversation history for Gemini API.
 * Ensures roles strictly alternate (user -> model -> user -> model) starting with 'user'.
 */
function formatGeminiHistory(messages) {
  if (!Array.isArray(messages) || messages.length <= 1) return [];

  const prior = messages.slice(0, -1);
  const formatted = [];
  let expectedRole = "user";

  for (const m of prior) {
    const text = (m.text || "").trim();
    if (!text) continue;

    const role = m.role === "assistant" || m.role === "model" ? "model" : "user";

    if (role === expectedRole) {
      formatted.push({
        role: role,
        parts: [{ text: text }],
      });
      expectedRole = role === "user" ? "model" : "user";
    }
  }

  if (formatted.length > 0 && formatted[formatted.length - 1].role === "user") {
    formatted.pop();
  }

  return formatted;
}

/**
 * Build the full contents array for REST API: system context + history + current query.
 */
function buildContents(systemPrompt, history, query) {
  return [
    { role: "user", parts: [{ text: `[System Context: ${systemPrompt}]` }] },
    { role: "model", parts: [{ text: "Understood. I am ready to assist as Placement Hub Assistant!" }] },
    ...history,
    { role: "user", parts: [{ text: query }] },
  ];
}

/**
 * Primary: Use @google/genai SDK.
 */
async function trySdk(apiKey, systemPrompt, history, query) {
  const ai = new GoogleGenAI({ apiKey });

  const chat = ai.chats.create({
    model: MODEL,
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

/**
 * Fallback: Direct REST API call with x-goog-api-key header.
 */
async function tryRest(apiKey, systemPrompt, history, query) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: buildContents(systemPrompt, history, query),
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    }),
  });

  const data = await res.json();

  if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }

  if (data?.error) {
    const err = data.error;
    if (err.code === 401 || err.code === 403 || err.status === "UNAUTHENTICATED") {
      throw new Error("AUTH_FAILED");
    }
    if (err.code === 404 || err.status === "NOT_FOUND") {
      throw new Error("MODEL_NOT_FOUND");
    }
    if (err.code === 429 || err.status === "RESOURCE_EXHAUSTED") {
      throw new Error("RATE_LIMIT");
    }
    throw new Error(err.message || "REST_ERROR");
  }

  throw new Error("EMPTY_RESPONSE");
}

export async function generateSmartResponse(query, ctx, messages) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.error("[Placement AI Engine Error] VITE_GEMINI_API_KEY is not defined in .env file.");
    return "⚠️ **Configuration Error**: Missing Gemini API Key (`VITE_GEMINI_API_KEY`). Please add a valid Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey) to your `.env` file and restart the dev server.";
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const history = formatGeminiHistory(messages);

  // 1. Primary: SDK
  try {
    const text = await trySdk(apiKey, systemPrompt, history, query);
    if (text && text.trim()) {
      return text.trim();
    }
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn(`[Placement AI Engine] SDK failed:`, msg);

    if (msg === "AUTH_FAILED" || msg.includes("401") || msg.includes("403") || msg.includes("API key") || msg.includes("API_KEY_INVALID")) {
      return "⚠️ **Authentication Failure**: Gemini API request failed due to an invalid or unauthorized API key. Please check your `VITE_GEMINI_API_KEY` in `.env`.";
    }
  }

  // 2. Fallback: REST
  try {
    const text = await tryRest(apiKey, systemPrompt, history, query);
    if (text && text.trim()) {
      return text.trim();
    }
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(`[Placement AI Engine] REST failed:`, msg);

    if (msg === "AUTH_FAILED") {
      return "⚠️ **Authentication Failure**: Gemini API request failed due to an invalid or unauthorized API key. Please check your `VITE_GEMINI_API_KEY` in `.env`.";
    }
    if (msg === "MODEL_NOT_FOUND") {
      return "⚠️ **Model Unavailable**: The configured Gemini model (`" + MODEL + "`) is not available. Please check your Gemini API configuration.";
    }
    if (msg === "RATE_LIMIT") {
      return "⚠️ **Rate Limit Exceeded**: Gemini API quota limit reached. Please wait a moment and try again.";
    }
  }

  // 3. All failed
  console.error("[Placement AI Engine Error] All Gemini AI API requests failed. Check network or VITE_GEMINI_API_KEY.");
  return "⚠️ **Service Unavailable**: Unable to reach the Gemini AI service. Please try again in a moment.";
}
