import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import {
  getStudentProfile,
  sendFollowRequest,
  unfollowUser,
  cancelFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollower,
  blockUser,
  unblockUser,
  isBlocked,
  reportUser,
  uploadReportEvidence,
  subscribeToPendingFollowRequests,
  subscribeToFollowStatus,
  subscribeToStudentProfile,
  subscribeToFollowers,
  subscribeToFollowing,
} from "../services/social";
import { createNotification } from "../services/firestore";
import UserAvatar from "../components/UserAvatar";
import Modal from "../components/Modal";
import "./StudentProfile.css";

export default function StudentProfile() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startConversation } = useChat();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState(null);
  const [incomingFollowStatus, setIncomingFollowStatus] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportEvidence, setReportEvidence] = useState(null);
  const [reportChatEvidence, setReportChatEvidence] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const isOwnProfile = user?.uid === studentId;

  useEffect(() => {
    let unsubFollowStatus = null;
    let unsubPendingRequests = null;
    let unsubProfile = null;
    let unsubFollowers = null;
    let unsubFollowing = null;

    setLoading(true);
    unsubProfile = subscribeToStudentProfile(studentId, (data) => {
      setProfile(data);
      setLoading(false);
    });

    if (!isOwnProfile) {
      unsubFollowStatus = subscribeToFollowStatus(user.uid, studentId, ({ status, incomingStatus }) => {
        setFollowStatus(status);
        setIncomingFollowStatus(incomingStatus);
      });
      isBlocked(user.uid, studentId).then(({ data: bd }) => {
        if (bd) setBlocked(true);
      });
      isBlocked(studentId, user.uid).then(({ data: bd2 }) => {
        if (bd2) setBlocked(true);
      });
    }

    unsubFollowers = subscribeToFollowers(studentId, (list) => {
      setFollowers(list || []);
    });
    unsubFollowing = subscribeToFollowing(studentId, (list) => {
      setFollowing(list || []);
    });

    if (isOwnProfile) {
      unsubPendingRequests = subscribeToPendingFollowRequests(user.uid, (requests) => {
        setPendingRequests(requests);
      });
    }

    return () => {
      unsubProfile?.();
      unsubFollowStatus?.();
      unsubPendingRequests?.();
      unsubFollowers?.();
      unsubFollowing?.();
    };
  }, [studentId, user?.uid, isOwnProfile]);

  async function handleFollow() {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus === "accepted") {
        await unfollowUser(user.uid, studentId);
      } else if (followStatus === "pending") {
        await cancelFollowRequest(user.uid, studentId);
      } else if (incomingFollowStatus === "accepted") {
        await removeFollower(user.uid, studentId);
      } else if (incomingFollowStatus === "pending") {
        await acceptFollowRequest(studentId, user.uid);
        createNotification({
          title: "Follow Request Accepted",
          message: `${user.displayName || "Someone"} accepted your follow request.`,
          type: "follow_accepted",
          link: `/students/${user.uid}`,
          targetUserId: studentId,
          senderId: user.uid,
          relatedUserId: studentId,
        }).catch(() => {});
      } else {
        const { data, error } = await sendFollowRequest(user.uid, studentId);
        if (error === "blocked") {
          setBlocked(true);
          return;
        }
        if (data && data.status === "pending") {
          createNotification({
            title: "Follow Request",
            message: `${user.displayName || "Someone"} wants to follow you.`,
            type: "follow_request",
            link: `/students/${user.uid}`,
            targetUserId: studentId,
            senderId: user.uid,
            relatedUserId: user.uid,
            followRequestId: data.id,
          }).catch(() => {});
        }
      }
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleRejectIncomingRequest() {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      await rejectFollowRequest(studentId, user.uid);
    } finally {
      setFollowLoading(false);
    }
  }

  function getFollowLabel() {
    if (followStatus === "accepted") return "Following";
    if (followStatus === "pending") return "Requested";
    if (incomingFollowStatus === "accepted") return "Following";
    if (incomingFollowStatus === "pending") return "Accept Request";
    return "Follow";
  }

  async function handleAcceptRequest(fromId) {
    await acceptFollowRequest(fromId, user.uid);
    createNotification({
      title: "Follow Request Accepted",
      message: `${user.displayName || "Someone"} accepted your follow request.`,
      type: "follow_accepted",
      link: `/students/${user.uid}`,
      targetUserId: fromId,
      senderId: user.uid,
      relatedUserId: fromId,
    }).catch(() => {});
  }

  async function handleRejectFromList(fromId) {
    await rejectFollowRequest(fromId, user.uid);
  }

  async function handleRemoveFollower(followerId) {
    await removeFollower(user.uid, followerId);
  }

  async function handleBlock() {
    if (blocked) {
      await unblockUser(user.uid, studentId);
      setBlocked(false);
    } else {
      await blockUser(user.uid, studentId);
      setBlocked(true);
      setFollowStatus(null);
    }
  }

  async function handleReport() {
    if (!reportReason || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      let evidenceUrls = [];
      if (reportEvidence) {
        const { data: evData, error: evError } = await uploadReportEvidence("temp", reportEvidence);
        if (!evError && evData) {
          evidenceUrls = [evData.fileUrl];
        }
      }
      if (reportChatEvidence.trim()) {
        const chatBlob = new Blob([reportChatEvidence], { type: "text/plain" });
        const chatFile = new File([chatBlob], "chat-evidence.txt", { type: "text/plain" });
        const { data: chatEvData, error: chatEvError } = await uploadReportEvidence("temp", chatFile);
        if (!chatEvError && chatEvData) {
          evidenceUrls = [...evidenceUrls, chatEvData.fileUrl];
        }
      }
      const { data } = await reportUser(user.uid, studentId, reportReason, reportDetails, evidenceUrls);
      if (data && evidenceUrls.length > 0) {
        const { default: { updateDoc, doc: docRef } } = await import("firebase/firestore");
        const { db } = await import("../config/firebase");
        await updateDoc(docRef(db, "reports", data.id), { evidenceUrls });
      }
      setReportSent(true);
      setShowReport(false);
      setReportReason("");
      setReportDetails("");
      setReportEvidence(null);
      setReportChatEvidence("");
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleStartChat() {
    if (blocked || chatLoading) return;
    const canChat = profile?.profileVisibility === "public" || followStatus === "accepted" || incomingFollowStatus === "accepted";
    if (!canChat) return;
    setChatLoading(true);
    setChatError("");
    try {
      const conv = await startConversation(studentId);
      if (conv) {
        navigate(`/students?chat=${studentId}`);
      } else {
        setChatError("Could not start conversation.");
      }
    } catch (err) {
      setChatError("Error: " + err.message);
    } finally {
      setChatLoading(false);
    }
  }

  const canViewDetails = useMemo(() => {
    if (isOwnProfile) return true;
    if (profile?.profileVisibility === "public") return true;
    if (followStatus === "accepted") return true;
    if (incomingFollowStatus === "accepted") return true;
    return false;
  }, [isOwnProfile, profile?.profileVisibility, followStatus, incomingFollowStatus]);

  const canChat = useMemo(() => {
    if (isOwnProfile) return false;
    if (blocked) return false;
    if (profile?.profileVisibility === "public") return true;
    if (followStatus === "accepted") return true;
    if (incomingFollowStatus === "accepted") return true;
    return false;
  }, [isOwnProfile, blocked, profile?.profileVisibility, followStatus, incomingFollowStatus]);

  if (loading) {
    return (
      <div className="sp-page animate-fade-in">
        <div className="skeleton-card" style={{ height: 200 }} />
        <div className="skeleton-card" style={{ height: 300 }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sp-page animate-fade-in">
        <div className="sp-empty glass">
          <h3>Student not found</h3>
          <button className="btn btn-primary" onClick={() => navigate("/students")}>Back to Students</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-page animate-fade-in">
      <div className="sp-back-bar" onClick={() => navigate("/students")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Back to Students</span>
      </div>

      <div className="sp-hero glass">
        <div className="sp-hero-top">
          <div className="sp-avatar-wrap">
            <UserAvatar user={{ uid: profile.id }} profile={profile} style={{ width: 80, height: 80 }} />
            {profile.profileVisibility === "private" && (
              <span className="sp-privacy-badge" title="Private Profile">🔒</span>
            )}
          </div>
          <div className="sp-hero-info">
            <h1 className="sp-name">{profile.displayName || "Student"}</h1>
            {isOwnProfile && <p className="sp-email">{profile.email}</p>}
            {profile.branch && <span className="sp-tag">{profile.branch}</span>}
            {profile.graduationYear && <span className="sp-tag">Class of {profile.graduationYear}</span>}
            {profile.college && <span className="sp-tag">{profile.college}</span>}
          </div>
          <div className="sp-hero-stats">
            <div className="sp-stat">
              <strong>{followers.length}</strong>
              <span>Followers</span>
            </div>
            <div className="sp-stat">
              <strong>{following.length}</strong>
              <span>Following</span>
            </div>
          </div>
        </div>

        {!isOwnProfile && (
          <div className="sp-hero-actions">
            <button
              className={`btn ${followStatus === "accepted" ? "btn-ghost" : incomingFollowStatus === "pending" ? "btn-primary" : "btn-primary"}`}
              onClick={handleFollow}
              disabled={blocked || followLoading}
            >
              {getFollowLabel()}
            </button>
            {incomingFollowStatus === "pending" && (
              <button
                className="btn btn-ghost"
                onClick={handleRejectIncomingRequest}
                disabled={blocked || followLoading}
              >
                Reject
              </button>
            )}
            {canChat && (
              <button className="btn btn-primary" onClick={handleStartChat} disabled={chatLoading}>
                {chatLoading ? "Opening..." : "Message"}
              </button>
            )}
            {chatError && (
              <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 4 }}>{chatError}</div>
            )}
            {!isOwnProfile && (
              <>
                <button className="btn btn-ghost" onClick={handleBlock}>
                  {blocked ? "Unblock" : "Block"}
                </button>
                {!blocked && (
                  <button className="btn btn-ghost" onClick={() => setShowReport(true)}>
                    Report
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isOwnProfile && pendingRequests.length > 0 && (
        <div className="sp-section glass">
          <h3 className="sp-section-title">Follow Requests ({pendingRequests.length})</h3>
          <div className="sp-requests-list">
            {pendingRequests.map((r) => (
              <div key={r.id} className="sp-request-item">
                <UserAvatar user={{ uid: r.id }} profile={r} style={{ width: 36, height: 36 }} />
                <span className="sp-request-name">{r.displayName || "Student"}</span>
                <button className="btn btn-primary btn-sm" onClick={() => handleAcceptRequest(r.id)}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRejectFromList(r.id)}>Reject</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canViewDetails ? (
        <>
          {profile.about && (
            <div className="sp-section glass">
              <h3 className="sp-section-title">About</h3>
              <p className="sp-about-text">{profile.about}</p>
            </div>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div className="sp-section glass">
              <h3 className="sp-section-title">Skills</h3>
              <div className="sp-skills-cloud">
                {profile.skills.map((sk, i) => (
                  <span key={i} className="sp-skill-chip">{sk}</span>
                ))}
              </div>
            </div>
          )}

          {profile.projects && profile.projects.length > 0 && (
            <div className="sp-section glass">
              <h3 className="sp-section-title">Projects</h3>
              <div className="sp-projects-list">
                {profile.projects.map((p, i) => (
                  <div key={i} className="sp-project-item">
                    <strong>{p.name || "Project"}</strong>
                    {p.description && <p>{p.description}</p>}
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="sp-project-link">View Project</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.placementStatus && (
            <div className="sp-section glass">
              <h3 className="sp-section-title">Placement Status</h3>
              <span className={`sp-placement-badge sp-placement-${profile.placementStatus}`}>
                {profile.placementStatus}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="sp-section glass sp-locked">
          <div className="sp-locked-icon">🔒</div>
          <h3>Profile is Private</h3>
          <p>Send a follow request to view detailed profile information.</p>
        </div>
      )}

      <div className="sp-section glass">
        <h3 className="sp-section-title">Followers ({followers.length})</h3>
        {followers.length === 0 ? (
          <p className="sp-empty-text">No followers yet.</p>
        ) : (
          <div className="sp-follow-list">
            {followers.map((f) => (
              <div key={f.id} className="sp-follow-item" onClick={() => navigate(`/students/${f.id}`)}>
                <UserAvatar user={{ uid: f.id }} profile={f} style={{ width: 32, height: 32 }} />
                <span>{f.displayName || "Student"}</span>
                {isOwnProfile && (
                  <button
                    className="sp-remove-follower-btn"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFollower(f.id); }}
                    title="Remove follower"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sp-section glass">
        <h3 className="sp-section-title">Following ({following.length})</h3>
        {following.length === 0 ? (
          <p className="sp-empty-text">Not following anyone yet.</p>
        ) : (
          <div className="sp-follow-list">
            {following.map((f) => (
              <div key={f.id} className="sp-follow-item" onClick={() => navigate(`/students/${f.id}`)}>
                <UserAvatar user={{ uid: f.id }} profile={f} style={{ width: 32, height: 32 }} />
                <span>{f.displayName || "Student"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showReport} onClose={() => { setShowReport(false); setReportReason(""); setReportDetails(""); setReportEvidence(null); setReportChatEvidence(""); }} title="Report Student">
        {reportSent ? (
          <div className="sp-report-done">
            <p>Report submitted. Thank you for helping keep our community safe.</p>
            <button className="btn btn-primary" onClick={() => { setReportSent(false); }}>Close</button>
          </div>
        ) : (
          <>
            <div className="modal-field">
              <label className="field-label">Reason</label>
              <select className="input-field" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                <option value="">Select a reason...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="fake_profile">Fake Profile</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="modal-field">
              <label className="field-label">Details (optional)</label>
              <textarea className="input-field" rows="3" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Provide any additional details..." />
            </div>
            <div className="modal-field">
              <label className="field-label">Evidence (optional)</label>
              <div className="sp-evidence-upload">
                <input
                  type="file"
                  id="report-evidence"
                  accept="image/*,.pdf"
                  className="sp-evidence-input"
                  onChange={(e) => setReportEvidence(e.target.files?.[0] || null)}
                />
                <label htmlFor="report-evidence" className="sp-evidence-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {reportEvidence ? reportEvidence.name : "Attach screenshot or evidence"}
                </label>
                {reportEvidence && (
                  <button className="sp-evidence-remove" onClick={() => setReportEvidence(null)}>✕</button>
                )}
              </div>
            </div>
            <div className="modal-field">
              <label className="field-label">Chat Evidence (optional)</label>
              <textarea
                className="input-field"
                rows="3"
                value={reportChatEvidence}
                onChange={(e) => setReportChatEvidence(e.target.value)}
                placeholder="Paste relevant chat messages or conversation text here..."
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn--secondary" onClick={() => { setShowReport(false); setReportReason(""); setReportDetails(""); setReportEvidence(null); setReportChatEvidence(""); }}>Cancel</button>
              <button className="modal-btn modal-btn--primary" onClick={handleReport} disabled={!reportReason || reportSubmitting}>
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
