import React from "react";
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Homepage from "./pages/homepage.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import FAQs from "./pages/FAQs.jsx";
import Header from "./components/Header.jsx";
import Navigation from "./components/Navigation.jsx";
import Login from "./auth/login.jsx"

function Landing() {
  return (
    <BrowserRouter>
      <div className="flex flex-col">
        <Header />
        <div className="m-2">
          <Navigation />
          <Routes>
            <Route path="/homepage" element={<Homepage />} />
            <Route path="/account" element={<Account />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faqs" element={<FAQs />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

function Dashboard() {
  
  return (
    <>
    </>
  );
}

function App () {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <>
      {isLoggedIn ? (
        <Dashboard />
      ) : (
        <Landing /> 
      )}
    
    </>
  );
}

export default App;
