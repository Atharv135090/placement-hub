// Field Aliases Map for Label-Aware Boundary Parsing
const FIELD_ALIASES = [
  { field: "companyName", labels: ["company name", "company", "organization name", "organisation name", "org name", "firm name", "employer"] },
  { field: "role", labels: ["job title", "role", "position", "profile", "designation", "job role", "job"] },
  { field: "employmentType", labels: ["employment type", "type of employment", "employment", "job type", "type"] },
  { field: "workMode", labels: ["work mode", "job mode", "mode of work", "mode", "work location type"] },
  { field: "ctc", labels: ["ctc", "package", "salary", "annual ctc", "compensation", "annual package", "pay"] },
  { field: "stipend", labels: ["stipend", "monthly stipend", "internship stipend"] },
  { field: "location", labels: ["location", "job location", "posting location", "place", "city", "workplace"] },
  { field: "industry", labels: ["industry", "domain", "sector"] },
  { field: "organizationSize", labels: ["organization size", "organisation size", "company size", "employee count", "org size"] },
  { field: "description", labels: ["description", "job description", "about company", "about job", "about", "details"] },
  { field: "eligibleCourses", labels: ["eligible courses", "eligible branches", "eligible streams", "courses", "branches", "eligible degree"] },
  { field: "eligibilityCriteria", labels: ["eligibility criteria", "academic criteria", "eligibility", "criteria", "min percentage", "cgpa criteria"] },
  { field: "registrationOpensAt", labels: ["registration opens", "registration open", "opens at", "opens", "start date", "registration start"] },
  { field: "registrationClosesAt", labels: ["registration closes", "registration close", "closes at", "closes", "deadline", "last date", "end date"] },
  { field: "companyWebsite", labels: ["company website", "website", "url", "portal url", "site"] },
  { field: "companyLogo", labels: ["company logo", "logo url", "logo", "icon"] },
  { field: "applicationLink", labels: ["application link", "registration link", "apply link", "job link", "link"] }
];

export function normalizeEmploymentType(val = "") {
  if (!val) return null;
  const lower = val.toLowerCase().trim();
  if (lower.includes("intern") && (lower.includes("full") || lower.includes("ppo"))) {
    return "Internship + Full-Time";
  }
  if (lower.includes("intern")) return "Internship";
  if (lower.includes("full")) return "Full-Time";
  if (lower.includes("contract")) return "Contract";
  if (lower.includes("part")) return "Part-Time";
  return val.trim();
}

export function normalizeWorkMode(val = "") {
  if (!val) return null;
  const lower = val.toLowerCase().trim();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  if (lower.includes("off campus") || lower.includes("off-campus")) return "Off Campus";
  if (lower.includes("on campus") || lower.includes("on-campus")) return "On Campus";
  return val.trim();
}

export function parseCourses(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return String(val)
    .split(/\n|,|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toLowerCase().startsWith("eligible courses"));
}

export function parseLabelAwareText(text = "") {
  if (!text || !text.trim()) return {};

  const cleanText = text.replace(/\r\n/g, "\n");
  const matches = [];

  const allLabels = [];
  for (const item of FIELD_ALIASES) {
    for (const lbl of item.labels) {
      allLabels.push({ field: item.field, labelText: lbl });
    }
  }
  allLabels.sort((a, b) => b.labelText.length - a.labelText.length);

  for (const { field, labelText } of allLabels) {
    const regex = new RegExp(`(?:^|\\n|\\s|;)${labelText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[:=\\-]\\s*`, "gi");
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      const matchStart = match.index + (match[0].match(/^\s+/) ? match[0].match(/^\s+/)[0].length : 0);
      const valueStart = match.index + match[0].length;

      const isOverlapping = matches.some(
        (m) => (matchStart >= m.matchStart && matchStart < m.valueStart)
      );

      if (!isOverlapping) {
        matches.push({
          field,
          labelText,
          matchStart,
          valueStart,
        });
      }
    }
  }

  if (matches.length === 0) return {};

  matches.sort((a, b) => a.matchStart - b.matchStart);
  const result = {};

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const nextStart = (i + 1 < matches.length) ? matches[i + 1].matchStart : cleanText.length;
    let extractedVal = cleanText.substring(curr.valueStart, nextStart).trim();
    extractedVal = extractedVal.replace(/^[;,\-\s]+|[;,\-\s]+$/g, "").trim();

    if (extractedVal) {
      if (curr.field === "eligibleCourses") {
        const courses = parseCourses(extractedVal);
        if (courses.length > 0) {
          result.eligibleCourses = result.eligibleCourses ? [...result.eligibleCourses, ...courses] : courses;
        }
      } else if (!result[curr.field]) {
        result[curr.field] = extractedVal;
      }
    }
  }

  if (result.employmentType) result.employmentType = normalizeEmploymentType(result.employmentType);
  if (result.workMode) result.workMode = normalizeWorkMode(result.workMode);
  if (result.role) result.title = result.role;

  return result;
}

