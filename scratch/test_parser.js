import { extractPlacementData } from "../src/utils/placementParser.js";

console.log("=== RUNNING ACCEPTANCE TESTS ===\n");

// Acceptance Test 1
const input1 = `Company: eQ Technologic
Role: Software Engineer Fresher
Employment Type: Internship + Full-Time
Work Mode: Remote
CTC: INR 14,00,000
Stipend: INR 35,000
Location: Remote Working
Industry: IT / Computers - Software`;

console.log("--- TEST 1 ---");
const result1 = extractPlacementData(input1);
console.log(JSON.stringify(result1, null, 2));

// Acceptance Test 2
const input2 = `Company: Noovosoft Technologies
Role: Application Developer
Employment Type: Internship + Full-Time
CTC: INR 6,00,000
Stipend: INR 18,000
Location: Remote Working
Industry: IT / Computers - Software
Organization Size: 2,001 - 10,000
Eligible Courses: B.E. - Computer Science & Engineering, B.E. - Information Technology
Eligibility Criteria: 60% throughout in academics`;

console.log("\n--- TEST 2 ---");
const result2 = extractPlacementData(input2);
console.log(JSON.stringify(result2, null, 2));

// Acceptance Test 3 (Single Line Multi-Field)
const input3 = `Company: ABC Role: Software Engineer CTC: INR 8 LPA Location: Pune`;
console.log("\n--- TEST 3 (Single Line) ---");
const result3 = extractPlacementData(input3);
console.log(JSON.stringify(result3, null, 2));

// Acceptance Test 4 (Natural Language)
const input4 = `Add ABC for Software Engineer, 8 LPA, Pune.`;
console.log("\n--- TEST 4 (Natural Language) ---");
const result4 = extractPlacementData(input4);
console.log(JSON.stringify(result4, null, 2));
