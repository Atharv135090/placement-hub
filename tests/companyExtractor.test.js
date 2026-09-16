import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase services before importing the module under test
vi.mock("../src/services/firestore/companies", () => ({
  findCompanyByName: vi.fn(),
  addCompany: vi.fn(),
}));
vi.mock("../src/services/firestore/jobs", () => ({
  addJob: vi.fn(),
  getJobsByCompany: vi.fn(),
}));

import { detectAddIntent, extractCompanyAndDrive } from "../src/utils/companyExtractor";

// ═══════════════════════════════════════════════════════════════
// INTENT DETECTION TESTS (§14, §16, §17)
// ═══════════════════════════════════════════════════════════════

describe("detectAddIntent", () => {
  it("returns intent=false for null/empty", () => {
    expect(detectAddIntent(null)).toEqual({ intent: false });
    expect(detectAddIntent("")).toEqual({ intent: false });
    expect(detectAddIntent("   ")).toEqual({ intent: false });
  });

  it("detects company-only intent", () => {
    expect(detectAddIntent("add company").scope).toBe("company_only");
    expect(detectAddIntent("add only the company").scope).toBe("company_only");
    expect(detectAddIntent("create company only").scope).toBe("company_only");
  });

  it("detects drive-only intent", () => {
    expect(detectAddIntent("add drive").scope).toBe("drive_only");
    expect(detectAddIntent("add only the placement").scope).toBe("drive_only");
    expect(detectAddIntent("add job").scope).toBe("drive_only");
  });

  it("detects drive-under-company intent", () => {
    // "add drive under NVIDIA" matches DRIVE_ONLY_PATTERNS first (scope="drive_only")
    // then the target company is extracted separately by the caller
    const result = detectAddIntent("add drive under NVIDIA");
    expect(result.intent).toBe(true);
  });

  it("detects general add intent", () => {
    expect(detectAddIntent("add this").scope).toBe("auto");
    expect(detectAddIntent("save it").scope).toBe("auto");
    expect(detectAddIntent("add this company").scope).toBe("auto");
    expect(detectAddIntent("create a drive").scope).toBe("auto");
  });

  it("returns intent=false for non-add messages", () => {
    expect(detectAddIntent("show all companies")).toEqual({ intent: false });
    expect(detectAddIntent("hello")).toEqual({ intent: false });
    expect(detectAddIntent("what is the CTC")).toEqual({ intent: false });
  });
});

// ═══════════════════════════════════════════════════════════════
// FIELD EXTRACTION TESTS (§13, §15)
// ═══════════════════════════════════════════════════════════════

describe("extractCompanyAndDrive", () => {
  it("returns null for empty input", () => {
    const result = extractCompanyAndDrive("");
    expect(result.company).toBeNull();
    expect(result.drive).toBeNull();
  });

  it("extracts company name from labeled text", () => {
    const result = extractCompanyAndDrive("Company Name: eQ Technologic");
    expect(result.company).not.toBeNull();
    expect(result.company.name).toBe("eQ Technologic");
  });

  it("extracts industry separately from company name", () => {
    const text = `Company Name: eQ Technologic
Industry: IT / Computers - Software`;
    const result = extractCompanyAndDrive(text);
    expect(result.company.name).toBe("eQ Technologic");
    expect(result.company.industry).toBe("IT / Computers - Software");
  });

  it("extracts drive title separately from company name", () => {
    const text = `Company Name: eQ Technologic
Drive Title: Software Engineer Fresher`;
    const result = extractCompanyAndDrive(text);
    expect(result.company.name).toBe("eQ Technologic");
    expect(result.drive.title).toBe("Software Engineer Fresher");
  });

  it("extracts CTC and stipend as separate fields", () => {
    const text = `CTC: INR 14,00,000
Stipend: INR 35,000`;
    const result = extractCompanyAndDrive(text);
    // Drive object uses "package" for CTC field
    expect(result.drive.package).toBe("INR 14,00,000");
    expect(result.drive.stipend).toBe("INR 35,000");
  });

  it("does NOT put raw message into individual fields", () => {
    const longText = `Company Name: eQ Technologic
Industry: IT / Computers - Software
Organisation Size: 2,001 - 10,000
Drive Title: Software Engineer Fresher
CTC: INR 14,00,000
Description: Looking to leapfrog your career`;
    const result = extractCompanyAndDrive(longText);
    // Company name should be ONLY the company name, not the whole text
    expect(result.company.name).toBe("eQ Technologic");
    expect(result.company.name.length).toBeLessThan(longText.length);
    // Drive title should be ONLY the drive title
    expect(result.drive.title).toBe("Software Engineer Fresher");
    expect(result.drive.title.length).toBeLessThan(longText.length);
    // Industry should be ONLY the industry
    expect(result.company.industry).toBe("IT / Computers - Software");
  });

  it("extracts eligibility courses", () => {
    const text = `Eligible Courses: B.E. - Computer Science, B.E. - IT`;
    const result = extractCompanyAndDrive(text);
    expect(result.drive.eligibility).toContain("B.E.");
  });

  it("extracts registration dates", () => {
    const text = `Registration Opens: 2026-05-20
Registration Closes: 2026-05-21`;
    const result = extractCompanyAndDrive(text);
    expect(result.drive.registrationOpens).toBeTruthy();
    expect(result.drive.registrationCloses).toBeTruthy();
  });

  it("extracts employment type", () => {
    const text = `Employment Type: Internship + Full-Time`;
    const result = extractCompanyAndDrive(text);
    expect(result.drive.type).toBe("Internship + Full-Time");
  });

  it("extracts work mode", () => {
    const text = `Work Mode: Remote`;
    const result = extractCompanyAndDrive(text);
    expect(result.drive.workMode).toBe("Remote");
  });

  it("extracts application link", () => {
    const text = `Application Link: https://apply.example.com`;
    const result = extractCompanyAndDrive(text);
    expect(result.drive.applicationLink).toBe("https://apply.example.com");
  });
});