/**
 * Natural Language Parser for conversational commands
 */
export function parseNaturalLanguageText(text = "") {
  if (!text || !text.trim()) return {};
  const data = {};
  const str = text.trim();
  const lower = str.toLowerCase();

  // 1. Detect Delete Intent
  if (lower.startsWith("delete") || lower.startsWith("remove")) {
    const delMatch = str.match(/(?:delete|remove)\s+(?:company\s+)?([a-z0-9\s&.-]+)/i);
    if (delMatch) {
      return { intent: "delete", companyName: delMatch[1].trim() };
    }
  }

  // 2. Detect Update Application Status Intent
  if (lower.includes("update") && (lower.includes("status") || lower.includes("application"))) {
    const statusMatch = lower.match(/(shortlisted|interview|selected|applied|rejected)/i);
    const compMatch = str.match(/(?:for|at|of)\s+([a-z0-9\s&.-]+?)(?:\s+to|\s+status|\.|$)/i);
    if (statusMatch) {
      return {
        intent: "update_status",
        status: statusMatch[1].toLowerCase(),
        companyName: compMatch ? compMatch[1].trim() : null,
      };
    }
  }

  // 3. Detect Search / Query Intent
  if (lower.startsWith("search") || lower.startsWith("show all") || lower.startsWith("find")) {
    const ctcFilterMatch = str.match(/ctc\s*(?:>|>=|above|over|more than)\s*([\d.]+)/i);
    if (ctcFilterMatch) {
      return { intent: "query_ctc", minCtc: parseFloat(ctcFilterMatch[1]) };
    }
    const searchTarget = str.replace(/^(?:search|show all|find)\s+(?:companies\s+)?/i, "").trim();
    return { intent: "search", query: searchTarget };
  }

  // 4. Pattern: "Add [Company] with [Role] role, [CTC] CTC and [Stipend] stipend. [Remote] [full-time]."
  const fullAddPattern = /add\s+([a-z0-9\s&.-]+?)\s+with\s+([a-z0-9\s&.-]+?)\s+(?:role|position|profile)/i;
  const fullAddMatch = str.match(fullAddPattern);
  if (fullAddMatch) {
    data.companyName = fullAddMatch[1].trim();
    data.role = fullAddMatch[2].trim();
  }

  // Fallback pattern: "Add [Company] for [Role]"
  if (!data.companyName) {
    const addPattern = /add\s+([a-z0-9\s&.-]+?)\s+(?:for|as|hiring for)\s+([a-z0-9\s&.-]+?)(?:,|\.|$)/i;
    const addMatch = str.match(addPattern);
    if (addMatch) {
      data.companyName = addMatch[1].trim();
      data.role = addMatch[2].trim();
    }
  }

  // Pattern: "[Company] is hiring [Role]"
  if (!data.companyName) {
    const hiringPattern = /([a-z0-9\s&.-]+?)\s+(?:is hiring|hiring|recruiting)\s+([a-z0-9\s&.-]+?)(?:,|\.|$)/i;
    const hiringMatch = str.match(hiringPattern);
    if (hiringMatch) {
      data.companyName = hiringMatch[1].trim();
      data.role = hiringMatch[2].trim();
    }
  }

  // CTC extraction: "14 LPA CTC" or "₹14,00,000 (14 LPA)" or "14 LPA"
  const ctcMatch = str.match(/(?:inr|₹)?\s*([\d,.]+\s*(?:lpa|lakhs?|cr))/i);
  if (ctcMatch) {
    const rawVal = ctcMatch[1].trim();
    data.ctc = rawVal.startsWith("₹") ? rawVal : `₹${rawVal.toUpperCase()}`;
  }

  // Stipend extraction: "35k stipend" or "₹35,000 stipend" or "35,000 stipend"
  const stipendMatch = str.match(/(?:inr|₹)?\s*([\d,k]+)\s*stipend/i) || str.match(/stipend\s*(?:is|=|:)?\s*(?:inr|₹)?\s*([\d,k]+)/i);
  if (stipendMatch) {
    let stVal = stipendMatch[1].trim();
    if (stVal.toLowerCase().endsWith("k")) {
      const num = parseFloat(stVal) * 1000;
      stVal = num.toLocaleString("en-IN");
    }
    data.stipend = `₹${stVal}`;
  }

  // Work Mode detection: Remote / Hybrid / On Campus
  if (lower.includes("remote")) data.workMode = "Remote";
  else if (lower.includes("hybrid")) data.workMode = "Hybrid";
  else if (lower.includes("on campus") || lower.includes("on-campus")) data.workMode = "On Campus";

  // Employment Type: Full-time / Internship
  if (lower.includes("full-time") || lower.includes("full time")) data.employmentType = "Full-Time";
  else if (lower.includes("internship") || lower.includes("intern")) data.employmentType = "Internship";

  // Location detection: "in Pune" or "at Bangalore"
  const locMatch = str.match(/(?:location|place|city)\s*(?:is|=|:)?\s*([a-z\s]+?)(?:,|\.|$)/i);
  if (locMatch) {
    data.location = locMatch[1].trim();
  } else if (data.workMode === "Remote") {
    data.location = "Remote";
  }

  if (data.role) data.title = data.role;
  return data;
}

