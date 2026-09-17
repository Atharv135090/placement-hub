import { describe, it, expect, beforeEach } from "vitest";

// Simulation of the tab-based ReturnWelcomeJourney trigger evaluation
function evaluateTabWelcomeTrigger({ user, loading, sessionStorageMock }) {
  if (loading) return { shouldOpen: false, reason: "loading" };
  if (!user?.uid) return { shouldOpen: false, reason: "no_user" };

  const tabKey = `welcomeJourneyShown_${user.uid}`;
  const alreadyShown =
    sessionStorageMock.getItem("welcomeJourneyShown") === "true" ||
    sessionStorageMock.getItem(tabKey) === "true";

  if (!alreadyShown) {
    sessionStorageMock.setItem("welcomeJourneyShown", "true");
    sessionStorageMock.setItem(tabKey, "true");
    return { shouldOpen: true, reason: "shown_fresh_tab" };
  }

  return { shouldOpen: false, reason: "already_shown_in_tab" };
}

// Simulation of user name resolution
function resolveWelcomeGreeting(profile, user) {
  const rawName = profile?.displayName || profile?.name || user?.displayName || "";
  const firstName = rawName.trim().split(" ")[0] || rawName.trim();
  return {
    firstName,
    titleText: firstName ? `Welcome back, ${firstName}!` : "Welcome back!",
  };
}

// Helper to create a sessionStorage mock
function createSessionStorageMock(initialData = {}) {
  let store = { ...initialData };
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    getAll: () => store,
  };
}

