import { NavLink } from "react-router-dom";

function Navigation() {
  return (
    <>
      <div className="font-[roboto] max-h-[3rem] bg-red-950 text-[clamp(1rem,1vw,1.5rem)] p-[clamp(0.3rem,0.5rem,1rem)] text-white rounded-[5em]">
        <nav className="flex justify-around font-bold">
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? "underline" : "")}
          >
            Home
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) => (isActive ? "underline" : "")}
          >
            Account
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) => (isActive ? "underline" : "")}
          >
            Contact us
          </NavLink>
          <NavLink
            to="/faqs"
            className={({ isActive }) => (isActive ? "underline" : "")}
          >
            FAQs
          </NavLink>
        </nav>
      </div>
    </>
  );
}

export default Navigation;
