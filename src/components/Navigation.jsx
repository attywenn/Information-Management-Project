

function Navigation () {
    return (
        <>
            <div className="font-[roboto] max-h-[3rem] bg-red-950 text-[clamp(1rem,1vw,1.5rem)] p-[clamp(0.3rem,0.5rem,1rem)] text-white rounded-[5em]">
                <nav className="flex justify-around font-bold">
                    <a href="/">Home</a>
                    <a href="/">Account</a>
                    <a href="/">Navigate</a>
                    <a href="/">FAQs</a>
                </nav>
            </div>
        
        </>
    );
}

export default Navigation;