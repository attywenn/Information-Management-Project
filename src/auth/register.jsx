import { useState } from "react";
import { lookupLoginIdentity, registerPatientAccount } from "../services/supabaseBackendService.js";

const SECURITY_QUESTIONS = [
    "Name of your cat",
    "Favorite actor/actress",
    "Favorite food",
    "Name of your first school",
    "Your childhood nickname",
];

const KEYBOARD_SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const KEYBOARD_ALLOWED_PATTERN = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;

const evaluatePasswordStrength = (password) => {
    const safe = String(password || "");
    let score = 0;

    if (safe.length >= 8) score += 1;
    if (safe.length >= 12) score += 1;
    if (/[A-Z]/.test(safe)) score += 1;
    if (/[a-z]/.test(safe)) score += 1;
    if (/\d/.test(safe)) score += 1;
    if (KEYBOARD_SPECIAL_CHAR_PATTERN.test(safe)) score += 1;

    if (score <= 2) {
        return { label: "Weak", textClass: "text-red-600", barClass: "bg-red-500", widthClass: "w-1/3" };
    }
    if (score <= 4) {
        return { label: "Medium", textClass: "text-amber-600", barClass: "bg-amber-500", widthClass: "w-2/3" };
    }
    return { label: "Strong", textClass: "text-emerald-600", barClass: "bg-emerald-500", widthClass: "w-full" };
};

const validatePasswordPolicy = (password) => {
    if (!password) return "Password is required.";
    if (password.includes(" ")) return "Spaces are not allowed in password.";
    if (!KEYBOARD_ALLOWED_PATTERN.test(password)) {
        return "Use only letters, numbers, and common keyboard symbols in password.";
    }
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (!KEYBOARD_SPECIAL_CHAR_PATTERN.test(password)) {
        return "Password must contain at least one special character.";
    }
    return "";
};

function Register({ setIsRegisteringState }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [surname, setSurname] = useState("");
    const [firstname, setFirstname] = useState("");
    const [middlename, setMiddlename] = useState("");
    const [dob, setDob] = useState("");
    const [houseNumber, setHouseNumber] = useState("");
    const [street, setStreet] = useState("");
    const [purokSubdivision, setPurokSubdivision] = useState("");
    const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [securityAnswer, setSecurityAnswer] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const passwordStrength = evaluatePasswordStrength(password);
    const passwordRuleError = validatePasswordPolicy(password);
    const hasConfirmPassword = confirmPassword.length > 0;
    const isPasswordMatched = hasConfirmPassword && password === confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (passwordRuleError) {
            setError(passwordRuleError);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (!securityAnswer.trim()) {
            setError("Security answer is required for password recovery.");
            return;
        }

        setIsSubmitting(true);

        try {
            await registerPatientAccount({
                username,
                email,
                password,
                surname,
                firstname,
                middlename,
                dob,
                houseNumber,
                street,
                purokSubdivision,
                securityQuestion,
                securityAnswer,
                contactNumber,
            });

            const loginLookup = await lookupLoginIdentity({ identifier: email, role: "patient", dob });
            const patientCode = loginLookup?.patient_code || "";
            setSuccess(
                patientCode
                    ? `Registration saved successfully. Your Patient ID is ${patientCode}.`
                    : "Registration saved successfully. Please sign in to continue."
            );
            setUsername("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setSurname("");
            setFirstname("");
            setMiddlename("");
            setDob("");
            setHouseNumber("");
            setStreet("");
            setPurokSubdivision("");
            setSecurityQuestion(SECURITY_QUESTIONS[0]);
            setSecurityAnswer("");
            setContactNumber("");
            setTimeout(() => setIsRegisteringState(true), 1500);
        } catch (submitError) {
            setError(submitError?.message || "Unable to complete registration. Please try again.");
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

                    <div>
                        <label className={labelClass} htmlFor="reg-email">Email Address</label>
                        <input id="reg-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="reg-password">Password</label>
                            <input id="reg-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <div className="mt-2 rounded-full h-1.5 bg-slate-100 overflow-hidden">
                                <div className={`h-full ${passwordStrength.barClass} ${passwordStrength.widthClass}`} />
                            </div>
                            <p className={`text-xs font-semibold mt-2 ${passwordStrength.textClass}`}>Password strength: {passwordStrength.label}</p>
                            {password && passwordRuleError && (
                                <p className="text-xs text-red-600 mt-1">{passwordRuleError}</p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">Required: at least 1 uppercase letter, at least 1 special character, no spaces, common keyboard symbols only.</p>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-confirm-password">Confirm Password</label>
                            <input id="reg-confirm-password" type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                            {hasConfirmPassword && (
                                <p className={`text-xs mt-2 font-semibold ${isPasswordMatched ? "text-emerald-600" : "text-red-600"}`}>
                                    {isPasswordMatched ? "Password matched" : "Password does not match"}
                                </p>
                            )}
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

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Address (Philippine Hierarchy)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass} htmlFor="reg-region">Region</label>
                                <input id="reg-region" type="text" className={`${inputClass} opacity-80 cursor-not-allowed`} value="NCR" readOnly />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="reg-province">Province</label>
                                <input id="reg-province" type="text" className={`${inputClass} opacity-80 cursor-not-allowed`} value="METRO MANILA" readOnly />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="reg-city">City</label>
                                <input id="reg-city" type="text" className={`${inputClass} opacity-80 cursor-not-allowed`} value="SAN JUAN CITY" readOnly />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="reg-barangay">Barangay</label>
                                <input id="reg-barangay" type="text" className={`${inputClass} opacity-80 cursor-not-allowed`} value="BARANGAY SAN PERFECTO" readOnly />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass} htmlFor="reg-house-number">House Number</label>
                                <input id="reg-house-number" type="text" className={inputClass} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="reg-street">Street</label>
                                <input id="reg-street" type="text" className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelClass} htmlFor="reg-purok">Purok/Subdivision</label>
                                <input id="reg-purok" type="text" className={inputClass} value={purokSubdivision} onChange={(e) => setPurokSubdivision(e.target.value)} required />
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-200" />

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Security Question (Required)</p>
                        <div>
                            <label className={labelClass} htmlFor="reg-security-question">Choose a question</label>
                            <select
                                id="reg-security-question"
                                className={inputClass}
                                value={securityQuestion}
                                onChange={(e) => setSecurityQuestion(e.target.value)}
                                required
                            >
                                {SECURITY_QUESTIONS.map((question) => (
                                    <option key={question} value={question}>{question}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-security-answer">Your answer</label>
                            <input
                                id="reg-security-answer"
                                type="text"
                                className={inputClass}
                                value={securityAnswer}
                                onChange={(e) => setSecurityAnswer(e.target.value)}
                                required
                            />
                        </div>
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