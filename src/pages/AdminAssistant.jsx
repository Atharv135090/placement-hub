import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  addCompany,
  findCompanyByName,
  deleteCompany,
  getCompanies,
  getAllUsers,
  getAllApplications,
  deleteAllCompanies,
  deleteAllApplications,
} from "../services/firestore";
import { extractPlacementData } from "../utils/placementParser";
import "./AdminAssistant.css";

function normalizeText(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function extractQuotedString(text) {
  const match = text.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

function parseAdminCommand(text, companies = []) {
  const lower = text.toLowerCase().trim();
  const normalized = normalizeText(text);

  const companyKeywords = ["company", "companies", "corp", "corporation", "firm", "organization"];
  const userKeywords = ["user", "users", "student", "students", "people", "accounts"];
  const appKeywords = ["application", "applications", "app", "apps", "applied"];
  const analyticsKeywords = ["analytics", "stats", "statistics", "metrics", "numbers", "data", "insights"];

  function hasKeyword(input, keywords) {
    return keywords.some(k => input.includes(k));
  }

  function extractAfterKeywords(input, keywords) {
    for (const kw of keywords) {
      const idx = input.indexOf(kw);
      if (idx !== -1) {
        return input.substring(idx + kw.length).trim();
      }
    }
    return "";
  }

  if (lower === "help" || lower === "commands" || lower === "?" || lower === "what can you do") {
    return { intent: "help", raw: text };
  }

  if (normalized.startsWith("delete all ") || normalized.startsWith("remove all ")) {
    if (hasKeyword(normalized, companyKeywords)) return { intent: "delete_all_companies", raw: text };
    if (hasKeyword(normalized, appKeywords)) return { intent: "delete_all_applications", raw: text };
  }

  if (lower === "undo") return { intent: "undo", raw: text };
  if (lower === "redo") return { intent: "redo", raw: text };

  const isDeleteIntent = /\b(delete|remove|destroy|eliminate|drop|erase)\b/.test(lower);
  const isAddIntent = /\b(add|create|new|insert|register|setup|set up)\b/.test(lower);
  const isUpdateIntent = /\b(update|edit|modify|change|alter|set|adjust)\b/.test(lower);
  const isShowIntent = /\b(show|list|display|view|see|get|fetch|all|what|which|find|search|look)\b/.test(lower);

  if (isShowIntent && hasKeyword(lower, analyticsKeywords)) {
    return { intent: "show_analytics", raw: text };
  }

  if (isShowIntent && hasKeyword(lower, userKeywords)) {
    return { intent: "list_users", raw: text };
  }

  if (isShowIntent && hasKeyword(lower, appKeywords)) {
    return { intent: "list_applications", raw: text };
  }

  if (isShowIntent) {
    if (hasKeyword(lower, companyKeywords)) {
      return { intent: "list_companies", raw: text };
    }
    if (!hasKeyword(lower, userKeywords) && !hasKeyword(lower, appKeywords)) {
      return { intent: "list_companies", raw: text };
    }
  }

  if (isAddIntent && hasKeyword(lower, companyKeywords)) {
    let name = extractAfterKeywords(lower, companyKeywords);
    name = name.replace(/^(called|named|as|info:|information:|details:)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;
    const parsed = extractPlacementData(text);
    return { intent: "add_company", companyName: name, parsedData: parsed, raw: text };
  }

  if (isAddIntent) {
    let name = lower.replace(/\b(add|create|new|insert|register|setup|set up)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;
    if (hasKeyword(lower, companyKeywords) || !hasKeyword(lower, userKeywords)) {
      const parsed = extractPlacementData(text);
      return { intent: "add_company", companyName: name, parsedData: parsed, raw: text };
    }
  }

  if (isDeleteIntent && hasKeyword(lower, companyKeywords)) {
    let name = extractAfterKeywords(lower, companyKeywords);
    name = name.replace(/^(called|named|the|called the)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;
    if (!name) {
      return { intent: "delete_company_no_name", raw: text };
    }
    const matched = fuzzyMatchCompany(name, companies);
    if (matched) {
      return { intent: "delete_company", companyName: matched.name, companyId: matched.id, raw: text };
    }
    return { intent: "delete_company", companyName: name, raw: text };
  }

  if (isDeleteIntent) {
    let name = lower.replace(/\b(delete|remove|destroy|eliminate|drop|erase)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;

    if (!name) {
      return { intent: "delete_company_no_name", raw: text };
    }

    const matchedCompany = fuzzyMatchCompany(name, companies);
    if (matchedCompany) {
      return { intent: "delete_company", companyName: matchedCompany.name, companyId: matchedCompany.id, raw: text };
    }

    return { intent: "delete_company", companyName: name, raw: text };
  }

  if (isUpdateIntent && hasKeyword(lower, companyKeywords)) {
    let name = extractAfterKeywords(lower, companyKeywords);
    name = name.replace(/^(called|named|the)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;
    return { intent: "update_company", companyName: name, raw: text };
  }

  if (isUpdateIntent) {
    let name = lower.replace(/\b(update|edit|modify|change|alter|set|adjust)\s*/i, "").trim();
    const quoted = extractQuotedString(text);
    if (quoted) name = quoted;

    const matchedCompany = fuzzyMatchCompany(name, companies);
    if (matchedCompany) {
      return { intent: "update_company", companyName: matchedCompany.name, companyId: matchedCompany.id, raw: text };
    }

    return { intent: "update_company", companyName: name, raw: text };
  }

  if (hasKeyword(lower, ["how many", "count", "total", "number of"])) {
    if (hasKeyword(lower, companyKeywords)) return { intent: "list_companies", raw: text };
    if (hasKeyword(lower, userKeywords)) return { intent: "list_users", raw: text };
    if (hasKeyword(lower, appKeywords)) return { intent: "list_applications", raw: text };
    return { intent: "show_analytics", raw: text };
  }

  if (hasKeyword(lower, ["what", "which", "who", "where", "when", "how", "why"])) {
    if (hasKeyword(lower, companyKeywords)) return { intent: "list_companies", raw: text };
    if (hasKeyword(lower, userKeywords)) return { intent: "list_users", raw: text };
    if (hasKeyword(lower, appKeywords)) return { intent: "list_applications", raw: text };
    if (hasKeyword(lower, analyticsKeywords)) return { intent: "show_analytics", raw: text };
    return { intent: "general_question", question: text, raw: text };
  }

  return { intent: "general_question", question: text, raw: text };
}

function fuzzyMatchCompany(input, companies) {
  if (!input || !companies.length) return null;
  const normalized = normalizeText(input);
  let best = null;
  let bestScore = 0;
  for (const c of companies) {
    const cname = normalizeText(c.name);
    if (cname === normalized) return c;
    if (cname.includes(normalized) || normalized.includes(cname)) {
      const score = normalized.length / cname.length;
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  if (best && bestScore > 0.3) return best;
  for (const c of companies) {
    const cname = normalizeText(c.name);
    const words = cname.split(" ");
    const inputWords = normalized.split(" ");
    const matchCount = inputWords.filter(w => words.some(cw => cw.includes(w) || w.includes(cw))).length;
    const score = matchCount / Math.max(inputWords.length, 1);
    if (score > bestScore && score > 0.4) { bestScore = score; best = c; }
  }
  return best;
}

function getCompanyLogoUrl(name, website) {
  if (website) {
    try {
      const url = new URL(website.startsWith("http") ? website : `https://${website}`);
      const domain = url.hostname.replace("www.", "");
      return `https://logo.clearbit.com/${domain}`;
    } catch { /* ignore */ }
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e1e2e&color=ef4444&bold=true&size=128`;
}

export default function AdminAssistant({ onClose }) {
  const { user: _user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [companiesCache, setCompaniesCache] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      navigate("/admin");
    }
  }

  useEffect(() => {
    setMessages([{
      role: "assistant",
      text: `Hi! I'm your Placement Management Assistant.

I can help you manage companies, users, and applications. Just ask naturally — here are some examples:

Companies:
• "Add company Google"
• "Delete eQ Technologic"
• "Show me all companies"
• "Which companies do we have?"

Users & Analytics:
• "Show users"
• "How many applications?"
• "Show analytics"

Bulk Operations:
• "Delete all companies"
• "Delete all applications"

I also answer general questions — just ask anything!`,
    }]);
    setTimeout(() => inputRef.current?.focus(), 100);
    loadCache();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingConfirm]);

  async function loadCache() {
    const cRes = await getCompanies();
    setCompaniesCache(cRes.data || []);
  }

  function addMsg(role, text, meta = {}) {
    setMessages(prev => [...prev, { role, text, ...meta, id: Date.now() }]);
  }

  function recordAction(action) {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    addMsg("user", text);

    await loadCache();
    const cmd = parseAdminCommand(text, companiesCache);

    switch (cmd.intent) {
      case "help": {
        addMsg("assistant", `Here's what I can help with:

COMPANIES:
• Add company [name] — Create a new company
• Delete company [name] — Remove a company
• Update company [name] — View or modify details
• Show companies — List all companies

USERS & ANALYTICS:
• Show users — List all registered users
• Show applications — View all applications
• Show analytics — View system statistics

BULK OPERATIONS:
• Delete all companies
• Delete all applications

OTHER:
• Undo / Redo — Undo or redo last action

I also understand natural language! Try:
• "Which companies do we have?"
• "How many students are registered?"
• "Remove eQ Technologic"`);
        break;
      }

      case "add_company": {
        setBusy(true);
        if (!cmd.companyName || cmd.companyName.trim().length === 0) {
          addMsg("assistant", "I'd be happy to add a company! What's the company name?\n\nExample: \"Add company Google\"");
          setBusy(false);
          return;
        }
        const existing = await findCompanyByName(cmd.companyName);
        if (existing.data) {
          addMsg("assistant", `Company "${existing.data.name}" already exists.\n\n• Industry: ${existing.data.industry || "N/A"}\n• Location: ${existing.data.location || "N/A"}\n\nWould you like to update it instead? Say "Update company ${existing.data.name}".`);
          setBusy(false);
          return;
        }
        setPendingConfirm({
          type: "add_company",
          companyName: cmd.companyName.trim(),
          parsedData: cmd.parsedData || {},
        });
        addMsg("assistant", `I'll add "${cmd.companyName.trim()}" as a new company. Confirm below:`);
        setBusy(false);
        break;
      }

      case "delete_company_no_name": {
        setBusy(true);
        const compsRes = await getCompanies();
        const comps = compsRes.data || [];
        if (comps.length === 0) {
          addMsg("assistant", "There are no companies to delete. Add one first by saying \"Add company [name]\".");
        } else {
          const list = comps.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
          addMsg("assistant", `Which company would you like to delete?\n\n${list}\n\nJust tell me the name, like "Delete ${comps[0]?.name || 'Google'}".`);
        }
        setBusy(false);
        return;
      }

      case "delete_company": {
        setBusy(true);
        let companyName = cmd.companyName;
        let companyId = cmd.companyId;

        if (!companyId) {
          const findRes = await findCompanyByName(companyName);
          if (findRes.data) {
            companyId = findRes.data.id;
            companyName = findRes.data.name;
          } else {
            const compsRes = await getCompanies();
            const matched = fuzzyMatchCompany(companyName, compsRes.data || []);
            if (matched) {
              companyId = matched.id;
              companyName = matched.name;
            }
          }
        }

        if (!companyId) {
          addMsg("assistant", `I couldn't find a company matching "${cmd.companyName}". Please check the name and try again.\n\nType "Show companies" to see all available companies.`);
          setBusy(false);
          return;
        }

        const company = (companiesCache || []).find(c => c.id === companyId) || { name: companyName, id: companyId };
        setPendingConfirm({
          type: "delete_company",
          companyId,
          companyName: company.name,
          companyData: company,
        });
        addMsg("assistant", `I found "${company.name}". This will permanently remove the company and its associated data.\n\nDo you want me to continue?`);
        setBusy(false);
        break;
      }

      case "update_company": {
        setBusy(true);
        let companyName = cmd.companyName;
        let company = null;

        const findRes = await findCompanyByName(companyName);
        if (findRes.data) {
          company = findRes.data;
        } else {
          const compsRes = await getCompanies();
          company = fuzzyMatchCompany(companyName, compsRes.data || []);
        }

        if (!company) {
          addMsg("assistant", `I couldn't find a company matching "${cmd.companyName}". Please check the name and try again.\n\nType "Show companies" to see all available companies.`);
          setBusy(false);
          return;
        }

        addMsg("assistant", `Company Details:\n\n• Name: ${company.name}\n• Industry: ${company.industry || "Not specified"}\n• Location: ${company.location || "Not specified"}\n• Website: ${company.website || "Not specified"}\n• Status: ${company.isActive ? "Active" : "Inactive"}\n\nTo update, describe what you'd like to change, or say "Delete company ${company.name}" to remove it.`);
        setBusy(false);
        break;
      }

      case "list_companies": {
        setBusy(true);
        const compsRes = await getCompanies();
        const comps = compsRes.data || [];
        if (comps.length === 0) {
          addMsg("assistant", "No companies yet. Add your first company by saying \"Add company [name]\".");
        } else {
          const list = comps.map(c => {
            return `• ${c.name} — ${c.industry || "N/A"} — ${c.location || "N/A"}`;
          }).join("\n");
          addMsg("assistant", `Companies (${comps.length}):\n\n${list}`);
        }
        setBusy(false);
        break;
      }

      case "list_users": {
        setBusy(true);
        const usersRes = await getAllUsers();
        const users = usersRes.data || [];
        if (users.length === 0) {
          addMsg("assistant", "No users registered yet.");
        } else {
          const list = users.map(u =>
            `• ${u.displayName || u.email || "Unknown"} — ${u.role || "student"}`
          ).join("\n");
          addMsg("assistant", `Registered Users (${users.length}):\n\n${list}`);
        }
        setBusy(false);
        break;
      }

      case "list_applications": {
        setBusy(true);
        const appsRes = await getAllApplications();
        const apps = appsRes.data || [];
        if (apps.length === 0) {
          addMsg("assistant", "No applications found yet.");
        } else {
          const list = apps.slice(0, 20).map(a =>
            `• ${a.userEmail || a.userId || "Unknown"} — ${a.jobTitle || a.companyName || "N/A"} — ${a.status || "pending"}`
          ).join("\n");
          const extra = apps.length > 20 ? `\n\n... and ${apps.length - 20} more` : "";
          addMsg("assistant", `Applications (${apps.length}):\n\n${list}${extra}`);
        }
        setBusy(false);
        break;
      }

      case "show_analytics": {
        setBusy(true);
        const [compsRes, appsRes, usersRes] = await Promise.all([
          getCompanies(),
          getAllApplications(),
          getAllUsers(),
        ]);
        const compsCount = (compsRes.data || []).length;
        const appsCount = (appsRes.data || []).length;
        const usersCount = (usersRes.data || []).length;
        const apps = appsRes.data || [];
        const interviews = apps.filter(a => a.status === "interview").length;
        const offers = apps.filter(a => a.status === "offer" || a.status === "selected").length;

        addMsg("assistant", `System Analytics:\n\n• Companies: ${compsCount}\n• Applications: ${appsCount}\n• Registered Users: ${usersCount}\n• Interviews: ${interviews}\n• Offers: ${offers}`);
        setBusy(false);
        break;
      }

      case "delete_all_companies": {
        setBusy(true);
        const countRes = await getCompanies();
        const count = (countRes.data || []).length;
        if (count === 0) {
          addMsg("assistant", "No companies to delete.");
          setBusy(false);
          return;
        }
        setPendingConfirm({ type: "delete_all_companies", count });
        addMsg("assistant", `WARNING: This will permanently delete ALL ${count} companies and their associated data.\n\nThis action cannot be easily undone. Do you want to continue?`);
        setBusy(false);
        break;
      }

      case "delete_all_applications": {
        setBusy(true);
        const appsCountRes = await getAllApplications();
        const appsCount = (appsCountRes.data || []).length;
        if (appsCount === 0) {
          addMsg("assistant", "No applications to delete.");
          setBusy(false);
          return;
        }
        setPendingConfirm({ type: "delete_all_applications", count: appsCount });
        addMsg("assistant", `WARNING: This will permanently delete ALL ${appsCount} applications.\n\nThis action cannot be easily undone. Do you want to continue?`);
        setBusy(false);
        break;
      }

      case "undo": {
        const action = undoStack[undoStack.length - 1];
        if (!action) {
          addMsg("assistant", "Nothing to undo.");
          return;
        }
        setBusy(true);
        try {
          if (action.type === "add_company" && action.companyId) {
            await deleteCompany(action.companyId);
          } else if (action.type === "delete_company" && action.companyData) {
            await addCompany(action.companyData);
          }
          setUndoStack(prev => prev.slice(0, -1));
          setRedoStack(prev => [...prev, action]);
          addMsg("assistant", `Undone: ${action.description}`);
        } catch {
          addMsg("assistant", "Failed to undo. Please try again.");
        }
        setBusy(false);
        break;
      }

      case "redo": {
        const action = redoStack[redoStack.length - 1];
        if (!action) {
          addMsg("assistant", "Nothing to redo.");
          return;
        }
        setBusy(true);
        try {
          if (action.type === "add_company" && action.companyData) {
            const res = await addCompany(action.companyData);
            if (res.data) {
              const updatedAction = { ...action, companyId: res.data.id };
              setRedoStack(prev => prev.slice(0, -1));
              setUndoStack(prev => [...prev, updatedAction]);
              addMsg("assistant", `Redone: ${updatedAction.description}`);
              setBusy(false);
              return;
            }
          } else if (action.type === "delete_company" && action.companyId) {
            await deleteCompany(action.companyId);
          }
          setRedoStack(prev => prev.slice(0, -1));
          setUndoStack(prev => [...prev, action]);
          addMsg("assistant", `Redone: ${action.description}`);
        } catch {
          addMsg("assistant", "Failed to redo. Please try again.");
        }
        setBusy(false);
        break;
      }

      case "general_question": {
        setBusy(true);
        const question = cmd.question || text;
        try {
          const { generateSmartResponse } = await import("../utils/aiEngine");
          const context = {
            companies: companiesCache,
            userRole: "admin",
          };
          const response = await generateSmartResponse(question, context, messages);
          addMsg("assistant", response);
        } catch {
          addMsg("assistant", getGeneralResponse(question, companiesCache));
        }
        setBusy(false);
        break;
      }

      default: {
        addMsg("assistant", `I'm not sure what you mean. Try:\n\n• "Add company [name]"\n• "Delete company [name]"\n• "Show companies"\n• "Show users"\n• "Show analytics"\n• Or just ask a natural language question!`);
      }
    }
  }

  function getGeneralResponse(question, companies) {
    const q = question.toLowerCase();

    if (q.includes("company") && (q.includes("how many") || q.includes("count") || q.includes("total"))) {
      return `There are ${companies.length} companies in the system.`;
    }
    if (q.includes("interview")) {
      return "I can help you check interview status. Try \"Show applications\" to see all applications and their statuses.";
    }
    if (q.includes("help") || q.includes("what can")) {
      return "I can help you manage companies, users, and applications. Just ask naturally! Say \"Help\" for a full list of commands.";
    }

    return `I'm here to help with placement management. I can assist with:\n\n• Companies — Add, delete, update, list\n• Users — View registered users\n• Applications — View all applications\n• Analytics — System statistics\n\nTry asking something like:\n• "Show companies"\n• "Add company Google"\n• "How many applications?"`;
  }

  async function handleConfirm() {
    if (!pendingConfirm) return;
    setBusy(true);
    const { type, companyName, companyId, companyData, count } = pendingConfirm;

    if (type === "add_company") {
      const logoUrl = getCompanyLogoUrl(companyName);
      const parsed = pendingConfirm.parsedData || {};
      const res = await addCompany({
        name: companyName,
        industry: parsed.industry || "",
        location: parsed.location || "",
        organisationSize: parsed.organizationSize || "",
        website: parsed.companyWebsite || "",
        description: parsed.description || "",
        logoUrl,
        isActive: true,
      });
      const newId = res.data?.id;
      recordAction({ type: "add_company", companyId: newId, companyName, description: `Added ${companyName}` });
      addMsg("assistant", `Company "${companyName}" added successfully.\n\nLogo: Auto-generated\n\nThe company is now available in the Companies section. [Undo] available if needed.`);
    } else if (type === "delete_company") {
      await deleteCompany(companyId);
      recordAction({ type: "delete_company", companyId, companyData, companyName, description: `Deleted ${companyName}` });
      addMsg("assistant", `Company "${companyName}" deleted successfully.\n\n[Undo] available if needed.`);
    } else if (type === "delete_all_companies") {
      const res = await deleteAllCompanies();
      addMsg("assistant", `All ${res.data?.deleted || count} companies deleted successfully.`);
    } else if (type === "delete_all_applications") {
      const res = await deleteAllApplications();
      addMsg("assistant", `All ${res.data?.deleted || count} applications deleted successfully.`);
    }

    setPendingConfirm(null);
    setBusy(false);
    loadCache();
  }

  function handleCancel() {
    setPendingConfirm(null);
  }

  return (
    <div className="admin-asst-overlay" onClick={handleClose}>
      <div className="admin-asst-panel glass-heavy" onClick={e => e.stopPropagation()}>
        <div className="admin-asst-header">
          <div className="admin-asst-title-group">
            <div className="admin-asst-icon">🛡</div>
            <div>
              <h2 className="admin-asst-title">Admin Assistant</h2>
              <span className="admin-asst-sub">Placement Management</span>
            </div>
          </div>
          <div className="admin-asst-header-actions">
            <button
              className="admin-asst-action-btn"
              onClick={() => {
                const last = undoStack[undoStack.length - 1];
                if (last) {
                  setUndoStack(prev => prev.slice(0, -1));
                  setRedoStack(prev => [...prev, last]);
                  addMsg("assistant", `Undone: ${last.description}`);
                }
              }}
              disabled={undoStack.length === 0}
              title="Undo"
            >
              Undo
            </button>
            <button
              className="admin-asst-action-btn"
              onClick={() => {
                const last = redoStack[redoStack.length - 1];
                if (last) {
                  setRedoStack(prev => prev.slice(0, -1));
                  setUndoStack(prev => [...prev, last]);
                  addMsg("assistant", `Redone: ${last.description}`);
                }
              }}
              disabled={redoStack.length === 0}
              title="Redo"
            >
              Redo
            </button>
            <button className="admin-asst-close" onClick={handleClose}>✕</button>
          </div>
        </div>

        <div className="admin-asst-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`admin-asst-msg admin-asst-msg--${msg.role}`}>
              {msg.role === "assistant" && <div className="admin-asst-msg-icon">🛡</div>}
              <div className="admin-asst-msg-text">{msg.text}</div>
            </div>
          ))}

          {pendingConfirm && (
            <div className="admin-asst-confirm-card">
              <p className="admin-asst-confirm-label">Confirm Action</p>
              <div className="admin-asst-confirm-preview">
                {pendingConfirm.type === "add_company" && <strong>Add Company: {pendingConfirm.companyName}</strong>}
                {pendingConfirm.type === "delete_company" && <strong>Delete Company: {pendingConfirm.companyName}</strong>}
                {pendingConfirm.type === "delete_all_companies" && <strong>Delete ALL {pendingConfirm.count} companies</strong>}
                {pendingConfirm.type === "delete_all_applications" && <strong>Delete ALL {pendingConfirm.count} applications</strong>}
              </div>
              <div className="admin-asst-confirm-actions">
                <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                <button
                  className={`btn ${pendingConfirm.type.includes("delete") ? "btn-danger" : "btn-primary"}`}
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  {pendingConfirm.type.includes("delete") ? "Delete" : "Confirm & Save"}
                </button>
              </div>
            </div>
          )}

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

        <form className="admin-asst-composer" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="admin-asst-input"
            placeholder="Ask anything... (Add, Delete, Show, or natural language)"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="admin-asst-send" disabled={!input.trim() || busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
