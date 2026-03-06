import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Login({ setIsRegisteringState }) {
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");  
  const [IsLoggedIn, setIsLoggedInState] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {
        "Content-Type" : "application/json",
      },
      body : JSON.stringify({
        accountId,
        password,
        dob
      }),
    });

    const data = await response.json();
    if (data.success) {
      alert("Login successful!");
      // Redirect to dashboard or another page
      setIsLoggedIn(true);
    } else {
      alert(`Login failed: ${data.message}`);
    }

  };

  return (
    <div className="flex flex-col items-center justify-center mt-8 font-[roboto] text-center bg-white border border-red-950 p-6 rounded-lg w-full max-w-sm md:bg-white/5 md:border-none">
      <h1 className="text-2xl font-bold mb-4 text-black">Login as Patient</h1>
      <p className="mt-1 text-center max-w-[20rem] font-bold text-black/70">
        Login with your credentials provided by the Barangay Health Center System
        administrator.
      </p>

      <form className="flex flex-col items-center mt-2" onSubmit={handleSubmit}>
        <label htmlFor="accountId" className="font-bold">
          Account ID
        </label>
        <input
          id="accountId"
          type="text"
          placeholder="Account ID"
          className="mb-2 p-2 border border-red-950 rounded"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
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
        />

        <label htmlFor="dob" className="font-bold ">
          Birthdate
        </label>
        <input
          type="date"
          id="dob"
          className="mb-4 p-2 border border-red-950 rounded"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <button
          type="submit"
          className="font-bold bg-red-950 text-white px-4 py-2 rounded hover:bg-red-800"
        >
          Login
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