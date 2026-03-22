import homepageImage from "../assets/images/hpageimg.jpg";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStethoscope, faFileMedical, faHouseChimneyMedical } from "@fortawesome/free-solid-svg-icons";

function Homepage() {
  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
        <div className="absolute inset-0">
          <img
            src={homepageImage}
            alt="San Perfecto Health Center exterior"
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        </div>
        
        <div className="relative px-6 py-16 sm:px-12 sm:py-24 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4 leading-tight">
            Quality Healthcare for <br className="hidden sm:block" />
            <span className="text-red-400">San Perfecto</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 mb-8 max-w-2xl leading-relaxed">
            Welcome to the official portal of Barangay San Perfecto Health Center. 
            Access your medical records, schedule appointments, and connect with 
            our healthcare professionals.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/account" 
              className="px-6 py-3 rounded-xl bg-brand-red text-white font-semibold hover:bg-brand-dark transition-all focus:ring-4 focus:ring-red-500/30 active:scale-95 shadow-lg shadow-red-900/20"
            >
              Sign In to Portal
            </Link>
            <Link 
              to="/contact" 
              className="px-6 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 backdrop-blur-sm transition-all focus:ring-4 focus:ring-white/30 active:scale-95"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Services/Info Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "Online Consultations",
            desc: "Book and manage your appointments with our doctors easily from home.",
            icon: faStethoscope
          },
          {
            title: "Health Records",
            desc: "Securely access your medical history and prescription records anytime.",
            icon: faFileMedical
          },
          {
            title: "Community Program",
            desc: "Stay updated on vaccination drives and barangay health initiatives.",
            icon: faHouseChimneyMedical
          }
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <FontAwesomeIcon icon={item.icon} className="w-6 h-6 text-brand-red" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
            <p className="text-slate-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Homepage;
