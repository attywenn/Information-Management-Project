import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function Login({ setIsRegisteringState }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState("patient");
  const [hwID, setHwID] = useState("");
  const [adminQ1, setAdminQ1] = useState("");
  const [adminQ2, setAdminQ2] = useState("");
  const [adminQ3, setAdminQ3] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Frontend-only mode: simulate a short login delay without backend calls.
      await new Promise((resolve) => setTimeout(resolve, 350));

      login({
        username,
        role,
        token: "frontend-only-session",
      });
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h1>
      <p className="text-slate-600 mb-6 leading-relaxed">
        Sign in with your credentials to access the portal.
      </p>

      <form className="flex flex-col space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        {/* Role Selector */}
        <div className="space-y-1.5">
          <label htmlFor="role" className="text-sm font-semibold text-slate-700">
            Account Type
          </label>
          <select
            id="role"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="patient">Patient</option>
            <option value="health_worker">Health Worker</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="username" className="text-sm font-semibold text-slate-700">
            {role === "admin" ? "Username or Email" : "Username"}
          </label>
          <input
            id="username"
            type="text"
            placeholder={role === "admin" ? "admin@sanperfecto.gov.ph" : "Enter your username"}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {role === "health_worker" && (
          <div className="space-y-1.5">
            <label htmlFor="hw-q1" className="text-sm font-semibold text-slate-700">
              Health Worker ID
            </label>
            <input
              id="hw-q1"
              type="text"
              placeholder="Enter your Health Worker ID"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={hwID}
              onChange={(e) => setHwID(e.target.value)}
              required
            />
          </div>
        )}

        {role === "patient" && (
          <div className="space-y-1.5">
            <label htmlFor="dob" className="text-sm font-semibold text-slate-700">
              Birthdate
            </label>
            <input
              type="date"
              id="dob"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
        )}

        {role === "admin" && (
          <div className="space-y-4 p-4 mt-2 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin Security Verification</p>
            <div className="space-y-1.5">
              <input
                id="admin-q1"
                type="password"
                inputMode="numeric"
                placeholder="Security Pin 1"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                value={adminQ1}
                onChange={(e) => setAdminQ1(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <input
                id="admin-q2"
                type="password"
                placeholder="Security Pin 2"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                value={adminQ2}
                onChange={(e) => setAdminQ2(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <input
                id="admin-q3"
                type="password"
                placeholder="Security Pin 3"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                value={adminQ3}
                onChange={(e) => setAdminQ3(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full bg-brand-red text-white font-semibold py-3 rounded-xl hover:bg-brand-dark transition-all focus:ring-4 focus:ring-red-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-600">
        Don't have an account?{" "}
        <button 
          onClick={() => setIsRegisteringState(false)} 
          className="font-semibold text-brand-red hover:text-brand-dark transition-colors"
        >
          Create patient account
        </button>
      </div>
    </div>
  );
}

export default Login;