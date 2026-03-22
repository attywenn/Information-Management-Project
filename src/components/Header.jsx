import logo from "../assets/images/sanperfecto.png";

function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      {/* Top Bar for Gov Ph style indicator */}
      <div className="bg-slate-100 py-1 border-b border-slate-200 hidden sm:block">
        <div className="mx-auto max-w-6xl px-4 text-xs text-slate-500 flex items-center gap-2">
          <span>Republic of the Philippines</span>
          <span className="text-slate-300">|</span>
          <span>City of San Juan</span>
        </div>
      </div>
      
      {/* Main Header */}
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center gap-4">
        <img
          src={logo}
          alt="San Perfecto logo"
          className="h-16 w-16 shrink-0 object-contain drop-shadow-sm"
        />
        <div className="text-center sm:text-left leading-tight">
          <div className="text-sm font-semibold tracking-wider text-brand-red uppercase">
            Barangay San Perfecto
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Health Center Portal
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            Metro Manila, Philippines
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
