// Re-export all social domain modules

// Students
export {
  getStudentProfile,
  subscribeToStudentProfile,
  getAllStudents,
  subscribeToStudents,
  updateStudentProfile,
  setUserOnline,
  setUserOffline,
  subscribeToUserPresence,
} from "./students";

// Follows
export {
  sendFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  cancelFollowRequest,
  removeFollower,
  getFollowStatus,
  getFollowers,
  getFollowing,
  subscribeToFollowers,
  subscribeToFollowing,
  getPendingFollowRequests,
  subscribeToPendingFollowRequests,
  subscribeToFollowStatus,
  subscribeToAllFollowStatuses,
} from "./follows";

// Blocks
export {
  blockUser,
  unblockUser,
  isBlocked,
} from "./blocks";

// Reports
export {
  reportUser,
  uploadReportEvidence,
  getAllReports,
  updateReportStatus,
  getModerationHistory,
  getModerationsByReport,
  sendAdminMessage,
  sendAdminWarning,
  adminUpdateReport,
} from "./reports";

// Messaging
export {
  getOrCreateConversation,
  getConversations,
  sendMessage,
  subscribeToMessages,
  subscribeToConversations,
  markConversationRead,
  encryptMessage,
  decryptMessage,
} from "./messaging";

// Admin Messaging
export {
  getOrCreateAdminConversation,
  sendAdminChatMessage,
  getAdminConversations,
  subscribeToAdminMessages,
  subscribeToAdminConversations,
  markAdminConversationRead,
} from "./adminMessaging";
