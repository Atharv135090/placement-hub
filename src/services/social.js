// Backward-compatible barrel re-export from domain modules
// All existing `import { ... } from "./social"` continue to work unchanged

// Students
export {
  getStudentProfile,
  subscribeToStudentProfile,
  getAllStudents,
  subscribeToStudents,
  updateStudentProfile,
} from "./social/students";

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
} from "./social/follows";

// Blocks
export {
  blockUser,
  unblockUser,
  isBlocked,
} from "./social/blocks";

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
} from "./social/reports";

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
} from "./social/messaging";
