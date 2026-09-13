import fs from "fs";

// Mock import.meta.env for node test
const envContent = fs.readFileSync(".env", "utf8");
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : "";

globalThis.import = {
  meta: {
    env: {
      VITE_GEMINI_API_KEY: apiKey
    }
  }
};
process.env.VITE_GEMINI_API_KEY = apiKey;

async function testEngine() {
  const { generateSmartResponse, getPlacementContext } = await import("../src/utils/aiEngine.js");

  const mockCtx = getPlacementContext(
    [{ companyName: "Google", role: "SDE-1", status: "applied" }],
    [{ id: "1", name: "Google", role: "SDE-1", package: "30 LPA" }],
    ["1"],
    { displayName: "Raj", branch: "Computer Engineering", gradYear: "2026" },
    { displayName: "Raj" }
  );

  const testPrompts = [
    "hi",
    "what's your name?",
    "what are you doing?",
    "why?",
    "explain binary search",
    "give me interview tips",
    "tell me a joke",
    "what companies are available?"
  ];

  console.log("=== TESTING AI ENGINE WITH PROMPTS ===");
  for (const prompt of testPrompts) {
    console.log(`\nUser: "${prompt}"`);
    const response = await generateSmartResponse(prompt, mockCtx, []);
    console.log(`Assistant: ${response.slice(0, 150)}...`);
  }
}

testEngine();
