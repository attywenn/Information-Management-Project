import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChartPie,
    faCalendarDays,
    faPhone,
    faInbox,
    faGear,
    faUsers,
    faRightFromBracket,
    faStethoscope,
    faBox,
} from "@fortawesome/free-solid-svg-icons";

function DashboardNavigation() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    const tabs = [{ label: "Dashboard", path: "/dashboard", icon: faChartPie }];

    if (user?.role === "patient") {
        tabs.push(
            { label: "Schedules", path: "/schedules", icon: faCalendarDays },
            { label: "History", path: "/history", icon: faPhone },
            { label: "Inbox", path: "/inbox", icon: faInbox },
            { label: "Settings", path: "/settings", icon: faGear }
        );
    } else if (user?.role === "admin") {
        tabs.push(
            { label: "Schedules", path: "/schedules", icon: faCalendarDays },
            { label: "Manage Accounts", path: "/manage-accounts", icon: faUsers },
            { label: "Inventory", path: "/inventory", icon: faBox },
            { label: "History", path: "/history", icon: faPhone },
            { label: "Inbox", path: "/inbox", icon: faInbox },
            { label: "Settings", path: "/settings", icon: faGear }
        );
    } else if (user?.role === "health_worker") {
        tabs.push(
            { label: "Schedules", path: "/schedules", icon: faCalendarDays },
            { label: "Consultation", path: "/consultation", icon: faStethoscope },
            { label: "Inventory", path: "/inventory", icon: faBox },
            { label: "History", path: "/history", icon: faPhone },
            { label: "Settings", path: "/settings", icon: faGear }
        );
    } else {
        tabs.push({ label: "Settings", path: "/settings", icon: faGear });
    }

    return (
        <aside className="w-64 min-h-screen bg-white flex flex-col justify-between border-r border-slate-200 shrink-0 sticky top-0 h-screen overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white font-bold text-xl drop-shadow-sm">
                        +
                    </div>
                    <div>
                        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                            San Perfecto
                        </div>
                        <div className="text-sm font-bold text-slate-900 leading-snug">
                            Health Portal
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
                    Main Menu
                </div>
                {tabs.map(({ label, path, icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                isActive
                                    ? "bg-red-50 text-brand-red shadow-sm border border-red-100/50"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                            }`
                        }
                    >
                        <FontAwesomeIcon icon={icon} className="w-4 h-4 opacity-90" />
                        <span className="truncate">{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                <button
                    type="button"
                    onClick={() => setLogoutModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-brand-red hover:border-red-200 active:scale-95 shadow-sm"
                >
                    <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
                    Log out
                </button>
            </div>

            {logoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">Confirm Logout</h3>
                        <p className="mt-2 text-sm text-slate-600">Do you really want to log out?</p>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setLogoutModalOpen(false)}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLogoutModalOpen(false);
                                    logout();
                                    navigate("/account", { replace: true });
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default DashboardNavigation;