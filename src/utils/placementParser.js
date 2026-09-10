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
