import { useState } from "react";

function Cards ({image, serviceName, description}) {

    return (
        <>
            <div className="flex-col items-center justify-center m-[2em] p-[1em] bg-sky-200 border-[3px] rounded-[3%] w-[10em]">
                <div className="font-bold text-center">{serviceName}</div>
                <div className="text-center">{description}</div>
            </div>
        </>
    );
}

export default Cards;