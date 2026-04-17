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
        <>
            <aside className="hidden lg:flex w-72 min-h-screen bg-white/85 backdrop-blur-xl flex-col justify-between border-r border-slate-200/80 shrink-0 sticky top-0 h-screen overflow-y-auto">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-brand-red flex items-center justify-center text-white font-bold text-xl shadow-md shadow-red-200/70">
                            +
                        </div>
                        <div>
                            <div className="text-[11px] font-bold tracking-[0.22em] text-slate-400 uppercase">
                                San Perfecto
                            </div>
                            <div className="text-base font-extrabold text-slate-900 leading-snug">
                                Health Portal
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 px-3">
                        Main Menu
                    </div>
                    {tabs.map(({ label, path, icon }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) =>
                                `w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all ${
                                    isActive
                                        ? "bg-red-50 text-brand-red shadow-sm border border-red-100"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                                }`
                            }
                        >
                            <FontAwesomeIcon icon={icon} className="w-4 h-4 opacity-90" />
                            <span className="truncate">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200 bg-slate-50/70">
                    <button
                        type="button"
                        onClick={() => setLogoutModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-brand-red hover:border-red-200 active:scale-95 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
                        Log out
                    </button>
                </div>
            </aside>

            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-brand-red text-white font-bold text-lg flex items-center justify-center shadow-sm">+</div>
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">San Perfecto</p>
                            <p className="text-sm font-extrabold text-slate-900 leading-tight">Health Portal</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setLogoutModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl px-2 py-2">
                <div className="grid grid-flow-col auto-cols-fr gap-1 overflow-x-auto">
                    {tabs.map(({ label, path, icon }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) =>
                                `flex min-w-18 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-all ${
                                    isActive
                                        ? "bg-red-50 text-brand-red"
                                        : "text-slate-500"
                                }`
                            }
                        >
                            <FontAwesomeIcon icon={icon} className="h-4 w-4" />
                            <span className="truncate text-center leading-tight">{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>

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

        </>
    );
}

export default DashboardNavigation;