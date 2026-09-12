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
  updateJob,
  deleteJob,
  getAllUsers,
  getAllApplications,
  deleteAllCompanies,
  deleteAllApplications,
  uploadJobAttachment,
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

  // POD draft: editable preview before Firebase write (PRD §16, §31)
  // { mode: "company_and_drive"|"company_only"|"drive_only",
  //   company: { name, industry, organisationSize, description, logoUrl },
  //   drive: { title, employmentType, location, ctc, stipend, description, otherBenefits, registrationOpensAt, registrationClosesAt, eligibleCourses, eligibilityCriteria, attachment },
  //   source: { source }, existingCompanyId, existingCompanyName }
  const [podDraft, setPodDraft] = useState(null);
  const [podDraftPdf, setPodDraftPdf] = useState(null); // pending PDF file for attachment
  const podDraftFileRef = useRef(null);

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
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [refreshData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirmation, podDraft, busy]);

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
    setPodDraft(null);
    setPodDraftPdf(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // Manage eligible courses in podDraft
  function addPodDraftCourse(courseText) {
    const trimmed = (courseText || "").trim();
    if (!trimmed) return;
    setPodDraft((p) => ({
      ...p,
      drive: {
        ...p.drive,
        eligibleCourses: [...(p.drive.eligibleCourses || []), trimmed],
      },
    }));
  }

  function removePodDraftCourse(index) {
    setPodDraft((p) => ({
      ...p,
      drive: {
        ...p.drive,
        eligibleCourses: (p.drive.eligibleCourses || []).filter((_, i) => i !== index),
      },
    }));
  }

  function updatePodDraftCourse(index, value) {
    setPodDraft((p) => {
      const courses = [...(p.drive.eligibleCourses || [])];
      courses[index] = value;
      return { ...p, drive: { ...p.drive, eligibleCourses: courses } };
    });
  }

  // Handle PDF file selection for attachment
  function handlePodDraftPdfSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      addMsg("assistant", "Only PDF files are accepted. Please select a .pdf file.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addMsg("assistant", "File is too large. Please select a PDF under 10 MB.");
      e.target.value = "";
      return;
    }
    setPodDraftPdf(file);
  }

  function removePodDraftPdf() {
    setPodDraftPdf(null);
    if (podDraftFileRef.current) podDraftFileRef.current.value = "";
  }

  // Handle chat commands to edit POD draft fields (PRD §29)
  // Returns true if the command was handled
  function handlePodDraftChatCommand(rawText, lower) {
    // Cancel
    if (/^(cancel|stop|abort|exit|never\s*mind|nevermind)$/i.test(lower)) {
      setPodDraft(null);
      setPodDraftPdf(null);
      addMsg("assistant", "Draft cancelled. How else can I help?");
      return true;
    }

    // Change <field> to <value>
    const changeMatch = rawText.match(
      /^(?:change|update|set|edit)\s+(?:the\s+)?(.+?)\s+to\s+(.+)/i
    );
    if (changeMatch) {
      const fieldLabel = changeMatch[1].toLowerCase().trim();
      const value = changeMatch[2].trim();
      const fieldMap = {
        "company name": { section: "company", key: "name" },
        "name": { section: "company", key: "name" },
        "industry": { section: "company", key: "industry" },
        "organisation size": { section: "company", key: "organisationSize" },
        "org size": { section: "company", key: "organisationSize" },
        "description": { section: "drive", key: "description" },
        "logo": { section: "company", key: "logoUrl" },
        "position": { section: "drive", key: "title" },
        "title": { section: "drive", key: "title" },
        "role": { section: "drive", key: "title" },
        "ctc": { section: "drive", key: "ctc" },
        "package": { section: "drive", key: "ctc" },
        "salary": { section: "drive", key: "ctc" },
        "stipend": { section: "drive", key: "stipend" },
        "location": { section: "drive", key: "location" },
        "type": { section: "drive", key: "employmentType" },
        "employment type": { section: "drive", key: "employmentType" },
        "eligibility": { section: "drive", key: "eligibilityCriteria" },
        "eligible courses": { section: "drive", key: "eligibleCourses" },
        "registration opens": { section: "drive", key: "registrationOpensAt" },
        "registration closes": { section: "drive", key: "registrationClosesAt" },
        "deadline": { section: "drive", key: "registrationClosesAt" },
        "other benefits": { section: "drive", key: "otherBenefits" },
        "benefits": { section: "drive", key: "otherBenefits" },
        "attachment": { section: "drive", key: "attachment" },
      };
      const mapping = fieldMap[fieldLabel];
      if (mapping) {
        // Special handling for eligibleCourses — store as array
        if (mapping.key === "eligibleCourses") {
          const courses = value.split(/,|;|\n/)
            .map((s) => s.replace(/^[*•\-–]\s+/, "").trim())
            .filter((s) => s.length > 0);
          setPodDraft((prev) => ({
            ...prev,
            [mapping.section]: { ...prev[mapping.section], [mapping.key]: courses },
          }));
          addMsg("assistant", `Updated **eligible courses** to: ${courses.join(", ")}. You can continue editing or click **Confirm & Add**.`);
          return true;
        }
        setPodDraft((prev) => ({
          ...prev,
          [mapping.section]: { ...prev[mapping.section], [mapping.key]: value },
        }));
        addMsg("assistant", `Updated **${fieldLabel}** to "${value}" in the draft. You can continue editing or click **Confirm & Add**.`);
        return true;
      }
      addMsg("assistant", `I don't recognize the field "${changeMatch[1]}". You can edit fields directly in the form below, or use fields like: CTC, position, company name, industry, location, eligibility, etc.`);
      return true;
    }

    // Confirm shortcut
    if (/^(confirm|proceed|yes|submit|add|create|go ahead|save)\b/i.test(lower)) {
      addMsg("assistant", "Click the **Confirm & Add** button below to save the draft to Firebase.");
      return true;
    }

    return false;
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

        // PRD §16: Show editable draft instead of text-only confirmation
        const draft = {
          mode: "company_only",
          existingCompanyId: null,
          existingCompanyName: null,
          company: {
            name: companyName,
            industry: parsed.companyData?.industry || "",
            organisationSize: parsed.companyData?.organisationSize || "",
            description: parsed.companyData?.organisationDescription || "",
            logoUrl: parsed.companyData?.companyLogo || "",
          },
          drive: {},
          source: parsed.sourceData || {},
        };
        setPodDraft(draft);

        addMsg("assistant", `Review the company fields below, then click **Confirm & Add** to register **${companyName}**.`);
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
    // 3. POD DRAFT FIELD EDITING (chat commands while draft is open)
    // ──────────────────────────────────────────────────────────
    if (podDraft) {
      const handled = handlePodDraftChatCommand(rawText, lower);
      if (handled) return;
    }

    // ──────────────────────────────────────────────────────────
    // 3b. IN-PROGRESS DRIVE CREATION (MULTI-TURN CONVERSATION)
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

  // Company found in Firebase — create editable draft for drive under existing company
  async function handlePodDriveWithExistingCompany(existingCompany, driveData, podCompanyData, sourceData) {
    const jobTitle = driveData.jobTitle || driveData.title || "Not Specified";

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

    // PRD §13: Clean draft object — only from parsed source, NO stale data fallback
    const draft = {
      mode: "drive_only",
      existingCompanyId: existingCompany.id,
      existingCompanyName: existingCompany.name,
      company: { name: existingCompany.name },
      drive: {
        title: driveData.jobTitle || driveData.title || "",
        employmentType: driveData.employmentType || "",
        location: driveData.location || "",
        ctc: driveData.ctc || "",
        stipend: driveData.stipend || "",
        description: driveData.description || "",
        otherBenefits: driveData.otherBenefits || "",
        registrationOpensAt: driveData.registrationOpensAt || "",
        registrationClosesAt: driveData.registrationClosesAt || "",
        eligibleCourses: Array.isArray(driveData.eligibleCourses)
          ? driveData.eligibleCourses
          : driveData.eligibleCourses
            ? [driveData.eligibleCourses]
            : [],
        eligibilityCriteria: driveData.eligibilityCriteria || "",
        attachment: driveData.attachment || "",
      },
      source: sourceData || {},
    };
    setPodDraft(draft);

    addMsg(
      "assistant",
      `Found existing company: **${existingCompany.name}**\n\nReview and edit the drive fields below, then click **Confirm & Add**.`
    );
  }

  // Company not found — create editable draft for company + drive (PRD §16, §31)
  async function handlePodDriveNewCompany(companyName, companyData, driveData, sourceData) {
    // PRD §13: Clean draft object — only from parsed source
    const draft = {
      mode: "company_and_drive",
      existingCompanyId: null,
      existingCompanyName: null,
      company: {
        name: companyName || "",
        industry: companyData?.industry || "",
        organisationSize: companyData?.organisationSize || "",
        description: companyData?.organisationDescription || "",
        logoUrl: companyData?.companyLogo || "",
      },
      drive: {
        title: driveData.jobTitle || driveData.title || "",
        employmentType: driveData.employmentType || "",
        location: driveData.location || "",
        ctc: driveData.ctc || "",
        stipend: driveData.stipend || "",
        description: driveData.description || "",
        otherBenefits: driveData.otherBenefits || "",
        registrationOpensAt: driveData.registrationOpensAt || "",
        registrationClosesAt: driveData.registrationClosesAt || "",
        eligibleCourses: Array.isArray(driveData.eligibleCourses)
          ? driveData.eligibleCourses
          : driveData.eligibleCourses
            ? [driveData.eligibleCourses]
            : [],
        eligibilityCriteria: driveData.eligibilityCriteria || "",
        attachment: driveData.attachment || "",
      },
      source: sourceData || {},
    };
    setPodDraft(draft);

    addMsg(
      "assistant",
      `I couldn't find **"${companyName}"** in Placement Hub.\n\nReview and edit the company + drive fields below, then click **Confirm & Add** to register both.`
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

  // ──────────────────────────────────────────────────────────
  // POD DRAFT CONFIRM: Write final edited values to Firebase
  // PRD §16, §31: Final edited values are the SINGLE SOURCE OF TRUTH
  // ──────────────────────────────────────────────────────────

  // Sanitize attachment value — never let SOURCE contaminate attachment
  function sanitizeAttachment(raw) {
    if (!raw) return "Not Specified";
    let val = String(raw).trim();
    // Strip trailing "SOURCE" or "Source: ..." that leaked from parser
    val = val.replace(/\s+source\b.*$/i, "").trim();
    if (!val || val.toLowerCase() === "not specified") return "Not Specified";
    return val;
  }

  async function handlePodDraftConfirm() {
    if (!podDraft) return;
    const { mode, company, drive, source, existingCompanyId, existingCompanyName } = podDraft;
    const pendingPdf = podDraftPdf;

    setPodDraft(null);
    setPodDraftPdf(null);
    setBusy(true);

    try {
      // MODE: drive_only — company already exists in Firebase
      if (mode === "drive_only") {
        const companyId = existingCompanyId;
        const companyName = existingCompanyName || company.name;

        const jobPayload = {
          companyId,
          companyName,
          title: drive.title || "Not Specified",
          jobTitle: drive.title || "Not Specified",
          type: drive.employmentType || "Not Specified",
          employmentType: drive.employmentType || "Not Specified",
          location: drive.location || "Not Specified",
          package: drive.ctc || "Not Specified",
          ctc: drive.ctc || "Not Specified",
          stipend: drive.stipend || "Not Specified",
          description: drive.description || "Not Specified",
          otherBenefits: drive.otherBenefits || "Not Specified",
          registrationOpensAt: drive.registrationOpensAt || "Not Specified",
          registrationClosesAt: drive.registrationClosesAt || "Not Specified",
          deadline: drive.registrationClosesAt || "Not Specified",
          eligibleCourses: Array.isArray(drive.eligibleCourses)
            ? drive.eligibleCourses
            : drive.eligibleCourses
              ? [drive.eligibleCourses]
              : [],
          eligibility: drive.eligibilityCriteria || "Not Specified",
          eligibilityCriteria: drive.eligibilityCriteria || "Not Specified",
          attachment: sanitizeAttachment(drive.attachment),
          source: source?.source || "Not Specified",
          isActive: true,
        };

        const res = await addJob(jobPayload);
        if (res.error) {
          addMsg("assistant", `Failed to create drive: ${res.error}`);
        } else {
          // Upload PDF attachment if provided
          if (pendingPdf && res.data?.id) {
            const uploadRes = await uploadJobAttachment(res.data.id, companyId, pendingPdf);
            if (!uploadRes.error) {
              await updateJob(res.data.id, { attachment: uploadRes.data.fileUrl });
            }
          }
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
            `Drive created successfully!\n\n• Company: ${companyName}\n• Role: ${jobPayload.title}${pendingPdf ? "\n• Attachment: " + pendingPdf.name : ""}\n• ID: ${res.data?.id}\n\nThe drive is now visible to students.`
          );
        }
        return;
      }

      // MODE: company_and_drive — new company + drive
      if (mode === "company_and_drive") {
        const companyName = company.name;
        if (!validateCompanyName(companyName)) {
          addMsg("assistant", `Creation aborted: "${companyName}" contains field labels. Please provide a clean company name.`);
          return;
        }

        const companyPayload = {
          name: companyName,
          industry: company.industry || "",
          organisationSize: company.organisationSize || "",
          description: company.description || "",
          logoUrl: company.logoUrl || "",
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

        const jobPayload = {
          companyId: newCompanyId,
          companyName,
          title: drive.title || "Not Specified",
          jobTitle: drive.title || "Not Specified",
          type: drive.employmentType || "Not Specified",
          employmentType: drive.employmentType || "Not Specified",
          location: drive.location || "Not Specified",
          package: drive.ctc || "Not Specified",
          ctc: drive.ctc || "Not Specified",
          stipend: drive.stipend || "Not Specified",
          description: drive.description || "Not Specified",
          otherBenefits: drive.otherBenefits || "Not Specified",
          registrationOpensAt: drive.registrationOpensAt || "Not Specified",
          registrationClosesAt: drive.registrationClosesAt || "Not Specified",
          deadline: drive.registrationClosesAt || "Not Specified",
          eligibleCourses: Array.isArray(drive.eligibleCourses)
            ? drive.eligibleCourses
            : drive.eligibleCourses
              ? [drive.eligibleCourses]
              : [],
          eligibility: drive.eligibilityCriteria || "Not Specified",
          eligibilityCriteria: drive.eligibilityCriteria || "Not Specified",
          attachment: sanitizeAttachment(drive.attachment),
          source: source?.source || "Not Specified",
          isActive: true,
        };

        const jobRes = await addJob(jobPayload);
        if (jobRes.error) {
          addMsg("assistant", `Company "${companyName}" was created (ID: ${newCompanyId}), but the drive failed: ${jobRes.error}`);
        } else {
          // Upload PDF attachment if provided
          if (pendingPdf && jobRes.data?.id) {
            const uploadRes = await uploadJobAttachment(jobRes.data.id, newCompanyId, pendingPdf);
            if (!uploadRes.error) {
              await updateJob(jobRes.data.id, { attachment: uploadRes.data.fileUrl });
            }
          }
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
            `Company "${companyName}" and drive "${jobPayload.title}" created successfully!\n\n• Company ID: ${newCompanyId}${pendingPdf ? "\n• Attachment: " + pendingPdf.name : ""}\n• Drive ID: ${jobRes.data?.id}\n\nBoth are now visible in Placement Hub.`
          );
        }
        return;
      }

      // MODE: company_only — just create company from parsed data
      if (mode === "company_only") {
        const companyName = company.name;
        if (!validateCompanyName(companyName)) {
          addMsg("assistant", `Creation aborted: "${companyName}" contains field labels. Please provide a clean company name.`);
          return;
        }

        const companyPayload = {
          name: companyName,
          industry: company.industry || "",
          organisationSize: company.organisationSize || "",
          description: company.description || "",
          logoUrl: company.logoUrl || "",
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
            `Company "${companyName}" created successfully!\n\n• Industry: ${company.industry || "Not Specified"}\n• Org Size: ${company.organisationSize || "Not Specified"}\n• ID: ${res.data?.id}`
          );
        }
        return;
      }
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
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

          {/* ─────────────────────────────────────────────────── */}
          {/* POD DRAFT: Editable Preview Before Firebase Write     */}
          {/* PRD §16, §31, §32: All fields editable, clean draft */}
          {/* ─────────────────────────────────────────────────── */}
          {podDraft && (
            <div className="pod-draft-card glass-panel animate-fade-in">
              <div className="pod-draft-header">
                <span className="pod-draft-label">
                  {podDraft.mode === "company_only" && "New Company Preview"}
                  {podDraft.mode === "drive_only" && `New Drive for ${podDraft.existingCompanyName}`}
                  {podDraft.mode === "company_and_drive" && "New Company + Drive Preview"}
                </span>
                <span className="pod-draft-sub">Edit fields below or type commands (e.g. "Change CTC to 12 LPA")</span>
              </div>

              {/* Company fields */}
              {(podDraft.mode === "company_and_drive" || podDraft.mode === "company_only") && (
                <div className="pod-draft-section">
                  <div className="pod-draft-section-title">Company</div>
                  <div className="pod-draft-field">
                    <label>Company Name</label>
                    <input
                      type="text"
                      value={podDraft.company.name}
                      onChange={(e) => setPodDraft((p) => ({ ...p, company: { ...p.company, name: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-field">
                    <label>Industry</label>
                    <input
                      type="text"
                      value={podDraft.company.industry}
                      onChange={(e) => setPodDraft((p) => ({ ...p, company: { ...p.company, industry: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-field">
                    <label>Organisation Size</label>
                    <input
                      type="text"
                      value={podDraft.company.organisationSize}
                      onChange={(e) => setPodDraft((p) => ({ ...p, company: { ...p.company, organisationSize: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-field">
                    <label>Description</label>
                    <textarea
                      value={podDraft.company.description}
                      onChange={(e) => setPodDraft((p) => ({ ...p, company: { ...p.company, description: e.target.value } }))}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-field">
                    <label>Logo URL</label>
                    <input
                      type="text"
                      value={podDraft.company.logoUrl}
                      onChange={(e) => setPodDraft((p) => ({ ...p, company: { ...p.company, logoUrl: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}

              {/* Drive fields */}
              {podDraft.mode !== "company_only" && (
                <div className="pod-draft-section">
                  <div className="pod-draft-section-title">Drive</div>
                  <div className="pod-draft-field">
                    <label>Position / Title</label>
                    <input
                      type="text"
                      value={podDraft.drive.title}
                      onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, title: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-row">
                    <div className="pod-draft-field">
                      <label>CTC / Package</label>
                      <input
                        type="text"
                        value={podDraft.drive.ctc}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, ctc: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                    <div className="pod-draft-field">
                      <label>Stipend</label>
                      <input
                        type="text"
                        value={podDraft.drive.stipend}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, stipend: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="pod-draft-row">
                    <div className="pod-draft-field">
                      <label>Employment Type</label>
                      <input
                        type="text"
                        value={podDraft.drive.employmentType}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, employmentType: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                    <div className="pod-draft-field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={podDraft.drive.location}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, location: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="pod-draft-field">
                    <label>Description</label>
                    <textarea
                      value={podDraft.drive.description}
                      onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, description: e.target.value } }))}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-field">
                    <label>Eligibility Criteria</label>
                    <input
                      type="text"
                      value={podDraft.drive.eligibilityCriteria}
                      onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, eligibilityCriteria: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>
                  <div className="pod-draft-row">
                    <div className="pod-draft-field">
                      <label>Registration Opens</label>
                      <input
                        type="text"
                        value={podDraft.drive.registrationOpensAt}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, registrationOpensAt: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                    <div className="pod-draft-field">
                      <label>Registration Closes</label>
                      <input
                        type="text"
                        value={podDraft.drive.registrationClosesAt}
                        onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, registrationClosesAt: e.target.value } }))}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="pod-draft-field">
                    <label>Other Benefits</label>
                    <input
                      type="text"
                      value={podDraft.drive.otherBenefits}
                      onChange={(e) => setPodDraft((p) => ({ ...p, drive: { ...p.drive, otherBenefits: e.target.value } }))}
                      disabled={busy}
                    />
                  </div>

                  {/* Eligible Courses — editable list */}
                  <div className="pod-draft-field">
                    <label>Eligible Courses</label>
                    {(podDraft.drive.eligibleCourses || []).length === 0 && (
                      <div className="pod-draft-courses-empty">No courses specified</div>
                    )}
                    {(podDraft.drive.eligibleCourses || []).map((course, idx) => (
                      <div key={idx} className="pod-draft-course-row">
                        <input
                          type="text"
                          value={course}
                          onChange={(e) => updatePodDraftCourse(idx, e.target.value)}
                          disabled={busy}
                          className="pod-draft-course-input"
                        />
                        <button
                          type="button"
                          className="pod-draft-course-remove"
                          onClick={() => removePodDraftCourse(idx)}
                          disabled={busy}
                          title="Remove course"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="pod-draft-course-add">
                      <input
                        type="text"
                        placeholder="Add a course..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPodDraftCourse(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        disabled={busy}
                        className="pod-draft-course-add-input"
                      />
                    </div>
                  </div>

                  {/* Attachment — manual PDF upload only */}
                  <div className="pod-draft-field">
                    <label>Attachment</label>
                    <input
                      ref={podDraftFileRef}
                      type="file"
                      accept=".pdf"
                      onChange={handlePodDraftPdfSelect}
                      style={{ display: "none" }}
                    />
                    {podDraftPdf ? (
                      <div className="pod-draft-pdf-preview">
                        <span className="pod-draft-pdf-name">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, flexShrink: 0 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {podDraftPdf.name}
                        </span>
                        <div className="pod-draft-pdf-actions">
                          <button
                            type="button"
                            className="pod-draft-pdf-btn"
                            onClick={() => podDraftFileRef.current?.click()}
                            disabled={busy}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className="pod-draft-pdf-btn pod-draft-pdf-btn--remove"
                            onClick={removePodDraftPdf}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="pod-draft-pdf-upload"
                        onClick={() => podDraftFileRef.current?.click()}
                        disabled={busy}
                      >
                        + Upload PDF
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Source info */}
              {podDraft.source?.source && (
                <div className="pod-draft-source">Source: {podDraft.source.source}</div>
              )}

              {/* Actions */}
              <div className="pod-draft-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => { setPodDraft(null); setPodDraftPdf(null); addMsg("assistant", "Draft cancelled."); }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handlePodDraftConfirm}
                  disabled={busy}
                >
                  Confirm & Add
                </button>
              </div>
            </div>
          )}

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
            placeholder="Ask anything... (e.g. 'Add a drive for NVIDIA', 'Change CTC to 14 LPA')"
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
