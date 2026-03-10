import logo from "../assets/images/sanperfecto.png";

function Header() {
  return (
    <header className="font-[roboto] bg-gradient-to-r from-red-900 via-red-800 to-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <img
          src={logo}
          alt="San Perfecto logo"
          className="h-12 w-12 shrink-0 rounded-full bg-white/10 p-1"
        />
        <div className="leading-tight">
          <div className="text-sm sm:text-base font-extrabold tracking-wide">
            BGY. SAN PERFECTO HEALTH CENTER
          </div>
          <div className="text-xs sm:text-sm italic text-white/90">
            Lungsod ng San Juan, Kalakhang Maynila
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
