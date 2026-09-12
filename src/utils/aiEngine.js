import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

let genAI = null;
let model = null;

function isValidGeminiKey(key) {
  return key && key.startsWith("AIzaSy") && key.length > 30;
}

export function isAIConfigured() {
  return isValidGeminiKey(GEMINI_API_KEY);
}

function getGeminiModel() {
  if (!model && isValidGeminiKey(GEMINI_API_KEY)) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    } catch (err) {
      console.error("Failed to initialize Gemini:", err);
      model = null;
    }
  }
  return model;
}

export function getPlacementContext(applications, companies, savedIds, profile, user) {
  var savedCompanies = companies.filter(function(c) { return savedIds.includes(c.id); });
  var interviews = applications.filter(function(a) { return a.status === "interview"; });
  var shortlisted = applications.filter(function(a) { return a.status === "shortlisted"; });
  return {
    totalApplications: applications.length,
    applied: applications.filter(function(a) { return a.status === "applied"; }).length,
    shortlisted: shortlisted.length,
    interviews: interviews.length,
    offers: applications.filter(function(a) { return a.status === "offer" || a.status === "selected"; }).length,
    rejected: applications.filter(function(a) { return a.status === "rejected"; }).length,
    applicationDetails: applications.map(function(a) { return a.companyName + " — " + (a.role || "N/A") + " (" + a.status + ")"; }),
    savedCompanyNames: savedCompanies.map(function(c) { return c.name; }),
    totalCompanies: companies.length,
    branch: (profile && profile.branch) || "Not specified",
    gradYear: (profile && profile.gradYear) || "Not specified",
    userName: (profile && profile.displayName) || (user && user.displayName) || "there",
  };
}

function buildSystemPrompt(ctx) {
  var prompt = "You are Placement Hub Assistant — a helpful, friendly AI for college students.\n" +
    "You can answer ANY question: coding, CS concepts, general knowledge, career advice, daily life, jokes, translations, study plans, email writing, and more.\n" +
    "You also have access to the user's placement data. Use it when relevant.\n" +
    "Respond naturally and conversationally. Use markdown for code blocks and formatting.\n" +
    "Keep answers concise but complete. If the user asks for code, provide working code examples.\n" +
    "Do not restrict yourself to placement topics — answer everything like a general-purpose AI assistant.";

  if (ctx) {
    prompt += "\n\nUser's placement data:\n" +
      "- Name: " + (ctx.userName || "Student") + "\n" +
      "- Branch: " + (ctx.branch || "N/A") + "\n" +
      "- Graduation Year: " + (ctx.gradYear || "N/A") + "\n" +
      "- Total Applications: " + (ctx.totalApplications || 0) + "\n" +
      "- Applied: " + (ctx.applied || 0) + "\n" +
      "- Shortlisted: " + (ctx.shortlisted || 0) + "\n" +
      "- Interviews: " + (ctx.interviews || 0) + "\n" +
      "- Offers: " + (ctx.offers || 0) + "\n" +
      "- Rejected: " + (ctx.rejected || 0) + "\n" +
      "- Application Details: " + (ctx.applicationDetails || []).join("; ") + "\n" +
      "- Total Companies: " + (ctx.totalCompanies || 0);
  }

  return prompt;
}

export async function generateSmartResponse(query, ctx, messages) {
  var geminiModel = getGeminiModel();

  if (geminiModel) {
    try {
      var systemPrompt = buildSystemPrompt(ctx);

      var chatHistory = (messages || []).slice(0, -1).map(function(m) {
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        };
      });

      var chat = geminiModel.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I'm ready to help with anything!" }] },
        ].concat(chatHistory),
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.9,
        },
      });

      var result = await chat.sendMessage(query);
      var responseText = result.response.text();
      if (responseText && responseText.trim()) {
        return responseText;
      }
      return generateFallbackResponse(query, ctx);
    } catch (err) {
      console.error("Gemini API error:", err.message || err);
      if (err.message && err.message.includes("API key")) {
        console.warn("Invalid API key. Using fallback responses.");
      }
      return generateFallbackResponse(query, ctx);
    }
  }

  console.warn("Gemini model not available. Using fallback responses.");
  return generateFallbackResponse(query, ctx);
}

function generateFallbackResponse(query, ctx) {
  var lower = query.toLowerCase().trim();

  if (/^(hi|hello|hey|howdy|sup|yo|hola|namaste|good\s*(morning|afternoon|evening|night)|greetings)/i.test(lower)) {
    var time = new Date().getHours();
    var greeting = time < 12 ? "Good morning" : time < 17 ? "Good afternoon" : "Good evening";
    return greeting + ", " + ctx.userName + "! I'm your Placement Hub Assistant. I can help with coding, placement prep, general questions, or just chat. What's on your mind?";
  }

  if (/^(bye|goodbye|see you|ttyl|gn|goodnight)/i.test(lower)) {
    return "Goodbye, " + ctx.userName + "! Feel free to come back anytime. Good luck with your placement journey!";
  }

  if (/^(thanks|thank you|thx|ty|tysm|appreciate)/i.test(lower)) {
    return "You're welcome, " + ctx.userName + "! Happy to help. Let me know if there's anything else.";
  }

  if (/^(who are you|what are you|your name|what's your name|ur name)/i.test(lower)) {
    return "I'm your **Placement Hub Assistant** — your AI copilot for placements and beyond. I can help with coding, CS concepts, interview prep, career advice, and general questions. Just ask me anything!";
  }

  if (/^(what is my name|my name|who am i|what's my name)/i.test(lower)) {
    return "You're **" + ctx.userName + "**! You're logged into Placement Hub.";
  }

  if (/which companies|what companies|my applications|companies have i applied/i.test(lower)) {
    if (ctx.applicationDetails.length === 0) {
      return "You haven't applied to any companies yet. Browse the **Companies** page to find available placement drives and start applying!";
    }
    return "Here are the companies you've applied to:\n\n" + ctx.applicationDetails.map(function(a) { return "- **" + a + "**"; }).join("\n") + "\n\n**Total: " + ctx.totalApplications + "** application(s).";
  }

  if (/how many.*(applied|application)|count.*(applied|application)|total application/i.test(lower)) {
    return "You have **" + ctx.totalApplications + "** application(s):\n\n- Applied: **" + ctx.applied + "**\n- Shortlisted: **" + ctx.shortlisted + "**\n- Interviews: **" + ctx.interviews + "**\n- Offers: **" + ctx.offers + "**\n- Rejected: **" + ctx.rejected + "**";
  }

  if (/joke|funny|laugh/i.test(lower)) {
    var jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs!",
      "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
      "A SQL query walks into a bar, sees two tables, and asks... 'Can I JOIN you?'",
      "Why do Java developers wear glasses? Because they can't C#!",
      "What's a programmer's favorite hangout place? Foo Bar!",
      "How many programmers does it take to change a light bulb? None — that's a hardware problem!",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (/^what time|^current time|^tell.*time/i.test(lower)) {
    return "The current time is **" + new Date().toLocaleTimeString() + "** and the date is **" + new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + "**.";
  }

  return "I'm temporarily unable to connect to the AI service. Please try again in a moment.";
}