export function extractPlacementData(text = "") {
  if (!text || !text.trim()) return {};

  const labelData = parseLabelAwareText(text);
  const nlData = parseNaturalLanguageText(text);

  const combined = { ...nlData, ...labelData };

  if (combined.role && !combined.title) combined.title = combined.role;
  if (combined.title && !combined.role) combined.role = combined.title;

  return combined;
}

// ─── POD.ai STRUCTURED PARSER ──────────────────────────────────
// PRD §3: Structural labels are NEVER data.
// PRD §6: Missing fields = "Not Specified"
// PRD §13: Every operation is a fresh transaction.
// PRD §4: Field-boundary detection, NOT line-based splitting.

// Structural labels that must NEVER become field values (PRD §26)
const STRUCTURAL_LABELS = [
  "add drive from pod",
  "add drive",
  "create company",
  "from pod company",
  "pod company",
  "company",
  "drive",
  "source",
];

// All known field headers used as boundaries for extraction.
// Order matters: longest labels first to prevent partial matches.
const ALL_FIELD_HEADERS = [
  // Company fields
  { key: "organisationDescription", label: "organisation description", aliases: ["organization description", "about the organisation", "about the organization", "about organisation", "about organization", "company description", "org description"] },
  { key: "organisationSize", label: "organisation size", aliases: ["organization size", "org size", "company size"] },
  { key: "companyName", label: "company name", aliases: [] },
  { key: "companyLogo", label: "company logo", aliases: ["logo url", "logo", "icon"] },
  // Drive fields
  { key: "eligibleCourses", label: "eligible courses", aliases: ["eligible branches", "eligible streams", "courses", "branches", "eligible degree"] },
  { key: "eligibilityCriteria", label: "eligibility criteria", aliases: ["eligibility", "academic criteria", "criteria", "min percentage", "cgpa criteria"] },
  { key: "registrationOpensAt", label: "registration opens", aliases: ["registration opens at", "registration open", "opens at", "start date", "registration start"] },
  { key: "registrationClosesAt", label: "registration closes", aliases: ["registration closes at", "registration close", "closes at", "deadline", "last date", "end date"] },
  { key: "employmentType", label: "employment type", aliases: ["type of employment", "job type"] },
  { key: "jobTitle", label: "job title", aliases: ["role", "position", "designation", "job role"] },
  { key: "otherBenefits", label: "other benefits", aliases: ["benefits"] },
  { key: "attachment", label: "attachment", aliases: [] },
  { key: "industry", label: "industry", aliases: ["domain", "sector"] },
  { key: "location", label: "location", aliases: ["job location", "posting location", "place", "city", "workplace"] },
  { key: "description", label: "description", aliases: ["job description", "about job"] },
  { key: "stipend", label: "stipend", aliases: ["monthly stipend", "internship stipend"] },
  { key: "ctc", label: "ctc", aliases: ["cost to company", "package", "salary", "annual ctc"] },
  { key: "source", label: "source", aliases: [] },
];

// Build all label→key mappings for boundary detection
function buildAllLabelMappings() {
  const allLabels = [];
  for (const entry of ALL_FIELD_HEADERS) {
    allLabels.push({ key: entry.key, label: entry.label });
    for (const alias of entry.aliases) {
      allLabels.push({ key: entry.key, label: alias });
    }
  }
  // Sort longest first for correct matching
  allLabels.sort((a, b) => b.label.length - a.label.length);
  return allLabels;
}

