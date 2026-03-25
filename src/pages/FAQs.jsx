function FAQs() {
  const faqs = [
    {
      q: "Tuwing kailan pwedeng magpakonsulta sa San Perfecto Health Center?",
      a: "Bukas ang tanggapan ng San Perfecto Health Center mula 8:00 AM hanggang 5:00 PM.",
    },
    {
      q: "Libre ba ang konsultasyon?",
      a: "Opo, libre ang konsultasyon para sa mga residente ng Barangay San Perfecto. Ito ay mula sa buwis ng taumbayan. Walang babayaran ang mga magpapakonsulta mula sa pagpapa-check up hanggang sa mga gamot na ipapamahagi batay sa karamdaman ng pasyente.",
    },
    {
      q: "Sino ang gumawa ng website na ito?",
      a: "Ito ay kontribusyon ng mga iskolar ng bayan mula sa EARIST - College of Computing Studies.",
    },
    {
      q: "Pwede ba akong magpa-schedule ng aking pagpapakonsulta online?",
      a: "Opo, maaaring magpa-schedule ng inyong pagpapakonsulta basta't may access ka sa internet at ang iyong account ay nakarehistro sa aming sistema. Maaari kang pumili ng bakanteng schedule para sa libre at mabilis na konsultasyon mula sa mga propesyunal na barangay health workers. Para magpa-schedule, mag-login lamang sa iyong account at pumunta sa 'Schedule Consultation' section.",
    },
    {
      q: "Puwede bang magpa-konsulta ang mga hindi residente ng Barangay San Perfecto?",
      a: "Hindi po, ang serbisyo ng San Perfecto Health Center ay eksklusibo para sa mga residente ng Barangay San Perfecto. Ito ay upang matiyak na ang mga resources ng health center ay nakalaan para sa mga taong tunay na nangangailangan sa aming komunidad.",
    },
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
              <span className="text-brand-red font-bold text-xl shrink-0">
                Q.
              </span>
              {faq.q}
            </h3>
            <p className="text-slate-600 leading-relaxed pl-8">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQs;
