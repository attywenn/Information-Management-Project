import { NavLink } from "react-router-dom";

function Navigation() {
  const linkClass = ({ isActive }) =>
    [
      "relative px-4 py-2 text-sm sm:text-base font-medium transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/60 focus-visible:ring-offset-2",
      isActive 
        ? "text-brand-red after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-red" 
        : "text-slate-600 hover:text-brand-dark hover:bg-slate-50/50",
    ].join(" ");

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10 w-full">
      <nav className="mx-auto max-w-6xl px-4 flex items-center justify-center sm:justify-start gap-1 sm:gap-4">
        <NavLink to="/" className={linkClass}>
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
  );
}

export default Navigation;
