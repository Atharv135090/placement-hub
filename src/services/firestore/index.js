// Re-export all domain modules for backward compatibility
// Existing `import { ... } from "./firestore"` will continue to work

export { normalizeCompanyName } from "./companies";

// Companies
export {
  addCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  getActiveCompanies,
  findCompanyByName,
} from "./companies";

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
} from "./jobs";

// Users
export {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  uploadResume,
  toggleSaveJob,
  getUserSavedIds,
  getAllUsers,
} from "./users";

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
} from "./applications";

// Announcements
export {
  addAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
} from "./announcements";

// Notifications
export {
  createNotification,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from "./notifications";

// Attachments
export {
  addAttachment,
  uploadJobAttachment,
  getAttachmentsByJob,
  getAttachmentsByCompany,
  deleteAttachment,
} from "./attachments";

// Admin
export {
  deleteAllCompanies,
  deleteAllJobs,
  deleteAllApplications,
  deleteAllAnnouncements,
  adminLogoutUser,
  adminDeleteUser,
} from "./admin";
