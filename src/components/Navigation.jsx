import { NavLink } from "react-router-dom";

function Navigation() {
  const linkClass = ({ isActive }) =>
    [
      "px-3 py-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950",
      isActive ? "bg-white/15 text-white" : "text-white/90 hover:bg-white/10 hover:text-white",
    ].join(" ");

  return (
    <div className="font-[roboto] bg-red-950 text-white rounded-full shadow-md">
      <nav className="mx-auto max-w-6xl px-2 sm:px-3 py-2 flex items-center justify-center gap-1 sm:gap-2 font-bold text-sm sm:text-base">
        <NavLink to="/" className={linkClass}>
          Home
        </NavLink>
        <NavLink to="/account" className={linkClass}>
          Account
        </NavLink>
        <NavLink to="/contact" className={linkClass}>
          Contact us
        </NavLink>
        <NavLink to="/faqs" className={linkClass}>
          FAQs
        </NavLink>
      </nav>
    </div>
  );
}

export default Navigation;
