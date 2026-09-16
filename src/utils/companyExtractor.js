/**
 * Company/Drive Dynamic Extraction Engine
 *
 * Parses natural language extracted from screenshots into
 * structured Company + Drive data for Firebase creation.
 *
 * PRD: Admin Assistant Dynamic Company/Drive Extraction & Creation Fix
 */

import { findCompanyByName, addCompany } from "../services/firestore/companies";
import { addJob, getJobsByCompany } from "../services/firestore/jobs";

// ─── FIELD LABEL NORMALIZATION ──────────────────────────────

const COMPANY_FIELD_MAP = {
  name: [
    "company name", "organisation name", "organization name",
    "employer name", "company",
  ],
  industry: ["industry", "sector", "company industry", "business sector"],
  organisationSize: [
    "organisation size", "organization size", "company size",
    "employee size", "employees",
  ],
  location: [
    "company location", "office location", "headquarters", "hq",
    "location",
  ],
  website: [
    "website url", "company website", "official website", "website",
  ],
  contactEmail: [
    "contact email", "company email", "hr email",
    "recruitment email", "careers email", "email",
  ],
  logoUrl: [
    "logo url", "company logo url", "company logo", "logo",
  ],
  description: [
    "organisation description", "organization description",
    "company description", "about organisation", "about organization",
    "about company", "company overview", "company about",
    "description",
  ],
};

const DRIVE_FIELD_MAP = {
  title: [
    "job / drive title", "drive title", "position title",
    "job title", "job role", "role", "position", "opening", "designation",
  ],
  type: [
    "employment type", "job type", "employment", "work type",
  ],
  location: [
    "job location", "work location", "office location", "location",
  ],
  workMode: [
    "work mode", "working mode", "mode",
    "remote/onsite", "remote / on-site", "remote", "on-site", "hybrid",
  ],
  package: [
    "ctc", "cost to company", "package", "salary", "compensation",
    "annual package", "annual ctc", "annual salary",
  ],
  stipend: [
    "stipend", "internship stipend", "monthly stipend",
  ],
  description: [
    "job description", "role description", "job details",
    "opportunity description", "description",
  ],
  otherDetails: [
    "additional details", "additional information", "benefits",
    "other information", "other details",
  ],
  eligibility: [
    "eligible courses", "eligible course", "courses",
    "eligible branches", "eligible departments", "eligibility",
  ],
  eligibilityCriteria: [
    "eligibility criteria", "eligibility requirements",
    "requirements", "academic criteria", "criteria",
  ],
  registrationOpens: [
    "registration opens", "registration open", "opens",
    "opening date", "application opens",
  ],
  registrationCloses: [
    "registration closes", "registration close", "closes",
    "closing date", "application closes", "deadline",
  ],
  applicationStatus: [
    "application status", "drive status", "application type",
  ],
  registrationStatus: [
    "registration status", "registration state",
  ],
  applicationLink: [
    "application link", "apply link", "apply url",
    "application url", "application portal",
  ],
};

// ─── INTENT DETECTION ───────────────────────────────────────

const ADD_INTENT_PATTERNS = [
  /^(add|create|save|put|insert)\s+(this|the|that|above|above company|this company|this drive|this placement|this job)/i,
  /^(add|create|save)\s+(it|them)/i,
  /^(add|create|save)\s+(a\s+)?(company|drive|placement|job)/i,
  /(add|create|save)\s+(this|the|that)\s+(company|drive|placement|job)/i,
  /(add|create)\s+(this|the|that)\s+(company|drive|placement|job)?\s*(to|in|under|into)?\s*(placement\s*hub|database|db|the\s*system)/i,
  /^add\s+it/i,
  /^add\s+this/i,
  /^add\s+the\s+above/i,
  /^save\s+it/i,
  /^create\s+it/i,
  /^put\s+it/i,
  /add\s+this\s+(company|drive|placement)/i,
  /add\s+(this|the)\s+drive/i,
  /create\s+(a\s+)?drive/i,
  /add\s+(a\s+)?placement/i,
  /add\s+(a\s+)?job/i,
];

const COMPANY_ONLY_PATTERNS = [
  /add\s+(only\s+)?the\s+company/i,
  /add\s+(only\s+)?company/i,
  /create\s+(only\s+)?the\s+company/i,
  /only\s+add\s+(the\s+)?company/i,
  /company\s+only/i,
];

