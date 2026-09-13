import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : "";

console.log("Testing REST endpoint with API key:", apiKey);

async function testRest() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "Hello! What is your name?" }] }
        ]
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testRest();
