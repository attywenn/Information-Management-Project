import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardNavigation from "../components/dashboardNavigation.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faCalendarDays, faFileMedical } from "@fortawesome/free-solid-svg-icons";

ChartJS.register(ArcElement, Tooltip, Legend);

function UserDashboard() {
    const { user } = useAuth();
    const location = useLocation();
    const path = location.pathname;

    const [stats, setStats] = useState({ patientCount: 0, healthWorkerCount: 0 });
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState("");

    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarMessage, setAvatarMessage] = useState("");
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordError, setPasswordError] = useState("");

    const [manageError, setManageError] = useState("");
    const [manageMessage, setManageMessage] = useState("");
    const [manageForm, setManageForm] = useState({
        username: "",
        email: "",
        password: "",
        surname: "",
        firstname: "",
        middlename: "",
        securityQuestionText: "What is your staff security keyword?",
        securityAnswer: "",
    });

    // Frontend-only stats for admin / health workers
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!user?.role || (user.role !== "admin" && user.role !== "health_worker")) {
                setStats({ patientCount: 0, healthWorkerCount: 0 });
                setStatsLoading(false);
                setStatsError("");
                return;
            }

            setStatsLoading(true);
            setStatsError("");
            setStats({ patientCount: 128, healthWorkerCount: 12 });
            setStatsLoading(false);
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [user?.role]);

    // Frontend-only profile data when visiting profile tab
    useEffect(() => {
        const timer = setTimeout(() => {
            if (path !== "/profile" || !user) {
                setProfile(null);
                setProfileLoading(false);
                setProfileError("");
                return;
            }

            setProfileLoading(true);
            setProfileError("");
            setProfile({
                username: user.username,
                email: user.role === "admin" ? "admin@sanperfecto.local" : "",
                role: user.role,
                profileImageUrl: "",
            });
            setProfileLoading(false);
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [path, user]);

    const pieData = useMemo(() => {
        return {
            labels: ["Patients", "Health workers"],
            datasets: [
                {
                    data: [stats.patientCount, stats.healthWorkerCount],
                    backgroundColor: ["#ef4444", "#0ea5e9"],
                    borderColor: ["#ffffff", "#ffffff"],
                    borderWidth: 1,
                },
            ],
        };
    }, [stats.patientCount, stats.healthWorkerCount]);

    const handleAvatarSubmit = async (e) => {
        e.preventDefault();
        setAvatarMessage("");
        setProfileError("");
        if (!avatarFile) {
            setProfileError("Please choose an image first.");
            return;
        }
        try {
            await new Promise((resolve) => setTimeout(resolve, 250));
            const localPreviewUrl = URL.createObjectURL(avatarFile);
            setAvatarMessage("Profile picture updated locally.");
            if (profile) {
                setProfile({ ...profile, profileImageUrl: localPreviewUrl });
            }
            setAvatarFile(null);
        } catch {
            setProfileError("Unable to update profile picture.");
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordMessage("");
        setPasswordError("");
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }
        try {
            await new Promise((resolve) => setTimeout(resolve, 250));
            setPasswordMessage("Password updated locally for frontend testing.");
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch {
            setPasswordError("Unable to update password.");
        }
    };

    const handleManageSubmit = async (e) => {
        e.preventDefault();
        setManageError("");
        setManageMessage("");
        try {
            await new Promise((resolve) => setTimeout(resolve, 250));
            setManageMessage("Health worker account saved locally for UI testing.");
            setManageForm({
                username: "",
                email: "",
                password: "",
                surname: "",
                firstname: "",
                middlename: "",
                securityQuestionText: manageForm.securityQuestionText,
                securityAnswer: "",
            });
        } catch {
            setManageError("Unable to save account.");
        }
    };

    const renderDashboardHome = () => {
        if (!user) return null;
        if (user.role === "admin") {    
            return (    
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            Maligayang araw{user.username ? `, ${user.username}` : ""}!
                        </h1>
                        <p className="text-slate-600">
                            You are logged in as <span className="font-semibold text-brand-red px-2 py-0.5 bg-red-50 rounded-md text-xs uppercase tracking-wide">Administrator</span>
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Accounts Overview</h2>
                            {statsLoading ? (
                                <div className="animate-pulse flex space-x-4">
                                    <div className="rounded-full bg-slate-200 h-48 w-48 mx-auto"></div>
                                </div>
                            ) : statsError ? (
                                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                            ) : (
                                <div className="h-64 flex justify-center">
                                    <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                                </div>
                            )}
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center gap-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Registered Patients</p>
                                <p className="text-4xl font-bold text-brand-red">
                                    {stats.patientCount}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Health Workers</p>
                                <p className="text-4xl font-bold text-slate-700">
                                    {stats.healthWorkerCount}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (user.role === "health_worker") {
            return (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            Maligayang araw{user.username ? `, ${user.username}` : ""}!
                        </h1>
                        <p className="text-slate-600">
                            You are logged in as <span className="font-semibold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md text-xs uppercase tracking-wide">Health Worker</span>
                        </p>
                    </div>
                    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-md">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Patient Overview</h2>
                        {statsLoading ? (
                            <div className="h-10 bg-slate-200 rounded animate-pulse w-24"></div>
                        ) : statsError ? (
                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                        ) : (
                            <p className="text-5xl font-bold text-brand-red">
                                {stats.patientCount}
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        // Patient
        return (
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                    Maligayang araw{user.username ? `, ${user.username}` : ""}!
                </h1>
                <p className="text-slate-600">
                    Welcome to your <span className="font-semibold text-brand-red px-2 py-0.5 bg-red-50 rounded-md text-xs uppercase tracking-wide">Patient Portal</span>
                </p>
                <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-brand-red" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">My Appointments</h3>
                        <p className="text-sm text-slate-500 mt-1">You have no upcoming appointments.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-brand-red" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Medical Records</h3>
                        <p className="text-sm text-slate-500 mt-1">View your consultation history.</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderProfile = () => {
        const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all";
        
        return (
            <div className="space-y-6 max-w-xl">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Profile Details</h1>
                    <p className="text-slate-600">
                        Manage your account settings, password, and avatar.
                    </p>
                </div>

                {profileLoading ? (
                    <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
                ) : profileError ? (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{profileError}</p>
                ) : profile ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center gap-6">
                        <div className="h-24 w-24 rounded-full bg-red-50 border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
                            {profile.profileImageUrl ? (
                                <img
                                    src={profile.profileImageUrl}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-bold text-brand-red">
                                    {profile.username?.[0]?.toUpperCase() || "U"}
                                </span>
                            )}
                        </div>
                        <div className="text-center sm:text-left">
                            <p className="text-2xl font-bold text-slate-900">{profile.username}</p>
                            {profile.email && (
                                <p className="text-slate-500 mt-1">{profile.email}</p>
                            )}
                            <p className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-full mt-3">
                                {profile.role}
                            </p>
                        </div>
                    </div>
                ) : null}

                <form onSubmit={handleAvatarSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">Update Profile Picture</h2>
                    {avatarMessage && (
                        <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{avatarMessage}</p>
                    )}
                    {profileError && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{profileError}</p>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-brand-red hover:file:bg-red-100 cursor-pointer"
                    />
                    <button
                        type="submit"
                        className="mt-2 text-sm font-semibold text-white bg-slate-900 px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Upload Avatar
                    </button>
                </form>

                <form
                    onSubmit={handlePasswordSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
                >
                    <h2 className="text-lg font-bold text-slate-800">Change Password</h2>
                    {passwordMessage && (
                        <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{passwordMessage}</p>
                    )}
                    {passwordError && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{passwordError}</p>
                    )}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="current-pw">
                            Current password
                        </label>
                        <input
                            id="current-pw"
                            type="password"
                            className={inputClass}
                            value={passwordForm.currentPassword}
                            onChange={(e) =>
                                setPasswordForm((f) => ({
                                    ...f,
                                    currentPassword: e.target.value,
                                }))
                            }
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="new-pw">
                            New password
                        </label>
                        <input
                            id="new-pw"
                            type="password"
                            className={inputClass}
                            value={passwordForm.newPassword}
                            onChange={(e) =>
                                setPasswordForm((f) => ({
                                    ...f,
                                    newPassword: e.target.value,
                                }))
                            }
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="confirm-pw">
                            Confirm new password
                        </label>
                        <input
                            id="confirm-pw"
                            type="password"
                            className={inputClass}
                            value={passwordForm.confirmPassword}
                            onChange={(e) =>
                                setPasswordForm((f) => ({
                                    ...f,
                                    confirmPassword: e.target.value,
                                }))
                            }
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-4 text-sm font-semibold text-white bg-brand-red px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-all active:scale-95 shadow-sm"
                    >
                        Save Password
                    </button>
                </form>
            </div>
        );
    };

    const renderManageAccounts = () => {
        if (user?.role !== "admin") {
            return (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 shrink-0" />
                    <p className="font-medium">You do not have permission to manage accounts.</p>
                </div>
            );
        }
        
        const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all";
        const labelClass = "block text-sm font-semibold text-slate-700 mb-1";

        return (
            <div className="max-w-3xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Health Workers</h1>
                    <p className="text-slate-600">
                        Register new health worker staff into the system.
                    </p>
                </div>
                {manageMessage && (
                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">{manageMessage}</p>
                )}
                {manageError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{manageError}</p>}
                
                <form
                    onSubmit={handleManageSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelClass} htmlFor="hw-username">Username</label>
                            <input
                                id="hw-username"
                                type="text"
                                className={inputClass}
                                value={manageForm.username}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, username: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-email">Email Address</label>
                            <input
                                id="hw-email"
                                type="email"
                                className={inputClass}
                                value={manageForm.email}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, email: e.target.value }))
                                }
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="hw-password">Temporary Password</label>
                        <input
                            id="hw-password"
                            type="password"
                            className={inputClass}
                            value={manageForm.password}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, password: e.target.value }))
                            }
                            required
                        />
                    </div>

                    <hr className="border-slate-100" />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                            <label className={labelClass} htmlFor="hw-surname">Surname</label>
                            <input
                                id="hw-surname"
                                type="text"
                                className={inputClass}
                                value={manageForm.surname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, surname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-firstname">First Name</label>
                            <input
                                id="hw-firstname"
                                type="text"
                                className={inputClass}
                                value={manageForm.firstname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, firstname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-middlename">Middle Name</label>
                            <input
                                id="hw-middlename"
                                type="text"
                                className={inputClass}
                                value={manageForm.middlename}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, middlename: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div>
                            <label className={`${labelClass} text-slate-900`}>Security Question</label>
                            <p className="text-xs text-slate-500 mb-2">Requested upon login as an additional security measure.</p>
                            <input
                                type="text"
                                className={inputClass}
                                value={manageForm.securityQuestionText}
                                onChange={(e) =>
                                    setManageForm((f) => ({
                                        ...f,
                                        securityQuestionText: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-sec-answer">Answer</label>
                            <input
                                id="hw-sec-answer"
                                type="text"
                                className={inputClass}
                                value={manageForm.securityAnswer}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, securityAnswer: e.target.value }))
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                        >
                            Create Employee Account
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const renderContent = () => {
        if (path === "/dashboard") return renderDashboardHome();
        if (path === "/profile") return renderProfile();
        if (path === "/manage-accounts") return renderManageAccounts();

        if (path === "/schedules") {
            return <p className="text-sm text-gray-700">Schedules module coming soon.</p>;
        }
        if (path === "/contact-us") {
            return (
                <p className="text-sm text-gray-700">
                    Contact health center staff for assistance. This section will be expanded.
                </p>
            );
        }
        if (path === "/faqs-dashboard") {
            return (
                <p className="text-sm text-gray-700">
                    Frequently asked questions about your account will appear here.
                </p>
            );
        }
        if (path === "/inbox") {
            return (
                <p className="text-sm text-gray-700">
                    Inbox and notifications will be available in a future update.
                </p>
            );
        }
        if (path === "/settings") {
            return (
                <p className="text-sm text-gray-700">
                    Additional settings will be available here later. For now, use the Profile tab
                    to change password and photo.
                </p>
            );
        }
        return renderDashboardHome();
    };

    return (
        <div className="flex h-screen overflow-hidden font-sans bg-slate-50">
            <DashboardNavigation />
            <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}

export default UserDashboard;