const DRIVE_ONLY_PATTERNS = [
  /add\s+(only\s+)?the\s+(drive|placement|job)/i,
  /add\s+(only\s+)?(drive|placement|job)/i,
  /only\s+add\s+(the\s+)?(drive|placement|job)/i,
  /(drive|placement|job)\s+only/i,
];

const UNDER_COMPANY_PATTERNS = [
  /(?:add|create|put)\s+(?:this|the|that)?\s*(?:drive|placement|job)?\s*(?:under|for|to|in)\s+(?:the\s+)?(?:existing\s+)?(.+?)(?:\.|$)/i,
  /(?:add|create)\s+(?:this|the)?\s*(?:drive|placement|job)\s+under\s+(.+?)(?:\.|$)/i,
];

export function detectAddIntent(text) {
  if (!text) return { intent: false };
  const trimmed = text.trim();

  for (const pattern of COMPANY_ONLY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: true, scope: "company_only" };
    }
  }

  for (const pattern of DRIVE_ONLY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: true, scope: "drive_only" };
    }
  }

  for (const pattern of UNDER_COMPANY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { intent: true, scope: "drive_under_company", targetCompany: match[1]?.trim() };
    }
  }

  for (const pattern of ADD_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: true, scope: "auto" };
    }
  }

  return { intent: false };
}

// ─── FIELD EXTRACTION ───────────────────────────────────────

function stripLabelFromLine(line) {
  return line.replace(/^[\s\-\*\•\·\»\>\:]+/, "").trim();
}

function findFieldValue(line, labelVariants) {
  // Strip trailing colon + whitespace from line before matching
  // Handles "Company Name:", "CTC:", "Job / Drive Title:" etc.
  const lineClean = line.replace(/[:\s]+$/, "").trim();
  const lower = lineClean.toLowerCase();

  for (const label of labelVariants) {
    const labelLower = label.toLowerCase();

    // Exact start: "Company Name: eQ Technologic" → label "company name"
    // Must be followed by a delimiter (space, colon, dash) or end of string
    // to avoid matching "organisation" when the line has "organisation size"
    if (lower.startsWith(labelLower)) {
      const afterLabel = lower.slice(labelLower.length);
      // If there's more text, it must start with a delimiter, not a word char
      if (afterLabel.length > 0 && /[a-z0-9]/.test(afterLabel[0])) {
        continue; // Skip — this label is a prefix of a longer field name
      }
      const value = line.slice(label.length).trim();
      const cleaned = stripLabelFromLine(value);
      return cleaned || null;
    }

    // Contained label: "Location / Work Mode: Remote" → label "work mode"
    const idx = lower.indexOf(labelLower);
    if (idx !== -1) {
      const after = line.slice(idx + label.length).trim();
      if (after) {
        return stripLabelFromLine(after);
      }
    }
  }
  return null;
}

function parseTextIntoLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function isCompanyFieldLabel(line) {
  const lower = line.toLowerCase().replace(/[:\-]$/, "").trim();
  for (const variants of Object.values(COMPANY_FIELD_MAP)) {
    for (const v of variants) {
      if (lower === v.toLowerCase() || lower.startsWith(v.toLowerCase())) return true;
    }
  }
  return false;
}

function isDriveFieldLabel(line) {
  const lower = line.toLowerCase().replace(/[:\-]$/, "").trim();
  for (const variants of Object.values(DRIVE_FIELD_MAP)) {
    for (const v of variants) {
      if (lower === v.toLowerCase() || lower.startsWith(v.toLowerCase())) return true;
    }
  }
  return false;
}

function looksLikeCompanyHeader(line) {
  const lower = line.toLowerCase().trim();
  const skipWords = [
    "company", "job role", "role", "employment", "location", "ctc",
    "stipend", "description", "eligible", "eligibility", "registration",
    "industry", "organisation", "organization", "about", "work mode",
    "other details", "attachment", "eligible courses", "eligibility criteria",
    "on campus", "off campus", "application", "registration schedule",
    "annual", "salary", "package", "cost to company", "position",
    "designation", "job title", "sector", "work type", "work location",
    "company size", "company description", "company website",
    "contact email", "logo", "remote", "hybrid", "internship",
    "full-time", "part-time", "contract",
  ];
  if (skipWords.some((w) => lower.startsWith(w))) return false;
  if (lower.includes(":")) return false;
  if (line.length > 80) return false;
  if (/^\d/.test(line)) return false;
  // Skip degree/course names (B.E., B.Tech, MCA, M.Tech, B.Sc, etc.)
  if (/^(b\.?e\.?|b\.?tech|m\.?tech|m\.?ca|b\.?sc|m\.?sc|b\.?com|m\.?com|b\.?ba|m\.?ba|b\.?ed|ph\.?d)/i.test(lower)) return false;
  return true;
}

