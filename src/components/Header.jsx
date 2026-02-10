import logo from "../assets/images/qclogo.webp"

function Header() {
  return (
    <>
      <div className="bg-gradient-to-r from-red-500 to-black h-[10vh] justify-center flex items-center text-[1.8rem]">
        <div className="flex items-center">
            <img src={logo} alt="logo" className="size-[3em] p-[0.7em] flex items-center" />
            <div className="flex-column">
            <div className="text-white font-bold">BALINGASA HIGH SCHOOL</div>
            <div className="text-[1rem] italic text-white mt-[-0.5rem]">
                Inventory Management System
            </div>
            </div>
        </div>    
      </div>
    </>
  );
}

export default Header;