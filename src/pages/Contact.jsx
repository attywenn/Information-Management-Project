function Contact() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Contact Us</h1>
        <p className="text-lg text-slate-600">
          Get in touch with Barangay San Perfecto Health Center
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info Card */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Health Center Info</h2>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="text-2xl mt-1">📍</div>
              <div>
                <h3 className="font-semibold text-slate-900">Address</h3>
                <p className="text-slate-600">123 Perfecto St., Barangay San Perfecto<br/>City of San Juan, Metro Manila</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="text-2xl mt-1">📞</div>
              <div>
                <h3 className="font-semibold text-slate-900">Phone</h3>
                <p className="text-slate-600">+63 (2) 8123 4567<br/>0917-123-4567</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="text-2xl mt-1">✉️</div>
              <div>
                <h3 className="font-semibold text-slate-900">Email</h3>
                <p className="text-brand-red font-medium">hc.sanperfecto@sanjuan.gov.ph</p>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Hours Card */}
        <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold mb-6">Operating Hours</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <span className="font-medium">Monday - Friday</span>
              <span className="text-slate-300">8:00 AM - 5:00 PM</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <span className="font-medium">Saturday</span>
              <span className="text-red-400 font-medium">Closed</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Sunday</span>
              <span className="text-red-400 font-medium">Closed</span>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-slate-800 rounded-xl">
            <p className="text-sm text-slate-300 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              In case of severe emergency, please go to the nearest general hospital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;

