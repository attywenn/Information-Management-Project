import Navigation from "../components/Navigation.jsx";
import Header from "../components/Header.jsx";

function Account() {
  return (
    <>
      <div className="flex flex-col">
        <Header /> {/* Header content */}
        {/* body contents */}
        <div className="m-2">
          <Navigation /> {/* Menu Bar */}
        </div>
      </div>
    </>
  );
}

export default Account;
