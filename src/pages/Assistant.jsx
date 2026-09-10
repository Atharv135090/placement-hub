import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import UserAvatar from "../components/UserAvatar";
import { getPlacementContext, generateSmartResponse } from "../utils/aiEngine";
import "./Assistant.css";

const MOTIVATIONAL_QUOTES = [
  "Discipline today creates opportunities tomorrow.",
  "Better Questions. Brighter Opportunities.",
  "Precision and relentless effort separate the good from the great.",
  "Speed without control is nothing; consistency wins the race.",
  "Every small concept mastered is horsepower added to your career.",
  "Your dream company isn't waiting for luck; it's waiting for your preparation.",
  "Stay focused, accelerate through challenges, and cross your finish line.",
  "Hard work in silence; let your offer letter make the noise.",
];

const CATEGORIES = [
  {
    id: "dsa",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "DSA Help",
    subtitle: "Solve coding problems",
    prompt: "Can you help me practice high-frequency Data Structures and Algorithms problems for placements?",
  },
  {
    id: "interview",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: "Interview Prep",
    subtitle: "Practice questions",
    prompt: "I want to practice technical and HR interview questions. What should I prepare first?",
  },
  {
    id: "resume",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: "Resume Review",
    subtitle: "Improve your resume",
    prompt: "How can I improve my tech resume bullet points to highlight impact and pass ATS screening?",
  },
  {
    id: "career",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    title: "Career Guidance",
    subtitle: "Get personalized advice",
    prompt: "Give me personalized career guidance and roadmap for software engineering placement drives.",
  },
  {
    id: "company",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
      </svg>
    ),
    title: "Company Insights",
    subtitle: "Learn about companies",
    prompt: "Tell me about hiring companies, their recruitment patterns, and preparation tips.",
  },
];

const QUICK_PROMPTS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    label: "Explain a topic",
    prompt: "Explain Dynamic Programming simply with real interview examples.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    label: "Solve a coding problem",
    prompt: "Help me solve a two-pointer coding problem step by step.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    label: "Review my resume",
    prompt: "What are the most impactful bullet point formulas for resume project descriptions?",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    label: "Interview questions",
    prompt: "Give me the top 5 most frequently asked behavioral and technical interview questions.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="18" x2="15" y2="18" />
        <line x1="10" y1="22" x2="14" y2="22" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>
    ),
    label: "Suggest projects",
    prompt: "Suggest 3 unique full-stack project ideas that impress interviewers.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M9 7h6M12 3l9 4H3l9-4z" />
      </svg>
    ),
    label: "Tell me about a company",
    prompt: "Tell me about the companies visiting for placements and what to prepare.",
  },
];