const ALL_LABEL_MAPPINGS = buildAllLabelMappings();

// Build regex pattern for matching any field header
const FIELD_HEADER_PATTERN = ALL_LABEL_MAPPINGS
  .map(e => e.label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
  .join("|");

/**
 * Extract fields from text using FIELD-BOUNDARY detection.
 * Uses the same approach as parseLabelAwareText: find all header positions,
 * then extract values between consecutive headers.
 * Works whether fields are on separate lines OR on the same line.
 */
function extractFieldsByBoundary(text, allowedKeys) {
  if (!text || !text.trim()) return {};

  const cleanText = text.replace(/\r\n/g, "\n");
  const matches = [];

  // Find all field headers in the text with their positions
  const regex = new RegExp(`(?:^|\\n|\\s|;)(${FIELD_HEADER_PATTERN})\\s*[:=]\\s*`, "gi");
  let match;
  while ((match = regex.exec(cleanText)) !== null) {
    const headerText = match[1].toLowerCase().trim();
    const mapping = ALL_LABEL_MAPPINGS.find(e => e.label === headerText);
    if (mapping && allowedKeys.includes(mapping.key)) {
      // Skip leading whitespace so matchStart points to the header text, not the whitespace before it
      const leadingWs = match[0].match(/^\s+/);
      const matchStart = match.index + (leadingWs ? leadingWs[0].length : 0);
      const valueStart = match.index + match[0].length;
      // Skip if overlapping with a previously matched value
      const isOverlapping = matches.some(
        m => matchStart >= m.matchStart && matchStart < m.valueStart
      );
      if (!isOverlapping) {
        matches.push({ key: mapping.key, matchStart, valueStart });
      }
    }
  }

  if (matches.length === 0) return {};

  matches.sort((a, b) => a.matchStart - b.matchStart);

  const result = {};

  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const nextStart = (i + 1 < matches.length) ? matches[i + 1].matchStart : cleanText.length;
    let value = cleanText.substring(curr.valueStart, nextStart).trim();
    // Clean trailing delimiters
    value = value.replace(/^[;,\-\s]+|[;,\-\s]+$/g, "").trim();

    if (value) {
      if (curr.key === "eligibleCourses") {
        const courses = value.split(/\n|,|;/)
          .map(s => s.replace(/^[*•\-–]\s+/, "").trim())
          .filter(s => s.length > 0 && !s.toLowerCase().startsWith("eligible courses"));
        if (courses.length > 0) {
          result.eligibleCourses = result.eligibleCourses ? [...result.eligibleCourses, ...courses] : courses;
        }
      } else if (!result[curr.key]) {
        result[curr.key] = value;
      }
    }
  }

  return result;
}

// Strip structural labels that appear before the actual content
function stripStructuralLabels(text) {
  let result = text;
  // Remove "ADD DRIVE FROM POD" / "ADD DRIVE" header
  result = result.replace(/^\s*(?:ADD DRIVE FROM POD|ADD DRIVE)\s*\n?/im, "");
  // Remove "CREATE COMPANY" header
  result = result.replace(/^\s*CREATE COMPANY\s*\n?/im, "");
  // Remove "FROM POD COMPANY" prefix
  result = result.replace(/^\s*FROM POD COMPANY\s*\n?/im, "");
  // Remove standalone structural label lines (COMPANY, DRIVE, SOURCE)
  const lines = result.split("\n").filter(l => {
    const trimmed = l.trim().toLowerCase();
    return !STRUCTURAL_LABELS.includes(trimmed);
  });
  return lines.join("\n");
}

