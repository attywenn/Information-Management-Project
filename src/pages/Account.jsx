import Login from "../auth/login";

function Account() {
  return (
    <>
      <div className="mt-8 font-[roboto] flex justify-center items-center flex-col font-[roboto]">
        <p className="mt-1 text-center max-w-[20rem] font-bold text-red-950/80">
          Login with your credentials given by the Barangay Health Center System administrator.
        </p>

        <Login />

        <p className="text-black/80 mt-5 text-center max-w-[20rem]">
          No account? Go to Barangay San Perfecto Health Center or click
          "Contact Us" on the Menu bar
        </p>
      </div>
    </>
  );
}

export default Account;
