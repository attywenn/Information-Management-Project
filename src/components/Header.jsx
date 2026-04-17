import { NavLink } from "react-router-dom";
import logo from "../assets/images/sanperfecto.png";

function Header() {
  const linkClass = ({ isActive }) =>
    [
      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60 focus-visible:ring-offset-2",
      isActive
        ? "text-brand-red bg-red-50"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    ].join(" ");

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={logo}
            alt="San Perfecto logo"
            className="h-9 w-9 object-contain"
          />
          <div className="hidden sm:block leading-tight">
            <div className="text-[11px] font-bold tracking-widest text-brand-red uppercase">
              Brgy. San Perfecto
            </div>
            <div className="text-sm font-extrabold text-slate-900 tracking-tight">
              Health Center Portal
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 ml-auto">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/account" className={linkClass}>
            Account
          </NavLink>
          <NavLink to="/contact" className={linkClass}>
            Contact Us
          </NavLink>
          <NavLink to="/faqs" className={linkClass}>
            FAQs
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
