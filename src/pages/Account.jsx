import { useState, useEffect } from "react";
import Login from "../auth/login";
import Register from "../auth/register";
import SJC from "../assets/images/bgy.png";

function Image() {
  return (
    <div className="hidden md:block overflow-hidden h-full w-full bg-slate-900">
      <img
        src={SJC}
        alt="Barangay San Perfecto"
        className="w-full h-full object-cover opacity-60 mix-blend-overlay"
      />
    </div>
  );
}

function Account({ isRegistering }) {
  const [showLogin, setShowLogin] = useState(false);
  const [isRegisteringState, setIsRegisteringState] = useState(true);

  if (isRegistering) {
    setIsRegisteringState(true);
  }
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogin(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-8">
      <div className="w-full max-w-5xl rounded-3xl shadow-xl bg-white border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Image/Info Banner */}
        <div className="relative hidden md:block md:w-5/12">
          {showLogin && <Image />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 space-y-2 text-white">
            <p className="text-xs font-bold tracking-widest text-brand-red uppercase">
              Patient Portal
            </p>
            <p className="text-2xl font-bold leading-tight">
              Barangay San Perfecto <br/> Health Center
            </p>
            <p className="text-sm text-slate-300 mt-2">
              Securely access your health records and consultations online.
            </p>
          </div>
        </div>

        {/* Right Side: Auth Component */}
        <div className="md:w-7/12 flex items-center justify-center bg-white px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            {isRegisteringState ? (
              <Login setIsRegisteringState={setIsRegisteringState} />
            ) : (
              <Register setIsRegisteringState={setIsRegisteringState} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Account;
