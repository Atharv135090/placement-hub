import { describe, it, expect } from "vitest";
import {
  buildLatestDriveDateMap,
  compareCompaniesByRegisteredDate,
  getCompanyCreatedAtMs,
  getCompanyDriveDateMs,
  getCompanyRegisteredDateMs,
  getCompanySortTimeMs,
  sortCompaniesByRegisteredDate,
  toDateInputValue,
} from "../src/utils/companySort";

// ═══════════════════════════════════════════════════════════════
// MANUAL COMPANY REGISTRATION DATE + AUTOMATIC SORTING
// ═══════════════════════════════════════════════════════════════

const ts = (seconds) => ({ seconds, nanoseconds: 0 });
const names = (list) => list.map((c) => c.name);

describe("Registered date parsing", () => {
  it("parses YYYY-MM-DD strings", () => {
    expect(getCompanyRegisteredDateMs({ registeredDate: "2025-03-15" })).toBe(
      Date.parse("2025-03-15")
    );
  });

  it("parses Firestore timestamp objects", () => {
    expect(getCompanyRegisteredDateMs({ registeredDate: ts(1700000000) })).toBe(1700000000000);
  });

  it("parses Date instances", () => {
    const d = new Date("2025-01-02T00:00:00Z");
    expect(getCompanyRegisteredDateMs({ registeredDate: d })).toBe(d.getTime());
  });

  it("returns null when no registered date exists", () => {
    expect(getCompanyRegisteredDateMs({})).toBeNull();
    expect(getCompanyRegisteredDateMs({ registeredDate: "" })).toBeNull();
    expect(getCompanyRegisteredDateMs({ registeredDate: "not-a-date" })).toBeNull();
  });
});

describe("Newest First sorting (default)", () => {
  it("sorts by manually configured registered date descending", () => {
    const list = [
      { name: "Mid", registeredDate: "2025-06-15" },
      { name: "Newest", registeredDate: "2026-01-01" },
      { name: "Oldest", registeredDate: "2024-01-01" },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "desc"))).toEqual([
      "Newest",
      "Mid",
      "Oldest",
    ]);
  });

  it("latest registered date appears first, earliest last", () => {
    const sorted = sortCompaniesByRegisteredDate(
      [
        { name: "A", registeredDate: "2024-05-01" },
        { name: "B", registeredDate: "2026-02-01" },
        { name: "C", registeredDate: "2025-01-01" },
      ],
      "desc"
    );
    expect(sorted[0].name).toBe("B");
    expect(sorted[sorted.length - 1].name).toBe("A");
  });

  it("falls back to creation timestamp for companies without a registered date", () => {
    const list = [
      { name: "Older (no date)", createdAt: ts(1000) },
      { name: "Manual 2024", registeredDate: "2024-01-01" },
      { name: "Newer (no date)", createdAt: ts(2000000000) },
    ];
    const sorted = sortCompaniesByRegisteredDate(list, "desc");
    // Newer fallback (year 2033) > manual 2024 > older fallback (1970)
    expect(names(sorted)).toEqual(["Newer (no date)", "Manual 2024", "Older (no date)"]);
  });

  it("tie-breaks equal registered dates by creation timestamp (descending)", () => {
    const list = [
      { name: "First created", registeredDate: "2025-05-05", createdAt: ts(100) },
      { name: "Second created", registeredDate: "2025-05-05", createdAt: ts(200) },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "desc"))).toEqual([
      "Second created",
      "First created",
    ]);
  });

  it("is consistent regardless of input order", () => {
    const a = { name: "A", registeredDate: "2025-05-05", createdAt: ts(100) };
    const b = { name: "B", registeredDate: "2025-05-05", createdAt: ts(200) };
    expect(names(sortCompaniesByRegisteredDate([a, b], "desc"))).toEqual(["B", "A"]);
    expect(names(sortCompaniesByRegisteredDate([b, a], "desc"))).toEqual(["B", "A"]);
  });

  it("sorts companies with no dates at all after those with dates", () => {
    const list = [
      { name: "No dates" },
      { name: "Has date", registeredDate: "2020-01-01" },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "desc"))).toEqual(["Has date", "No dates"]);
  });

  it("does not mutate the input array", () => {
    const list = [
      { name: "A", registeredDate: "2024-01-01" },
      { name: "B", registeredDate: "2025-01-01" },
    ];
    const copy = [...list];
    sortCompaniesByRegisteredDate(list, "desc");
    expect(list).toEqual(copy);
  });
});

