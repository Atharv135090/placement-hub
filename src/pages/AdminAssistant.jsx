import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  getJobs,
  addJob,
  deleteJob,
  getAllUsers,
  getAllApplications,
  deleteAllCompanies,
  deleteAllApplications,
} from "../services/firestore";
import "./AdminAssistant.css";
import { parsePodDriveMessage, parseCreateCompanyMessage, validateCompanyName } from "../utils/placementParser";

// Security check: Never expose internal prompts, PRDs, or rules
function isAskingForInstructions(text) {
  const lower = (text || "").toLowerCase();
  return (
    lower.includes("system prompt") ||
    lower.includes("instructions") ||
    lower.includes("prd") ||
    lower.includes("hidden rules") ||
    lower.includes("developer instructions") ||
    lower.includes("internal rules") ||
    lower.includes("show me your prompt") ||
    lower.includes("show your prompt") ||
    lower.includes("tell me your prompt") ||
    lower.includes("reveal your instructions") ||
    lower.includes("what are your instructions") ||
    lower.includes("architecture instructions") ||
    lower.includes("security rules") ||
    lower.includes("hidden context")
  );
}

// Helper: Normalize string for comparison
function clean(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export default function AdminAssistant({ onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Chat conversation
  const [messages, setMessages] = useState([
    {
      id: "init-welcome",
      role: "assistant",
      text: "Hi! How can I help you manage Placement Hub today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Live Firebase caches
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);

  // Fresh data ref — always holds the latest Firebase data (not stale React state)
  const freshDataRef = useRef({ companies: [], jobs: [], users: [], applications: [] });

  // Multi-turn conversation context
  const [activeDriveDraft, setActiveDriveDraft] = useState(null);
  const [lastCreatedDrive, setLastCreatedDrive] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      navigate("/admin");
    }
  }

  // Refresh live Firebase data — returns fresh data for immediate use
  const refreshData = useCallback(async () => {
    try {
      const [compRes, jobsRes, usersRes, appsRes] = await Promise.all([
        getCompanies(),
        getJobs(),
        getAllUsers(),
        getAllApplications(),
      ]);
      const freshCompanies = compRes.data || [];
      const freshJobs = jobsRes.data || [];
      const freshUsers = usersRes.data || [];
      const freshApps = appsRes.data || [];
      setCompanies(freshCompanies);
      setJobs(freshJobs);
      setUsers(freshUsers);
      setApplications(freshApps);
      // Update ref so processMessage can use fresh data immediately
      freshDataRef.current = { companies: freshCompanies, jobs: freshJobs, users: freshUsers, applications: freshApps };
      return freshDataRef.current;
    } catch (err) {
      console.error("AdminAssistant failed to load Firebase data:", err);
      return freshDataRef.current;
    }
  }, []);

  useEffect(() => {
    refreshData();
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [refreshData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirmation, busy]);

  function addMsg(role, text, extra = {}) {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        role,
        text,
        ...extra,
      },
    ]);
  }

  // Find company by natural matching — uses fresh Firebase data, NOT stale React state
  function findCompany(nameQuery, list) {
    // Always use fresh data from ref (not stale React state)
    const companyList = list || freshDataRef.current.companies;
    if (!nameQuery) return null;
    const q = clean(nameQuery);
    if (!q) return null;

    // Exact normalized match (highest priority)
    let found = companyList.find((c) => clean(c.name) === q);
    if (found) return found;

    // Abbreviation match (e.g. "eq" → "eQ Technologic")
    found = companyList.find((c) => {
      const cname = clean(c.name);
      // Only match abbreviations if the abbreviation is at least 3 chars
      // or if the full name is short (like "eQ")
      if (q.length >= 3 && cname.includes(q)) return true;
      if (q.length < 3 && cname.startsWith(q) && cname.length <= q.length + 15) return true;
      return false;
    });
    if (found) return found;

    // Substring match — require significant overlap to prevent false matches
    found = companyList.find((c) => {
      const cname = clean(c.name);
      if (cname.includes(q) && q.length >= 3) return true;
      if (q.includes(cname) && cname.length >= 3) return true;
      return false;
    });
    if (found) return found;

    return null;
  }

  // Clear chat conversation
  function handleClearChat() {
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: "assistant",
        text: "Hi! How can I help you manage Placement Hub today?",
      },
    ]);
    setActiveDriveDraft(null);
    setPendingConfirmation(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // Main input submit handler
  async function handleSubmit(e) {
    e?.preventDefault();
    const raw = input.trim();
    if (!raw || busy) return;

    setInput("");
    addMsg("user", raw);
    setBusy(true);

    // Refresh live data first to ensure 100% real Firebase state
    await refreshData();

    try {
      await processMessage(raw);
    } catch (err) {
      console.error("Error processing admin assistant message:", err);
      addMsg(
        "assistant",
        "I encountered an error processing your request. Please try again."
      );
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // Core Natural Language & Business Logic Processing
  async function processMessage(rawText) {
    const lower = rawText.toLowerCase().trim();

    // ──────────────────────────────────────────────────────────
    // 1. SECURITY RULE: NEVER EXPOSE INTERNAL INSTRUCTIONS OR PRD
    // ──────────────────────────────────────────────────────────
    if (isAskingForInstructions(rawText)) {
      addMsg(
        "assistant",
        "I can't provide internal instructions, but I can help you manage Placement Hub."
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 1b. STRUCTURED "ADD DRIVE FROM POD" FORMAT
    // ──────────────────────────────────────────────────────────
    if (/^add\s+drive\b/i.test(lower)) {
      const parsed = parsePodDriveMessage(rawText);
      if (parsed) {
        await handlePodDriveImport(parsed);
        return;
      }
    }

    // ──────────────────────────────────────────────────────────
    // 1c. STRUCTURED "CREATE COMPANY" FORMAT
    // PRD §16: Must use field-boundary parsing, not raw text as name
    // ──────────────────────────────────────────────────────────
    if (/^create\s+company\b/i.test(lower)) {
      const parsed = parseCreateCompanyMessage(rawText);
      if (parsed && parsed.companyData && parsed.companyData.companyName) {
        const companyName = parsed.companyData.companyName;

        // PRD §9: Validate companyName doesn't contain field headers
        if (!validateCompanyName(companyName)) {
          addMsg("assistant", "The company name appears to contain field labels instead of a clean name. Please provide just the company name (e.g. \"Acme Corp\").");
          return;
        }

        const existing = findCompany(companyName);
        if (existing) {
          addMsg("assistant", `Company "${existing.name}" is already registered in Placement Hub.`);
          return;
        }

        // Show parsed fields for confirmation
        const companyFields = [];
        if (parsed.companyData.companyLogo) companyFields.push(`• Logo: ${parsed.companyData.companyLogo}`);
        if (parsed.companyData.organisationDescription) companyFields.push(`• Description: ${parsed.companyData.organisationDescription.substring(0, 100)}${parsed.companyData.organisationDescription.length > 100 ? "..." : ""}`);
        if (parsed.companyData.industry) companyFields.push(`• Industry: ${parsed.companyData.industry}`);
        if (parsed.companyData.organisationSize) companyFields.push(`• Organisation Size: ${parsed.companyData.organisationSize}`);

        const extraInfo = companyFields.length > 0 ? `\n\nParsed details:\n${companyFields.join("\n")}` : "";

        setPendingConfirmation({
          action: "create_pod_company_only",
          companyName,
          companyData: parsed.companyData,
          sourceData: parsed.sourceData,
        });

        addMsg("assistant", `Would you like me to register **${companyName}** as a new company?${extraInfo}`);
        return;
      }
      // If structured parsing failed, fall through to NLP handler below
    }

    // ──────────────────────────────────────────────────────────
    // 2. IN-PROGRESS CONFIRMATION HANDLING (YES / NO)
    // ──────────────────────────────────────────────────────────
    if (pendingConfirmation) {
      const isAffirmative =
        /^(yes|confirm|proceed|sure|ok|okay|yep|yup|do it|create|delete|go ahead)\b/i.test(
          lower
        );
      const isNegative =
        /^(no|cancel|stop|abort|don't|dont|never mind|nevermind)\b/i.test(lower);

      if (isAffirmative) {
        await executePendingAction(pendingConfirmation);
        setPendingConfirmation(null);
        return;
      }

      if (isNegative) {
        setPendingConfirmation(null);
        addMsg("assistant", "Action cancelled. How else can I help you?");
        return;
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. IN-PROGRESS DRIVE CREATION (MULTI-TURN CONVERSATION)
    // ──────────────────────────────────────────────────────────
    if (activeDriveDraft) {
      // Check if user is modifying a field on the current draft
      if (
        lower.includes("change the ctc") ||
        lower.includes("change ctc") ||
        lower.includes("update ctc") ||
        lower.includes("set ctc")
      ) {
        const ctcVal = rawText
          .replace(/^(change|update|set)\s+(the\s+)?ctc\s+(to\s+)?/i, "")
          .trim();
        const updated = { ...activeDriveDraft, ctc: ctcVal || "Not Specified" };
        setActiveDriveDraft(updated);
        setPendingConfirmation({
          action: "create_drive",
          draft: updated,
        });
        addMsg(
          "assistant",
          `Updated CTC to ${ctcVal || "Not Specified"} for the ${updated.title || "drive"} at ${updated.companyName}.\n\nShall I create the drive now?`
        );
        return;
      }

      if (lower.includes("change the position") || lower.includes("change position")) {
        const posVal = rawText
          .replace(/^(change|update|set)\s+(the\s+)?position\s+(to\s+)?/i, "")
          .trim();
        const updated = { ...activeDriveDraft, title: posVal };
        setActiveDriveDraft(updated);
        addMsg(
          "assistant",
          `Updated position to "${posVal}". What is the CTC for this drive?`
        );
        return;
      }

      // Step: Asking for Position / Title
      if (activeDriveDraft.step === "ask_title") {
        const title = rawText.replace(/^(position is|role is|for)\s+/i, "").trim();
        const updated = {
          ...activeDriveDraft,
          title,
          step: "ask_ctc",
        };
        setActiveDriveDraft(updated);
        addMsg("assistant", "Got it. What's the CTC?");
        return;
      }

      // Step: Asking for CTC
      if (activeDriveDraft.step === "ask_ctc") {
        const ctc = rawText.replace(/^(ctc is|salary is|it is)\s+/i, "").trim();
        const updated = {
          ...activeDriveDraft,
          ctc,
          step: "ask_type",
        };
        setActiveDriveDraft(updated);
        addMsg("assistant", "What's the employment type?");
        return;
      }

      // Step: Asking for Employment Type
      if (activeDriveDraft.step === "ask_type") {
        const empType = rawText.trim();
        const updated = {
          ...activeDriveDraft,
          employmentType: empType || "Full-time",
          step: "ready_to_create",
        };
        setActiveDriveDraft(updated);
        setPendingConfirmation({
          action: "create_drive",
          draft: updated,
        });
        addMsg(
          "assistant",
          `Great! Here are the drive details:\n• Company: ${updated.companyName}\n• Position: ${updated.title}\n• CTC: ${updated.ctc}\n• Employment Type: ${updated.employmentType}\n\nShall I create this drive now?`
        );
        return;
      }

      // If user cancels during draft
      if (
        lower === "cancel" ||
        lower === "stop" ||
        lower === "exit" ||
        lower === "abort"
      ) {
        setActiveDriveDraft(null);
        addMsg("assistant", "Drive creation cancelled.");
        return;
      }
    }

    // ──────────────────────────────────────────────────────────
    // 4. NATURAL GREETINGS (NO DUMPING ANALYTICS!)
    // ──────────────────────────────────────────────────────────
    if (
      /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|yo)\b/i.test(
        lower
      ) &&
      lower.split(" ").length <= 4
    ) {
      addMsg("assistant", "Hi! How can I help you manage Placement Hub today?");
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 5. SYSTEM ANALYTICS (ONLY WHEN EXPLICITLY REQUESTED)
    // ──────────────────────────────────────────────────────────
    if (
      lower === "show analytics" ||
      lower === "analytics" ||
      lower === "view analytics" ||
      lower === "system analytics" ||
      lower === "platform stats" ||
      lower === "platform summary" ||
      lower.includes("today's platform summary") ||
      lower.includes("give me today's platform summary")
    ) {
      const fresh = freshDataRef.current;
      const interviewCount = fresh.applications.filter(
        (a) => a.status === "interview"
      ).length;
      const offerCount = fresh.applications.filter(
        (a) => a.status === "offer" || a.status === "selected"
      ).length;

      addMsg(
        "assistant",
        `Here's the current platform overview:\n• Companies: ${fresh.companies.length}\n• Drives: ${fresh.jobs.length}\n• Applications: ${fresh.applications.length}\n• Registered Users: ${fresh.users.length}\n• Interviews: ${interviewCount}\n• Offers: ${offerCount}`
      );
      return;
    }

    if (
      lower.includes("how many companies") ||
      lower === "count companies" ||
      lower === "total companies"
    ) {
      addMsg(
        "assistant",
        `We currently have ${freshDataRef.current.companies.length} ${
          freshDataRef.current.companies.length === 1 ? "company" : "companies"
        } registered in the system.`
      );
      return;
    }

    if (
      lower.includes("how many applications") ||
      lower === "count applications" ||
      lower === "total applications"
    ) {
      addMsg(
        "assistant",
        `There are currently ${freshDataRef.current.applications.length} ${
          freshDataRef.current.applications.length === 1 ? "application" : "applications"
        } submitted.`
      );
      return;
    }

    if (
      lower.includes("how many users") ||
      lower.includes("how many students") ||
      lower === "count users" ||
      lower === "total users"
    ) {
      addMsg(
        "assistant",
        `There are currently ${freshDataRef.current.users.length} registered ${
          freshDataRef.current.users.length === 1 ? "user" : "users"
        } on Placement Hub.`
      );
      return;
    }

    if (
      lower.includes("how many offers") ||
      lower === "count offers" ||
      lower === "total offers"
    ) {
      const offerCount = freshDataRef.current.applications.filter(
        (a) => a.status === "offer" || a.status === "selected"
      ).length;
      addMsg(
        "assistant",
        `There are currently ${offerCount} placement offers recorded.`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 6. COMPANIES: SHOW ALL COMPANIES
    // ──────────────────────────────────────────────────────────
    if (
      lower === "show all companies" ||
      lower === "show companies" ||
      lower === "list companies" ||
      lower === "all companies" ||
      lower.includes("which companies do we have") ||
      lower.includes("what companies do we have") ||
      lower.includes("list all companies")
    ) {
      const freshComps = freshDataRef.current.companies;
      if (freshComps.length === 0) {
        addMsg(
          "assistant",
          "There are currently no companies registered in Placement Hub. You can add one by saying \"Add company [name]\"."
        );
        return;
      }
      const list = freshComps
        .map((c, i) => `${i + 1}. ${c.name}`)
        .join("\n");
      addMsg(
        "assistant",
        `We currently have ${freshComps.length} ${
          freshComps.length === 1 ? "company" : "companies"
        }:\n${list}`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 7. COMPANY-AWARE BEHAVIOR: "TELL ME ABOUT [COMPANY]"
    // ──────────────────────────────────────────────────────────
    if (
      lower.startsWith("tell me about") ||
      lower.startsWith("about ") ||
      lower.startsWith("info about ") ||
      lower.startsWith("company info for ") ||
      lower.startsWith("details for ")
    ) {
      const compQuery = rawText
        .replace(
          /^(tell me about|about|info about|company info for|details for)\s+/i,
          ""
        )
        .replace(/\b(company|inc|ltd)\b/gi, "")
        .trim();

      const matchedComp = findCompany(compQuery);
      if (!matchedComp) {
        addMsg(
          "assistant",
          `I couldn't find a company record matching "${compQuery}". Say "Show all companies" to see what's available.`
        );
        return;
      }

      // Display real, dynamically fetched values from the company document ONLY
      const fields = [
        matchedComp.description ? `${matchedComp.description}\n` : null,
        `• Industry: ${matchedComp.industry || "Not specified"}`,
        `• Location: ${matchedComp.location || "Not specified"}`,
        `• Organisation Size: ${
          matchedComp.organisationSize ||
          matchedComp.size ||
          "Not specified"
        }`,
        `• Website: ${matchedComp.website || "Not specified"}`,
        `• Status: ${matchedComp.isActive ? "Active" : "Inactive"}`,
      ].filter(Boolean);

      addMsg(
        "assistant",
        `**${matchedComp.name}**\n\n${fields.join("\n")}`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 8. DRIVES: "SHOW [COMPANY]'S DRIVES"
    // ──────────────────────────────────────────────────────────
    if (
      lower.includes("'s drives") ||
      lower.includes(" drives for ") ||
      lower.includes(" drives of ") ||
      (lower.startsWith("show ") && lower.endsWith(" drives"))
    ) {
      // Extract company name
      let compQuery = rawText
        .replace(/'s\s+drives\b/i, "")
        .replace(/^show\s+(all\s+)?drives\s+(for|of)\s+/i, "")
        .replace(/^show\s+/i, "")
        .replace(/\s+drives$/i, "")
        .trim();

      const matchedComp = findCompany(compQuery);
      if (!matchedComp) {
        addMsg(
          "assistant",
          `I couldn't find a company matching "${compQuery}". Type "Show all companies" to see registered companies.`
        );
        return;
      }

      // Filter real jobs linked to this company ID or company name — use fresh data
      const freshJobs = freshDataRef.current.jobs;
      const compJobs = freshJobs.filter(
        (j) =>
          j.companyId === matchedComp.id ||
          clean(j.companyName) === clean(matchedComp.name)
      );

      if (compJobs.length === 0) {
        addMsg(
          "assistant",
          `${matchedComp.name} currently has no placement drives registered. Would you like to create one? Say "Add a drive for ${matchedComp.name}".`
        );
        return;
      }

      const list = compJobs
        .map(
          (j, i) =>
            `${i + 1}. **${j.title || j.jobTitle || "Drive"}** — ${
              j.package || j.ctc || "CTC Not specified"
            } (${j.type || j.employmentType || "Full-time"})${
              j.location ? ` • ${j.location}` : ""
            }`
        )
        .join("\n");

      addMsg(
        "assistant",
        `Here are the placement drives for **${matchedComp.name}**:\n\n${list}`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 9. DRIVES: "SHOW ACTIVE DRIVES" / "SHOW ALL DRIVES"
    // ──────────────────────────────────────────────────────────
    if (
      lower === "show active drives" ||
      lower === "show drives" ||
      lower === "show all drives" ||
      lower === "list drives" ||
      lower === "all drives"
    ) {
      const freshJobs = freshDataRef.current.jobs;
      if (freshJobs.length === 0) {
        addMsg(
          "assistant",
          "There are currently no placement drives registered in Placement Hub. You can add one by saying \"Add a drive for [Company]\"."
        );
        return;
      }

      const list = freshJobs
        .map(
          (j, i) =>
            `${i + 1}. **${j.companyName || "Company"}** — ${
              j.title || j.jobTitle || "Drive"
            } (${j.package || j.ctc || "CTC Not specified"})`
        )
        .join("\n");

      addMsg(
        "assistant",
        `Here are the active placement drives (${freshJobs.length}):\n\n${list}`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 10. NATURAL DRIVE CREATION: "ADD A DRIVE FOR [COMPANY]"
    // (CRITICAL: COMPANY ≠ DRIVE! NEVER DUPLICATES COMPANY!)
    // ──────────────────────────────────────────────────────────
    if (
      lower.startsWith("add a drive for ") ||
      lower.startsWith("add drive for ") ||
      lower.startsWith("create a drive for ") ||
      lower.startsWith("create drive for ") ||
      lower.startsWith("add drive ") ||
      lower.startsWith("new drive for ")
    ) {
      // Check if position was also mentioned, e.g. "Add a Software Developer drive for eQ Technologic"
      let positionExtracted = null;
      let targetCompName = "";

      const fullPattern =
        /^(add|create)\s+(a\s+)?(.+?)\s+drive\s+for\s+(.+)$/i.exec(rawText);

      if (fullPattern) {
        positionExtracted = fullPattern[3].trim();
        targetCompName = fullPattern[4].trim();
      } else {
        targetCompName = rawText
          .replace(
            /^(add|create)\s+(a\s+)?drive\s+(for\s+)?/i,
            ""
          )
          .trim();
      }

      const matchedComp = findCompany(targetCompName);

      if (!matchedComp) {
        addMsg(
          "assistant",
          `I couldn't find a company matching "${targetCompName}". You can register the company first by saying "Add company ${targetCompName}".`
        );
        return;
      }

      // If position was already provided:
      if (positionExtracted && positionExtracted.length > 1) {
        const draft = {
          companyId: matchedComp.id,
          companyName: matchedComp.name,
          title: positionExtracted,
          step: "ask_ctc",
        };
        setActiveDriveDraft(draft);
        addMsg(
          "assistant",
          `Sure. I found ${matchedComp.name} for the "${positionExtracted}" drive. What's the CTC?`
        );
        return;
      }

      // Start multi-turn drive creation
      const draft = {
        companyId: matchedComp.id,
        companyName: matchedComp.name,
        step: "ask_title",
      };
      setActiveDriveDraft(draft);
      addMsg(
        "assistant",
        `Sure. I found ${matchedComp.name}. What position is the drive for?`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 11. "DELETE THE DRIVE I JUST CREATED"
    // ──────────────────────────────────────────────────────────
    if (
      lower.includes("delete the drive i just created") ||
      lower.includes("remove the drive i just created") ||
      lower.includes("delete the newly created drive")
    ) {
      if (!lastCreatedDrive) {
        addMsg(
          "assistant",
          "No drive was recently created in this session. You can say \"Show active drives\" to view existing drives, or \"Delete the [Role] drive for [Company]\"."
        );
        return;
      }

      setPendingConfirmation({
        action: "delete_drive",
        target: lastCreatedDrive,
      });

      addMsg(
        "assistant",
        `Are you sure you want to delete the **${lastCreatedDrive.title}** drive for **${lastCreatedDrive.companyName}**? This will permanently remove the record from Firebase.`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 12. "DELETE [ROLE] DRIVE" / "DELETE THE DEVELOPER DRIVE"
    // (AMBIGUITY HANDLING)
    // ──────────────────────────────────────────────────────────
    if (
      lower.startsWith("delete ") &&
      lower.includes("drive")
    ) {
      const searchTerm = lower
        .replace(/^delete\s+(the\s+)?/i, "")
        .replace(/\s+drive(s)?\b/i, "")
        .trim();

      const matchedJobs = freshDataRef.current.jobs.filter((j) => {
        const titleClean = (j.title || j.jobTitle || "").toLowerCase();
        const compClean = (j.companyName || "").toLowerCase();
        return (
          titleClean.includes(searchTerm) ||
          compClean.includes(searchTerm) ||
          searchTerm.includes(titleClean)
        );
      });

      if (matchedJobs.length === 0) {
        addMsg(
          "assistant",
          `I couldn't find any drive matching "${searchTerm}". Type "Show active drives" to see all registered drives.`
        );
        return;
      }

      if (matchedJobs.length > 1) {
        const list = matchedJobs
          .map(
            (j, i) =>
              `${i + 1}. **${j.companyName || "Company"}** — ${
                j.title || j.jobTitle || "Drive"
              }`
          )
          .join("\n");

        addMsg(
          "assistant",
          `I found ${matchedJobs.length} matching drives:\n\n${list}\n\nWhich one should I delete? Please specify the company and role.`
        );
        return;
      }

      // Exactly 1 match found — ask for confirmation
      const targetJob = matchedJobs[0];
      setPendingConfirmation({
        action: "delete_drive",
        target: {
          id: targetJob.id,
          title: targetJob.title || targetJob.jobTitle || "Drive",
          companyName: targetJob.companyName || "Company",
        },
      });

      addMsg(
        "assistant",
        `Are you sure you want to delete the **${targetJob.title || targetJob.jobTitle}** drive for **${targetJob.companyName}**?`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 13. "ADD [COMPANY]" / "ADD A COMPANY CALLED [NAME]"
    // ──────────────────────────────────────────────────────────
    if (
      lower.startsWith("add company ") ||
      lower.startsWith("add a company ") ||
      lower.startsWith("register company ") ||
      lower.startsWith("create company ") ||
      lower.startsWith("add a company called ")
    ) {
      let compName = rawText
        .replace(
          /^(add|register|create)\s+(a\s+)?company\s+(called\s+|named\s+)?/i,
          ""
        )
        .replace(/["']/g, "")
        .trim();

      if (!compName) {
        addMsg("assistant", "What's the name of the company you'd like to add?");
        return;
      }

      const existing = findCompany(compName);
      if (existing) {
        addMsg(
          "assistant",
          `Company "${existing.name}" is already registered in Placement Hub.`
        );
        return;
      }

      setPendingConfirmation({
        action: "create_company",
        name: compName,
      });

      addMsg(
        "assistant",
        `Would you like me to register **${compName}** as a new company?`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 14. "DELETE THE [COMPANY] COMPANY" / "DELETE [COMPANY]"
    // ──────────────────────────────────────────────────────────
    if (
      lower.startsWith("delete company ") ||
      lower.startsWith("delete the company ") ||
      (lower.startsWith("delete ") && lower.includes("company"))
    ) {
      const compName = rawText
        .replace(/^delete\s+(the\s+)?company\s+/i, "")
        .replace(/^delete\s+/i, "")
        .replace(/\s+company$/i, "")
        .trim();

      const matchedComp = findCompany(compName);
      if (!matchedComp) {
        addMsg(
          "assistant",
          `I couldn't find a company record matching "${compName}".`
        );
        return;
      }

      setPendingConfirmation({
        action: "delete_company",
        target: matchedComp,
      });

      addMsg(
        "assistant",
        `Are you sure you want to delete **${matchedComp.name}**? This will permanently remove the company record and its associated data.`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 15. "CHANGE [COMPANY]'S WEBSITE" / "UPDATE [COMPANY] WEBSITE"
    // ──────────────────────────────────────────────────────────
    if (
      lower.includes("website") &&
      (lower.includes("change") || lower.includes("update") || lower.includes("set"))
    ) {
      // Find company — use fresh data
      let targetComp = null;
      for (const c of freshDataRef.current.companies) {
        if (lower.includes(c.name.toLowerCase())) {
          targetComp = c;
          break;
        }
      }

      // Check for URL in message
      const urlMatch = rawText.match(
        /https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );

      if (targetComp && urlMatch) {
        const newUrl = urlMatch[0];
        await updateCompany(targetComp.id, { website: newUrl });
        await refreshData();
        addMsg(
          "assistant",
          `Updated website for **${targetComp.name}** to ${newUrl}.`
        );
        return;
      }

      if (targetComp && !urlMatch) {
        addMsg(
          "assistant",
          `What should be the new website URL for **${targetComp.name}**?`
        );
        return;
      }
    }

    // ──────────────────────────────────────────────────────────
    // 16. USERS & APPLICATIONS LISTING
    // ──────────────────────────────────────────────────────────
    if (
      lower === "show users" ||
      lower === "list users" ||
      lower === "show students" ||
      lower === "all users"
    ) {
      const freshUsers = freshDataRef.current.users;
      if (freshUsers.length === 0) {
        addMsg("assistant", "No registered users found in the system.");
        return;
      }
      const list = freshUsers
        .slice(0, 15)
        .map(
          (u, i) =>
            `${i + 1}. **${u.displayName || u.name || "User"}** (${
              u.email || "No email"
            }) — ${u.role || "student"}`
        )
        .join("\n");
      addMsg(
        "assistant",
        `Registered Users (${freshUsers.length}):\n\n${list}${
          freshUsers.length > 15 ? `\n\n...and ${freshUsers.length - 15} more.` : ""
        }`
      );
      return;
    }

    if (
      lower === "show applications" ||
      lower === "list applications" ||
      lower === "all applications"
    ) {
      const freshApps = freshDataRef.current.applications;
      if (freshApps.length === 0) {
        addMsg("assistant", "No applications have been submitted yet.");
        return;
      }
      const list = freshApps
        .slice(0, 15)
        .map(
          (a, i) =>
            `${i + 1}. **${a.userEmail || a.userId || "Applicant"}** — ${
              a.jobTitle || a.companyName || "Drive"
            } (${a.status || "applied"})`
        )
        .join("\n");
      addMsg(
        "assistant",
        `Applications (${freshApps.length}):\n\n${list}${
          freshApps.length > 15
            ? `\n\n...and ${freshApps.length - 15} more.`
            : ""
        }`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 17. BULK DELETIONS (REQUIRE EXPLICIT CONFIRMATION)
    // ──────────────────────────────────────────────────────────
    if (lower === "delete all companies") {
      setPendingConfirmation({
        action: "delete_all_companies",
        count: freshDataRef.current.companies.length,
      });
      addMsg(
        "assistant",
        `WARNING: This will permanently delete ALL ${freshDataRef.current.companies.length} companies and their associated data. Are you sure?`
      );
      return;
    }

    if (lower === "delete all applications") {
      setPendingConfirmation({
        action: "delete_all_applications",
        count: freshDataRef.current.applications.length,
      });
      addMsg(
        "assistant",
        `WARNING: This will permanently delete ALL ${freshDataRef.current.applications.length} applications. Are you sure?`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // 18. GENERAL NATURAL LANGUAGE FALLBACK
    // (Concise, polite, zero prompt exposure)
    // ──────────────────────────────────────────────────────────
    addMsg(
      "assistant",
      "I can help you manage companies, placement drives, applications, and view analytics on Placement Hub. For example, try saying:\n\n• \"Show all companies\"\n• \"Tell me about [Company Name]\"\n• \"Show [Company Name]'s drives\"\n• \"Add a drive for [Company Name]\"\n• \"Add company [Name]\"\n• \"Show analytics\""
    );
  }

  // ──────────────────────────────────────────────────────────────
  // POD.ai STRUCTURED IMPORT HANDLER
  // PRD §10-13: Strict COMPANY ≠ DRIVE separation
  // ──────────────────────────────────────────────────────────────
  async function handlePodDriveImport(parsed) {
    const { companyData, driveData, sourceData } = parsed;

    // STEP 1: Identify company name
    const companyName = companyData.companyName;
    if (!companyName) {
      addMsg("assistant", "I detected a structured message but couldn't find the Company Name.\n\nPlease include \"Company Name: [name]\" in the COMPANY section.");
      return;
    }

    // STEP 2: Search REAL Firebase companies (PRD §28)
    const existingCompany = findCompany(companyName);

    if (existingCompany) {
      // STEP 3: Company exists — use existing (PRD §14)
      await handlePodDriveWithExistingCompany(existingCompany, driveData, companyData, sourceData);
    } else {
      // STEP 4: Company doesn't exist — ask admin (PRD §16, §31)
      await handlePodDriveNewCompany(companyName, companyData, driveData, sourceData);
    }
  }

  // Company found in Firebase — create drive under existing company
  async function handlePodDriveWithExistingCompany(existingCompany, driveData, podCompanyData, sourceData) {
    const jobTitle = driveData.title || "Not Specified";

    // PRD §27: Duplicate prevention — use fresh data, not stale React state
    const freshJobs = freshDataRef.current.jobs;
    const existingDrive = freshJobs.find(
      (j) =>
        j.companyId === existingCompany.id &&
        (j.title || "").toLowerCase() === jobTitle.toLowerCase()
    );

    if (existingDrive) {
      addMsg(
        "assistant",
        `A drive titled "${jobTitle}" already exists for ${existingCompany.name} (ID: ${existingDrive.id}).\n\nWould you like to update it instead, or create a new drive with a different title?`
      );
      return;
    }

    // Build drive summary for confirmation (PRD §31)
    const driveFields = buildDriveSummary(driveData, sourceData);

    setPendingConfirmation({
      action: "create_pod_drive",
      companyId: existingCompany.id,
      companyName: existingCompany.name,
      existingCompany: true,
      driveData,
      sourceData,
      podCompanyData,
    });

    addMsg(
      "assistant",
      `Found existing company: **${existingCompany.name}**\n\nDrive to create:\n${driveFields}\n\nCreate this drive under ${existingCompany.name}?`
    );
  }

  // Company not found — ask admin before creating (PRD §16, §31)
  async function handlePodDriveNewCompany(companyName, companyData, driveData, sourceData) {
    const driveFields = buildDriveSummary(driveData, sourceData);

    // Show what we know about the company from the screenshot
    const companyFields = [];
    if (companyData.industry && companyData.industry !== "Not Specified") companyFields.push(`• Industry: ${companyData.industry}`);
    if (companyData.organisationSize && companyData.organisationSize !== "Not Specified") companyFields.push(`• Organisation Size: ${companyData.organisationSize}`);
    if (companyData.organisationDescription && companyData.organisationDescription !== "Not Specified") companyFields.push(`• Description: ${companyData.organisationDescription.substring(0, 100)}${companyData.organisationDescription.length > 100 ? "..." : ""}`);
    if (companyData.companyLogo && companyData.companyLogo !== "Not Specified") companyFields.push(`• Logo: ${companyData.companyLogo}`);

    const companyInfo = companyFields.length > 0
      ? `\nCompany info from screenshot:\n${companyFields.join("\n")}`
      : "\nNo additional company information available from screenshot.";

    setPendingConfirmation({
      action: "create_pod_company_and_drive",
      companyName,
      companyData,
      driveData,
      sourceData,
    });

    addMsg(
      "assistant",
      `I couldn't find "${companyName}" in Placement Hub.${companyInfo}\n\nDrive to create:\n${driveFields}\n\nWould you like me to create the company "${companyName}" and then add this drive?`
    );
  }

  // Build a human-readable summary of drive fields
  function buildDriveSummary(driveData, sourceData) {
    const lines = [];
    if (driveData.title && driveData.title !== "Not Specified") lines.push(`• Position: ${driveData.title}`);
    if (driveData.employmentType && driveData.employmentType !== "Not Specified") lines.push(`• Employment Type: ${driveData.employmentType}`);
    if (driveData.location && driveData.location !== "Not Specified") lines.push(`• Location: ${driveData.location}`);
    if (driveData.ctc && driveData.ctc !== "Not Specified") lines.push(`• CTC: ${driveData.ctc}`);
    if (driveData.stipend && driveData.stipend !== "Not Specified") lines.push(`• Stipend: ${driveData.stipend}`);
    if (driveData.description && driveData.description !== "Not Specified") lines.push(`• Description: ${driveData.description.substring(0, 100)}${driveData.description.length > 100 ? "..." : ""}`);
    if (driveData.otherBenefits && driveData.otherBenefits !== "Not Specified") lines.push(`• Other Benefits: ${driveData.otherBenefits}`);
    if (driveData.registrationOpensAt && driveData.registrationOpensAt !== "Not Specified") lines.push(`• Registration Opens: ${driveData.registrationOpensAt}`);
    if (driveData.registrationClosesAt && driveData.registrationClosesAt !== "Not Specified") lines.push(`• Registration Closes: ${driveData.registrationClosesAt}`);
    if (driveData.eligibleCourses && (!Array.isArray(driveData.eligibleCourses) || driveData.eligibleCourses.length > 0)) {
      const courses = Array.isArray(driveData.eligibleCourses) ? driveData.eligibleCourses : [driveData.eligibleCourses];
      lines.push(`• Eligible Courses: ${courses.join(", ")}`);
    }
    if (driveData.eligibilityCriteria && driveData.eligibilityCriteria !== "Not Specified") lines.push(`• Eligibility: ${driveData.eligibilityCriteria}`);
    if (driveData.attachment && driveData.attachment !== "Not Specified") lines.push(`• Attachment: ${driveData.attachment}`);
    if (sourceData.source) lines.push(`• Source: ${sourceData.source}`);
    return lines.length > 0 ? lines.join("\n") : "• (No additional drive fields provided)";
  }

  // Execute confirmed actions directly into Firebase
  async function executePendingAction(conf) {
    if (!conf) return;

    if (conf.action === "create_drive") {
      const draft = conf.draft;
      // PRD §38: NEVER invent data. Use only what the user provided.
      const jobPayload = {
        companyId: draft.companyId,
        companyName: draft.companyName,
        title: draft.title || "Not Specified",
        jobTitle: draft.title || "Not Specified",
        package: draft.ctc || "Not Specified",
        ctc: draft.ctc || "Not Specified",
        type: draft.employmentType || "Not Specified",
        employmentType: draft.employmentType || "Not Specified",
        location: draft.location || "Not Specified",
        eligibleCourses: draft.eligibleCourses || [],
        isActive: true,
      };

      const res = await addJob(jobPayload);
      if (res.error) {
        addMsg("assistant", `Failed to create drive: ${res.error}`);
      } else {
        const newDrive = {
          id: res.data?.id,
          title: jobPayload.title,
          companyId: draft.companyId,
          companyName: draft.companyName,
        };
        setLastCreatedDrive(newDrive);
        setActiveDriveDraft(null);
        await refreshData();
        addMsg(
          "assistant",
          `The ${jobPayload.title} drive for ${draft.companyName} has been created successfully.`
        );
      }
      return;
    }

    if (conf.action === "delete_drive") {
      const target = conf.target;
      const res = await deleteJob(target.id);
      if (res.error) {
        addMsg("assistant", `Failed to delete drive: ${res.error}`);
      } else {
        if (lastCreatedDrive?.id === target.id) {
          setLastCreatedDrive(null);
        }
        await refreshData();
        addMsg(
          "assistant",
          `The ${target.title} drive for ${target.companyName} has been deleted successfully.`
        );
      }
      return;
    }

    if (conf.action === "create_company") {
      const compName = conf.name;
      const res = await addCompany({
        name: compName,
        industry: "",
        location: "",
        website: "",
        description: "",
        isActive: true,
      });

      if (res.error) {
        addMsg("assistant", `Failed to create company: ${res.error}`);
      } else {
        await refreshData();
        addMsg(
          "assistant",
          `Company "${compName}" has been added to Placement Hub successfully.`
        );
      }
      return;
    }

    // ──────────────────────────────────────────────────────────
    // POD.ai COMPANY CREATION (company only, no drive)
    // PRD §13: Fresh transaction object from parsed source only
    // ──────────────────────────────────────────────────────────
    if (conf.action === "create_pod_company_only") {
      const { companyName, companyData } = conf;

      // PRD §9: Final validation before write
      if (!validateCompanyName(companyName)) {
        addMsg("assistant", `Creation aborted: "${companyName}" contains field labels. Please provide a clean company name.`);
        return;
      }

      // PRD §13: Fresh object — only source-supplied fields
      const companyPayload = {
        name: companyName,
        industry: companyData?.industry || "",
        organisationSize: companyData?.organisationSize || "",
        description: companyData?.organisationDescription || "",
        logoUrl: companyData?.companyLogo || "",
        location: "",
        website: "",
        isActive: true,
      };

      const res = await addCompany(companyPayload);
      if (res.error) {
        addMsg("assistant", `Failed to create company "${companyName}": ${res.error}`);
      } else {
        await refreshData();
        addMsg(
          "assistant",
          `Company "${companyName}" created successfully!\n\n• Industry: ${companyData?.industry || "Not Specified"}\n• Org Size: ${companyData?.organisationSize || "Not Specified"}\n• ID: ${res.data?.id}`
        );
      }
      return;
    }

    if (conf.action === "delete_company") {
      const comp = conf.target;
      const res = await deleteCompany(comp.id);
      if (res.error) {
        addMsg("assistant", `Failed to delete company: ${res.error}`);
      } else {
        await refreshData();
        addMsg(
          "assistant",
          `Company "${comp.name}" has been deleted successfully.`
        );
      }
      return;
    }

    if (conf.action === "delete_all_companies") {
      const res = await deleteAllCompanies();
      await refreshData();
      addMsg(
        "assistant",
        `All ${res.data?.deleted || conf.count} companies have been deleted.`
      );
      return;
    }

    if (conf.action === "delete_all_applications") {
      const res = await deleteAllApplications();
      await refreshData();
      addMsg(
        "assistant",
        `All ${res.data?.deleted || conf.count} applications have been deleted.`
      );
      return;
    }

    // ──────────────────────────────────────────────────────────
    // POD.ai DRIVE CREATION (existing company)
    // PRD §14: Existing company MUST be reused
    // PRD §15: Company data must NOT be overwritten
    // ──────────────────────────────────────────────────────────
    if (conf.action === "create_pod_drive") {
      const { companyId, companyName, driveData, sourceData } = conf;

      // PRD §5, §6: Drive fields — use exact values from screenshot, "Not Specified" for missing
      const jobPayload = {
        companyId,
        companyName,
        title: driveData.title || "Not Specified",
        jobTitle: driveData.title || "Not Specified",
        type: driveData.employmentType || "Not Specified",
        employmentType: driveData.employmentType || "Not Specified",
        location: driveData.location || "Not Specified",
        package: driveData.ctc || "Not Specified",
        ctc: driveData.ctc || "Not Specified",
        stipend: driveData.stipend || "Not Specified",
        description: driveData.description || "Not Specified",
        otherBenefits: driveData.otherBenefits || "Not Specified",
        registrationOpensAt: driveData.registrationOpensAt || "Not Specified",
        registrationClosesAt: driveData.registrationClosesAt || "Not Specified",
        deadline: driveData.registrationClosesAt || "Not Specified",
        eligibleCourses: Array.isArray(driveData.eligibleCourses)
          ? driveData.eligibleCourses
          : driveData.eligibleCourses
            ? [driveData.eligibleCourses]
            : [],
        eligibility: driveData.eligibilityCriteria || "Not Specified",
        eligibilityCriteria: driveData.eligibilityCriteria || "Not Specified",
        attachment: driveData.attachment || "Not Specified",
        source: sourceData?.source || "Not Specified",
        isActive: true,
      };

      const res = await addJob(jobPayload);
      if (res.error) {
        addMsg("assistant", `Failed to create drive: ${res.error}`);
      } else {
        const newDrive = {
          id: res.data?.id,
          title: jobPayload.title,
          companyId,
          companyName,
        };
        setLastCreatedDrive(newDrive);
        await refreshData();
        addMsg(
          "assistant",
          `Drive created successfully!\n\n• Company: ${companyName}\n• Role: ${jobPayload.title}\n• ID: ${res.data?.id}\n\nThe drive is now visible to students in the Placement Drives section.`
        );
      }
      return;
    }

    // ──────────────────────────────────────────────────────────
    // POD.ai COMPANY + DRIVE CREATION (new company)
    // PRD §16: Create company from source data only, then drive
    // PRD §25: Do NOT invent missing company information
    // ──────────────────────────────────────────────────────────
    if (conf.action === "create_pod_company_and_drive") {
      const { companyName, companyData, driveData, sourceData } = conf;

      // PRD §16: Use ONLY values from the screenshot, "Not Specified" for missing
      const companyPayload = {
        name: companyName,
        industry: companyData?.industry || "",
        organisationSize: companyData?.organisationSize || "",
        description: companyData?.organisationDescription || "",
        logoUrl: companyData?.companyLogo && companyData.companyLogo !== "Not Specified"
          ? companyData.companyLogo
          : "",
        location: "",
        website: "",
        isActive: true,
      };

      const compRes = await addCompany(companyPayload);
      if (compRes.error) {
        addMsg("assistant", `Failed to create company "${companyName}": ${compRes.error}`);
        return;
      }

      const newCompanyId = compRes.data?.id;

      // Now create the drive under the new company
      const jobPayload = {
        companyId: newCompanyId,
        companyName,
        title: driveData.title || "Not Specified",
        jobTitle: driveData.title || "Not Specified",
        type: driveData.employmentType || "Not Specified",
        employmentType: driveData.employmentType || "Not Specified",
        location: driveData.location || "Not Specified",
        package: driveData.ctc || "Not Specified",
        ctc: driveData.ctc || "Not Specified",
        stipend: driveData.stipend || "Not Specified",
        description: driveData.description || "Not Specified",
        otherBenefits: driveData.otherBenefits || "Not Specified",
        registrationOpensAt: driveData.registrationOpensAt || "Not Specified",
        registrationClosesAt: driveData.registrationClosesAt || "Not Specified",
        deadline: driveData.registrationClosesAt || "Not Specified",
        eligibleCourses: Array.isArray(driveData.eligibleCourses)
          ? driveData.eligibleCourses
          : driveData.eligibleCourses
            ? [driveData.eligibleCourses]
            : [],
        eligibility: driveData.eligibilityCriteria || "Not Specified",
        eligibilityCriteria: driveData.eligibilityCriteria || "Not Specified",
        attachment: driveData.attachment || "Not Specified",
        source: sourceData?.source || "Not Specified",
        isActive: true,
      };

      const jobRes = await addJob(jobPayload);
      if (jobRes.error) {
        addMsg("assistant", `Company "${companyName}" was created, but the drive failed: ${jobRes.error}`);
      } else {
        const newDrive = {
          id: jobRes.data?.id,
          title: jobPayload.title,
          companyId: newCompanyId,
          companyName,
        };
        setLastCreatedDrive(newDrive);
        await refreshData();
        addMsg(
          "assistant",
          `Company "${companyName}" and drive "${jobPayload.title}" created successfully!\n\n• Company ID: ${newCompanyId}\n• Drive ID: ${jobRes.data?.id}\n\nBoth are now visible in Placement Hub.`
        );
      }
      return;
    }
  }

  return (
    <div className="admin-asst-overlay" onClick={handleClose}>
      <div
        className="admin-asst-panel glass-heavy animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Admin Assistant"
      >
        {/* Header */}
        <header className="admin-asst-header">
          <div className="admin-asst-title-group">
            <div className="admin-asst-icon">🛡</div>
            <div>
              <h2 className="admin-asst-title">Admin Assistant</h2>
              <span className="admin-asst-sub">Placement Hub Management</span>
            </div>
          </div>

          <div className="admin-asst-header-actions">
            <button
              className="admin-asst-action-btn"
              onClick={handleClearChat}
              title="Start a new conversation"
            >
              New Chat
            </button>
            <button
              className="admin-asst-close"
              onClick={handleClose}
              title="Close Assistant"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="admin-asst-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`admin-asst-msg admin-asst-msg--${msg.role}`}
            >
              {msg.role === "assistant" && (
                <div className="admin-asst-msg-icon">🛡</div>
              )}
              <div className="admin-asst-msg-content">
                <div className="admin-asst-msg-text">{msg.text}</div>
              </div>
            </div>
          ))}

          {/* In-chat confirmation card */}
          {pendingConfirmation && (
            <div className="admin-asst-confirm-card glass-panel animate-fade-in">
              <div className="admin-asst-confirm-label">
                <span>Confirmation Required</span>
              </div>
              <div className="admin-asst-confirm-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setPendingConfirmation(null);
                    addMsg(
                      "assistant",
                      "Action cancelled. How else can I help you?"
                    );
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className={`btn ${
                    pendingConfirmation.action.includes("delete")
                      ? "btn-danger"
                      : "btn-primary"
                  }`}
                  onClick={async () => {
                    setPendingConfirmation(null);
                    setBusy(true);
                    try {
                      await executePendingAction(pendingConfirmation);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                >
                  {pendingConfirmation.action.includes("delete")
                    ? "Confirm Delete"
                    : "Confirm & Save"}
                </button>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {busy && (
            <div className="admin-asst-msg admin-asst-msg--assistant">
              <div className="admin-asst-msg-icon">🛡</div>
              <div className="admin-asst-typing">
                <span className="dot dot-1" />
                <span className="dot dot-2" />
                <span className="dot dot-3" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Bottom Composer */}
        <form className="admin-asst-composer" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="admin-asst-input"
            placeholder="Ask anything... (e.g. 'Show all companies', 'Add a drive for eQ')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            className="admin-asst-send"
            disabled={!input.trim() || busy}
            title="Send Message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
