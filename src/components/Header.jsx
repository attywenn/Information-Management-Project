import logo from "../assets/images/sanmateo.webp";

function Header() {
  return (
    <>
      <div className="font-[roboto] bg-gradient-to-r from-blue-500 to-black h-[4em] justify-center flex items-center text-[1.8rem]">
        <div className="flex items-center">
          <img
            src={logo}
            alt="logo"
            className="size-[3.5em] p-[0.7em] flex items-center"
          />
          <div className="flex-column">
            <div className="text-white font-bold">
              BARANGAY SILANGAN E-GOV PORTAL
            </div>
            <div className="text-[1rem] italic text-white mt-[-0.5rem]">
              Bayan ng San Mateo, Lalawigan ng Rizal
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Header;
