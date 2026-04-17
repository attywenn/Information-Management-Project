import { useState } from "react";
import Login from "../auth/login";
import Register from "../auth/register";
import SJC from "../assets/images/bgy.png";

function Account() {
  // true = show Login form, false = show Register form
  const [isRegisteringState, setIsRegisteringState] = useState(true);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-8">
      <div className="w-full max-w-5xl rounded-3xl shadow-xl bg-white border border-slate-200 overflow-hidden flex flex-col md:flex-row">

        {/* Left Side: Image/Info Banner */}
        <div className="relative hidden md:block md:w-5/12 bg-slate-900">
          <img
            src={SJC}
            alt="Barangay San Perfecto"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 space-y-2 text-white">
            <p className="text-xs font-bold tracking-widest text-red-400 uppercase">
              Patient Portal
            </p>
            <p className="text-2xl font-bold leading-tight">
              Barangay San Perfecto <br /> Health Center
            </p>
            <p className="text-sm text-slate-300 mt-2">
              Resident's portal for digitalized health services
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
