import logo from "../assets/images/sanperfecto.png";

function Header() {
  return (
    <>
      <div className="font-[roboto] bg-gradient-to-r from-red-800 to-black h-[4em] justify-around flex items-center text-[clamp(1rem,1.4vw,3rem)]">
        <div className="flex items-center ">
          <img src={logo} alt="logo" className="size-[4em] p-[0.7em]" />
          <div className="flex flex-col">
            <div className="text-white font-bold">
              BGY. SAN PERFECTO HEALTH CENTER
            </div>
            <div className="text-[1rem] italic text-white -mt-2">
              Lungsod ng San Juan, Kalakhang Maynila
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Header;
