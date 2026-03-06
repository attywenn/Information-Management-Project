function Register ({ setIsRegisteringState }) {
    return (
        <>
            <div className="flex-column justify-center text-center align-center" >
                <div>Account Registration</div>






                <button onClick={() => setIsRegisteringState(true)} className="mt-4 text-red-950 font-bold underline">
                    Back to Login
                </button>
            </div>
        </>
    )
}

export default Register;