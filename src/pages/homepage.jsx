import React from "react";
import Header from "../components/Header.jsx"

function homepage () {
    return (
        <>  
        <Header />
        <div className="flex justify-center font-bold text-[4rem]">

            <div className="flex-column justify-center mt-[5em]">
                <div>Tsaka na natin ito galawin... kapag approved na...</div>
            </div>
        </div>
        </>
    );
}

export default homepage;