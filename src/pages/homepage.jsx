import Navigation from "../components/Navigation.jsx";
import Header from "../components/Header.jsx";

// USER LANDING PAGE //

function Contributors () {
  return (
    <>
      <div className="flex justify-center items-center mt-[3rem] font-[roboto] md:grid md:grid-cols-2">
        <div className="-space-y-3 font-bold">
          <div className="text-[1rem]">WELCOME TO</div>
          <div className="text-[1.5rem] text-red-950">BARANGAY SAN PERFECTO</div>
          <div className="text-[1.3rem] italic">Health Center</div>
        </div>
      </div>
    </>
  );
}

function Homepage() {
  return (
    <>
      <div className="flex flex-col">
        <Header /> {/* Header content */}
        
        {/* body contents */}

        <div className="m-2">
          
          <Navigation /> {/* Menu Bar */}
          <Contributors />
        </div>
      </div>
    </>
  );
}

export default Homepage;
