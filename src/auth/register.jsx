import { useState } from "react";

function Register({ setIsRegisteringState }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [surname, setSurname] = useState("");
    const [firstname, setFirstname] = useState("");
    const [middlename, setMiddlename] = useState("");
    const [dob, setDob] = useState("");
    const [address, setAddress] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [profileImage, setProfileImage] = useState(null);
    const [identityImage, setIdentityImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsSubmitting(true);

        try {
            // Frontend-only mode: keep UX flow without sending data to backend.
            await new Promise((resolve) => setTimeout(resolve, 350));

            setSuccess("Registration saved locally for UI testing. You can now log in.");
            setUsername("");
            setPassword("");
            setConfirmPassword("");
            setSurname("");
            setFirstname("");
            setMiddlename("");
            setDob("");
            setAddress("");
            setContactNumber("");
            setProfileImage(null);
            setIdentityImage(null);
            setTimeout(() => setIsRegisteringState(true), 1500);
        } catch {
            setError("Unable to complete registration. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all";
    const labelClass = "text-xs font-semibold text-slate-700 block mb-1";

    return (
        <div className="flex flex-col w-full max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Account</h1>
            <p className="text-sm text-slate-600 mb-6">
                Register as a patient. Health worker accounts are created by an admin.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium border border-green-200">
                        {success}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Basic Account Info */}
                    <div>
                        <label className={labelClass} htmlFor="reg-username">Username</label>
                        <input id="reg-username" type="text" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="reg-password">Password</label>
                            <input id="reg-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-confirm-password">Confirm Password</label>
                            <input id="reg-confirm-password" type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        </div>
                    </div>

                    <hr className="border-slate-200" />

                    {/* Personal Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="reg-firstname">First Name</label>
                            <input id="reg-firstname" type="text" className={inputClass} value={firstname} onChange={(e) => setFirstname(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-surname">Surname</label>
                            <input id="reg-surname" type="text" className={inputClass} value={surname} onChange={(e) => setSurname(e.target.value)} required />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="reg-middlename">Middle Name (Optional)</label>
                            <input id="reg-middlename" type="text" className={inputClass} value={middlename} onChange={(e) => setMiddlename(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-dob">Birthdate</label>
                            <input id="reg-dob" type="date" className={inputClass} value={dob} onChange={(e) => setDob(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="reg-contact">Contact Number</label>
                        <input id="reg-contact" type="text" className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required />
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="reg-address">Full Address</label>
                        <textarea id="reg-address" className={`${inputClass} resize-none h-20`} value={address} onChange={(e) => setAddress(e.target.value)} required />
                    </div>

                    <hr className="border-slate-200" />

                    <div>
                        <label className={labelClass} htmlFor="reg-profile-image">Profile Image (Optional)</label>
                        <input id="reg-profile-image" type="file" accept="image/*" className={`${inputClass} p-1.5`} onChange={(e) => setProfileImage(e.target.files?.[0] || null)} />
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="reg-identity-image">Proof of Identity (Optional)</label>
                        <input id="reg-identity-image" type="file" accept="image/*" className={`${inputClass} p-1.5`} onChange={(e) => setIdentityImage(e.target.files?.[0] || null)} />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-6 w-full bg-brand-red text-white font-semibold py-3 rounded-xl hover:bg-brand-dark transition-all focus:ring-4 focus:ring-red-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Registering..." : "Create Account"}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 pb-4">
                Already have an account?{" "}
                <button 
                    onClick={() => setIsRegisteringState(true)} 
                    className="font-semibold text-brand-red hover:text-brand-dark transition-colors"
                >
                    Sign in here
                </button>
            </div>
            
            {/* simple style for custom-scrollbar so it doesn't look ugly inline */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}

export default Register;