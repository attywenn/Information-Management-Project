import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

const ACCOUNTS_STORAGE_KEY = "sanperfecto-accounts";
const ADMIN_OTP_STORAGE_KEY = "sanperfecto-admin-otp";

const loadAccounts = () => {
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const findPatientAccount = ({ identifier, email }) => {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  return loadAccounts().find((account) => {
    if (account.role !== "patient") {
      return false;
    }

    const accountIdentifiers = [account.username, account.email, account.patientCode, account.patientId]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return accountIdentifiers.includes(normalizedIdentifier) || (normalizedEmail && accountIdentifiers.includes(normalizedEmail));
  }) || null;
};

function Login({ setIsRegisteringState }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState("patient");
  const [systemLicenseNumber, setSystemLicenseNumber] = useState("");
  const [adminId, setAdminId] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [adminStep, setAdminStep] = useState("credentials");
  const [adminOtpMessage, setAdminOtpMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoverIdentifier, setRecoverIdentifier] = useState("");
  const [recoverQuestion, setRecoverQuestion] = useState("");
  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [recoverError, setRecoverError] = useState("");
  const [recoverMessage, setRecoverMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Frontend-only mode: simulate a short login delay without backend calls.
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (role === "patient") {
        const storedPatient = findPatientAccount({ identifier, email });
        const patientCode = storedPatient?.patientCode || storedPatient?.patientId || `PATIENT${String(Date.now()).slice(-12).padStart(12, "0")}`;

        login({
          username: storedPatient?.username || identifier || email || "patient.user",
          role: "patient",
          displayName: storedPatient?.displayName || storedPatient?.firstname || identifier || email || "Patient",
          patientCode,
          patientId: patientCode,
          surname: storedPatient?.surname || "",
          firstname: storedPatient?.firstname || "",
          middlename: storedPatient?.middlename || "",
          email: storedPatient?.email || email || identifier || "",
          password: storedPatient?.password || password,
          dob: storedPatient?.dob || dob,
          address: storedPatient?.address || null,
          fullAddress: storedPatient?.fullAddress || "",
          contactNumber: storedPatient?.contactNumber || "",
          securityQuestion: storedPatient?.securityQuestion || "",
          securityAnswer: storedPatient?.securityAnswer || "",
          token: "frontend-only-session",
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      if (role === "health_worker") {
        login({
          username: identifier || email || "health.worker",
          role: "health_worker",
          displayName: identifier || email || "Health Worker",
          workerId: identifier || `HW-${String(Date.now()).slice(-6)}`,
          email: email || identifier || "",
          password,
          dob,
          systemLicenseNumber,
          token: "frontend-only-session",
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      if (adminStep === "credentials") {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        window.localStorage.setItem(ADMIN_OTP_STORAGE_KEY, otp);
        setAdminStep("otp");
        setAdminOtpMessage(`OTP sent to ${email || "your email"}. Demo OTP: ${otp}`);
        return;
      }

      window.localStorage.removeItem(ADMIN_OTP_STORAGE_KEY);
      login({
        username: adminId || email || "admin.user",
        role: "admin",
        displayName: adminId || email || "Administrator",
        adminId: adminId || `ADMIN-${String(Date.now()).slice(-6)}`,
        email: email || "",
        password,
        dob,
        pinCode,
        token: "frontend-only-session",
      });
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAdminStep = () => {
    setAdminStep("credentials");
    setAdminOtp("");
    setAdminOtpMessage("");
    window.localStorage.removeItem(ADMIN_OTP_STORAGE_KEY);
  };

  const handleRecoverPassword = (e) => {
    e.preventDefault();
    setRecoverError("");
    setRecoverMessage("");

    try {
      const accounts = JSON.parse(window.localStorage.getItem(ACCOUNTS_STORAGE_KEY) || "[]");
      const accountRole = role === "health_worker" ? "health_worker" : "patient";
      const matchedAccount = accounts.find(
        (account) =>
          account.role === accountRole &&
          (
            accountRole === "patient"
              ? (account.patientCode === recoverIdentifier || account.patientId === recoverIdentifier || account.email === recoverIdentifier)
              : (account.workerId === recoverIdentifier || account.email === recoverIdentifier)
          )
      );

      if (!matchedAccount) {
        setRecoverError(
          accountRole === "patient"
            ? "No patient account found for that Patient ID or email."
            : "No health worker account found for that Health Worker ID or email."
        );
        return;
      }

      if (!matchedAccount.securityQuestion || !matchedAccount.securityAnswer) {
        setRecoverError("This account does not have a security question yet.");
        return;
      }

      if (matchedAccount.securityQuestion !== recoverQuestion) {
        setRecoverError("Selected question does not match the account's chosen security question.");
        return;
      }

      if ((matchedAccount.securityAnswer || "").trim().toLowerCase() !== recoverAnswer.trim().toLowerCase()) {
        setRecoverError("Incorrect answer. Please try again.");
        return;
      }

      setRecoverMessage(`Password recovered successfully. Your password is: ${matchedAccount.password || "(not set)"}`);
    } catch {
      setRecoverError("Unable to recover password right now.");
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
            onChange={(e) => {
              setRole(e.target.value);
              setError("");
              resetAdminStep();
            }}
          >
            <option value="patient">Patient</option>
            <option value="health_worker">Health Worker</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        {(role === "patient" || role === "health_worker") && (
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-sm font-semibold text-slate-700">
              {role === "patient" ? "Patient ID or Email" : "Worker ID or Email"}
            </label>
            <input
              id="identifier"
              type="text"
              placeholder={role === "patient" ? "PATIENT000000000000 or email" : "Worker ID or email"}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
        )}

        {role === "admin" && (
          <div className="space-y-1.5">
            <label htmlFor="admin-id" className="text-sm font-semibold text-slate-700">
              Admin ID
            </label>
            <input
              id="admin-id"
              type="text"
              placeholder="ADMIN-0001"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              required
            />
          </div>
        )}

        {role === "admin" && (
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              placeholder="admin@sanperfecto.gov.ph"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

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
            <label htmlFor="system-license" className="text-sm font-semibold text-slate-700">
              System License Number
            </label>
            <input
              id="system-license"
              type="text"
              placeholder="Enter your system license number"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all"
              value={systemLicenseNumber}
              onChange={(e) => setSystemLicenseNumber(e.target.value)}
              required
            />
          </div>
        )}

        {(role === "patient" || role === "health_worker" || role === "admin") && (
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
              <label htmlFor="admin-pin" className="text-sm font-semibold text-slate-700">
                PINCODE
              </label>
              <input
                id="admin-pin"
                type="password"
                inputMode="numeric"
                placeholder="Enter your PINCODE"
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                required
              />
            </div>
            {adminStep === "otp" && (
              <div className="space-y-1.5">
                <label htmlFor="admin-otp" className="text-sm font-semibold text-slate-700">
                  OTP
                </label>
                <input
                  id="admin-otp"
                  type="text"
                  placeholder="Enter OTP sent to email"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                  value={adminOtp}
                  onChange={(e) => setAdminOtp(e.target.value)}
                  required
                />
              </div>
            )}
            {adminOtpMessage && <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100">{adminOtpMessage}</p>}
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
        <button
          type="button"
          onClick={() => {
            setShowForgotPassword((prev) => !prev);
            setRecoverError("");
            setRecoverMessage("");
          }}
          className="font-semibold text-brand-red hover:text-brand-dark transition-colors"
        >
          Forgot Password?
        </button>
      </div>

      {showForgotPassword && (
        role === "admin" ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Admin Password Assistance</p>
            <p className="text-sm text-slate-700">
              If you forgot your password, send an email to the developer immediately: wnciplays@gmail.com
            </p>
          </div>
        ) : (
          <form onSubmit={handleRecoverPassword} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              {role === "health_worker" ? "Health Worker Password Recovery" : "Patient Password Recovery"}
            </p>
            <div>
              <label htmlFor="recover-identifier" className="text-xs font-semibold text-slate-700 block mb-1">
                {role === "health_worker" ? "Health Worker ID or Email" : "Patient ID or Email"}
              </label>
              <input
                id="recover-identifier"
                type="text"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                value={recoverIdentifier}
                onChange={(e) => setRecoverIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="recover-question" className="text-xs font-semibold text-slate-700 block mb-1">
                Security Question
              </label>
              <select
                id="recover-question"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                value={recoverQuestion}
                onChange={(e) => setRecoverQuestion(e.target.value)}
                required
              >
                <option value="">Select your question</option>
                <option value="Name of your cat">Name of your cat</option>
                <option value="Favorite actor/actress">Favorite actor/actress</option>
                <option value="Favorite food">Favorite food</option>
                <option value="Name of your first school">Name of your first school</option>
                <option value="Your childhood nickname">Your childhood nickname</option>
              </select>
            </div>
            <div>
              <label htmlFor="recover-answer" className="text-xs font-semibold text-slate-700 block mb-1">
                Answer
              </label>
              <input
                id="recover-answer"
                type="text"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                value={recoverAnswer}
                onChange={(e) => setRecoverAnswer(e.target.value)}
                required
              />
            </div>
            {recoverError && <p className="text-sm text-red-600">{recoverError}</p>}
            {recoverMessage && <p className="text-sm text-green-700">{recoverMessage}</p>}
            <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800">
              Recover Password
            </button>
          </form>
        )
      )}

      <div className="mt-6 text-center text-sm text-slate-600">
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