import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAssistant } from "../contexts/AssistantContext";
import { usePlacementData } from "../contexts/PlacementDataContext";
import UserAvatar from "../components/UserAvatar";
import { getPlacementContext, generateSmartResponse } from "../utils/aiEngine";
import "./Assistant.css";

var SUGGESTIONS = [
  "What is the capital of France?",
  "Explain DSA",
  "Write a Python program to sort a list",
  "Tell me a joke",
  "What should I prepare for interviews?",
  "Help me write a resume",
];

function renderMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n/g, '<br/>');
}

export default function Assistant() {
  const { user, profile } = useAuth();
  var {
    messages,
    input,
    setInput,
    busy,
    setBusy,
    clearConversation,
    bottomRef,
    addMsg,
  } = useAssistant();

  var { applications, companies, savedIds } = usePlacementData();
  var inputRef = useRef(null);
  var copiedIdxState = useState(null);
  var copiedIdx = copiedIdxState[0];
  var setCopiedIdx = copiedIdxState[1];

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, bottomRef]);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    var text = input.trim();
    if (!text || busy) return;

    setInput("");
    addMsg("user", text);
    setBusy(true);

    var ctx = getPlacementContext(applications, companies, savedIds, profile, user);

    try {
      var response = await generateSmartResponse(text, ctx, messages);
      addMsg("assistant", response);
    } catch (err) {
      addMsg("assistant", "Sorry, I encountered an error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(function() { setCopiedIdx(null); }, 2000);
  }

  function handleSuggestionClick(suggestion) {
    setInput(suggestion);
    if (inputRef.current) inputRef.current.focus();
  }

  return (
    <div className="asst-page animate-fade-in">
      <div className="asst-container">
        <div className="asst-header glass">
          <div className="asst-header-left">
            <div className="asst-header-icon">✨</div>
            <div>
              <h1 className="asst-header-title">Placement Assistant</h1>
              <p className="asst-header-sub">Ask anything — coding, career, or general questions</p>
            </div>
          </div>
          <div className="asst-header-right">
            <button className="asst-header-btn" onClick={clearConversation} title="New Chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              New Chat
            </button>
          </div>
        </div>

        <div className="asst-messages">
          {messages.length <= 1 && (
            <div className="asst-welcome">
              <div className="asst-welcome-icon">✨</div>
              <h2>Hi! I'm your Placement Assistant</h2>
              <p>You can ask me anything — coding, study, career, general questions, or just chat.</p>
              <div className="asst-suggestions">
                {SUGGESTIONS.map(function(s, i) {
                  return (
                    <button key={i} className="asst-suggestion-chip" onClick={function() { handleSuggestionClick(s); }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map(function(msg, i) {
            return (
              <div key={i} className={"asst-msg asst-msg--" + msg.role}>
                <div className="asst-msg-avatar">
                  {msg.role === "assistant" ? (
                    <span>✨</span>
                  ) : (
                    <UserAvatar user={user} profile={profile} alt="You" />
                  )}
                </div>
                <div className="asst-msg-body">
                  <div className="asst-msg-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  {msg.role === "assistant" && i > 0 && (
                    <div className="asst-msg-actions">
                      <button className="asst-action-btn" onClick={function() { handleCopy(msg.text, i); }} title="Copy">
                        {copiedIdx === i ? "✓ Copied" : "⧉ Copy"}
                      </button>
                    </div>
                  )}
                  <span className="asst-msg-time">
                    {new Date(msg.ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="asst-msg asst-msg--assistant">
              <div className="asst-msg-avatar"><span>✨</span></div>
              <div className="asst-msg-body">
                <div className="asst-typing">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form className="asst-input-bar" onSubmit={handleSubmit}>
          <div className="asst-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="asst-input"
              placeholder="Ask anything..."
              value={input}
              onChange={function(e) { setInput(e.target.value); }}
              disabled={busy}
            />
            <button type="submit" className="asst-send-btn" disabled={!input.trim() || busy} title="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
