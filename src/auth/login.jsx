import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { recoverPasswordWithSecurityAnswer, signInPortalAccount, signOutPortalAccount, initiateOtpForCurrentSession, verifyOtpForCurrentSession } from "../services/supabaseBackendService.js";

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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [otpPending, setOtpPending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [tempSession, setTempSession] = useState(null);
  const [tempProfile, setTempProfile] = useState(null);
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
      // Removed non-SMS admin OTP step; proceed to credential verification

      const loginIdentifier = role === "admin" ? (adminId || email) : identifier;
      const { session, profile } = await signInPortalAccount({
        identifier: loginIdentifier,
        password,
        role,
        dob,
      });

      if (role === "health_worker" && systemLicenseNumber.trim() && profile.workerId && profile.workerId !== systemLicenseNumber.trim()) {
        await signOutPortalAccount();
        setError("Health Worker ID does not match account record.");
        return;
      }

      if (role === "admin") {
        if (adminId.trim() && profile.adminId && profile.adminId !== adminId.trim()) {
          await signOutPortalAccount();
          setError("Admin ID does not match account record.");
          return;
        }
        if (pinCode && profile.pinCode && profile.pinCode !== pinCode) {
          await signOutPortalAccount();
          setError("PINCODE is incorrect.");
          return;
        }
      }

      // Hold session and profile temporarily while OTP verification completes
      setTempSession(session);
      setTempProfile(profile);
      setOtpPending(true);
      setOtpError("");
      setOtpMessage("Sending OTP...");

      const resolvedPhone = profile?.phone || profile?.contactNumber || "";

      try {
        await initiateOtpForCurrentSession({
          phone: resolvedPhone,
        });
        setOtpMessage("OTP sent. Check your phone and enter the code.");
      } catch (initErr) {
        setOtpPending(false);
        setTempSession(null);
        setTempProfile(null);
        await signOutPortalAccount();
        throw initErr;
      }
    } catch (submitError) {
      setError(submitError?.message || "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setIsSubmitting(true);

    try {
      const normalizedOtpCode = otpCode.replace(/\D/g, "").trim();
      if (!normalizedOtpCode) {
        setOtpError("Please enter the OTP sent to your phone.");
        return;
      }

      await verifyOtpForCurrentSession({ code: normalizedOtpCode });

      // success: finalize login
      login({
        ...tempProfile,
        token: tempSession.access_token,
      });
      setOtpPending(false);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setOtpError(err?.message || "OTP verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelOtpFlow = async () => {
    try {
      await signOutPortalAccount();
    } catch (cancelError) {
      console.warn("Failed to sign out during OTP cancellation.", cancelError);
    }
    setOtpPending(false);
    setTempProfile(null);
    setTempSession(null);
    setOtpCode("");
    setOtpError("");
    setOtpMessage("");
  };

  

  const handleRecoverPassword = async (e) => {
    e.preventDefault();
    setRecoverError("");
    setRecoverMessage("");

    try {
      const accountRole = role === "health_worker" ? "health_worker" : "patient";
      await recoverPasswordWithSecurityAnswer({
        identifier: recoverIdentifier,
        role: accountRole,
        dob,
        securityQuestion: recoverQuestion,
        securityAnswer: recoverAnswer,
      });

      setRecoverMessage("Password reset email has been sent. Please check your inbox.");
    } catch (recoverException) {
      setRecoverError(recoverException?.message || "Unable to recover password right now.");
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
            {/* Admin non-SMS OTP removed; admins will receive SMS OTP after signing in */}
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

      {otpPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Enter OTP</h3>
              <button type="button" onClick={cancelOtpFlow} className="text-sm text-slate-600">Cancel</button>
            </div>
            <p className="text-sm text-slate-600 mt-2">{otpMessage || "A 6-digit code has been sent to your phone."}</p>
            {otpError && <p className="text-sm text-red-600 mt-3">{otpError}</p>}
            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                placeholder="Enter 6-digit OTP"
                className="w-full p-3 border rounded-lg text-lg text-center"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-red text-white py-2 rounded-lg">
                  {isSubmitting ? "Verifying..." : "Verify OTP"}
                </button>
                <button type="button" onClick={cancelOtpFlow} className="flex-1 border rounded-lg py-2">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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