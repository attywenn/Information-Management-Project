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
    <div className="flex flex-col">
      <Header />
      <div className="m-2">
        <Navigation />
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/account" element={<Account />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faqs" element={<FAQs />} />
          <Route path="*" element={<Homepage />} />
        </Routes>
      </div>
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
        "/contact-us",
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