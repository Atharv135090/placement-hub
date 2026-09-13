import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : "";

console.log("API Key configured:", Boolean(apiKey));

const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
  const modelsToTest = ["gemini-3.5-flash"];
  for (const modelName of modelsToTest) {
    try {
      console.log(`\nTesting model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello! What is your name?");
      const text = result.response.text();
      console.log(`SUCCESS [${modelName}]:`, text);
      return;
    } catch (err) {
      console.error(`FAILED [${modelName}]:`, err.message);
    }
  }
}

testModels();
