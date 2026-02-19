import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Homepage from "./pages/homepage.jsx";
import Account from "./pages/Account.jsx";
import Contact from "./pages/Contact.jsx";
import FAQs from "./pages/FAQs.jsx";
import Header from "./components/Header.jsx";
import Navigation from "./components/Navigation.jsx";

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col">
        <Header />
        <div className="m-2">
          <Navigation />
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/account" element={<Account />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faqs" element={<FAQs />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
