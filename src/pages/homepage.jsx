// USER LANDING PAGE //

import homepageImage from "../assets/images/hpageimg.jpg";

function Welcome() {
  return (
    <>
      <div className="flex justify-center items-center mt-[3rem] font-[roboto] md:grid md:grid-cols-2 lg:grid-cols-1">
        <div className="-space-y-3 font-bold text-center">
          <div className="text-[1rem]">WELCOME TO</div>
          <div className="text-[1.5rem] text-red-950">
            BARANGAY SAN PERFECTO
          </div>
          <div className="text-[1.3rem] italic">Health Center</div>
        </div>
      </div>
      <div className="flex-column font-[roboto] m-0 p-0">
        <img
          src={homepageImage}
          alt="Homepage"
          className="w-full h-100 object-cover opacity-75 "
        />
      </div>  


    </>
  );
}

function Homepage() {
  return (
    <>
      <Welcome />
    </>
  );
}

export default Homepage;