// ─── PUBLIC: Parse ADD DRIVE FROM POD ──────────────────────────
export function parsePodDriveMessage(text) {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  // Must contain "ADD DRIVE" somewhere
  if (!/add\s+drive\b/i.test(trimmed)) return null;

  // Find section boundaries (COMPANY / DRIVE / SOURCE)
  const lines = trimmed.split("\n").map(l => l.replace(/\r/g, ""));
  let companyStart = -1, driveStart = -1, sourceStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toLowerCase();
    if (l === "company") companyStart = i + 1;
    else if (l === "drive") driveStart = i + 1;
    else if (l === "source") sourceStart = i + 1;
  }

  // PRD §4: Field-boundary detection — works even without section headers
  const companyKeys = ["companyName", "companyLogo", "organisationDescription", "industry", "organisationSize"];
  const driveKeys = ["jobTitle", "employmentType", "location", "ctc", "stipend", "description", "otherBenefits", "registrationOpensAt", "registrationClosesAt", "eligibleCourses", "eligibilityCriteria", "attachment"];
  const sourceKeys = ["source"];

  let companyData = {}, driveData = {}, sourceData = {};

  if (driveStart !== -1) {
    // Multiline with section headers: extract per-section, exclude boundary lines
    const companyEnd = driveStart - 1;  // Exclude the "Drive" line itself
    const companyText = companyStart !== -1
      ? lines.slice(companyStart, companyEnd).join("\n")
      : "";
    const driveEnd = sourceStart !== -1 ? sourceStart - 1 : lines.length;
    const driveText = lines.slice(driveStart, driveEnd).join("\n");
    const sourceText = sourceStart !== -1
      ? lines.slice(sourceStart).join("\n")
      : "";

    companyData = extractFieldsByBoundary(companyText, companyKeys);
    driveData = extractFieldsByBoundary(driveText, driveKeys);
    sourceData = extractFieldsByBoundary(sourceText, sourceKeys);
  }

  // Fallback: try field-boundary extraction on full text (handles single-line format)
  if (!companyData.companyName && !driveData.jobTitle) {
    const allKeys = [...companyKeys, ...driveKeys, ...sourceKeys];
    const allData = extractFieldsByBoundary(trimmed, allKeys);
    if (allData.companyName) companyData.companyName = allData.companyName;
    if (allData.companyLogo) companyData.companyLogo = allData.companyLogo;
    if (allData.organisationDescription) companyData.organisationDescription = allData.organisationDescription;
    if (allData.industry) companyData.industry = allData.industry;
    if (allData.organisationSize) companyData.organisationSize = allData.organisationSize;
    if (allData.jobTitle) driveData.jobTitle = allData.jobTitle;
    if (allData.employmentType) driveData.employmentType = allData.employmentType;
    if (allData.location) driveData.location = allData.location;
    if (allData.ctc) driveData.ctc = allData.ctc;
    if (allData.stipend) driveData.stipend = allData.stipend;
    if (allData.description) driveData.description = allData.description;
    if (allData.otherBenefits) driveData.otherBenefits = allData.otherBenefits;
    if (allData.registrationOpensAt) driveData.registrationOpensAt = allData.registrationOpensAt;
    if (allData.registrationClosesAt) driveData.registrationClosesAt = allData.registrationClosesAt;
    if (allData.eligibleCourses) driveData.eligibleCourses = allData.eligibleCourses;
    if (allData.eligibilityCriteria) driveData.eligibilityCriteria = allData.eligibilityCriteria;
    if (allData.attachment) driveData.attachment = allData.attachment;
    if (allData.source) sourceData.source = allData.source;
  }

  // Validate
  if (!companyData.companyName && !driveData.jobTitle) return null;

  return { companyData, driveData, sourceData };
}

// ─── PUBLIC: Parse CREATE COMPANY structured format ─────────────
export function parseCreateCompanyMessage(text) {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  // Must contain "CREATE COMPANY"
  if (!/create\s+company\b/i.test(trimmed)) return null;

  // Strip structural labels
  const cleaned = stripStructuralLabels(trimmed);

  // Extract company fields using boundary detection
  const companyKeys = ["companyName", "companyLogo", "organisationDescription", "industry", "organisationSize"];
  const sourceKeys = ["source"];

  const companyData = extractFieldsByBoundary(cleaned, companyKeys);
  const sourceData = extractFieldsByBoundary(cleaned, sourceKeys);

  // Must have at least a company name
  if (!companyData.companyName) return null;

  return { companyData, sourceData };
}

// ─── VALIDATION: Check if companyName contains field headers ────
const COMPANY_FIELD_HEADERS = [
  "company name", "company logo", "organisation description", "organization description",
  "about the organisation", "about the organization", "about organisation", "about organization",
  "company description", "org description", "organisation size", "organization size",
  "org size", "company size", "industry", "domain", "sector",
  "job title", "role", "position", "designation",
  "employment type", "location", "ctc", "stipend",
  "eligible courses", "eligibility criteria", "eligibility",
  "registration opens", "registration closes",
  "description", "job description", "attachment",
  "source", "create company", "add drive", "from pod company",
];

export function validateCompanyName(name) {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  for (const header of COMPANY_FIELD_HEADERS) {
    if (lower.includes(header + ":") || lower.includes(header + " :") || lower.includes(header + "=")) {
      return false;  // Company name contains a field header — invalid
    }
  }
  return true;
}

// Keep old exports for backward compatibility
export { parsePodDriveMessage as parseStructuredDriveBlock };
