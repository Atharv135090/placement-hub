import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import UserAvatar from "../components/UserAvatar";
import { getPlacementContext, generateSmartResponse, isAIConfigured } from "../utils/aiEngine";
import "./Assistant.css";

// 6 Premium Quick Action Cards matching PRD & reference design
const ACTION_CARDS = [
  {
    id: "explain",
    label: "Explain a topic",
    subtext: "Get simple explanations",
    colorClass: "asst-card-pink",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    prompt: "Explain Dynamic Programming simply with real interview examples and code snippets.",
  },
  {
    id: "interview",
    label: "Interview prep",
    subtext: "Practice questions",
    colorClass: "asst-card-blue",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    prompt: "Give me top technical and behavioral interview questions asked in placement drives.",
  },
  {
    id: "resume",
    label: "Review my resume",
    subtext: "Get AI feedback",
    colorClass: "asst-card-green",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    prompt: "How can I improve my software engineering resume bullet points to highlight impact and pass ATS?",
  },
  {
    id: "projects",
    label: "Suggest projects",
    subtext: "Get project ideas",
    colorClass: "asst-card-amber",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="18" x2="15" y2="18" />
        <line x1="10" y1="22" x2="14" y2="22" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    ),
    prompt: "Suggest 3 unique full-stack project ideas that stand out to tech recruiters and interviewers.",
  },
  {
    id: "company",
    label: "Tell me about a company",
    subtext: "Company insights",
    colorClass: "asst-card-purple",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
      </svg>
    ),
    prompt: "Tell me about companies visiting for campus placements and what specific topics I should prepare for them.",
  },
  {
    id: "more",
    label: "More ideas",
    subtext: "Explore more",
    colorClass: "asst-card-slate",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    prompt: "Give me a step-by-step placement preparation roadmap covering DSA, System Design, Projects, and Aptitude.",
  },
];

// Topic chips below input composer
const TOPIC_CHIPS = [
  {
    id: "chip-dsa",
    label: "DSA",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    prompt: "What are the most essential DSA topics for tech interviews?",
  },
  {
    id: "chip-sys",
    label: "System Design",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="10" x2="6" y2="14" />
        <line x1="18" y1="10" x2="18" y2="14" />
      </svg>
    ),
    prompt: "Explain key System Design principles for junior software engineering roles.",
  },
  {
    id: "chip-resume",
    label: "Resume",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    prompt: "How to structure a tech resume to get more interview calls?",
  },
  {
    id: "chip-aptitude",
    label: "Aptitude",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    prompt: "What aptitude and logical reasoning topics should I focus on for placement rounds?",
  },
  {
    id: "chip-company",
    label: "Company",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
      </svg>
    ),
    prompt: "How do product companies evaluate candidates during technical interview rounds?",
  },
  {
    id: "chip-projects",
    label: "Projects",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    prompt: "What features make a web project stand out on a developer portfolio?",
  },
];

function renderMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n/g, "<br/>");
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const then = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "Just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(then).toLocaleDateString();
}

