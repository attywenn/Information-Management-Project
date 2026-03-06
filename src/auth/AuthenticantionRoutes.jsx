import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./login.jsx";
import Register from "./register.jsx";

function AuthenticationRoutes() {
  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> 
      </Routes>
  );
}

export default AuthenticationRoutes;