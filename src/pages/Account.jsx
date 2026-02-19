import Login from "../auth/login";
import SJC from "../assets/images/sjc.jpeg"

function Account() {
  return (
    <>
      <div className="mt-15 font-[roboto] md:grid md:grid-cols-2">
        <div className="flex justify-center items-center">
          <Login />
        </div>
        <div className="hidden md:block">
            <img src={SJC} alt="SJC" className="w-full h-full object-cover opacity-80 rounded-lg" />
        </div>
      </div>
    </>
  );
}

export default Account;
