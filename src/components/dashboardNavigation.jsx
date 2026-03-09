import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function DashboardNavigation() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const tabs = [
        { label: "Dashboard", path: "/dashboard" },
        { label: "Profile", path: "/profile" },
        { label: "Schedules", path: "/schedules" },
        { label: "Contact us", path: "/contact-us" },
        { label: "FAQs", path: "/faqs-dashboard" },
        { label: "Inbox", path: "/inbox" },
        { label: "Settings", path: "/settings" },
    ];

    return (
        <aside className="w-64 min-h-screen bg-red-950 text-white flex flex-col justify-between border-r border-white/10">
            <div className="p-6">
                <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">
                    San Perfecto HC
                </div>
                <div className="text-lg font-semibold leading-snug">
                    Patient Portal
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
                {tabs.map(({ label, path }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            `w-full flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-left transition-colors border-l-4 ${
                                isActive
                                    ? "bg-white/10 border-white text-white"
                                    : "border-transparent text-white/80 hover:bg-white/5 hover:text-white"
                            }`
                        }
                    >
                        <span className="truncate">{label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    type="button"
                    onClick={() => {
                        logout();
                        navigate("/account", { replace: true });
                    }}
                    className="w-full rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-left transition-colors hover:bg-white/10"
                >
                    Log out
                </button>
            </div>
        </aside>
    );
}

export default DashboardNavigation;