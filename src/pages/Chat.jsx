import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, writeBatch, collection } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { db, storage } from "../config/firebase";
import { getAllStudents, getOrCreateAdminConversation, sendAdminChatMessage, subscribeToAdminMessages, markAdminConversationRead, subscribeToUserPresence } from "../services/social";
import UserAvatar from "../components/UserAvatar";
import EmojiPicker from "../components/EmojiPicker";
import Modal from "../components/Modal";
import "./Chat.css";

// ─── SVG ICONS ──────────────────────────────────────────────
const ChatHeaderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PenEditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const ThreeDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const EmojiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const SendAirplaneIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
  </svg>
);

const DoubleCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

const BackArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    sending,
    sendChatMessage,
    markRead,
    startConversation,
  } = useChat();

  const [input, setInput] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [convSearch, setConvSearch] = useState("");

  // Admin conversation state
  const adminConvId = searchParams.get("adminConv");
  const [adminMode, setAdminMode] = useState(false);
  const [adminConv, setAdminConv] = useState(null);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminSending, setAdminSending] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminPartner, setAdminPartner] = useState(null);

  // Partner presence state
  const [partnerPresence, setPartnerPresence] = useState({ online: false, lastSeenAt: null });

  // New Message Modal State
  const [newMsgModalOpen, setNewMsgModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Conversation action state
  const [showConvMenu, setShowConvMenu] = useState(false);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // File attachment state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Disappearing messages state
  const [showDisappearingPopup, setShowDisappearingPopup] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState(null);

  // Clear/Delete confirmation state
  const [confirmAction, setConfirmAction] = useState(null); // "clear" | "delete" | null

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/zip",
    "application/x-zip-compressed",
  ];
  const ALLOWED_EXTENSIONS = [".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".jpg",".jpeg",".png",".webp",".zip"];
  const BLOCKED_EXTENSIONS = [".exe",".bat",".cmd",".scr",".ps1"];

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const adminMsgEndRef = useRef(null);

  // Activate admin mode when ?adminConv param is present
  useEffect(() => {
    if (!adminConvId || !user?.uid) {
      setAdminMode(false);
      return;
    }
    setAdminMode(true);
    setActiveConversation(null);

    async function loadAdminConv() {
      const convSnap = await getDoc(doc(db, "adminConversations", adminConvId));
      if (convSnap.exists()) {
        const convData = convSnap.data();
        setAdminConv({ id: adminConvId, ...convData });
        const otherId = convData.participants?.find((p) => p !== user.uid);
        if (otherId) {
          const userSnap = await getDoc(doc(db, "users", otherId));
          if (userSnap.exists()) {
            setAdminPartner({ id: otherId, ...userSnap.data() });
          }
        }
        markAdminConversationRead(adminConvId, user.uid);
      }
    }
    loadAdminConv();

    const unsub = subscribeToAdminMessages(adminConvId, (msgs) => {
      setAdminMessages(msgs);
    });

    return () => {
      unsub();
      setAdminMode(false);
      setAdminConv(null);
      setAdminMessages([]);
      setAdminPartner(null);
    };
  }, [adminConvId, user?.uid, setActiveConversation]);

  // Handle ?student= param — auto-select conversation
  useEffect(() => {
    if (!user?.uid) return;
    const studentId = searchParams.get("student");
    if (!studentId) return;
    if (activeConversation?.otherUser?.id === studentId) {
      setSearchParams({});
      return;
    }
    async function selectStudent() {
      try {
        const conv = await startConversation(studentId);
        if (conv) {
          setActiveConversation(conv);
        }
      } catch (err) {
        console.error("Failed to start conversation:", err);
      }
      setSearchParams({});
    }
    selectStudent();
  }, [searchParams, user?.uid, activeConversation?.otherUser?.id, startConversation, setActiveConversation, setSearchParams]);

  // Subscribe to active conversation partner's presence
  useEffect(() => {
    if (!activeConversation?.otherUser?.id) return;
    const unsub = subscribeToUserPresence(activeConversation.otherUser.id, setPartnerPresence);
    return () => unsub();
  }, [activeConversation?.otherUser?.id]);

  function formatLastSeen(lastSeenAt) {
    if (!lastSeenAt) return "";
    const d = lastSeenAt.toDate ? lastSeenAt.toDate() : new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Last seen just now";
    if (diffMin < 60) return `Last seen ${diffMin} min ago`;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const seenDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (today.getTime() === seenDay.getTime()) {
      return `Last seen today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (seenDay.getTime() === yesterday.getTime()) {
      return `Last seen yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
    }
    return `Last seen ${d.toLocaleDateString()}`;
  }

  // Auto-scroll admin messages
  useEffect(() => {
    adminMsgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [adminMessages]);

  async function handleAdminSend() {
    if (!adminInput.trim() || adminSending || !adminConv) return;
    setAdminSending(true);
    const text = adminInput.trim();
    setAdminInput("");
    await sendAdminChatMessage(adminConv.id, user.uid, text, adminConv.participants);
    setAdminSending(false);
    adminMsgEndRef.current?.focus?.();
  }

  function handleAdminKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdminSend();
    }
  }

  function exitAdminMode() {
    setSearchParams({});
    setAdminMode(false);
    setAdminConv(null);
    setAdminMessages([]);
    setAdminPartner(null);
  }

  function formatAdminTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark read when active
  useEffect(() => {
    if (activeConversation?.id) {
      markRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages.length, markRead]);

  // Load available users for the New Message modal (excluding logged-in user)
  useEffect(() => {
    if (!newMsgModalOpen) return;
    async function loadContacts() {
      setLoadingContacts(true);
      try {
        const res = await getAllStudents();
        const myUid = user?.uid;
        const myEmail = user?.email?.toLowerCase();
        const usersList = (res.data || []).filter(
          (u) => u.id !== myUid && (!myEmail || (u.email || "").toLowerCase() !== myEmail)
        );
        setAvailableUsers(usersList);
      } catch (e) {
        console.error("Failed to load contacts:", e);
      }
      setLoadingContacts(false);
    }
    loadContacts();
  }, [newMsgModalOpen, user?.uid, user?.email]);

  // Resolve partner profile for active conversation
  const [partnerProfile, setPartnerProfile] = useState(null);

  useEffect(() => {
    if (!activeConversation) {
      setPartnerProfile(null);
      return;
    }
    if (activeConversation.otherUser) {
      setPartnerProfile(activeConversation.otherUser);
      return;
    }
    const found = conversations.find((c) => c.id === activeConversation.id);
    if (found?.otherUser) {
      setPartnerProfile(found.otherUser);
      return;
    }
    const otherId = activeConversation.participants?.find((p) => p !== user?.uid);
    if (!otherId) return;
    let cancelled = false;
    import("../services/social").then(({ getStudentProfile }) => {
      if (cancelled) return;
      getStudentProfile(otherId).then((res) => {
        if (!cancelled && res.data) setPartnerProfile(res.data);
      });
    });
    return () => { cancelled = true; };
  }, [activeConversation, conversations, user?.uid]);

  const activePartner = partnerProfile || activeConversation?.otherUser;

  // Send message handler
  async function handleSend() {
    if (!input.trim() || sending || !activeConversation?.id) return;
    const textToSend = input.trim();
    setInput("");
    await sendChatMessage(activeConversation.id, textToSend);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Handle emoji selection
  function handleEmojiSelect(emoji) {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }

  // Handle file attachment
  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeConversation?.id) return;
    e.target.value = "";

    // Validate blocked types
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      alert("This file type is not allowed.");
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      alert("File is too large. Maximum file size is 10 MB.");
      return;
    }

    // Validate MIME type (fallback to extension check)
    const mimeValid = ALLOWED_TYPES.includes(file.type);
    const extValid = ALLOWED_EXTENSIONS.includes(ext);
    if (!mimeValid && !extValid) {
      alert("Unsupported file type. Please select a valid file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const storagePath = `chat_attachments/${activeConversation.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      // Send attachment message
      const attachmentData = {
        type: "attachment",
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || ext,
        downloadURL,
        storagePath,
      };

      await sendChatMessage(activeConversation.id, JSON.stringify(attachmentData));
    } catch (err) {
      console.error("File upload error:", err);
      alert("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // Close chat (deselect conversation, keep it in list)
  function handleCloseChat() {
    setShowConvMenu(false);
    setActiveConversation(null);
  }

  // Disappearing messages
  async function handleSetDisappearing(duration) {
    if (!activeConversation?.id) return;
    try {
      await updateDoc(doc(db, "conversations", activeConversation.id), {
        disappearingMessages: {
          enabled: duration !== null,
          duration: duration,
        },
      });
      setDisappearingDuration(duration);
      setShowDisappearingPopup(false);
    } catch (err) {
      console.error("Failed to update disappearing messages:", err);
    }
  }

  // Load disappearing messages setting
  useEffect(() => {
    if (!activeConversation?.id) {
      setDisappearingDuration(null);
      return;
    }
    async function loadSetting() {
      try {
        const snap = await getDoc(doc(db, "conversations", activeConversation.id));
        if (snap.exists()) {
          const data = snap.data();
          const dm = data.disappearingMessages;
          if (dm?.enabled) {
            setDisappearingDuration(dm.duration || null);
          } else {
            setDisappearingDuration(null);
          }
        }
      } catch {}
    }
    loadSetting();
  }, [activeConversation?.id]);

  // Close disappearing popup on click outside
  useEffect(() => {
    if (!showDisappearingPopup) return;
    function handleClick(e) {
      if (!e.target.closest(".msg-disappearing-popup") && !e.target.closest(".msg-conv-menu-item")) {
        setShowDisappearingPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDisappearingPopup]);

  // Clear chat messages
  async function handleClearChat() {
    if (!activeConversation?.id || !user?.uid) return;
    setConfirmAction(null);
    try {
      const msgQuery = query(
        collection(db, "messages"),
        where("conversationId", "==", activeConversation.id)
      );
      const snapshot = await getDocs(msgQuery);
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      await updateDoc(doc(db, "conversations", activeConversation.id), {
        lastMessage: null,
        lastMessageAt: null,
      });
    } catch (err) {
      console.error("Clear chat error:", err);
    }
  }

  // Delete chat (remove from user's conversation list)
  async function handleDeleteChat() {
    if (!activeConversation?.id || !user?.uid) return;
    setConfirmAction(null);
    try {
      const convRef = doc(db, "conversations", activeConversation.id);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) return;

      const convData = convSnap.data();
      const participants = convData.participants || [];

      // Remove current user from participants
      const updatedParticipants = participants.filter((p) => p !== user.uid);

      if (updatedParticipants.length === 0) {
        // Last participant — delete conversation and its messages
        const msgQuery = query(
          collection(db, "messages"),
          where("conversationId", "==", activeConversation.id)
        );
        const msgSnap = await getDocs(msgQuery);
        const batch = writeBatch(db);
        msgSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(convRef);
        await batch.commit();
      } else {
        // Update participants to exclude current user
        await updateDoc(convRef, { participants: updatedParticipants });
      }

      setActiveConversation(null);
    } catch (err) {
      console.error("Delete chat error:", err);
    }
  }

  // Format message timestamp: 08:48 PM
  function formatMessageTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  // Format conversation preview timestamp
  function formatConvTime(date) {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  function formatFileSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Filter conversations based on search and tab
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    if (convSearch.trim()) {
      const q = convSearch.toLowerCase().trim();
      result = result.filter((c) => {
        const name = (c.otherUser?.displayName || "Student").toLowerCase();
        const role = (c.otherUser?.role || "").toLowerCase();
        return name.includes(q) || role.includes(q);
      });
    }

    if (filterTab === "students") {
      result = result.filter((c) => !c.otherUser?.role || c.otherUser?.role === "student" || c.otherUser?.role === "owner");
    } else if (filterTab === "recruiters") {
      result = result.filter((c) => c.otherUser?.role === "recruiter" || c.otherUser?.role === "admin");
    } else if (filterTab === "companies") {
      result = result.filter((c) => c.isCompany || c.otherUser?.role === "company");
    }

    return result;
  }, [conversations, convSearch, filterTab]);

  // Start new conversation from modal
  async function handleSelectContact(contact) {
    setNewMsgModalOpen(false);
    const otherUserObj = {
      id: contact.id,
      displayName: contact.displayName || contact.name || "Student",
      photoUrl: contact.photoUrl,
      role: contact.role || "student",
      branch: contact.branch,
    };
    try {
      const conv = await startConversation(contact.id);
      if (conv) {
        setActiveConversation({ ...conv, otherUser: otherUserObj });
      } else {
        const fallbackId = [user?.uid, contact.id].sort().join("_");
        setActiveConversation({
          id: fallbackId,
          participants: [user?.uid, contact.id],
          otherUser: otherUserObj,
        });
      }
      setPartnerProfile(otherUserObj);
    } catch (err) {
      console.error("Error starting chat:", err);
    }
  }

  // Filtered contacts for modal
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return availableUsers;
    const q = contactSearch.toLowerCase().trim();
    return availableUsers.filter((u) => {
      const name = (u.displayName || u.name || "").toLowerCase();
      const branch = (u.branch || "").toLowerCase();
      return name.includes(q) || branch.includes(q);
    });
  }, [availableUsers, contactSearch]);

  // ─── ADMIN MESSAGE VIEW ─────────────────────────────────────
  if (adminMode && adminConv) {
    return (
      <div className="msg-page-wrapper animate-fade-in">
        <div className="msg-page-header">
          <div className="msg-title-block">
            <button className="msg-back-to-list-btn" onClick={exitAdminMode} title="Back to chat">
              <BackArrowIcon />
            </button>
            <div className="msg-icon-badge msg-icon-badge--admin">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 className="msg-main-title">
                {adminPartner?.displayName || "Admin"}
              </h1>
              <p className="msg-main-subtitle msg-main-subtitle--admin">Placement Hub Admin</p>
            </div>
          </div>
        </div>

        <div className="msg-card-container">
          <section className="msg-chat-panel" style={{ flex: 1 }}>
            <div className="msg-active-header">
              <button className="msg-back-to-list-btn" onClick={exitAdminMode} title="Back">
                <BackArrowIcon />
              </button>
              <div className="msg-active-user-meta">
                <div className="msg-active-avatar-wrap">
                  <UserAvatar
                    user={{ uid: adminPartner?.id }}
                    profile={adminPartner}
                    style={{ width: 44, height: 44 }}
                  />
                </div>
                <div className="msg-active-name-col">
                  <h3 className="msg-active-name">{adminPartner?.displayName || "Admin"}</h3>
                  <span className="msg-active-status-text">
                    <span className="msg-status-circle" /> Placement Hub Admin
                  </span>
                </div>
              </div>
            </div>

            <div className="msg-history-body">
              <div className="msg-date-divider">
                <span className="msg-date-pill">Admin Messages</span>
              </div>

              {adminMessages.length === 0 ? (
                <div className="msg-empty-thread">
                  <p className="msg-thread-prompt">No messages yet.</p>
                </div>
              ) : (
                adminMessages.map((m) => {
                  const isSent = m.senderId === user?.uid;
                  const isWarning = m.isAdminMessage && m.text?.startsWith("[WARNING]");
                  const displayText = isWarning ? m.text.replace("[WARNING]", "").trim() : m.text;
                  const timeStr = formatAdminTime(m.createdAt);

                  return (
                    <div key={m.id} className={`msg-bubble-row ${isSent ? "sent" : "received"}`}>
                      {!isSent && (
                        <div className="msg-bubble-avatar">
                          <UserAvatar
                            user={{ uid: adminPartner?.id }}
                            profile={adminPartner}
                            style={{ width: 34, height: 34 }}
                          />
                        </div>
                      )}

                      <div className={`msg-bubble-box ${isSent ? "sent" : "received"} ${isWarning ? "msg-bubble--warning" : "msg-bubble--admin"}`}>
                        {isWarning && (
                          <div className="msg-warning-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>Warning</span>
                          </div>
                        )}
                        <p className="msg-bubble-text">{displayText}</p>
                        <div className="msg-bubble-footer">
                          <span className="msg-bubble-time">{timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={adminMsgEndRef} />
            </div>

            <div className="msg-composer-outer">
              <div className="msg-composer-capsule">
                <input
                  type="text"
                  className="msg-composer-input"
                  placeholder="Type a message..."
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  onKeyDown={handleAdminKeyDown}
                  disabled={adminSending}
                />
                <button
                  type="button"
                  className="msg-composer-send-btn"
                  onClick={handleAdminSend}
                  disabled={!adminInput.trim() || adminSending}
                  title="Send message"
                >
                  <SendAirplaneIcon />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-page-wrapper animate-fade-in">
      {/* ─── 4. MESSAGES HEADER ────────────────────────────────────── */}
      <div className="msg-page-header">
        <div className="msg-title-block">
          <div className="msg-icon-badge">
            <ChatHeaderIcon />
          </div>
          <div>
            <h1 className="msg-main-title">Messages</h1>
            <p className="msg-main-subtitle">Connect with students, recruiters and your network</p>
          </div>
        </div>

        <button className="msg-btn-new-message" onClick={() => setNewMsgModalOpen(true)}>
          <PenEditIcon />
          <span>New Message</span>
        </button>
      </div>

      {/* ─── MAIN TWO-COLUMN MESSAGING CARD ───────────────────────── */}
      <div className="msg-card-container">
        {/* ─── 5. LEFT CONVERSATION LIST PANEL ─────────────────────── */}
        <aside className={`msg-sidebar-panel ${activeConversation ? "msg-sidebar--hide-mobile" : ""}`}>
          {/* Search bar */}
          <div className="msg-search-box">
            <SearchIcon />
            <input
              type="text"
              className="msg-search-input"
              placeholder="Search conversations..."
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
            />
          </div>

          {/* Filter Tabs: All, Students, Recruiters, Companies */}
          <div className="msg-filter-tabs" role="tablist" aria-label="Conversation Filters">
            <button
              className={`msg-tab-pill ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "students" ? "active" : ""}`}
              onClick={() => setFilterTab("students")}
            >
              Students
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "recruiters" ? "active" : ""}`}
              onClick={() => setFilterTab("recruiters")}
            >
              Recruiters
            </button>
            <button
              className={`msg-tab-pill ${filterTab === "companies" ? "active" : ""}`}
              onClick={() => setFilterTab("companies")}
            >
              Companies
            </button>
          </div>

          {/* Scrollable Conversation List */}
          <div className="msg-conversations-list">
            {filteredConversations.length === 0 ? (
              <div className="msg-empty-list">
                <div className="msg-empty-icon-wrap">💬</div>
                <h4 className="msg-empty-title">
                  {convSearch ? "No matching conversations" : "No messages yet"}
                </h4>
                <p className="msg-empty-desc">
                  {convSearch
                    ? "Try a different search keyword."
                    : "Start connecting with fellow students and recruiters."}
                </p>
                {!convSearch && (
                  <button className="msg-empty-btn" onClick={() => setNewMsgModalOpen(true)}>
                    <PenEditIcon />
                    <span>Start a conversation</span>
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activeConversation?.id === c.id;
                const other = c.otherUser || {};
                const name = other.displayName || "Student";
                const lastMsg = c.lastMessageText || (c.lastMessage ? "[Encrypted Message]" : "Started a conversation");
                const timeStr = formatConvTime(c.lastMessageAt || c.updatedAt || c.createdAt);
                const unread = c.unreadCount || 0;

                return (
                  <div
                    key={c.id}
                    className={`msg-conv-item ${isSelected ? "msg-conv-item--active" : ""}`}
                    onClick={() => {
                      setActiveConversation(c);
                      markRead(c.id);
                    }}
                  >
                    <div className="msg-conv-avatar-wrap">
                      <UserAvatar
                        user={{ uid: other.id }}
                        profile={other}
                        style={{ width: 44, height: 44 }}
                      />
                      <span className="msg-online-dot" />
                    </div>

                    <div className="msg-conv-content">
                      <div className="msg-conv-top-row">
                        <span className="msg-conv-name">{name}</span>
                        <span className="msg-conv-time">{timeStr}</span>
                      </div>
                      <div className="msg-conv-bottom-row">
                        <p className="msg-conv-preview">{lastMsg}</p>
                        {unread > 0 && <span className="msg-unread-badge">{unread}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ─── 6. RIGHT ACTIVE CHAT PANEL ──────────────────────────── */}
        <section className={`msg-chat-panel ${!activeConversation ? "msg-chat-panel--empty" : ""}`}>
          {!activeConversation ? (
            <div className="msg-chat-empty-state">
              <div className="msg-placeholder-icon-wrap">
                <ChatHeaderIcon />
              </div>
              <h3 className="msg-placeholder-title">Select a conversation</h3>
              <p className="msg-placeholder-subtitle">
                Choose a conversation from the list on the left, or start a new chat with fellow students and mentors.
              </p>
              <button className="msg-placeholder-btn" onClick={() => setNewMsgModalOpen(true)}>
                <PenEditIcon />
                <span>New Message</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="msg-active-header">
                <button
                  className="msg-back-to-list-btn"
                  onClick={() => setActiveConversation(null)}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <BackArrowIcon />
                </button>

                <div className="msg-active-user-meta">
                  <div className="msg-active-avatar-wrap">
                    <UserAvatar
                      user={{ uid: activePartner?.id }}
                      profile={activePartner}
                      style={{ width: 44, height: 44 }}
                    />
                  </div>

                  <div className="msg-active-name-col">
                    <h3 className="msg-active-name">
                      {activePartner?.displayName || activePartner?.name || "Student"}
                    </h3>
                    <span className={`msg-active-status-text ${partnerPresence.online ? "online" : "offline"}`}>
                      <span className="msg-status-circle" /> {partnerPresence.online ? "Online" : formatLastSeen(partnerPresence.lastSeenAt)}
                    </span>
                  </div>
                </div>

                {/* Header Action Icons */}
                <div className="msg-header-actions">
                  <button
                    type="button"
                    className="msg-action-icon-btn"
                    title="View Profile"
                    onClick={() => navigate(`/students/${activePartner?.id || ""}`)}
                  >
                    <InfoIcon />
                  </button>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="msg-action-icon-btn"
                      title="Conversation options"
                      onClick={() => setShowConvMenu(!showConvMenu)}
                    >
                      <ThreeDotsIcon />
                    </button>
                    {showConvMenu && (
                      <div className="msg-conv-menu">
                        <button
                          className="msg-conv-menu-item"
                          onClick={handleCloseChat}
                        >
                          Close Chat
                        </button>
                        <div style={{ position: "relative" }}>
                          <button
                            className="msg-conv-menu-item"
                            onClick={() => { setShowConvMenu(false); setShowDisappearingPopup(!showDisappearingPopup); }}
                          >
                            Disappearing Messages {disappearingDuration ? `(${disappearingDuration})` : "(Off)"}
                          </button>
                          {showDisappearingPopup && (
                            <div className="msg-disappearing-popup">
                              <div className="msg-disappearing-title">Disappearing Messages</div>
                              {[null, "24h", "7d", "30d"].map((dur) => (
                                <label key={dur || "off"} className="msg-disappearing-option">
                                  <input
                                    type="radio"
                                    name="disappearing"
                                    checked={disappearingDuration === dur}
                                    onChange={() => handleSetDisappearing(dur)}
                                  />
                                  <span>{dur === null ? "Off" : dur === "24h" ? "24 hours" : dur === "7d" ? "7 days" : "30 days"}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="msg-conv-menu-divider" />
                        <button
                          className="msg-conv-menu-item"
                          onClick={() => { setShowConvMenu(false); setConfirmAction("clear"); }}
                        >
                          Clear Chat
                        </button>
                        <button
                          className="msg-conv-menu-item danger"
                          onClick={() => { setShowConvMenu(false); setConfirmAction("delete"); }}
                        >
                          Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message History Body */}
              <div className="msg-history-body">
                {/* Date separator */}
                <div className="msg-date-divider">
                  <span className="msg-date-pill">Today</span>
                </div>

                {messages.length === 0 ? (
                  <div className="msg-empty-thread">
                    <p className="msg-thread-prompt">No messages yet in this conversation.</p>
                    <p className="msg-thread-sub">Send a message below to start chatting!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSent = m.senderId === user?.uid;
                    const timeStr = formatMessageTime(m.createdAt);

                    // Check if message is an attachment
                    let isAttachment = false;
                    let attachmentData = null;
                    try {
                      const parsed = JSON.parse(m.text);
                      if (parsed.type === "attachment" && parsed.downloadURL) {
                        isAttachment = true;
                        attachmentData = parsed;
                      }
                    } catch {}

                    const isImage = attachmentData?.contentType?.startsWith("image/");

                    return (
                      <div key={m.id} className={`msg-bubble-row ${isSent ? "sent" : "received"}`}>
                        {!isSent && (
                          <div className="msg-bubble-avatar">
                            <UserAvatar
                              user={{ uid: activePartner?.id }}
                              profile={activePartner}
                              style={{ width: 34, height: 34 }}
                            />
                          </div>
                        )}

                        <div className={`msg-bubble-box ${isSent ? "sent" : "received"}`}>
                          {isAttachment ? (
                            <>
                              {isImage && attachmentData.downloadURL && (
                                <div className="msg-attachment-preview">
                                  <img src={attachmentData.downloadURL} alt={attachmentData.fileName} loading="lazy" />
                                </div>
                              )}
                              <div className="msg-attachment-card">
                                <div className="msg-attachment-icon">
                                  {isImage ? "🖼️" : "📄"}
                                </div>
                                <div className="msg-attachment-info">
                                  <span className="msg-attachment-name">{attachmentData.fileName}</span>
                                  <span className="msg-attachment-size">{formatFileSize(attachmentData.fileSize)}</span>
                                </div>
                                <a
                                  href={attachmentData.downloadURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="msg-attachment-download"
                                >
                                  Open
                                </a>
                              </div>
                            </>
                          ) : (
                            <p className="msg-bubble-text">{m.text}</p>
                          )}
                          <div className="msg-bubble-footer">
                            <span className="msg-bubble-time">{timeStr}</span>
                            {isSent && (
                              <span className="msg-read-check" title="Delivered">
                                <DoubleCheckIcon />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ─── 7. MESSAGE COMPOSER BAR ───────────────────────── */}
              <div className="msg-composer-outer">
                {uploading && (
                  <div className="msg-upload-progress">
                    <span>Uploading...</span>
                    <div className="msg-upload-bar">
                      <div className="msg-upload-bar-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                )}
                <div className="msg-composer-capsule" style={{ position: "relative" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                    accept={ALLOWED_EXTENSIONS.join(",")}
                  />
                  <button
                    type="button"
                    className="msg-composer-tool-btn"
                    title="Attach file"
                    onClick={handleFileSelect}
                    disabled={uploading}
                  >
                    <PaperclipIcon />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    className="msg-composer-input"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending || uploading}
                  />

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="msg-composer-tool-btn"
                      title="Insert emoji"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <EmojiIcon />
                    </button>
                    {showEmojiPicker && (
                      <EmojiPicker
                        onSelect={handleEmojiSelect}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    className="msg-composer-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || sending || uploading}
                    title="Send message"
                  >
                    <SendAirplaneIcon />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ─── 8. NEW MESSAGE MODAL ─────────────────────────────────── */}
      <Modal open={newMsgModalOpen} onClose={() => setNewMsgModalOpen(false)} title="New Message">
        <div className="msg-modal-body">
          <div className="msg-modal-search-wrap">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search students by name or branch..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="msg-modal-search-input"
              autoFocus
            />
          </div>

          <div className="msg-modal-contacts-list">
            {loadingContacts ? (
              <div className="msg-modal-loading">Loading students...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="msg-modal-empty">No students found matching your search.</div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="msg-modal-contact-item"
                  onClick={() => handleSelectContact(contact)}
                >
                  <UserAvatar
                    user={{ uid: contact.id }}
                    profile={contact}
                    style={{ width: 40, height: 40 }}
                  />
                  <div className="msg-modal-contact-info">
                    <span className="msg-modal-contact-name">
                      {contact.displayName || contact.name || "Student"}
                    </span>
                    <span className="msg-modal-contact-sub">
                      {contact.branch ? `${contact.branch} • ` : ""}
                      {contact.role === "admin" || contact.role === "owner" ? "Admin" : "Student"}
                    </span>
                  </div>
                  <button type="button" className="msg-modal-chat-btn" onClick={() => handleSelectContact(contact)}>
                    Chat
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ─── CONFIRMATION MODAL ─────────────────────────────────── */}
      {confirmAction && (
        <div className="msg-confirm-overlay" onClick={() => setConfirmAction(null)}>
          <div className="msg-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="msg-confirm-title">
              {confirmAction === "clear" ? "Clear this chat?" : "Delete this chat?"}
            </h3>
            <p className="msg-confirm-desc">
              {confirmAction === "clear"
                ? "This will remove all messages from this conversation for you. This cannot be undone."
                : "This conversation will be removed from your conversation list. This cannot be undone."}
            </p>
            <div className="msg-confirm-actions">
              <button className="msg-confirm-cancel" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                className={`msg-confirm-action ${confirmAction === "delete" ? "danger" : ""}`}
                onClick={confirmAction === "clear" ? handleClearChat : handleDeleteChat}
              >
                {confirmAction === "clear" ? "Clear" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