function looksLikeCompanyName(text) {
  const trimmed = text.trim();
  if (trimmed.length > 60) return false;
  if (trimmed.length < 2) return false;
  if (/^\d/.test(trimmed)) return false;
  if (/^[a-z]/.test(trimmed) && trimmed === trimmed.toLowerCase()) return false;
  return true;
}

// ─── DATE PARSING ───────────────────────────────────────────

function parseDateString(text) {
  if (!text) return null;
  const trimmed = text.trim();

  const isoMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const ddmmyyyy = trimmed.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const spoken = trimmed.match(
    new RegExp(`(\\d{1,2})[\\s\\-]?(${monthNames.join("|")})[\\s\\-]?(\\d{4})`, "i")
  );
  if (spoken) {
    const [, d, mon, y] = spoken;
    const m = monthNames.indexOf(mon.toLowerCase().slice(0, 3)) + 1;
    return `${y}-${String(m).padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return trimmed;
}

function parseRegistrationDates(text) {
  const lower = text.toLowerCase();
  let opens = null;
  let closes = null;

  const opensMatch = text.match(/opens?\s*[:\-]?\s*(.+)/i);
  const closesMatch = text.match(/clos(?:es?|ing)\s*[:\-]?\s*(.+)/i);
  const deadlineMatch = text.match(/deadline\s*[:\-]?\s*(.+)/i);
  const startMatch = text.match(/start(?:s|ing)?\s*[:\-]?\s*(.+)/i);
  const endMatch = text.match(/end(?:s|ing)?\s*[:\-]?\s*(.+)/i);

  if (opensMatch) opens = parseDateString(opensMatch[1]);
  if (!opens && startMatch) opens = parseDateString(startMatch[1]);
  if (closesMatch) closes = parseDateString(closesMatch[1]);
  if (!closes && deadlineMatch) closes = parseDateString(deadlineMatch[1]);
  if (!closes && endMatch) closes = parseDateString(endMatch[1]);

  if (!opens && !closes) {
    const rangeMatch = text.match(/(\d{1,2})[\s\-\/to]+(\w+)[\s\-\/]+(\d{4})\s*(?:to|[-–])\s*(\d{1,2})[\s\-\/]+(\w+)[\s\-\/]+(\d{4})/i);
    if (rangeMatch) {
      opens = parseDateString(`${rangeMatch[1]} ${rangeMatch[2]} ${rangeMatch[3]}`);
      closes = parseDateString(`${rangeMatch[4]} ${rangeMatch[5]} ${rangeMatch[6]}`);
    }
  }

  if (!opens && !closes) {
    const dashMatch = text.match(/(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4})\s*(?:to|[-–])\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4})/i);
    if (dashMatch) {
      opens = parseDateString(dashMatch[1]);
      closes = parseDateString(dashMatch[2]);
    }
  }

  return { opens, closes };
}

// ─── MAIN EXTRACTION ────────────────────────────────────────

export function extractCompanyAndDrive(text) {
  if (!text) return { company: null, drive: null };

  const lines = parseTextIntoLines(text);
  const company = {
    name: null,
    industry: null,
    organisationSize: null,
    location: null,
    description: null,
    website: null,
    contactEmail: null,
    logoUrl: null,
  };
  const drive = {
    title: null,
    type: null,
    location: null,
    workMode: null,
    package: null,
    stipend: null,
    description: null,
    otherDetails: null,
    eligibility: null,
    eligibilityCriteria: null,
    registrationOpens: null,
    registrationCloses: null,
    applicationStatus: null,
    registrationStatus: null,
    applicationLink: null,
  };

  let foundCompanyName = false;
  let multiLineBuffer = null;
  let multiLineKey = null;
  let multiLineTarget = null;

  // Pending label: when "Company:" appears alone on a line, value is on NEXT line
  let pendingLabel = null; // { field, target, isMultiLine }

  function flushMultiLine() {
    if (multiLineKey && multiLineBuffer) {
      const val = multiLineBuffer.trim();
      if (val) {
        if (multiLineTarget === "company" && company.hasOwnProperty(multiLineKey)) {
          company[multiLineKey] = (company[multiLineKey] || "") + (company[multiLineKey] ? "\n" : "") + val;
        } else if (multiLineTarget === "drive" && drive.hasOwnProperty(multiLineKey)) {
          drive[multiLineKey] = (drive[multiLineKey] || "") + (drive[multiLineKey] ? "\n" : "") + val;
        }
      }
      multiLineBuffer = null;
      multiLineKey = null;
      multiLineTarget = null;
    }
  }

  function flushPendingLabel() {
    pendingLabel = null;
  }

  function setFieldWithPending(field, target, value, isMultiLine) {
    if (target === "company") {
      if (field === "name" && value.length > 0) {
        company.name = value;
        foundCompanyName = true;
      } else if (isMultiLine) {
        company[field] = value;
        multiLineBuffer = value;
        multiLineKey = field;
        multiLineTarget = "company";
      } else {
        company[field] = value;
      }
    } else if (target === "drive") {
      if (isMultiLine) {
        drive[field] = value;
        multiLineBuffer = value;
        multiLineKey = field;
        multiLineTarget = "drive";
      } else {
        drive[field] = value;
      }
    }
  }

  function tryMatchFieldLabel(line) {
    const stripped = line.toLowerCase().trim().replace(/[:]+$/, "").trim();
    if (!stripped) return null;

    // Check company fields
    for (const [field, variants] of Object.entries(COMPANY_FIELD_MAP)) {
      for (const v of variants) {
        const vl = v.toLowerCase();
        if (stripped === vl || stripped.startsWith(vl + " ")) {
          return { field, target: "company", isMultiLine: field === "description" };
        }
      }
    }

    // Check drive fields — try exact/closest match first
    for (const [field, variants] of Object.entries(DRIVE_FIELD_MAP)) {
      for (const v of variants) {
        const vl = v.toLowerCase();
        if (stripped === vl || stripped.startsWith(vl + " ")) {
          const isMultiLine = field === "description" || field === "otherDetails" || field === "eligibility" || field === "eligibilityCriteria";
          return { field, target: "drive", isMultiLine };
        }
      }
    }

    // Fallback: check if stripped contains a known label (handles "Location / Work Mode:", "Job/Drive Title:", etc.)
    for (const [field, variants] of Object.entries(DRIVE_FIELD_MAP)) {
      for (const v of variants) {
        const vl = v.toLowerCase();
        if (vl.length >= 4 && stripped.includes(vl)) {
          const isMultiLine = field === "description" || field === "otherDetails" || field === "eligibility" || field === "eligibilityCriteria";
          return { field, target: "drive", isMultiLine };
        }
      }
    }
    for (const [field, variants] of Object.entries(COMPANY_FIELD_MAP)) {
      for (const v of variants) {
        const vl = v.toLowerCase();
        if (vl.length >= 4 && stripped.includes(vl)) {
          return { field, target: "company", isMultiLine: field === "description" };
        }
      }
    }

    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().trim();

    // Skip separators
    if (/^[\=\-\*\•\·]{3,}$/.test(line)) {
      flushMultiLine();
      flushPendingLabel();
      continue;
    }

    // Check for registration schedule block
    if (lower.startsWith("registration schedule") || lower === "registration schedule:") {
      flushMultiLine();
      flushPendingLabel();
      const remaining = lines.slice(i + 1).join(" ");
      const { opens, closes } = parseRegistrationDates(remaining);
      if (opens) drive.registrationOpens = opens;
      if (closes) drive.registrationCloses = closes;
      continue;
    }

    // Check for inline registration range
    const regRangeMatch = line.match(/registration\s*(?:opens?\s*[:\-]?\s*(.+?)\s*(?:to|[-–]|clos(?:es?|ing)\s*[:\-]?\s*(.+)))/i);
    if (regRangeMatch) {
      flushMultiLine();
      flushPendingLabel();
      if (regRangeMatch[1]) {
        const { opens, closes } = parseRegistrationDates(line);
        if (opens) drive.registrationOpens = opens;
        if (closes) drive.registrationCloses = closes;
      }
      continue;
    }

    // ── Handle pending label (value was on previous line) ──
    if (pendingLabel) {
      const { field, target, isMultiLine } = pendingLabel;
      const value = line.trim();
      if (value) {
        // If multi-line field, check if this line is actually a new label
        if (isMultiLine && tryMatchFieldLabel(line)) {
          flushPendingLabel();
        } else {
          setFieldWithPending(field, target, value, isMultiLine);
          flushPendingLabel();
          continue;
        }
      }
    }

    // ── Multi-line continuation ──
    if (multiLineKey) {
      const nextLabel = tryMatchFieldLabel(line);
      if (!nextLabel && line.length > 0) {
        multiLineBuffer += "\n" + line;
        continue;
      } else if (nextLabel) {
        flushMultiLine();
      }
    }

    // ── Try company fields (same line: "Label: Value") ──
    let matched = false;
    // Sort company field variants by length descending so longer labels match first
    // e.g. "organisation size" must match before "organisation"
    const companyFieldEntries = Object.entries(COMPANY_FIELD_MAP).map(([field, variants]) => {
      const sorted = [...variants].sort((a, b) => b.length - a.length);
      return [field, sorted];
    });
    for (const [field, variants] of companyFieldEntries) {
      const value = findFieldValue(line, variants);
      if (value !== null) {
        flushMultiLine();
        flushPendingLabel();
        if (field === "name" && value.length > 0) {
          company.name = value;
          foundCompanyName = true;
        } else if (field === "description") {
          company.description = value;
          multiLineBuffer = value;
          multiLineKey = "description";
          multiLineTarget = "company";
        } else {
          company[field] = value;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // ── Try drive fields (same line: "Label: Value") ──
    for (const [field, variants] of Object.entries(DRIVE_FIELD_MAP)) {
      const value = findFieldValue(line, variants);
      if (value !== null) {
        flushMultiLine();
        flushPendingLabel();
        if (field === "description") {
          drive.description = value;
          multiLineBuffer = value;
          multiLineKey = "description";
          multiLineTarget = "drive";
        } else if (field === "otherDetails") {
          drive.otherDetails = value;
          multiLineBuffer = value;
          multiLineKey = "otherDetails";
          multiLineTarget = "drive";
        } else if (field === "eligibility" || field === "eligibilityCriteria") {
          drive[field] = value;
          multiLineBuffer = value;
          multiLineKey = field;
          multiLineTarget = "drive";
        } else if (field === "registrationOpens" || field === "registrationCloses") {
          drive[field] = parseDateString(value);
        } else if (field === "workMode") {
          drive.workMode = normalizeWorkMode(value);
        } else {
          drive[field] = value;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // ── Detect standalone label (value on next line) ──
    const fieldLabel = tryMatchFieldLabel(line);
    if (fieldLabel) {
      flushMultiLine();
      flushPendingLabel();
      pendingLabel = fieldLabel;
      continue;
    }

    // ── No company name found yet — try to detect it ──
    if (!foundCompanyName && looksLikeCompanyHeader(line) && looksLikeCompanyName(line)) {
      flushMultiLine();
      flushPendingLabel();
      company.name = line.replace(/^[\s\-\*\•]+/, "").trim();
      foundCompanyName = true;
      continue;
    }

    flushPendingLabel();
  }

  flushMultiLine();
  flushPendingLabel();

  // If we found a title-like field but no company name, try to extract from title context
  if (!company.name && drive.title) {
    const atMatch = drive.title.match(/(.+?)\s+(?:at|@|for)\s+(.+)/i);
    if (atMatch) {
      drive.title = atMatch[1].trim();
      company.name = atMatch[2].trim();
    }
  }

  return { company, drive };
}

function normalizeWorkMode(text) {
  const lower = text.toLowerCase();
  if (lower.includes("remote") || lower.includes("work from home") || lower.includes("wfh")) return "Remote";
  if (lower.includes("hybrid") || lower.includes("remote + office")) return "Hybrid";
  if (lower.includes("on-site") || lower.includes("onsite") || lower.includes("office")) return "On-site";
  return text;
}

// ─── COMPANY CREATION FLOW ──────────────────────────────────

let lastExtractedData = null;

export function setLastExtractedData(data) {
  lastExtractedData = data;
}

export function getLastExtractedData() {
  return lastExtractedData;
}

export async function executeCompanyCreation(extractedData, scope = "auto", targetCompanyName = null) {
  const { company, drive } = extractedData;

  if (!company.name && !drive.title) {
    return {
      success: false,
      message: "I couldn't identify a company name or job role from the information you provided. Please check the text and try again.",
    };
  }

  // Check for existing company
  let existingCompany = null;
  if (company.name) {
    const result = await findCompanyByName(company.name);
    if (result.data) {
      existingCompany = result.data;
    }
  }

  // If "drive under company" mode, look up by target name
  if (scope === "drive_under_company" && targetCompanyName) {
    const result = await findCompanyByName(targetCompanyName);
    if (result.data) {
      existingCompany = result.data;
    } else {
      return {
        success: false,
        message: `I couldn't find a company named "${targetCompanyName}" in Placement HUB. Please add the company first or check the spelling.`,
      };
    }
  }

  const results = [];
  let companyCreated = false;
  let companyId = null;

  if (existingCompany) {
    companyId = existingCompany.id;
    results.push(`Found existing company: **${existingCompany.name}**`);

    if (scope === "company_only") {
      return {
        success: true,
        message: `ℹ️ **${existingCompany.name}** already exists in Placement HUB. No duplicate was created.`,
        companyId,
      };
    }
  } else if (company.name && scope !== "drive_only") {
    // Create new company
    const companyData = {
      name: company.name,
      industry: company.industry || "",
      location: company.location || "",
      organisationSize: company.organisationSize || "",
      description: company.description || "",
      website: company.website || "",
      contactEmail: company.contactEmail || "",
      logoUrl: company.logoUrl || "",
    };

    const res = await addCompany(companyData);
    if (res.error) {
      return {
        success: false,
        message: `Failed to create company "${company.name}": ${res.error}`,
      };
    }
    companyId = res.data.id;
    companyCreated = true;
    results.push(`✅ Created company: **${company.name}**`);
  } else if (scope === "drive_only" && !existingCompany) {
    return {
      success: false,
      message: "I need to know which company to add this drive under. Please specify the company name.",
    };
  }

  // Create drive if we have a title and a companyId
  const hasDriveData = drive.title || drive.type || drive.package || drive.stipend;
  if (hasDriveData && companyId && scope !== "company_only") {
    const eligibleCourses = Array.isArray(drive.eligibility)
      ? drive.eligibility
      : (drive.eligibility || "").split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    const jobData = {
      companyId,
      companyName: company.name || existingCompany?.name || "",
      title: drive.title || "",
      jobTitle: drive.title || "",
      type: drive.type || "",
      employmentType: drive.type || "",
      location: drive.location || "",
      workMode: drive.workMode || "",
      package: drive.package || "",
      ctc: drive.package || "",
      stipend: drive.stipend || "",
      description: drive.description || "",
      otherBenefits: drive.otherDetails || "",
      registrationOpensAt: drive.registrationOpens || "",
      registrationClosesAt: drive.registrationCloses || "",
      deadline: drive.registrationCloses || "",
      eligibleCourses,
      eligibility: drive.eligibilityCriteria || "",
      eligibilityCriteria: drive.eligibilityCriteria || "",
      applicationLink: drive.applicationLink || "",
      attachment: "",
      source: "admin_assistant",
      isActive: true,
    };

    // Check for duplicate drive
    const existingJobs = await getJobsByCompany(companyId);
    const duplicate = (existingJobs.data || []).find(
      (j) => j.title && j.title.toLowerCase() === jobData.title.toLowerCase()
    );
    if (duplicate) {
      results.push(`ℹ️ Drive **${jobData.title}** already exists under ${existingCompany?.name || company.name}. No duplicate was created.`);
    } else {
      const jobRes = await addJob(jobData);
      if (jobRes.error) {
        results.push(`⚠️ Company was ${companyCreated ? "created" : "found"}, but failed to create drive: ${jobRes.error}`);
        return {
          success: true,
          message: results.join("\n\n"),
          companyId,
          partial: true,
        };
      }
      results.push(`✅ Created drive: **${jobData.title}**`);
    }
  }

  if (results.length === 0) {
    return {
      success: false,
      message: "I found some information but couldn't determine what to create. Please specify whether you want to add the company, the drive, or both.",
    };
  }

  const companyName = company.name || existingCompany?.name || "Unknown";
  let summary = results.join("\n\n");

  if (companyCreated && hasDriveData && companyId) {
    summary = `✅ **${companyName}** has been added to Placement HUB and the **${drive.title || "drive"}** was created.`;
  } else if (companyCreated) {
    summary = `✅ **${companyName}** has been added to Placement HUB.`;
  } else if (existingCompany && hasDriveData) {
    summary = `✅ **${drive.title || "Drive"}** was added under the existing company **${existingCompany.name}**.`;
  } else if (existingCompany) {
    summary = `ℹ️ **${existingCompany.name}** already exists in Placement HUB. No duplicate was created.`;
  }

  return {
    success: true,
    message: summary,
    companyId,
  };
}
