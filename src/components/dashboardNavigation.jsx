import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChartPie,
    faUser,
    faCalendarDays,
    faPhone,
    faCircleQuestion,
    faInbox,
    faGear,
    faUsers,
    faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

function DashboardNavigation() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const tabs = [
        { label: "Dashboard", path: "/dashboard", icon: faChartPie },
        { label: "Profile", path: "/profile", icon: faUser },
        { label: "Schedules", path: "/schedules", icon: faCalendarDays },
        { label: "Contact us", path: "/contact-us", icon: faPhone },
        { label: "FAQs", path: "/faqs-dashboard", icon: faCircleQuestion },
        { label: "Inbox", path: "/inbox", icon: faInbox },
        { label: "Settings", path: "/settings", icon: faGear },
    ];

    if (user?.role === "admin") {
        tabs.splice(3, 0, { label: "Manage Accounts", path: "/manage-accounts", icon: faUsers });
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
                    onClick={() => {
                        logout();
                        navigate("/account", { replace: true });
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-brand-red hover:border-red-200 active:scale-95 shadow-sm"
                >
                    <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
                    Log out
                </button>
            </div>
        </aside>
    );
}

export default DashboardNavigation;