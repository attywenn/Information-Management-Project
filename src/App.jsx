import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./context/useAuth.js";
import Homepage from "./pages/homepage.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import FAQs from "./pages/FAQs.jsx";
import Header from "./components/Header.jsx";
import UserDashboard from "./dashboard/userDashboard.jsx";
import { supabase } from "./utils/supabase.js";

// Initialize avatars bucket on app start
async function initializeAvatarsBucket() {
  try {
    await supabase.functions.invoke("ensure-avatars-bucket", {
      method: "POST",
    });
    console.log("Avatars bucket initialized");
  } catch (error) {
    console.warn("Could not initialize avatars bucket on startup:", error);
  }
}

/** Layout for all public landing pages (header + main content area). */
function LandingLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-1 w-full mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

/** Layout route that redirects unauthenticated users to /account. */
function RequireAuth() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Outlet /> : <Navigate to="/account" replace />;
}

function AppContent() {
  const { isLoggedIn, user } = useAuth();

  useEffect(() => {
    const theme = user?.theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.toggle("dark-mode", theme === "dark");
  }, [user?.theme]);

  // Initialize avatars bucket on app startup for all roles
  useEffect(() => {
    initializeAvatarsBucket();
  }, []);

  return (
    <Routes>
      {/* Public landing pages */}
      <Route element={<LandingLayout />}>
        <Route path="/" element={<Homepage />} />
        <Route path="/account" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faqs" element={<FAQs />} />
      </Route>

      {/* Protected dashboard pages — all rendered by UserDashboard which
          uses useLocation() internally to show the correct section. */}
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/schedules" element={<UserDashboard />} />
        <Route path="/history" element={<UserDashboard />} />
        <Route path="/consultation" element={<UserDashboard />} />
        <Route path="/inventory" element={<UserDashboard />} />
        <Route path="/faqs-dashboard" element={<UserDashboard />} />
        <Route path="/inbox" element={<UserDashboard />} />
        <Route path="/settings" element={<UserDashboard />} />
        <Route path="/manage-accounts" element={<UserDashboard />} />
        <Route path="/patient-accounts" element={<UserDashboard />} />
        <Route path="/health-worker-accounts" element={<UserDashboard />} />
      </Route>

      {/* Catch-all: send logged-in users to dashboard, others to home */}
      <Route
        path="*"
        element={<Navigate to={isLoggedIn ? "/dashboard" : "/"} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;