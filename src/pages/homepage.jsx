import React from "react";
import Header from "../components/Header.jsx";
import Cards from "../components/Cards.jsx";

function homepage() {
  return (
    <>
      <div className="flex-column">
        <Header />
        <div className="m-[3em] flex-column">
          <div className="font-bold text-[3rem]">
            WELCOME TO <span className="text-blue-500">BARANGAY SILANGAN</span>{" "}
            E-GOV SERVICES
          </div>

          <div className="text-[1.5rem]">
            Serbisyong pang-barangay? Mas pinadali na, hindi na kailangan ng
            pila!
          </div>
          <div className="grid grid-cols-2 gap-1 max-w-[40em] lg:grid-cols-4 lg:max-w-[50em]">
            <Cards
              serviceName="e-Brgy Clearance"
              description="Para kumuha ng e-Brgy clearance certificate, pindutin dito."
            />
            <Cards
              serviceName="e-Sedula"
              description="Para kumuha ng soft copy ng barangay sedula, pindutin dito."
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default homepage;
