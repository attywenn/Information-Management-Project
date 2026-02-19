

function Login () {
    return (
        <div className="flex flex-col items-center justify-center mt-8 font-[roboto]">
            <h1 className="text-2xl font-bold mb-4 text-red-950">Login as Patient</h1>
            <form className="flex flex-col items-center">
                <input
                    type="text"
                    placeholder="Account ID"
                    className="mb-2 p-2 border border-gray-300 rounded"
                />
                <input
                    type="password"
                    placeholder="Password"
                    className="mb-4 p-2 border border-gray-300 rounded"
                />
                <label htmlFor="dob" className="font-bold ">Birthdate</label>
                <input 
                    type="date"
                    name="dob"
                    placeholder="Date of Birth"
                    className="mb-4 p-2 border border-gray-300 rounded"
                />
                <button
                    type="submit"
                    className="bg-red-950 text-white px-4 py-2 rounded hover:bg-red-800"
                >
                    Login
                </button>
            </form>
        </div>
    );
}

export default Login;