describe("Oldest First sorting", () => {
  it("sorts ascending by registered date", () => {
    const list = [
      { name: "Newest", registeredDate: "2026-01-01" },
      { name: "Oldest", registeredDate: "2024-01-01" },
      { name: "Mid", registeredDate: "2025-06-15" },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "asc"))).toEqual([
      "Oldest",
      "Mid",
      "Newest",
    ]);
  });

  it("tie-breaks equal dates by creation timestamp (ascending)", () => {
    const list = [
      { name: "Second created", registeredDate: "2025-05-05", createdAt: ts(200) },
      { name: "First created", registeredDate: "2025-05-05", createdAt: ts(100) },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "asc"))).toEqual([
      "First created",
      "Second created",
    ]);
  });
});

describe("Editing a registered date repositions the company", () => {
  it("moves a company to the front when its date is changed to the newest", () => {
    const companies = [
      { id: "1", name: "Alpha", registeredDate: "2024-01-01", createdAt: ts(1) },
      { id: "2", name: "Beta", registeredDate: "2025-01-01", createdAt: ts(2) },
      { id: "3", name: "Gamma", registeredDate: "2023-01-01", createdAt: ts(3) },
    ];
    expect(names(sortCompaniesByRegisteredDate(companies, "desc"))).toEqual([
      "Beta",
      "Alpha",
      "Gamma",
    ]);

    const edited = companies.map((c) =>
      c.id === "1" ? { ...c, registeredDate: "2026-06-01" } : c
    );
    expect(names(sortCompaniesByRegisteredDate(edited, "desc"))).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("moves a company last when its date is cleared (falls back to creation timestamp)", () => {
    const companies = [
      { id: "1", name: "Alpha", registeredDate: "2026-01-01", createdAt: ts(1000) },
      { id: "2", name: "Beta", registeredDate: "2025-01-01", createdAt: ts(2000) },
    ];
    const edited = companies.map((c) =>
      c.id === "1" ? { ...c, registeredDate: "" } : c
    );
    expect(names(sortCompaniesByRegisteredDate(edited, "desc"))).toEqual(["Beta", "Alpha"]);
  });
});

describe("Raw placement drive fields are not read directly by the sorter", () => {
  it("ignores a raw registrationOpensAt field left on a company object", () => {
    const list = [
      { name: "A", registeredDate: "2025-01-01", registrationOpensAt: "2026-01-01" },
      { name: "B", registeredDate: "2025-01-01", registrationOpensAt: "2020-01-01" },
    ];
    const sorted = sortCompaniesByRegisteredDate(list, "desc");
    // Same registered date and no createdAt -> stable order, unaffected by raw drive fields
    expect(names(sorted)).toEqual(["A", "B"]);
    expect(compareCompaniesByRegisteredDate(list[0], list[1], "desc")).toBe(0);
  });
});

describe("Drive registration-date fallback (latest drive Registration Opens)", () => {
  const drives = [
    { companyId: "enabl3", registrationOpensAt: "2026-10-16T11:00" },
    { companyId: "rudder", registrationOpensAt: "2026-10-14T09:30" },
    { companyId: "nvidia", registrationOpensAt: "2026-09-30T10:30" },
  ];

  it("builds a companyId -> latest registration-opens map", () => {
    const map = buildLatestDriveDateMap([
      ...drives,
      { companyId: "enabl3", registrationOpensAt: "2026-10-01T09:00" },
      { companyId: "rudder", registrationOpensAt: "2026-10-20T09:00" },
      { registrationOpensAt: "2026-01-01" },
      { companyId: "empty", registrationOpensAt: null },
      { companyId: "bad", registrationOpensAt: "not-a-date" },
    ]);
    expect(map.enabl3).toBe(Date.parse("2026-10-16T11:00"));
    expect(map.rudder).toBe(Date.parse("2026-10-20T09:00"));
    expect(map.nvidia).toBe(Date.parse("2026-09-30T10:30"));
    expect("empty" in map).toBe(false);
    expect("bad" in map).toBe(false);
  });

  it("reported case: Enabl3 (16 Oct) before Rudder (14 Oct) although Rudder's createdAt is later", () => {
    const companies = [
      { id: "rudder", name: "Rudder Analytics", createdAt: ts(6000) },
      { id: "enabl3", name: "Enabl3Systems", createdAt: ts(5000) },
    ];
    const map = buildLatestDriveDateMap(drives);
    const enriched = companies.map((c) => ({
      ...c,
      driveRegistrationDate: map[c.id] ?? null,
    }));
    expect(names(sortCompaniesByRegisteredDate(enriched, "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
    expect(names(sortCompaniesByRegisteredDate(enriched, "asc"))).toEqual([
      "Rudder Analytics",
      "Enabl3Systems",
    ]);
  });

  it("manual registered date still wins over the drive date", () => {
    const company = {
      name: "A",
      registeredDate: "2025-01-01",
      driveRegistrationDate: Date.parse("2026-10-16T11:00"),
    };
    expect(getCompanySortTimeMs(company)).toBe(Date.parse("2025-01-01"));
  });

  it("falls back to createdAt when neither date exists", () => {
    const company = { name: "A", createdAt: ts(123) };
    expect(getCompanySortTimeMs(company)).toBe(123000);
    expect(getCompanyDriveDateMs({})).toBeNull();
    expect(getCompanyDriveDateMs({ driveRegistrationDate: "not-a-date" })).toBeNull();
  });
});

describe("toDateInputValue", () => {
  it("keeps YYYY-MM-DD strings as-is", () => {
    expect(toDateInputValue("2025-08-09")).toBe("2025-08-09");
  });

  it("converts Firestore timestamps to a date input value", () => {
    const seconds = Math.floor(new Date(2025, 0, 15, 12).getTime() / 1000);
    expect(toDateInputValue(ts(seconds))).toBe("2025-01-15");
  });

  it("returns empty string for missing values", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue("")).toBe("");
  });
});

describe("Sort time helpers", () => {
  it("prefers registered date over creation timestamp", () => {
    const company = { registeredDate: "2025-06-01", createdAt: ts(0) };
    expect(getCompanySortTimeMs(company)).toBe(Date.parse("2025-06-01"));
    expect(getCompanyCreatedAtMs(company)).toBe(0);
  });

  it("handles missing timestamps safely", () => {
    expect(getCompanyCreatedAtMs({})).toBe(0);
    expect(getCompanyCreatedAtMs(null)).toBe(0);
    expect(getCompanySortTimeMs({})).toBe(0);
  });
});

describe("Reported case: Enabl3Systems (16 Oct 2026) vs Rudder Analytics (14 Oct 2026)", () => {
  // Rudder has the LATER createdAt, so if fallback leaked in it would sort first.
  const enabl3 = {
    id: "AfO2Ui7eWIbVut9Cs2ab",
    name: "Enabl3Systems",
    registeredDate: "2026-10-16",
    createdAt: ts(5000),
  };
  const rudder = {
    id: "zIEYs2YtbYvJUoo7Mumo",
    name: "Rudder Analytics",
    registeredDate: "2026-10-14",
    createdAt: ts(6000),
  };

  it("Newest First places Enabl3Systems (16 Oct) before Rudder Analytics (14 Oct)", () => {
    expect(names(sortCompaniesByRegisteredDate([rudder, enabl3], "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
    expect(names(sortCompaniesByRegisteredDate([enabl3, rudder], "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
  });

  it("Oldest First reverses the same pair", () => {
    expect(names(sortCompaniesByRegisteredDate([enabl3, rudder], "asc"))).toEqual([
      "Rudder Analytics",
      "Enabl3Systems",
    ]);
  });

  it("uses the createdAt fallback (Rudder first) only when registered dates are missing", () => {
    const noDates = [
      { ...enabl3, registeredDate: undefined },
      { ...rudder, registeredDate: undefined },
    ];
    expect(names(sortCompaniesByRegisteredDate(noDates, "desc"))).toEqual([
      "Rudder Analytics",
      "Enabl3Systems",
    ]);
  });

  it("repositions after a Registered Date change (Firebase update simulation)", () => {
    const updated = { ...rudder, registeredDate: "2026-10-20" };
    expect(names(sortCompaniesByRegisteredDate([enabl3, updated], "desc"))).toEqual([
      "Rudder Analytics",
      "Enabl3Systems",
    ]);
    const movedBack = { ...updated, registeredDate: "2026-10-10" };
    expect(names(sortCompaniesByRegisteredDate([enabl3, movedBack], "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
  });

  it("works with the mapped shape used by the Companies page (registeredDate || null)", () => {
    const mapCompany = (fc) => ({ ...fc, registeredDate: fc.registeredDate || null });
    const list = [
      mapCompany({ ...rudder, registeredDate: null }),
      mapCompany(enabl3),
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
  });

  it("handles the same dates stored as Firestore timestamps", () => {
    const toStamp = (iso) => ts(Math.floor(Date.parse(iso) / 1000));
    const list = [
      { ...rudder, registeredDate: toStamp("2026-10-14") },
      { ...enabl3, registeredDate: toStamp("2026-10-16") },
    ];
    expect(names(sortCompaniesByRegisteredDate(list, "desc"))).toEqual([
      "Enabl3Systems",
      "Rudder Analytics",
    ]);
  });
});