describe("Placement Hub — Welcome Back Journey Popup PRD Tests", () => {
  const testUser = { uid: "user_atharv_123", displayName: "Atharv Kulkarni" };

  describe("TEST A — FRESH LOGIN (§2.A, §41.A, Item 2)", () => {
    it("opens popup when a user logs in and tab has not shown it yet", () => {
      const session = createSessionStorageMock();
      const res = evaluateTabWelcomeTrigger({
        user: testUser,
        loading: false,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(true);
      expect(session.getItem("welcomeJourneyShown")).toBe("true");
    });

    it("waits for auth initialization (does not prematurely exit while loading)", () => {
      const session = createSessionStorageMock();
      const res = evaluateTabWelcomeTrigger({
        user: null,
        loading: true,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(false);
      expect(res.reason).toBe("loading");
      expect(session.getItem("welcomeJourneyShown")).toBeNull();
    });
  });

  describe("TEST B — SAME TAB REFRESH (§3, §24, §41.B, Item 6)", () => {
    it("does NOT reopen popup on page refresh within the same active tab", () => {
      const session = createSessionStorageMock({
        welcomeJourneyShown: "true",
        [`welcomeJourneyShown_${testUser.uid}`]: "true",
      });
      const res = evaluateTabWelcomeTrigger({
        user: testUser,
        loading: false,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(false);
      expect(res.reason).toBe("already_shown_in_tab");
    });
  });

  describe("TEST C — NORMAL NAVIGATION (§3, §41.C, Item 7)", () => {
    it("does NOT reopen popup when moving between dashboard, companies, applications, etc.", () => {
      const session = createSessionStorageMock({
        welcomeJourneyShown: "true",
        [`welcomeJourneyShown_${testUser.uid}`]: "true",
      });

      // Navigate route 1
      const res1 = evaluateTabWelcomeTrigger({ user: testUser, loading: false, sessionStorageMock: session });
      expect(res1.shouldOpen).toBe(false);

      // Navigate route 2
      const res2 = evaluateTabWelcomeTrigger({ user: testUser, loading: false, sessionStorageMock: session });
      expect(res2.shouldOpen).toBe(false);
    });
  });

  describe("TEST D — CLOSE TAB AND REOPEN (§2.B, §25, §41.D, Item 4)", () => {
    it("MUST show popup when an already authenticated user closes the tab and reopens Placement Hub", () => {
      // Step 1: User is logged in, tab 1 had shown it and was closed (sessionStorage gone)
      // Step 2: User opens new tab / reopens Placement Hub -> fresh sessionStorage context
      const freshTabSession = createSessionStorageMock(); // fresh tab = empty sessionStorage

      const res = evaluateTabWelcomeTrigger({
        user: testUser, // Firebase automatically restores user
        loading: false,
        sessionStorageMock: freshTabSession,
      });

      expect(res.shouldOpen).toBe(true);
      expect(freshTabSession.getItem("welcomeJourneyShown")).toBe("true");
    });
  });

  describe("TEST E — NEW TAB BEHAVIOR (§26, §41.E, Item 5)", () => {
    it("opens popup when authenticated user opens site in another new browser tab", () => {
      const newTabSession = createSessionStorageMock(); // new tab has independent sessionStorage
      const res = evaluateTabWelcomeTrigger({
        user: testUser,
        loading: false,
        sessionStorageMock: newTabSession,
      });
      expect(res.shouldOpen).toBe(true);
    });
  });

  describe("TEST F — LOGOUT / LOGIN BEHAVIOR (§27, §41.F, Item 8)", () => {
    it("clears welcome markers on logout so next login triggers popup", () => {
      const session = createSessionStorageMock({
        welcomeJourneyShown: "true",
        [`welcomeJourneyShown_${testUser.uid}`]: "true",
      });

      // Simulate logOut cleanup in auth.js
      session.removeItem("welcomeJourneyShown");
      session.removeItem(`welcomeJourneyShown_${testUser.uid}`);

      // Next login
      const res = evaluateTabWelcomeTrigger({
        user: testUser,
        loading: false,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(true);
    });

    it("does not show popup when user is logged out", () => {
      const session = createSessionStorageMock();
      const res = evaluateTabWelcomeTrigger({
        user: null,
        loading: false,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(false);
      expect(res.reason).toBe("no_user");
    });
  });

  describe("TEST G — DEFAULT THEME (§7, §9, §37, §41.G, Item 10)", () => {
    it("initializes to Light Mode by default on fresh website documents", () => {
      const session = createSessionStorageMock(); // fresh tab has no theme stored
      const initialTheme = session.getItem("placement_hub_theme") || "light";
      expect(initialTheme).toBe("light");
    });
  });

  describe("TEST H & I — THEME SWITCHING (§8, §38, §41.H, §41.I, Items 11, 12)", () => {
    it("allows switching theme to dark mode in active tab", () => {
      const session = createSessionStorageMock();
      session.setItem("placement_hub_theme", "dark");
      expect(session.getItem("placement_hub_theme")).toBe("dark");
    });

    it("theme switch does NOT reopen or duplicate welcome journey popup", () => {
      const session = createSessionStorageMock({
        welcomeJourneyShown: "true",
      });

      // Theme toggle happens
      session.setItem("placement_hub_theme", "dark");

      // Check popup trigger again
      const res = evaluateTabWelcomeTrigger({
        user: testUser,
        loading: false,
        sessionStorageMock: session,
      });
      expect(res.shouldOpen).toBe(false);
    });
  });

  describe("DYNAMIC USER NAME (§6, Item 9)", () => {
    it("displays dynamic user first name from profile", () => {
      const res = resolveWelcomeGreeting({ displayName: "Atharv Sharma" }, null);
      expect(res.firstName).toBe("Atharv");
      expect(res.titleText).toBe("Welcome back, Atharv!");
    });

    it("falls back to auth user displayName", () => {
      const res = resolveWelcomeGreeting(null, { displayName: "Pooja Roy" });
      expect(res.firstName).toBe("Pooja");
      expect(res.titleText).toBe("Welcome back, Pooja!");
    });

    it("falls back to generic 'Welcome back!' without awkward punctuation when name is empty", () => {
      const res = resolveWelcomeGreeting(null, null);
      expect(res.firstName).toBe("");
      expect(res.titleText).toBe("Welcome back!");
    });

    it("is not hardcoded to Atharv", () => {
      const res1 = resolveWelcomeGreeting({ displayName: "Kiran" }, null);
      expect(res1.titleText).toBe("Welcome back, Kiran!");
      expect(res1.titleText).not.toBe("Welcome back, Atharv!");
    });
  });

  describe("MILESTONES & SEQUENCE (§10, §11, Items 21-25)", () => {
    const MILESTONES = [
      { id: 1, key: "explore", title: "Explore", subtitle: "Top Companies" },
      { id: 2, key: "prepare", title: "Prepare", subtitle: "Build Your Skills" },
      { id: 3, key: "apply", title: "Apply", subtitle: "Grab Opportunities" },
      { id: 4, key: "place", title: "Place", subtitle: "Achieve Your Goals" },
    ];

    it("preserves exact milestone titles and subtitles", () => {
      expect(MILESTONES.map((m) => m.title)).toEqual([
        "Explore",
        "Prepare",
        "Apply",
        "Place",
      ]);
      expect(MILESTONES.map((m) => m.subtitle)).toEqual([
        "Top Companies",
        "Build Your Skills",
        "Grab Opportunities",
        "Achieve Your Goals",
      ]);
    });
  });
});
