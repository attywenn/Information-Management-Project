import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Homepage from "./pages/homepage.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import FAQs from "./pages/FAQs.jsx";
import Header from "./components/Header.jsx";
import Navigation from "./components/Navigation.jsx";
import UserDashboard from "./dashboard/userDashboard.jsx";

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
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      {[
        "/dashboard",
        "/profile",
        "/schedules",
        "/history",
        "/faqs-dashboard",
        "/inbox",
        "/settings",
        "/manage-accounts",
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