import { useState, useEffect, useRef, useMemo } from "react";

const EMOJI_DATA = {
  "Smileys": [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
    "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
    "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢",
    "🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥",
    "😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴",
    "😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯",
    "🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮",
    "😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥",
    "😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱",
    "😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡",
  ],
  "Gestures": [
    "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞",
    "🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️",
    "🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐",
    "🤲","🤝","🙏","💪","🦾","🖖","🫱","🫲","🫳","🫴",
  ],
  "People": [
    "👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓",
    "👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇",
    "🤦","🤷","👮","🕵️","💂","🥷","👷","🫅","🤴","👸",
    "👳","👲","🧕","🤵","👰","🤰","🫃","🫄","🤱","👼",
    "🎅","🤶","🦸","🦹","🧙",
  ],
  "Animals": [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    "🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒",
    "🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇",
    "🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜",
    "🐢","🐍","🦎","🐙","🦑","🦐","🦞","🦀","🐡","🐠",
    "🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍",
    "🐘","🦒","🌿","🍀","🌱","🌲","🌳","🌴","🌵","🌺",
    "🌻","🌹","🌷","🌸","💐","🌾","🍂","🍁","🍃",
  ],
  "Food": [
    "🍇","🍈","🍉","🍊","🍋","🍌","🍍","🥭","🍎","🍏",
    "🍐","🍑","🍒","🍓","🫐","🥝","🍅","🥑","🍆","🥔",
    "🥕","🌽","🌶️","🫑","🥒","🥦","🧄","🧅","🍄","🍞",
    "🥐","🥖","🧀","🍖","🍗","🥩","🥓","🍔","🍟","🍕",
    "🌭","🥪","🌮","🌯","🥙","🧆","🥚","🍳","🥘","🍲",
    "🥗","🍿","🧈","🧂","☕","🫖","🍵","🍶","🍾","🍷",
    "🍸","🍹","🍺","🍻","🥂","🥃","🧋","🧊",
  ],
  "Objects": [
    "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","📷","📸",
    "📹","🎥","📞","☎️","📺","📻","🎙️","🧭","⏰","⏳",
    "📡","🔋","💡","🔦","🕯️","💰","💳","💎","🔧","🔩",
    "⚙️","🔨","🧲","🔫","💣","🧨","🔪","🗡️","🛡️","🔮",
    "🔭","🔬","💍","📿","🧿","💈",
  ],
  "Symbols": [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
    "❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️",
    "✝️","☪️","🕉️","☸️","✡️","🔯","☯️","☦️","🛐","⛎",
    "♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓",
    "🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸",
    "🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵",
    "🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕",
    "🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳",
    "🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️",
    "🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅",
  ],
  "Flags": [
    "🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️",
    "🇦🇨","🇦🇩","🇦🇪","🇦🇫","🇦🇬","🇦🇮","🇦🇱","🇦🇲","🇦🇴","🇦🇶",
    "🇦🇷","🇦🇸","🇦🇹","🇦🇺","🇦🇼","🇦🇽","🇦🇿","🇧🇦","🇧🇧","🇧🇩",
    "🇧🇪","🇧🇫","🇧🇬","🇧🇭","🇧🇮","🇧🇯","🇧🇱","🇧🇲","🇧🇳","🇧🇴",
    "🇧🇷","🇨🇦","🇨🇳","🇩🇪","🇪🇸","🇫🇷","🇬🇧","🇮🇳","🇮🇹","🇯🇵",
    "🇰🇷","🇲🇽","🇳🇬","🇷🇺","🇸🇦","🇹🇷","🇺🇦","🇺🇸","🇿🇦",
  ],
};

const CATEGORY_ICONS = {
  "Smileys": "😀",
  "Gestures": "👋",
  "People": "🧑",
  "Animals": "🐶",
  "Food": "🍔",
  "Objects": "💡",
  "Symbols": "❤️",
  "Flags": "🏁",
};

const CATEGORIES = Object.keys(EMOJI_DATA);

const RECENT_KEY = "emoji_recent";
const MAX_RECENT = 24;

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch { return []; }
}

function saveRecent(emoji) {
  try {
    const recent = getRecent().filter((e) => e !== emoji);
    recent.unshift(emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {}
}

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [recent, setRecent] = useState(getRecent);
  const pickerRef = useRef(null);
  const searchRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const results = [];
    for (const cat of CATEGORIES) {
      for (const emoji of EMOJI_DATA[cat]) {
        if (emoji.toLowerCase().includes(q)) {
          results.push(emoji);
        }
      }
    }
    return results;
  }, [search]);

  function handleSelect(emoji) {
    saveRecent(emoji);
    setRecent(getRecent());
    onSelect(emoji);
  }

  return (
    <div ref={pickerRef} className="ep">
      <div className="ep-search">
        <svg className="ep-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emoji"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ep-search-input"
        />
      </div>

      <div className="ep-tabs">
        <button
          className={`ep-tab ${!search && activeCategory === "__recent__" ? "active" : ""}`}
          onClick={() => { setActiveCategory("__recent__"); setSearch(""); }}
          title="Recent"
          type="button"
        >
          🕐
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`ep-tab ${activeCategory === cat && !search ? "active" : ""}`}
            onClick={() => { setActiveCategory(cat); setSearch(""); }}
            title={cat}
            type="button"
          >
            {CATEGORY_ICONS[cat]}
          </button>
        ))}
      </div>

      <div ref={gridRef} className="ep-grid">
        {filteredEmojis ? (
          filteredEmojis.length === 0 ? (
            <div className="ep-empty">No emoji found</div>
          ) : (
            <div className="ep-items">
              {filteredEmojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  className="ep-item"
                  onClick={() => handleSelect(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )
        ) : activeCategory === "__recent__" ? (
          recent.length === 0 ? (
            <div className="ep-empty">No recent emoji</div>
          ) : (
            <div className="ep-items">
              {recent.map((emoji, i) => (
                <button
                  key={`recent-${emoji}-${i}`}
                  className="ep-item"
                  onClick={() => handleSelect(emoji)}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="ep-items">
            {EMOJI_DATA[activeCategory]?.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                className="ep-item"
                onClick={() => handleSelect(emoji)}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
