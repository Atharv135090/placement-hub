import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { AssistantProvider } from "./contexts/AssistantContext";
import { PlacementDataProvider } from "./contexts/PlacementDataContext";
import { ChatProvider } from "./contexts/ChatContext";
import AppShell from "./components/AppShell";
import AdminLayout from "./components/AdminLayout";
import ProtectedAdmin from "./components/ProtectedAdmin";
import "./App.css";

const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Home = lazy(() => import("./pages/Home"));
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const AddCompany = lazy(() => import("./pages/AddCompany"));
const Applications = lazy(() => import("./pages/Applications"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Attention = lazy(() => import("./pages/Attention"));
const Students = lazy(() => import("./pages/Students"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const Chat = lazy(() => import("./pages/Chat"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminCompanies = lazy(() => import("./pages/admin/Companies"));
const AdminApplications = lazy(() => import("./pages/admin/Applications"));
const AdminAnnouncements = lazy(() => import("./pages/admin/Announcements"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminAssistant = lazy(() => import("./pages/AdminAssistant"));
const WebsiteAnalytics = lazy(() => import("./pages/admin/WebsiteAnalytics"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const Unauthorized = lazy(() => import("./pages/admin/Unauthorized"));

function PageSpinner() {
  return (
    <div className="page-loader">
      <div className="loader-spinner" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageSpinner />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <AssistantProvider>
      <PlacementDataProvider>
        <ChatProvider>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
            <Route element={<AppShell />}>
              {/* 01. Dashboard */}
              <Route path="/" element={<Home />} />

              {/* 02. Companies */}
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:companyId" element={<CompanyDetail />} />
              <Route path="/companies/new" element={<AddCompany />} />

              {/* 03. Applications */}
              <Route path="/applications" element={<Applications />} />

              {/* 04. Placement Assistant */}
              <Route path="/assistant" element={<Assistant />} />

              {/* 05. Analytics */}
              <Route path="/analytics" element={<Analytics />} />

              {/* 06. Students */}
              <Route path="/students" element={<Students />} />
              <Route path="/students/:studentId" element={<StudentProfile />} />

              {/* 07. Chat */}
              <Route path="/chat" element={<Chat />} />

              {/* 08. Profile & Settings */}
              <Route path="/profile" element={<Settings />} />
              <Route path="/settings" element={<Settings />} />

              {/* Ancillary routes */}
              <Route path="/attention" element={<Attention />} />
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            {/* Admin protected routes */}
            <Route path="/admin" element={<ProtectedAdmin><AdminLayout /></ProtectedAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="chatbot" element={<AdminAssistant />} />
              <Route path="analytics" element={<WebsiteAnalytics />} />
              <Route path="companies" element={<AdminCompanies />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="users" element={<ProtectedAdmin ownerOnly><AdminUsers /></ProtectedAdmin>} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="unauthorized" element={<Unauthorized />} />
              <Route path="drives" element={<Navigate to="/admin/companies" replace />} />
            </Route>

            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/drives" element={<Navigate to="/companies" replace />} />
            <Route path="/timeline" element={<Navigate to="/companies" replace />} />
            <Route path="/saved" element={<Navigate to="/companies" replace />} />
            <Route path="/calendar" element={<Navigate to="/applications" replace />} />
            <Route path="/resources" element={<Navigate to="/companies" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ChatProvider>
      </PlacementDataProvider>
    </AssistantProvider>
  );
}