export default function Assistant() {
  const { user, profile } = useAuth();
  const {
    messages,
    input,
    setInput,
    busy,
    setBusy,
    clearConversation,
    bottomRef,
    addMsg,
    setMessages,
  } = useAssistant();

  const { applications, companies, savedIds } = usePlacementData();
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatViewportRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  const [copiedIdx, setCopiedIdx] = useState(null);
  const [feedbackState, setFeedbackState] = useState({}); // { [msgIdx]: 'like' | 'dislike' }
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setTick] = useState(0); // Force re-render to update relative timestamps
  const [recentChats, setRecentChats] = useState(() => {
    try {
      const saved = localStorage.getItem("ph_recent_chats");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const firstName =
    profile?.displayName?.split(" ")[0] ||
    user?.displayName?.split(" ")[0] ||
    "Student";

  const aiReady = isAIConfigured();

  // Scroll to top on initial page mount (PRD Section 19 requirement)
  useLayoutEffect(() => {
    const mainViewport = document.querySelector(".main-viewport");
    if (mainViewport) {
      mainViewport.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, []);

  // Save recent chats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ph_recent_chats", JSON.stringify(recentChats));
    } catch {
      // ignore
    }
  }, [recentChats]);

  // Periodically refresh relative timestamps every 60s
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Automatically restore input focus whenever AI finishes processing (busy transitions to false)
  useEffect(() => {
    if (!busy) {
      inputRef.current?.focus();
    }
  }, [busy]);

  // Auto-scroll chat history internally ONLY when new messages arrive during an active conversation
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      if (chatViewportRef.current) {
        chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
      }
    }
  }, [messages]);

  async function handleSendMessage(textToSend) {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    setInput("");
    addMsg("user", text);
    setBusy(true);

    // Track in recent chats dynamically
    const title = text.length > 28 ? text.slice(0, 26) + "..." : text;
    setRecentChats((prev) => {
      const filtered = prev.filter((c) => c.title !== title);
      return [{ id: `rc-${Date.now()}`, title, ts: Date.now(), prompt: text }, ...filtered.slice(0, 7)];
    });

    const ctx = getPlacementContext(applications, companies, savedIds, profile, user);

    try {
      const response = await generateSmartResponse(text, ctx, messages);
      addMsg("assistant", response);
    } catch (err) {
      addMsg("assistant", "Sorry, I encountered an error while processing your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleFormSubmit(e) {
    if (e) e.preventDefault();
    handleSendMessage();
  }

  function handleCardClick(card) {
    handleSendMessage(card.prompt);
  }

  function handleChipClick(chip) {
    handleSendMessage(chip.prompt);
  }

  function handleRecentChatClick(chat) {
    if (chat.prompt) {
      handleSendMessage(chat.prompt);
    }
  }

  function handleNewChat() {
    clearConversation();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function handleFeedback(idx, type) {
    setFeedbackState((prev) => ({
      ...prev,
      [idx]: prev[idx] === type ? null : type,
    }));
  }

  function handleSpeak(text, idx) {
    if (!("speechSynthesis" in window)) return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>?/gm, ""));
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  }

  function handleShare(text) {
    if (navigator.share) {
      navigator.share({
        title: "Placement Hub Assistant",
        text: text.slice(0, 200) + "...",
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert("Response copied to clipboard for sharing!");
    }
  }

  function handleAttachmentClick() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setInput((prev) => (prev ? `${prev} [Attached file: ${file.name}]` : `[Attached file: ${file.name}] `));
      if (inputRef.current) inputRef.current.focus();
    }
  }

  const isNewChatState = messages.length <= 1;

  const filteredRecentChats = searchQuery.trim()
    ? recentChats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : recentChats;

  return (
    <div className="asst-container animate-fade-in">
      {/* Hidden File Input for Attachments */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      {/* ── WORKSPACE TOP BAR (PRD Section 3) ── */}
      <header className="asst-top-bar">
        <div className="asst-top-left">
          <div className="asst-dropdown-trigger" title="Assistant workspace">
            <span className="asst-top-title">Assistant</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="asst-chevron-icon">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="asst-top-right">
          <div className="asst-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="asst-search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="asst-search-input"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            className="asst-icon-btn"
            onClick={handleNewChat}
            title="New Chat"
            aria-label="New Chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="asst-user-avatar-badge" title={user?.displayName || "Profile"}>
            <UserAvatar user={user} profile={profile} alt={firstName} />
          </div>
        </div>
      </header>

      {/* ── AI SETUP WARNING BANNER (Shown if API key missing) ── */}
      {!aiReady && (
        <div className="asst-setup-warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            <strong>Gemini AI API Key missing:</strong> Add <code>VITE_GEMINI_API_KEY=your_key</code> in your <code>.env</code> file to enable live AI responses.
          </span>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <div className="asst-workspace-body">
        {/* ── DESKTOP SIDEBAR (PRD Section 2) ── */}
        <aside className="asst-sidebar">
          {/* New Chat Button */}
          <button className="asst-new-chat-btn" onClick={handleNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Chat</span>
          </button>

          {/* Recent Chats Section */}
          <div className="asst-sidebar-section">
            <h3 className="asst-sidebar-heading">Recent Chats</h3>
            <div className="asst-recent-list">
              {filteredRecentChats.length === 0 ? (
                <div className="asst-recent-empty">No recent conversations</div>
              ) : (
                filteredRecentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="asst-recent-item"
                    onClick={() => handleRecentChatClick(chat)}
                    role="button"
                    tabIndex={0}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="asst-recent-icon">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <div className="asst-recent-info">
                      <span className="asst-recent-title">{chat.title}</span>
                      <span className="asst-recent-time">{formatRelativeTime(chat.ts)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="asst-view-all-btn" onClick={() => setSearchQuery("")}>
              View all chats →
            </button>
          </div>

          {/* Sidebar User Footer */}
          <div className="asst-sidebar-user-footer">
            <UserAvatar user={user} profile={profile} alt={firstName} />
            <div className="asst-sidebar-user-details">
              <span className="asst-sidebar-user-name">
                {profile?.displayName || user?.displayName || "Student"}
              </span>
              <span className="asst-sidebar-user-email">
                {user?.email || ""}
              </span>
            </div>
          </div>
        </aside>

        {/* ── CHAT / CANVAS MAIN AREA ── */}
        <main className="asst-canvas">
          {/* EMPTY / NEW CHAT WELCOME STATE (PRD Section 4 & 5) */}
          {isNewChatState ? (
            <div className="asst-welcome-wrapper">
              <div className="asst-welcome-content">
                {/* Sparkle Icon Badge */}
                <div className="asst-sparkle-badge">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="asst-sparkle-svg">
                    <path
                      d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>

                {/* Hero Greeting */}
                <h1 className="asst-welcome-name">Hi {firstName} 👋</h1>
                <h2 className="asst-welcome-question">How can I help you today?</h2>

                <p className="asst-welcome-description">
                  Your AI-powered placement assistant. Get help with DSA, system design, resume review, company insights, interview prep, and more.
                </p>

                {/* 6 Quick Action Cards Grid (PRD Section 5) */}
                <div className="asst-action-cards-grid">
                  {ACTION_CARDS.map((card) => (
                    <div
                      key={card.id}
                      className={`asst-action-card ${card.colorClass}`}
                      onClick={() => handleCardClick(card)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="asst-action-card-icon">{card.icon}</div>
                      <div className="asst-action-card-text">
                        <span className="asst-action-card-title">{card.label}</span>
                        <span className="asst-action-card-subtext">{card.subtext}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT CONVERSATION THREAD (PRD Section 8 & 9) */
            <div className="asst-chat-thread-container">
              {/* Active Conversation Header (Fixed Top) */}
              <div className="asst-chat-header">
                <button className="asst-chat-back-btn" onClick={handleNewChat} title="Start New Chat">
                  ← New Chat
                </button>
                <span className="asst-chat-header-title">Active Conversation</span>
                <button className="asst-chat-more-btn" title="Options">
                  •••
                </button>
              </div>

              {/* Scrollable Messages Viewport */}
              <div className="asst-messages-viewport" ref={chatViewportRef}>
                <div className="asst-messages-list">
                  {messages.map((msg, i) => {
                    const isAssistant = msg.role === "assistant";
                    return (
                      <div
                        key={i}
                        className={`asst-message-row ${
                          isAssistant ? "asst-msg-ai" : "asst-msg-user"
                        }`}
                      >
                        {isAssistant && (
                          <div className="asst-ai-avatar">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="asst-ai-avatar-sparkle">
                              <path
                                d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                                fill="currentColor"
                              />
                            </svg>
                          </div>
                        )}

                        <div className="asst-message-content">
                          <div
                            className={`asst-message-bubble ${
                              isAssistant ? "asst-bubble-ai" : "asst-bubble-user"
                            }`}
                          >
                            <div
                              className="asst-markdown-body"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                            />

                            {/* AI Action Buttons Bar (PRD Section 8) */}
                            {isAssistant && (
                              <div className="asst-msg-actions-bar">
                                <button
                                  className="asst-msg-action-btn"
                                  onClick={() => handleCopy(msg.text, i)}
                                  title="Copy response"
                                >
                                  {copiedIdx === i ? "✓ Copied" : "⧉ Copy"}
                                </button>

                                <button
                                  className={`asst-msg-action-btn ${feedbackState[i] === "like" ? "active" : ""}`}
                                  onClick={() => handleFeedback(i, "like")}
                                  title="Good response"
                                >
                                  👍
                                </button>

                                <button
                                  className={`asst-msg-action-btn ${feedbackState[i] === "dislike" ? "active" : ""}`}
                                  onClick={() => handleFeedback(i, "dislike")}
                                  title="Poor response"
                                >
                                  👎
                                </button>

                                <button
                                  className={`asst-msg-action-btn ${speakingIdx === i ? "active" : ""}`}
                                  onClick={() => handleSpeak(msg.text, i)}
                                  title="Read aloud"
                                >
                                  {speakingIdx === i ? "🔊 Reading..." : "🔊 Voice"}
                                </button>

                                <button
                                  className="asst-msg-action-btn"
                                  onClick={() => handleShare(msg.text)}
                                  title="Share response"
                                >
                                  🔗 Share
                                </button>
                              </div>
                            )}
                          </div>
                          <span className="asst-msg-timestamp">
                            {new Date(msg.ts || Date.now()).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {!isAssistant && (
                          <div className="asst-user-avatar-wrap">
                            <UserAvatar user={user} profile={profile} alt="You" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {busy && (
                    <div className="asst-message-row asst-msg-ai">
                      <div className="asst-ai-avatar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="asst-ai-avatar-sparkle">
                          <path
                            d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="asst-message-content">
                        <div className="asst-message-bubble asst-bubble-ai asst-typing-bubble">
                          <div className="asst-typing-dots">
                            <span className="dot" />
                            <span className="dot" />
                            <span className="dot" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            </div>
          )}

          {/* ── CHAT COMPOSER & TOPICS AREA (PRD Section 6 & 7) ── */}
          <div className="asst-composer-wrapper">
            {/* ChatGPT-Style Capsule Composer (PRD Section 6) */}
            <form className="asst-composer-capsule" onSubmit={handleFormSubmit}>
              <button
                type="button"
                className="asst-composer-btn"
                onClick={handleAttachmentClick}
                title="Attach file"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <input
                ref={inputRef}
                type="text"
                className="asst-composer-input"
                placeholder="Ask anything about placements, DSA, resume, companies..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />

              <button
                type="button"
                className="asst-composer-btn asst-mic-btn"
                title="Microphone / Voice input"
                onClick={() => {
                  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.onresult = (event) => {
                      const transcript = event.results[0][0].transcript;
                      setInput(transcript);
                    };
                    recognition.start();
                  } else {
                    alert("Voice input is supported in Chrome, Edge, and Safari.");
                  }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>

              <button
                type="submit"
                className="asst-composer-send-btn"
                disabled={!input.trim() || busy}
                title="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>

            {/* Topic Chips (PRD Section 7) */}
            <div className="asst-topic-chips-row">
              {TOPIC_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  className="asst-topic-chip"
                  onClick={() => handleChipClick(chip)}
                  type="button"
                >
                  <span className="asst-chip-icon">{chip.icon}</span>
                  <span className="asst-chip-label">{chip.label}</span>
                </button>
              ))}
            </div>

            {/* Disclaimer Subtext (PRD Section 6) */}
            <p className="asst-disclaimer-text">
              Placement Hub Assistant can make mistakes. Always verify important information.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
