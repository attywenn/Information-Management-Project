import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardNavigation from "../components/dashboardNavigation.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function UserDashboard() {
    const { user, token } = useAuth();
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

    // Load stats for admin / health workers
    useEffect(() => {
        if (!token || !user?.role || (user.role !== "admin" && user.role !== "health_worker")) {
            return;
        }
        setStatsLoading(true);
        setStatsError("");
        fetch("/api/stats/summary", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setStats({
                        patientCount: data.patientCount ?? 0,
                        healthWorkerCount: data.healthWorkerCount ?? 0,
                    });
                } else {
                    setStatsError(data.message || "Failed to load stats");
                }
            })
            .catch((err) => setStatsError(err.message || "Failed to load stats"))
            .finally(() => setStatsLoading(false));
    }, [token, user?.role]);

    // Load profile for all roles when visiting profile tab
    useEffect(() => {
        if (path !== "/profile" || !token) return;
        setProfileLoading(true);
        setProfileError("");
        fetch("/api/profile", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setProfile(data.user);
                } else {
                    setProfileError(data.message || "Failed to load profile");
                }
            })
            .catch((err) => setProfileError(err.message || "Failed to load profile"))
            .finally(() => setProfileLoading(false));
    }, [path, token]);

    const pieData = useMemo(() => {
        const total = stats.patientCount + stats.healthWorkerCount || 1;
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
            const form = new FormData();
            form.append("avatar", avatarFile);
            const res = await fetch("/api/profile/avatar", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: form,
            });
            const data = await res.json();
            if (data.success) {
                setAvatarMessage("Profile picture updated.");
                if (profile) {
                    setProfile({ ...profile, profileImageUrl: data.url });
                }
                setAvatarFile(null);
            } else {
                setProfileError(data.message || "Failed to update profile picture");
            }
        } catch (err) {
            setProfileError(err.message || "Network error while updating picture");
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
            const res = await fetch("/api/profile/password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setPasswordMessage("Password updated successfully.");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                setPasswordError(data.message || "Failed to update password");
            }
        } catch (err) {
            setPasswordError(err.message || "Network error while updating password");
        }
    };

    const handleManageSubmit = async (e) => {
        e.preventDefault();
        setManageError("");
        setManageMessage("");
        if (!token) {
            setManageError("Not authenticated.");
            return;
        }
        try {
            const res = await fetch("/api/admin/health-workers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(manageForm),
            });
            const data = await res.json();
            if (data.success) {
                setManageMessage("Health worker account created.");
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
            } else {
                setManageError(data.message || "Failed to create health worker account");
            }
        } catch (err) {
            setManageError(err.message || "Network error while creating account");
        }
    };

    const renderDashboardHome = () => {
        if (!user) return null;
        if (user.role === "admin") {
            return (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-semibold mb-1">
                            Maligayang araw{user.username ? `, ${user.username}` : ""}!
                        </h1>
                        <p className="text-sm text-gray-600">
                            You are logged in as <span className="font-semibold">admin</span>.
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="col-span-2 bg-white rounded-lg shadow p-4">
                            <h2 className="text-lg font-semibold mb-2">Accounts overview</h2>
                            {statsLoading ? (
                                <p className="text-sm text-gray-500">Loading stats…</p>
                            ) : statsError ? (
                                <p className="text-sm text-red-600">{statsError}</p>
                            ) : (
                                <Pie data={pieData} />
                            )}
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 flex flex-col justify-center">
                            <p className="text-sm text-gray-600">Registered patients</p>
                            <p className="text-3xl font-bold text-red-700">
                                {stats.patientCount}
                            </p>
                            <p className="mt-4 text-sm text-gray-600">Health workers</p>
                            <p className="text-3xl font-bold text-sky-600">
                                {stats.healthWorkerCount}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }
        if (user.role === "health_worker") {
            return (
                <div className="space-y-4">
                    <h1 className="text-2xl font-semibold mb-1">
                        Maligayang araw{user.username ? `, ${user.username}` : ""}!
                    </h1>
                    <p className="text-sm text-gray-600">
                        You are logged in as <span className="font-semibold">health worker</span>.
                    </p>
                    <div className="mt-4 bg-white rounded-lg shadow p-4 max-w-md">
                        <h2 className="text-lg font-semibold mb-2">Patient overview</h2>
                        {statsLoading ? (
                            <p className="text-sm text-gray-500">Loading stats…</p>
                        ) : statsError ? (
                            <p className="text-sm text-red-600">{statsError}</p>
                        ) : (
                            <p className="text-4xl font-bold text-red-700">
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
                <h1 className="text-2xl font-semibold mb-2">
                    Maligayang araw{user.username ? `, ${user.username}` : ""}!
                </h1>
                <p className="text-sm text-gray-600">
                    You are logged in as <span className="font-semibold">patient</span>.
                </p>
            </div>
        );
    };

    const renderProfile = () => {
        return (
            <div className="space-y-6 max-w-xl">
                <div>
                    <h1 className="text-2xl font-semibold mb-2">Profile</h1>
                    <p className="text-sm text-gray-600">
                        View your account details, change your password, and update your profile
                        picture.
                    </p>
                </div>

                {profileLoading ? (
                    <p className="text-sm text-gray-500">Loading profile…</p>
                ) : profileError ? (
                    <p className="text-sm text-red-600">{profileError}</p>
                ) : profile ? (
                    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center overflow-hidden">
                            {profile.profileImageUrl ? (
                                <img
                                    src={profile.profileImageUrl}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-xl font-semibold text-red-800">
                                    {profile.username?.[0]?.toUpperCase() || "U"}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="font-semibold">{profile.username}</p>
                            {profile.email && (
                                <p className="text-sm text-gray-600">{profile.email}</p>
                            )}
                            <p className="text-xs text-gray-500 uppercase mt-1">
                                {profile.role}
                            </p>
                        </div>
                    </div>
                ) : null}

                <form onSubmit={handleAvatarSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
                    <h2 className="text-lg font-semibold">Change profile picture</h2>
                    {avatarMessage && (
                        <p className="text-sm text-green-600">{avatarMessage}</p>
                    )}
                    {profileError && (
                        <p className="text-sm text-red-600">{profileError}</p>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-700"
                    />
                    <button
                        type="submit"
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-red-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                        Upload new picture
                    </button>
                </form>

                <form
                    onSubmit={handlePasswordSubmit}
                    className="bg-white rounded-lg shadow p-4 space-y-3"
                >
                    <h2 className="text-lg font-semibold">Change password</h2>
                    {passwordMessage && (
                        <p className="text-sm text-green-600">{passwordMessage}</p>
                    )}
                    {passwordError && (
                        <p className="text-sm text-red-600">{passwordError}</p>
                    )}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium" htmlFor="current-pw">
                            Current password
                        </label>
                        <input
                            id="current-pw"
                            type="password"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                    <div className="space-y-2">
                        <label className="block text-sm font-medium" htmlFor="new-pw">
                            New password
                        </label>
                        <input
                            id="new-pw"
                            type="password"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                    <div className="space-y-2">
                        <label className="block text-sm font-medium" htmlFor="confirm-pw">
                            Confirm new password
                        </label>
                        <input
                            id="confirm-pw"
                            type="password"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-red-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                        Update password
                    </button>
                </form>
            </div>
        );
    };

    const renderManageAccounts = () => {
        if (user?.role !== "admin") {
            return (
                <p className="text-sm text-red-600">
                    You do not have permission to manage accounts.
                </p>
            );
        }
        return (
            <div className="max-w-xl space-y-4">
                <div>
                    <h1 className="text-2xl font-semibold mb-2">Manage health worker accounts</h1>
                    <p className="text-sm text-gray-600">
                        Create accounts for health workers. They will use their username,
                        password, and security question to access the system.
                    </p>
                </div>
                {manageMessage && (
                    <p className="text-sm text-green-600">{manageMessage}</p>
                )}
                {manageError && <p className="text-sm text-red-600">{manageError}</p>}
                <form
                    onSubmit={handleManageSubmit}
                    className="bg-white rounded-lg shadow p-4 space-y-3"
                >
                    <div className="space-y-1">
                        <label className="block text-sm font-medium" htmlFor="hw-username">
                            Username
                        </label>
                        <input
                            id="hw-username"
                            type="text"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            value={manageForm.username}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, username: e.target.value }))
                            }
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium" htmlFor="hw-email">
                            Email (required)
                        </label>
                        <input
                            id="hw-email"
                            type="email"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            value={manageForm.email}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, email: e.target.value }))
                            }
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium" htmlFor="hw-password">
                            Temporary password
                        </label>
                        <input
                            id="hw-password"
                            type="password"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            value={manageForm.password}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, password: e.target.value }))
                            }
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium" htmlFor="hw-surname">
                                Surname
                            </label>
                            <input
                                id="hw-surname"
                                type="text"
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                value={manageForm.surname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, surname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium" htmlFor="hw-firstname">
                                First name
                            </label>
                            <input
                                id="hw-firstname"
                                type="text"
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                value={manageForm.firstname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, firstname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium" htmlFor="hw-middlename">
                                Middle name (optional)
                            </label>
                            <input
                                id="hw-middlename"
                                type="text"
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                value={manageForm.middlename}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, middlename: e.target.value }))
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium">
                            Security question (mandatory)
                        </label>
                        <p className="text-xs text-gray-500">
                            This will be asked to the health worker for additional security.
                        </p>
                        <input
                            type="text"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                    <div className="space-y-1">
                        <label className="block text-sm font-medium" htmlFor="hw-sec-answer">
                            Security answer
                        </label>
                        <input
                            id="hw-sec-answer"
                            type="text"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            value={manageForm.securityAnswer}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, securityAnswer: e.target.value }))
                            }
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-red-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                    >
                        Create health worker account
                    </button>
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
        <div className="flex min-h-screen font-[roboto] bg-slate-50">
            <DashboardNavigation />
            <main className="flex-1 p-6">
                {renderContent()}
            </main>
        </div>
    );
}

export default UserDashboard;