function FAQs() {
  const faqs = [
    {
      q: "What are the health center's operating hours?",
      a: "We are open from Monday to Friday, 8:00 AM to 5:00 PM. We are closed on weekends and regular Philippine holidays."
    },
    {
      q: "How do I schedule an appointment?",
      a: "You can schedule an appointment by logging into your account on this portal or by visiting the center in person."
    },
    {
      q: "Are the services completely free?",
      a: "Yes, basic health consultations and available municipal medicines are fully subsidized for residents of Barangay San Perfecto."
    },
    {
      q: "What do I need to bring for my first visit?",
      a: "Please bring a valid ID verifying your residence in San Perfecto and your PhilHealth ID if available."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-slate-600">
          Find answers to common questions about our services and policies.
        </p>
      </div>

      <div className="grid gap-4">
        {faqs.map((faq, index) => (
          <div 
            key={index}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-start gap-3">
              <span className="text-brand-red font-bold text-xl shrink-0">Q.</span>
              {faq.q}
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQs;