import Login from "../auth/login";
import SJC from "../assets/images/sjc.jpeg";

function Account() {
  return (
    <>
      <div className="mt-15 font-[roboto] md:grid md:grid-cols-2 md:border md:rounded-lg md:shadow-lg md:ml-[30rem] md:mr-[30rem] md:h-[40rem] ">
        <div className="hidden md:block overflow-hidden">
          <img
            src={SJC}
            alt="SJC"
            className="w-full h-full object-cover opacity-75"
          />
        </div>
        <div className="flex justify-center items-center bg-red-400/5">
          <Login />
        </div>
      </div>
    </>
  );
}

export default Account;