const INITIAL_RECENT_CHATS = [];

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
  } = useAssistant();

  const { applications, companies, savedIds } = usePlacementData();
  const inputRef = useRef(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [recentChats, setRecentChats] = useState(INITIAL_RECENT_CHATS);

  const firstName =
    profile?.name?.split(" ")[0] ||
    user?.displayName?.split(" ")[0] ||
    "Atharv";

  // Automatic quote rotation every 7 seconds without immediate repetition
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
        } while (next === prev && MOTIVATIONAL_QUOTES.length > 1);
        return next;
      });
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bottomRef?.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, bottomRef]);

  async function handleSendMessage(textToSend) {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    setInput("");
    addMsg("user", text);
    setBusy(true);

    // Track in recent chats
    setRecentChats((prev) => {
      const title = text.length > 24 ? text.slice(0, 22) + "..." : text;
      return [{ id: Date.now(), title, time: "just now", prompt: text }, ...prev.slice(0, 4)];
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

  function handlePromptClick(promptText) {
    setInput(promptText);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleCategoryClick(item) {
    handleSendMessage(item.prompt);
  }

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => {
      setCopiedIdx(null);
    }, 2000);
  }

  const currentQuote = MOTIVATIONAL_QUOTES[quoteIndex];

  return (
    <div className="asst-page-workspace animate-fade-in">
      <div className="asst-layout-grid">
        {/* ── LEFT COLUMN: MAIN WORKSPACE (~72%) ── */}
        <div className="asst-main-column">
          {/* 1. Placement Assistant Hero Banner */}
          <div className="asst-hero-banner">
            <div className="asst-hero-left">
              <div className="asst-hero-icon-container">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="asst-sparkle-icon">
                  <path
                    d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="asst-hero-text">
                <span className="asst-ai-tag">AI POWERED</span>
                <h1 className="asst-title">
                  Placement <span className="asst-title-highlight">Assistant</span>
                </h1>
                <p className="asst-subtitle">
                  Your personal guide for coding, study, interviews, career and more. Ask anything. Get smarter. Go further.
                </p>
              </div>
            </div>

            {/* Subtle Automotive / SVJ branding watermark */}
            <div className="asst-hero-right">
              <div className="asst-svj-badge">
                <span className="asst-svj-logo">SVJ</span>
                <div className="asst-svj-divider" />
                <div className="asst-svj-motto">
                  <span>DRIVE</span>
                  <span>\ LEARN</span>
                  <span>ACHIEVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Quick-Help / Category Cards (5 horizontal cards) */}
          <div className="asst-categories-row">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="asst-category-card"
                onClick={() => handleCategoryClick(cat)}
                role="button"
                tabIndex={0}
              >
                <div className="asst-category-icon-box">{cat.icon}</div>
                <div className="asst-category-info">
                  <span className="asst-category-title">{cat.title}</span>
                  <span className="asst-category-sub">{cat.subtitle}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 3. Main Chat Area */}
          <div className="asst-chat-viewport">
            {/* If fresh conversation, render default welcome message */}
            {messages.length <= 1 ? (
              <div className="asst-chat-message-row asst-msg-incoming">
                <div className="asst-avatar-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="asst-avatar-sparkle">
                    <path
                      d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="asst-bubble-wrapper">
                  <div className="asst-chat-bubble asst-bubble-assistant">
                    <h3 className="asst-bubble-greeting">Hi {firstName}! 👋</h3>
                    <p className="asst-bubble-intro">I'm your Placement Assistant. I can help you with:</p>
                    <ul className="asst-bullet-list">
                      <li>
                        <span className="asst-bullet-point" />
                        <span>DSA and coding problems</span>
                      </li>
                      <li>
                        <span className="asst-bullet-point" />
                        <span>Interview preparation</span>
                      </li>
                      <li>
                        <span className="asst-bullet-point" />
                        <span>Resume building and review</span>
                      </li>
                      <li>
                        <span className="asst-bullet-point" />
                        <span>Career and placement guidance</span>
                      </li>
                      <li>
                        <span className="asst-bullet-point" />
                        <span>Company information</span>
                      </li>
                      <li>
                        <span className="asst-bullet-point" />
                        <span>General doubts</span>
                      </li>
                    </ul>
                    <p className="asst-bubble-closing">
                      Ask me anything or try one of the quick prompts on the right.
                    </p>
                  </div>
                  <span className="asst-msg-timestamp">11:39 AM</span>
                </div>
              </div>
            ) : null}

            {/* Conversation Messages */}
            {messages.slice(messages.length <= 1 ? 1 : 0).map((msg, i) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div
                  key={i}
                  className={`asst-chat-message-row ${
                    isAssistant ? "asst-msg-incoming" : "asst-msg-outgoing"
                  }`}
                >
                  {isAssistant && (
                    <div className="asst-avatar-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="asst-avatar-sparkle">
                        <path
                          d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="asst-bubble-wrapper">
                    <div
                      className={`asst-chat-bubble ${
                        isAssistant ? "asst-bubble-assistant" : "asst-bubble-user"
                      }`}
                    >
                      <div
                        className="asst-markdown-body"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                      />
                      {isAssistant && (
                        <div className="asst-bubble-actions">
                          <button
                            className="asst-copy-button"
                            onClick={() => handleCopy(msg.text, i)}
                            title="Copy text"
                          >
                            {copiedIdx === i ? "✓ Copied" : "⧉ Copy"}
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
              <div className="asst-chat-message-row asst-msg-incoming">
                <div className="asst-avatar-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="asst-avatar-sparkle">
                    <path
                      d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="asst-bubble-wrapper">
                  <div className="asst-chat-bubble asst-bubble-assistant asst-typing-bubble">
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

          {/* 4. Clean Bottom Chat Input */}
          <form className="asst-bottom-input-bar" onSubmit={handleFormSubmit}>
            <button type="button" className="asst-input-btn-attach" title="Attach file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <input
              ref={inputRef}
              type="text"
              className="asst-chat-input-field"
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />

            <button type="button" className="asst-input-btn-mic" title="Voice input">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            <button
              type="submit"
              className="asst-input-btn-send"
              disabled={!input.trim() || busy}
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>

        {/* ── RIGHT COLUMN: SIDEBAR (~28%) ── */}
        <div className="asst-sidebar-column">
          {/* 1. Top SVJ Supercar Quote Card */}
          <div className="asst-car-card">
            <div className="asst-car-card-overlay">
              <div className="asst-car-card-text">
                <p className="asst-car-quote">"Better Questions. Brighter Opportunities."</p>
                <div className="asst-car-quote-line" />
              </div>
            </div>
          </div>

          {/* 2. Quick Prompts Card */}
          <div className="asst-side-card">
            <div className="asst-side-card-header">
              <div className="asst-header-title-wrap">
                <span className="asst-side-header-icon">⚡</span>
                <h3 className="asst-side-card-title">Quick Prompts</h3>
              </div>
              <button
                type="button"
                className="asst-side-link-btn"
                onClick={() => handlePromptClick("Give me a list of all placement topics I should focus on.")}
              >
                See all
              </button>
            </div>
            <div className="asst-prompts-list">
              {QUICK_PROMPTS.map((qp, idx) => (
                <div
                  key={idx}
                  className="asst-prompt-item"
                  onClick={() => handlePromptClick(qp.prompt)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="asst-prompt-left">
                    <span className="asst-prompt-icon">{qp.icon}</span>
                    <span className="asst-prompt-label">{qp.label}</span>
                  </div>
                  <span className="asst-prompt-arrow">›</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Recent Chats Card */}
          <div className="asst-side-card">
            <div className="asst-side-card-header">
              <div className="asst-header-title-wrap">
                <span className="asst-side-header-icon">🕒</span>
                <h3 className="asst-side-card-title">Recent Chats</h3>
              </div>
              <button
                type="button"
                className="asst-side-link-btn"
                onClick={clearConversation}
                title="Start a new chat"
              >
                View all
              </button>
            </div>
            <div className="asst-recent-chats-list">
              {recentChats.map((rc) => (
                <div
                  key={rc.id}
                  className="asst-recent-chat-item"
                  onClick={() => handlePromptClick(rc.prompt)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="asst-recent-chat-left">
                    <span className="asst-recent-chat-bubble-icon">💬</span>
                    <span className="asst-recent-chat-title">{rc.title}</span>
                  </div>
                  <span className="asst-recent-chat-time">{rc.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Rotating Motivational Quote Card with Cockpit Visual */}
          <div className="asst-cockpit-card">
            <div className="asst-cockpit-overlay">
              <p className="asst-cockpit-quote">"{currentQuote}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
