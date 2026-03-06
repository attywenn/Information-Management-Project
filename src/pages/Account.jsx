import { useState, useEffect } from "react";

import Login from "../auth/login";
import Register from "../auth/register";
import SJC from "../assets/images/bgy.png";

function Image() {
  return (
    <div className="hidden md:block overflow-hidden h-full w-full">
      <img
        src={SJC}
        alt="SJC"
        className="w-full h-full object-cover opacity-75"
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
    <div className="min-h-[50rem] bg-gradient-to-b from-red-800/10 via-black/5 to-white flex items-center justify-center px-4 py-8 font-[roboto]">
      <div className="w-full max-w-5xl rounded-2xl shadow-2xl bg-white/95 border border-red-900/20 border-t-4 border-t-red-800 overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative hidden md:block">
            {showLogin && <Image />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 space-y-1 text-white">
              <p className="text-xs font-semibold tracking-[0.2em] text-red-200 uppercase">
                Barangay San Perfecto
              </p>
              <p className="text-lg font-bold leading-snug">
                Health Center Patient Portal
              </p>
              <p className="text-sm text-white/90 max-w-xs">
                Sign in to securely access your health center records and
                appointment details.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white px-4 py-8 sm:px-8">
            {isRegisteringState ? <Login setIsRegisteringState={setIsRegisteringState} /> : <Register setIsRegisteringState={setIsRegisteringState} /> }
          </div>
        </div>
      </div>
    </div>
  );
}

export default Account;
