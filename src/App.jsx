import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { useAuth } from "./context/useAuth.js";
import Homepage from "./pages/homepage.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import FAQs from "./pages/FAQs.jsx";
import Header from "./components/Header.jsx";
import Navigation from "./components/Navigation.jsx";
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

function Landing() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <Navigation />
      <main className="flex-1 w-full mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/account" element={<Account />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faqs" element={<FAQs />} />
          <Route path="*" element={<Homepage />} />
        </Routes>
      </main>
    </div>
  );
}

function Dashboard() {
  return <UserDashboard />;
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
      {[
        "/dashboard",
        "/schedules",
        "/history",
        "/consultation",
        "/inventory",
        "/faqs-dashboard",
        "/inbox",
        "/settings",
        "/manage-accounts",
        "/patient-accounts",
        "/health-worker-accounts",
      ].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            isLoggedIn ? (
              <Dashboard />
            ) : (
              <Navigate to="/account" replace />
            )
          }
        />
      ))}
      <Route path="*" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Landing />} />
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