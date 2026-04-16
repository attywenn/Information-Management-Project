import { useState, useEffect } from "react";
import { lookupLoginIdentity, registerPatientAccount } from "../services/supabaseBackendService.js";

const SECURITY_QUESTIONS = [
    "Name of your cat",
    "Favorite actor/actress",
    "Favorite food",
    "Name of your first school",
    "Your childhood nickname",
];

const SEX_OPTIONS = ["Male", "Female", "Prefer not to say"];

const GENDER_OPTIONS = [
    "Cisgender Woman",
    "Cisgender Man",
    "Transgender Woman",
    "Transgender Man",
    "Non-binary",
    "Genderqueer",
    "Agender",
    "Intersex",
    "Two-Spirit",
    "Questioning",
    "Prefer not to say",
    "Other / Unknown (please specify)",
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
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [surname, setSurname] = useState("");
    const [firstname, setFirstname] = useState("");
    const [middlename, setMiddlename] = useState("");
    const [dob, setDob] = useState("");
    const [sex, setSex] = useState(SEX_OPTIONS[2]);
    const [gender, setGender] = useState(GENDER_OPTIONS[10]);
    const [genderOther, setGenderOther] = useState("");
    const [houseNumber, setHouseNumber] = useState("");
    const [street, setStreet] = useState("");
    const [purokSubdivision, setPurokSubdivision] = useState("");
    const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [securityAnswer, setSecurityAnswer] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [patientCode, setPatientCode] = useState("");
    const [showPatientIdModal, setShowPatientIdModal] = useState(false);
    const [timerCount, setTimerCount] = useState(10);
    const passwordStrength = evaluatePasswordStrength(password);
    const passwordRuleError = validatePasswordPolicy(password);
    const hasConfirmPassword = confirmPassword.length > 0;
    const isPasswordMatched = hasConfirmPassword && password === confirmPassword;

    // Timer for patient ID modal
    useEffect(() => {
        if (!showPatientIdModal) return;

        setTimerCount(10);
        const timerInterval = setInterval(() => {
            setTimerCount((prev) => {
                if (prev <= 1) {
                    clearInterval(timerInterval);
                    setShowPatientIdModal(false);
                    setIsRegisteringState(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [showPatientIdModal, setIsRegisteringState]);

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

        if (gender === "Other / Unknown (please specify)" && !genderOther.trim()) {
            setError("Please specify your gender when selecting Other / Unknown.");
            return;
        }

        setIsSubmitting(true);

        try {
            const resolvedGender = gender === "Other / Unknown (please specify)"
                ? genderOther.trim()
                : gender;

            await registerPatientAccount({
                email,
                password,
                surname,
                firstname,
                middlename,
                dob,
                sex,
                gender: resolvedGender,
                houseNumber,
                street,
                purokSubdivision,
                securityQuestion,
                securityAnswer,
                contactNumber,
            });

            const loginLookup = await lookupLoginIdentity({ identifier: email, role: "patient", dob });
            const patientCodeValue = loginLookup?.patient_code || "";
            
            if (patientCodeValue) {
                setPatientCode(patientCodeValue);
                setShowPatientIdModal(true);
                setSuccess("");
            } else {
                setSuccess("Registration saved successfully. Please sign in to continue.");
                setTimeout(() => setIsRegisteringState(true), 1500);
            }

            // Clear form
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setSurname("");
            setFirstname("");
            setMiddlename("");
            setDob("");
            setSex(SEX_OPTIONS[2]);
            setGender(GENDER_OPTIONS[10]);
            setGenderOther("");
            setHouseNumber("");
            setStreet("");
            setPurokSubdivision("");
            setSecurityQuestion(SECURITY_QUESTIONS[0]);
            setSecurityAnswer("");
            setContactNumber("");
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass} htmlFor="reg-sex">Sex</label>
                            <select
                                id="reg-sex"
                                className={inputClass}
                                value={sex}
                                onChange={(e) => setSex(e.target.value)}
                                required
                            >
                                {SEX_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="reg-gender">Gender</label>
                            <select
                                id="reg-gender"
                                className={inputClass}
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                required
                            >
                                {GENDER_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {gender === "Other / Unknown (please specify)" && (
                        <div>
                            <label className={labelClass} htmlFor="reg-gender-other">Please specify gender</label>
                            <input
                                id="reg-gender-other"
                                type="text"
                                className={inputClass}
                                value={genderOther}
                                onChange={(e) => setGenderOther(e.target.value)}
                                required
                            />
                        </div>
                    )}

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

            {/* Patient ID Modal */}
            {showPatientIdModal && (
                <div className="fixed inset-0 bg-black/50 bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6 animate-in fade-in zoom-in">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Successful!</h2>
                            <p className="text-slate-600 text-sm mb-4">
                                Your account has been created successfully. Save your Patient ID to continue.
                            </p>
                        </div>

                        <div className="bg-slate-50 border-2 border-brand-red rounded-xl p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Patient ID</p>
                            <p className="text-2xl font-bold text-brand-red font-mono text-center break-all">
                                {patientCode}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(patientCode);
                                }}
                                className="w-full px-4 py-2.5 bg-brand-red text-white font-semibold rounded-lg hover:bg-brand-dark transition-all active:scale-95"
                            >
                                Copy Patient ID
                            </button>
                            <p className="text-center text-xs text-slate-500">
                                This modal will close in <span className="font-bold text-brand-red">{timerCount}</span> seconds
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-800">
                                <span className="font-semibold">Important:</span> You can now log in with your credentials. Email confirmation is not required to access your account.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
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