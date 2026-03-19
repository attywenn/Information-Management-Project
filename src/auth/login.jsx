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
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          dob: role === "patient" ? dob : undefined,
          role,
          q1: role === "admin" ? adminQ1 : undefined,
          q2: role === "admin" ? adminQ2 : undefined,
          q3: role === "admin" ? adminQ3 : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Backend responds with { success, message, user: { username, role }, token }
        login({
          username: data.user?.username,
          role: data.user?.role,
          token: data.token,
        });
        navigate("/dashboard", { replace: true });
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError(err.message || "Network error. Is the backend running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center mt-8 font-[roboto] text-center bg-white border border-red-950 p-6 rounded-lg w-full max-w-sm md:bg-white/5 md:border-none">
      <h1 className="text-2xl font-bold mb-4 text-black">Login</h1>
      <p className="mt-1 text-center max-w-[20rem] font-bold text-black/70">
        Login with your credentials provided by the Barangay Health Center System
        administrator.
      </p>

      <form className="flex flex-col items-center mt-2" onSubmit={handleSubmit}>
        {error && (
          <p className="mb-2 text-sm text-red-600 font-medium">{error}</p>
        )}
        <label htmlFor="username" className="font-bold">
          Username {role === "admin" ? "or Email" : ""}
        </label>
        <input
          id="username"
          type="text"
          placeholder={role === "admin" ? "Username or Email" : "Username"}
          className="mb-2 p-2 border border-red-950 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label htmlFor="password" className="font-bold">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="Password"
          className="mb-4 p-2 border border-red-950 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {role === "patient" && (
          <>
            <label htmlFor="dob" className="font-bold ">
              Birthdate
            </label>
            <input
              type="date"
              id="dob"
              className="mb-4 p-2 border border-red-950 rounded"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </>
        )}

        {role === "admin" && (
          <>
            <label htmlFor="admin-q1" className="font-bold">
              Admin security 1
            </label>
            <input
              id="admin-q1"
              type="password"
              inputMode="numeric"
              className="mb-2 p-2 border border-red-950 rounded"
              value={adminQ1}
              onChange={(e) => setAdminQ1(e.target.value)}
              required
            />

            <label htmlFor="admin-q2" className="font-bold">
              Admin security 2
            </label>
            <input
              id="admin-q2"
              type="password"
              className="mb-2 p-2 border border-red-950 rounded"
              value={adminQ2}
              onChange={(e) => setAdminQ2(e.target.value)}
              required
            />

            <label htmlFor="admin-q3" className="font-bold">
              Admin security 3
            </label>
            <input
              id="admin-q3"
              type="password"
              className="mb-4 p-2 border border-red-950 rounded"
              value={adminQ3}
              onChange={(e) => setAdminQ3(e.target.value)}
              required
            />
          </>
        )}
        <label htmlFor="role" className="font-bold">
          Role
        </label>
        <select
          id="role"
          className="mb-4 p-2 border border-red-950 rounded w-full"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="patient">Patient</option>
          <option value="health_worker">Health Worker</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="font-bold bg-red-950 text-white px-4 py-2 rounded hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

      </form>
      <p className="text-black/80 mt-5 text-center max-w-[20rem]">
        No account?{" "}
        <span className="text-black font-bold">
          <button onClick={() => setIsRegisteringState(false)} className="underline">
            Register here
          </button>
        </span>
      </p>
    </div>
  );
}

export default Login;