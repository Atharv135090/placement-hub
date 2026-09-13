import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = (
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_GEMINI_API_KEY)
  || (typeof process !== "undefined" && process?.env?.VITE_GEMINI_API_KEY)
  || ""
).trim();

if (typeof window !== "undefined") {
  console.log("[aiEngine] VITE_GEMINI_API_KEY loaded:", GEMINI_API_KEY ? `present (${GEMINI_API_KEY.length} chars, starts with ${GEMINI_API_KEY.slice(0, 6)}...)` : "MISSING");
}

export function isAIConfigured() {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 5);
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

  // Exclude current/last query which will be sent as the new prompt
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

  // Ensure history ends on model turn if non-empty
  if (formatted.length > 0 && formatted[formatted.length - 1].role === "user") {
    formatted.pop();
  }

  return formatted;
}

export async function generateSmartResponse(query, ctx, messages) {
  const apiKey = GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[Placement AI Engine Error] VITE_GEMINI_API_KEY is not defined in .env file.");
    return "⚠️ **Configuration Error**: Missing Gemini API Key (`VITE_GEMINI_API_KEY`). Please add a valid Gemini API Key from [Google AI Studio](https://aistudio.google.com/apikey) to your `.env` file and restart the dev server.";
  }

  const systemPrompt = buildSystemPrompt(ctx);
  const history = formatGeminiHistory(messages);

  // 1. Primary Attempt: @google/generative-ai SDK
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

  for (const modelName of modelsToTry) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({
        history: history,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(query);
      const responseText = result?.response?.text();

      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
    } catch (err) {
      console.warn(`[Placement AI Engine] SDK model '${modelName}' attempt failed:`, err.message || err);

      if (err.message && (err.message.includes("401") || err.message.includes("403") || err.message.includes("API key") || err.message.includes("authentication"))) {
        console.error("[Placement AI Engine Technical Error] Gemini API Key Authentication Failure:", {
          model: modelName,
          apiKeySnippet: apiKey.slice(0, 8) + "...",
          error: err,
        });
        break; // Stop trying other models if API key is unauthorized/invalid
      }
    }
  }

  // 2. Secondary Attempt: Direct REST API Endpoint
  for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const contents = [
        { role: "user", parts: [{ text: `[System Context: ${systemPrompt}]` }] },
        { role: "model", parts: [{ text: "Understood. I am ready to assist as Placement Hub Assistant!" }] },
        ...history,
        { role: "user", parts: [{ text: query }] },
      ];

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      }

      if (data?.error) {
        console.error(`[Placement AI Engine REST Error] ${modelName} returned HTTP ${res.status}:`, {
          code: data.error.code,
          status: data.error.status,
          message: data.error.message,
          details: data.error.details,
        });

        if (data.error.code === 401 || data.error.code === 403 || data.error.status === "UNAUTHENTICATED") {
          return `⚠️ **Gemini AI API Error (${data.error.code} ${data.error.status})**: ${data.error.message}\n\n*Technical Details:* The \`VITE_GEMINI_API_KEY\` defined in your \`.env\` file is invalid or unauthorized. Please get a free API key from [Google AI Studio](https://aistudio.google.com/apikey) and update your \`.env\` file.`;
        }
      }
    } catch (restErr) {
      console.error(`[Placement AI Engine REST Exception] ${modelName} fetch failed:`, restErr);
    }
  }

  // 3. Fallback when AI service cannot be reached
  console.error("[Placement AI Engine Error] All Gemini AI API requests failed. Check network or VITE_GEMINI_API_KEY.");
  return "⚠️ **AI Connection Error**: Unable to reach the Gemini AI service. Full technical diagnostic logs have been output to your browser console (F12). Please verify your `VITE_GEMINI_API_KEY` in `.env`.";
}
