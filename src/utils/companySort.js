// ─── COMPANY REGISTERED DATE HELPERS ─────────────────────────
// The admin can manually set a "Registered Date" per company
// (stored as a "YYYY-MM-DD" string). Companies are sorted by that
// date first. Companies without a manually configured date fall
// back to the registration-open date of their latest placement
// drive (attached by the pages as `driveRegistrationDate`), and
// finally to their original creation timestamp. Equal dates are
// tie-broken by the original creation timestamp for a stable order.

function toMs(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      try {
        const t = value.toDate().getTime();
        return Number.isFinite(t) ? t : null;
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === "number") {
      const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return value.seconds * 1000 + Math.floor(nanos / 1e6);
    }
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  return null;
}

export function getCompanyCreatedAtMs(company) {
  if (!company) return 0;
  const t = toMs(company.createdAt);
  return t === null ? 0 : t;
}

export function getCompanyRegisteredDateMs(company) {
  if (!company) return null;
  return toMs(company.registeredDate);
}

export function getCompanyDriveDateMs(company) {
  if (!company) return null;
  return toMs(company.driveRegistrationDate);
}

// Effective sort time: manually configured registered date when present,
// otherwise the latest placement-drive registration-open date, otherwise
// the original creation timestamp (fallback for older companies).
export function getCompanySortTimeMs(company) {
  const registered = getCompanyRegisteredDateMs(company);
  if (registered !== null) return registered;
  const drive = getCompanyDriveDateMs(company);
  if (drive !== null) return drive;
  return getCompanyCreatedAtMs(company);
}

// Builds a companyId -> latest registration-opens timestamp map from
// placement drive (job) records. Used by the pages so companies without a
// manually configured Registered Date can still be ordered by date.
export function buildLatestDriveDateMap(jobs) {
  const map = {};
  (jobs || []).forEach((job) => {
    const companyId = job?.companyId;
    if (!companyId) return;
    const ms = toMs(job?.registrationOpensAt);
    if (ms === null) return;
    if (!(companyId in map) || ms > map[companyId]) map[companyId] = ms;
  });
  return map;
}

export function compareCompaniesByRegisteredDate(a, b, direction = "desc") {
  const factor = direction === "asc" ? 1 : -1;
  const primary = getCompanySortTimeMs(a) - getCompanySortTimeMs(b);
  if (primary !== 0) return primary * factor;
  const secondary = getCompanyCreatedAtMs(a) - getCompanyCreatedAtMs(b);
  if (secondary !== 0) return secondary * factor;
  return 0;
}

// Returns a new array sorted by registered date (latest drive registration
// date, then createdAt as fallback/tiebreak).
export function sortCompaniesByRegisteredDate(list, direction = "desc") {
  return [...(list || [])].sort((a, b) =>
    compareCompaniesByRegisteredDate(a, b, direction)
  );
}

// Normalizes a stored registered date value to "YYYY-MM-DD" for <input type="date">.
export function toDateInputValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const ms = toMs(value);
  if (ms === null) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
