import { describe, it, expect } from "vitest";
import {
  normalizeEmploymentType,
  normalizeWorkMode,
  parseCourses,
  parseLabelAwareText,
} from "../src/utils/placementParser";

// ═══════════════════════════════════════════════════════════════
// EMPLOYMENT TYPE NORMALIZATION (§13)
// ═══════════════════════════════════════════════════════════════

describe("normalizeEmploymentType", () => {
  it("returns null for empty input", () => {
    expect(normalizeEmploymentType("")).toBeNull();
    expect(normalizeEmploymentType(null)).toBeNull();
    expect(normalizeEmploymentType(undefined)).toBeNull();
  });

  it("normalizes internship + full-time combinations", () => {
    expect(normalizeEmploymentType("Internship + Full-Time")).toBe("Internship + Full-Time");
    expect(normalizeEmploymentType("internship with ppo")).toBe("Internship + Full-Time");
    expect(normalizeEmploymentType("Intern + Full")).toBe("Internship + Full-Time");
  });

  it("normalizes standalone types", () => {
    expect(normalizeEmploymentType("Internship")).toBe("Internship");
    expect(normalizeEmploymentType("intern")).toBe("Internship");
    expect(normalizeEmploymentType("Full-time")).toBe("Full-Time");
    expect(normalizeEmploymentType("full time")).toBe("Full-Time");
    expect(normalizeEmploymentType("Contract")).toBe("Contract");
    expect(normalizeEmploymentType("Part-time")).toBe("Part-Time");
  });

  it("preserves unrecognized values", () => {
    expect(normalizeEmploymentType("Custom Type")).toBe("Custom Type");
  });
});

// ═══════════════════════════════════════════════════════════════
// WORK MODE NORMALIZATION (§15)
// ═══════════════════════════════════════════════════════════════

describe("normalizeWorkMode", () => {
  it("returns null for empty input", () => {
    expect(normalizeWorkMode("")).toBeNull();
    expect(normalizeWorkMode(null)).toBeNull();
  });

  it("normalizes work modes", () => {
    expect(normalizeWorkMode("remote")).toBe("Remote");
    expect(normalizeWorkMode("Remote Working")).toBe("Remote");
    expect(normalizeWorkMode("hybrid")).toBe("Hybrid");
    expect(normalizeWorkMode("on campus")).toBe("On Campus");
    expect(normalizeWorkMode("off-campus")).toBe("Off Campus");
  });

  it("preserves unrecognized values", () => {
    expect(normalizeWorkMode("Pune Office")).toBe("Pune Office");
  });
});

// ═══════════════════════════════════════════════════════════════
// COURSE PARSING (§20)
// ═══════════════════════════════════════════════════════════════

describe("parseCourses", () => {
  it("returns empty array for empty input", () => {
    expect(parseCourses("")).toEqual([]);
    expect(parseCourses(null)).toEqual([]);
  });

  it("parses comma-separated courses", () => {
    const result = parseCourses("B.E. - CS, B.E. - IT, MCA");
    expect(result).toEqual(["B.E. - CS", "B.E. - IT", "MCA"]);
  });

  it("parses newline-separated courses", () => {
    const result = parseCourses("B.E. - CS\nB.E. - IT\nMCA");
    expect(result).toEqual(["B.E. - CS", "B.E. - IT", "MCA"]);
  });

  it("filters out 'eligible courses' header", () => {
    const result = parseCourses("Eligible Courses: B.E. - CS, B.E. - IT");
    expect(result).not.toContain("Eligible Courses");
  });

  it("handles array input", () => {
    const result = parseCourses(["B.E. - CS", "B.E. - IT"]);
    expect(result).toEqual(["B.E. - CS", "B.E. - IT"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// LABEL-AWARE TEXT PARSING (§14, §15)
// ═══════════════════════════════════════════════════════════════

describe("parseLabelAwareText", () => {
  it("returns empty for empty input", () => {
    expect(parseLabelAwareText("")).toEqual({});
    expect(parseLabelAwareText(null)).toEqual({});
  });

  it("extracts company name", () => {
    const result = parseLabelAwareText("Company Name: eQ Technologic");
    expect(result.companyName).toBe("eQ Technologic");
  });

  it("extracts multiple fields", () => {
    const text = `Company Name: eQ Technologic
Industry: IT / Computers - Software
CTC: INR 14,00,000`;
    const result = parseLabelAwareText(text);
    expect(result.companyName).toBe("eQ Technologic");
    expect(result.industry).toBe("IT / Computers - Software");
    expect(result.ctc).toBe("INR 14,00,000");
  });

  it("does NOT put raw text into fields", () => {
    const longText = `Company Name: eQ Technologic
Industry: IT / Computers - Software
Organisation Size: 2,001 - 10,000
Drive Title: Software Engineer Fresher
CTC: INR 14,00,000`;
    const result = parseLabelAwareText(longText);
    expect(result.companyName).toBe("eQ Technologic");
    expect(result.companyName.length).toBeLessThan(longText.length);
  });

  it("extracts registration dates", () => {
    const text = `Registration Opens: 2026-05-20
Registration Closes: 2026-05-21`;
    const result = parseLabelAwareText(text);
    expect(result.registrationOpensAt).toBeTruthy();
    expect(result.registrationClosesAt).toBeTruthy();
  });

  it("extracts eligible courses", () => {
    const text = `Eligible Courses: B.E. - CS, B.E. - IT`;
    const result = parseLabelAwareText(text);
    expect(result.eligibleCourses).toBeTruthy();
  });
});
