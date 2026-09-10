# Placement Hub — Firestore Database Schema

## Collections

### companies

Stores information about companies visiting for placement drives.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Company name |
| `industry` | string | Industry sector |
| `website` | string | Company website URL |
| `logoUrl` | string | URL to company logo |
| `description` | string | Brief company description |
| `location` | string | Headquarters / office location |
| `contactEmail` | string | Recruiter contact email |
| `isActive` | boolean | Whether company is currently active (default: true) |
| `createdAt` | timestamp | Server-set creation time |
| `updatedAt` | timestamp | Server-set last update time |

### jobs

Placement drives and job postings. Each job references a company via `companyId`.

| Field | Type | Description |
|-------|------|-------------|
| `companyId` | string | Reference to companies collection |
| `title` | string | Job title (e.g., "Software Engineer") |
| `description` | string | Job description and responsibilities |
| `type` | string | Employment type (full-time, internship, etc.) |
| `package` | string | Compensation (e.g., "8 LPA") |
| `location` | string | Work location |
| `eligibility` | string | Eligibility criteria |
| `deadline` | timestamp | Application deadline |
| `isActive` | boolean | Whether drive is currently active (default: true) |
| `createdAt` | timestamp | Server-set creation time |
| `updatedAt` | timestamp | Server-set last update time |

### users

Student and admin profiles. Document ID is the Firebase Auth UID.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Auth UID (stored for reference) |
| `email` | string | User email |
| `displayName` | string | Full name |
| `photoUrl` | string | Profile photo URL |
| `role` | string | "student" (default), "admin", or "owner" |
| `branch` | string | Academic branch/department |
| `graduationYear` | number | Expected graduation year |
| `createdAt` | timestamp | Server-set creation time |
| `updatedAt` | timestamp | Server-set last update time |

### applications

Student job applications. References both `userId` and `jobId`.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Reference to users collection (Auth UID) |
| `jobId` | string | Reference to jobs collection |
| `status` | string | "pending" (default), "shortlisted", "rejected", "accepted" |
| `resumeUrl` | string | URL to uploaded resume |
| `notes` | string | Optional applicant notes |
| `createdAt` | timestamp | Server-set creation time |
| `updatedAt` | timestamp | Server-set last update time |

### announcements

System-wide announcements for students.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Announcement title |
| `content` | string | Announcement body |
| `authorId` | string | UID of admin/owner who created it |
| `priority` | string | "low", "medium", or "high" |
| `isActive` | boolean | Whether announcement is visible (default: true) |
| `createdAt` | timestamp | Server-set creation time |
| `updatedAt` | timestamp | Server-set last update time |

## Relationships

```
companies  1 ──── N  jobs        (companyId)
users      1 ──── N  applications (userId)
jobs       1 ──── N  applications (jobId)
```

## Security Rules Summary

| Collection | Read | Create | Update | Delete |
|------------|------|--------|--------|--------|
| companies | Any auth user | Owner/Admin | Owner/Admin | Owner/Admin |
| jobs | Any auth user | Owner/Admin | Owner/Admin | Owner/Admin |
| users | Any auth user | Own profile only | Own profile or Owner | Owner only |
| applications | Own or Owner/Admin | Own only | Own or Owner/Admin | Own or Owner/Admin |
| announcements | Any auth user | Owner/Admin | Owner/Admin | Owner/Admin |

## Future Collections (not yet created)

- `notifications` — Per-user notifications
- `analytics` — Admin-only analytics data
- `adminLogs` — Owner/admin activity audit trail

## Service Layer

All Firestore operations are centralized in `src/services/firestore.js`.
Components never import Firestore SDK directly — they use service functions.

### Exported Functions

**Companies:** `addCompany`, `getCompanies`, `getCompany`, `updateCompany`, `deleteCompany`

**Jobs:** `addJob`, `getJobs`, `getJob`, `getJobsByCompany`, `updateJob`, `deleteJob`

**Users:** `createUserProfile`, `getUserProfile`, `updateUserProfile`

**Applications:** `addApplication`, `getMyApplications`, `getApplication`, `updateApplication`

**Announcements:** `addAnnouncement`, `getAnnouncements`, `getAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`

**Query Helpers:** `getActiveJobs`, `getActiveCompanies`, `getActiveAnnouncements`, `getRecentJobs`
