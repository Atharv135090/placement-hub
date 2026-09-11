import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import {
  addApplication,
  updateApplication,
  addApplicationMessage,
  deleteApplicationMessage,
  addCompany,
  updateCompany,
  deleteCompany,
  createNotification,
  toggleSaveJob,
  getUserSavedIds,
} from "../services/firestore";

const PlacementDataContext = createContext(null);

export function usePlacementData() {
  const ctx = useContext(PlacementDataContext);
  if (!ctx) throw new Error("usePlacementData must be used within PlacementDataProvider");
  return ctx;
}

export function PlacementDataProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const companiesUnsub = useRef(null);
  const appsUnsub = useRef(null);
  const prevUid = useRef(null);

  // ── RESET ALL STATE when user changes ────────────────────────
  useEffect(() => {
    if (prevUid.current !== uid) {
      // Clean up old listeners
      companiesUnsub.current?.();
      appsUnsub.current?.();
      companiesUnsub.current = null;
      appsUnsub.current = null;

      // Reset all state
      setCompanies([]);
      setApplications([]);
      setSavedIds([]);
      setLoading(true);

      prevUid.current = uid;
    }
  }, [uid]);

  // ── COMPANIES listener (global, read-only for all users) ─────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const q = query(collection(db, "companies"));
    companiesUnsub.current = onSnapshot(q, (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Companies listener error:", err);
      setLoading(false);
    });
    return () => { companiesUnsub.current?.(); };
  }, [uid]);

  // ── APPLICATIONS listener (user-scoped) ──────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "applications"),
      where("userId", "==", uid)
    );
    appsUnsub.current = onSnapshot(q, (snap) => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Applications listener error:", err);
    });
    return () => { appsUnsub.current?.(); };
  }, [uid]);

  // ── SAVED IDs — load from Firestore on auth change ──────────
  useEffect(() => {
    if (!uid) {
      setSavedIds([]);
      return;
    }
    let cancelled = false;
    getUserSavedIds(uid).then(({ data }) => {
      if (!cancelled) setSavedIds(data || []);
    });
    return () => { cancelled = true; };
  }, [uid]);

  // ── STATS (derived from user-scoped applications) ───────────
  const stats = useMemo(() => {
    const total = applications.length;
    const shortlisted = applications.filter(a => a.status === "shortlisted").length;
    const interview = applications.filter(a => a.status === "interview").length;
    const offer = applications.filter(a => a.status === "offer" || a.status === "selected").length;
    const rejected = applications.filter(a => a.status === "rejected").length;
    const applied = applications.filter(a => a.status === "applied").length;
    return { total, shortlisted, interview, offer, selected: offer, rejected, applied };
  }, [applications]);

  const conversionMetrics = useMemo(() => {
    const total = applications.length || 1;
    return {
      applicationToShortlist: Math.round((stats.shortlisted / total) * 100),
      shortlistToInterview: Math.round((stats.interview / (stats.shortlisted || 1)) * 100),
      interviewToOffer: Math.round((stats.offer / (stats.interview || 1)) * 100),
    };
  }, [stats]);

  async function applyToDrive(jobId, companyName, role, compId) {
    const existing = applications.find(a => a.jobId === jobId || (compId && a.companyId === compId));
    if (existing) return { error: "already_applied", data: existing };
    const newApp = {
      id: `${uid}_${jobId}`,
      userId: uid,
      jobId,
      companyId: compId || null,
      companyName,
      role: role || "Open Role",
      status: "applied",
      appliedAt: new Date().toISOString(),
    };
    const res = await addApplication(newApp);
    if (res.error) return { error: res.error, data: null };
    return { data: newApp, error: null };
  }

  async function updateAppStatus(applicationId, newStatus) {
    const res = await updateApplication(applicationId, { status: newStatus, updatedAt: new Date().toISOString() });
    if (res.error) return { error: res.error };
    return { error: null };
  }

  async function removeApplication(applicationId) {
    const res = await updateApplication(applicationId, { status: "removed", updatedAt: new Date().toISOString() });
    if (res.error) return { error: res.error };
    return { error: null };
  }

  async function addMessageToApplication(applicationId, text) {
    return await addApplicationMessage(applicationId, { text });
  }

  async function deleteMessageFromApplication(applicationId, messageId) {
    return await deleteApplicationMessage(applicationId, messageId);
  }

  async function addNewCompany(data) {
    // PRD §17: Database data only used for duplicate check, not to fill missing fields
    const existing = companies.find(c => c.name.toLowerCase() === data.name.toLowerCase());
    if (existing) return { error: "exists", data: existing };
    // PRD §13: Fresh transaction object — only explicitly supplied values
    const newComp = {
      name: data.name,
      normalizedName: data.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      industry: data.industry || "",
      location: data.location || "",
      website: data.website || "",
      contactEmail: data.contactEmail || "",
      organisationSize: data.organisationSize || "",
      description: data.description || "",
      logoUrl: data.logoUrl || "",
      status: "active",
      isActive: true,
    };
    const res = await addCompany(newComp);
    if (res.error) return { error: res.error, data: null };
    createNotification({
      title: "New Company Added",
      message: `${data.name} has been added to the platform.`,
      type: "company",
      link: "/companies",
    }).catch(() => { });
    return { data: { id: res.data.id, ...newComp }, error: null };
  }

  async function updateExistingCompany(id, updates) {
    const res = await updateCompany(id, updates);
    if (res.error) return { error: res.error };
    return { data: { id }, error: null };
  }

  async function removeCompany(id) {
    const res = await deleteCompany(id);
    if (res.error) return { error: res.error };
    return { data: { id }, error: null };
  }

  // ── SAVED — persisted to Firestore under user document ──────
  const toggleSaveItem = useCallback(async (companyId) => {
    if (!uid) return;
    const isCurrentlySaved = savedIds.includes(companyId);
    // Optimistic update
    setSavedIds(prev =>
      isCurrentlySaved ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
    const res = await toggleSaveJob(uid, companyId, isCurrentlySaved);
    if (res.error) {
      // Revert on error
      setSavedIds(prev =>
        isCurrentlySaved ? [...prev, companyId] : prev.filter(id => id !== companyId)
      );
    }
  }, [uid, savedIds]);

  function isSaved(id) {
    return savedIds.includes(id);
  }

  const value = useMemo(() => ({
    companies,
    applications,
    savedIds,
    loading,
    stats,
    conversionMetrics,
    applyToDrive,
    updateAppStatus,
    removeApplication,
    addMessageToApplication,
    deleteMessageFromApplication,
    addNewCompany,
    updateExistingCompany,
    removeCompany,
    toggleSaveItem,
    isSaved,
  }), [companies, applications, savedIds, loading, stats, conversionMetrics, toggleSaveItem]);

  return (
    <PlacementDataContext.Provider value={value}>
      {children}
    </PlacementDataContext.Provider>
  );
}
