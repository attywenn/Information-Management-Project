function Login() {
  return (
    <div className="flex flex-col items-center justify-center mt-8 font-[roboto] text-center bg-white border border-red-950 p-6 rounded-lg w-full max-w-sm md:bg-white/5 md:border-none md:">
      <h1 className="text-2xl font-bold mb-4 text-black">Login as Patient</h1>
      <p className="mt-1 text-center max-w-[20rem] font-bold text-black/70">
        Login with your credentials given by the Barangay Health Center System
        administrator.
      </p>

      <form className="flex flex-col items-center mt-2">
        <label htmlFor="accountId" className="font-bold">
          Account ID
        </label>
        <input
          id="accountId"
          type="text"
          placeholder="Account ID"
          className="mb-2 p-2 border border-red-950 rounded"
        />

        <label htmlFor="password" className="font-bold">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="Password"
          className="mb-4 p-2 border border-red-950 rounded"
        />

        <label htmlFor="dob" className="font-bold ">
          Birthdate
        </label>
        <input
          type="date"
          id="dob"
          className="mb-4 p-2 border border-red-950 rounded"
        />
        <button
          type="submit"
          className="bg-red-950 text-white px-4 py-2 rounded hover:bg-red-800"
        >
          Login
        </button>

        <p className="text-black/80 mt-5 text-center max-w-[20rem]">
          No account?{" "}
          <span className="text-black font-bold">
            Go to Barangay San Perfecto Health Center or click "Contact Us" on
            the Menu bar
          </span>
        </p>
      </form>
    </div>
  );
}

export default Login;

