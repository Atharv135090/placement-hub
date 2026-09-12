// Backward-compatible barrel re-export from domain modules
// All existing `import { ... } from "./firestore"` continue to work unchanged

export { normalizeCompanyName } from "./firestore/companies";

// Companies
export {
  addCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  getActiveCompanies,
  findCompanyByName,
} from "./firestore/companies";

// Jobs
export {
  addJob,
  getJobs,
  getJob,
  getJobsByCompany,
  updateJob,
  deleteJob,
  getActiveJobs,
  getRecentJobs,
  getJobsByCompanyIds,
} from "./firestore/jobs";

// Users
export {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  uploadResume,
  getResumeDataUrl,
  toggleSaveJob,
  getUserSavedIds,
  getAllUsers,
} from "./firestore/users";

// Applications
export {
  addApplication,
  getApplicationByUserAndJob,
  getMyApplications,
  getApplication,
  updateApplication,
  addApplicationMessage,
  deleteApplicationMessage,
  getApplicationsByJobIds,
  getAllApplications,
  deleteApplication,
} from "./firestore/applications";

// Announcements
export {
  addAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
} from "./firestore/announcements";

// Notifications
export {
  createNotification,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from "./firestore/notifications";

// Attachments
export {
  addAttachment,
  uploadJobAttachment,
  getAttachmentsByJob,
  getAttachmentsByCompany,
  deleteAttachment,
} from "./firestore/attachments";

// Admin
export {
  deleteAllCompanies,
  deleteAllJobs,
  deleteAllApplications,
  deleteAllAnnouncements,
  adminLogoutUser,
  adminDeleteUser,
  adminBlockUser,
} from "./firestore/admin";
