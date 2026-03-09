import { useState } from "react";

function Register({ setIsRegisteringState }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [surname, setSurname] = useState("");
    const [firstname, setFirstname] = useState("");
    const [middlename, setMiddlename] = useState("");
    const [dob, setDob] = useState("");
    const [address, setAddress] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/register/patient", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password,
                    surname,
                    firstname,
                    middlename,
                    dob,
                    address,
                    contactNumber,
                    profileImage,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess("Registration successful. You can now log in.");
                setUsername("");
                setPassword("");
                setConfirmPassword("");
                setSurname("");
                setFirstname("");
                setMiddlename("");
                setDob("");
                setAddress("");
                setContactNumber("");
                setProfileImage("");
                // Optionally switch back to login after a short delay
                setTimeout(() => setIsRegisteringState(true), 1500);
            } else {
                setError(data.message || "Registration failed");
            }
        } catch (err) {
            setError(err.message || "Network error. Is the backend running?");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col justify-center text-center items-center w-full max-w-md">
            <h1 className="text-2xl font-bold mb-4 text-black">Patient Registration</h1>
            <p className="mt-1 text-center max-w-[20rem] font-semibold text-black/70 mb-4">
                Create a patient account. Health worker accounts are created by an admin.
            </p>

            <form
                onSubmit={handleSubmit}
                className="w-full flex flex-col items-stretch space-y-2 text-left"
            >
                {error && (
                    <p className="mb-1 text-sm text-red-600 font-medium text-center">
                        {error}
                    </p>
                )}
                {success && (
                    <p className="mb-1 text-sm text-green-600 font-medium text-center">
                        {success}
                    </p>
                )}

                <label className="font-bold" htmlFor="reg-username">
                    Username
                </label>
                <input
                    id="reg-username"
                    type="text"
                    className="p-2 border border-red-950 rounded"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a unique username"
                    required
                />


                <label className="font-bold" htmlFor="reg-surname">
                    Surname
                </label>
                <input
                    id="reg-surname"
                    type="text"
                    className="p-2 border border-red-950 rounded"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-firstname">
                    First name
                </label>
                <input
                    id="reg-firstname"
                    type="text"
                    className="p-2 border border-red-950 rounded"
                    value={firstname}
                    onChange={(e) => setFirstname(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-middlename">
                    Middle name (optional)
                </label>
                <input
                    id="reg-middlename"
                    type="text"
                    className="p-2 border border-red-950 rounded"
                    value={middlename}
                    onChange={(e) => setMiddlename(e.target.value)}
                />
                <label className="font-bold" htmlFor="reg-password">
                    Password
                </label>
                <input
                    id="reg-password"
                    type="password"
                    className="p-2 border border-red-950 rounded"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-confirm-password">
                    Confirm Password
                </label>
                <input
                    id="reg-confirm-password"
                    type="password"
                    className="p-2 border border-red-950 rounded"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-dob">
                    Birthdate
                </label>
                <input
                    id="reg-dob"
                    type="date"
                    className="p-2 border border-red-950 rounded"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-address">
                    Address
                </label>
                <textarea
                    id="reg-address"
                    className="p-2 border border-red-950 rounded"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-contact">
                    Contact number
                </label>
                <input
                    id="reg-contact"
                    type="text"
                    className="p-2 border border-red-950 rounded"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                />

                <label className="font-bold" htmlFor="reg-profile-image">
                    Profile image (URL or filename)
                </label>
                <input
                    id="reg-profile-image"
                    type="text"
                    className="p-2 border border-red-950 rounded mb-2"
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    placeholder="Upload separately and paste path, or enter filename"
                />

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 font-bold bg-red-950 text-white px-4 py-2 rounded hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Registering..." : "Register as Patient"}
                </button>
            </form>

            <button
                onClick={() => setIsRegisteringState(true)}
                className="mt-4 text-red-950 font-bold underline"
            >
                Back to Login
            </button>
        </div>
    );
}

export default Register;