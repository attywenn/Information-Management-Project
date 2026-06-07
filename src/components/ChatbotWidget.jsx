import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase.js";
import { useAuth } from "../context/useAuth.js";
import {
  buildSupportConversationKey,
  createSupportConversationMessage,
  fetchSupportChatTarget,
  fetchSupportConversationMessages,
  sendSupportProblemReport,
} from "../services/supabaseBackendService.js";

const SUGGESTED_QUESTIONS = [
  "Paano gumawa ng account?",
  "Paano magpa-libreng konsulta?",
  "Anong oras nagbubukas ang center?",
  "Paano magpa-schedule ng konsultasyon online?",
  "Saan ang health center?",
  "Paano i-recover ang password?",
  "Pwede ba ang hindi residente?",
];

const buildBotResponse = (message) => {
  const normalized = String(message || "").toLowerCase();
  const responses = [];

  const addResponse = (condition, responseText) => {
    if (condition && !responses.includes(responseText)) {
      responses.push(responseText);
    }
  };

  addResponse(
    ["account", "register", "signup", "sign up", "gawa", "gumawa", "magparehistro", "create"].some((keyword) =>
      normalized.includes(keyword)
    ),
    "Para gumawa ng patient account: pumunta sa Account page, i-click ang 'Create patient account', at kumpletuhin ang registration form. Health worker accounts ay ginagawa ng admin."
  );

  addResponse(
    ["konsulta", "consult", "consultation", "schedule", "appointment", "book"].some((keyword) =>
      normalized.includes(keyword)
    ),
    "Para magpa-schedule ng konsultasyon: mag-login sa iyong account at pumunta sa 'Schedule Consultation' section sa dashboard, pagkatapos pumili ng bakanteng schedule."
  );

  addResponse(
    ["libre", "libreng", "free"].some((keyword) => normalized.includes(keyword)),
    "Libre ang konsultasyon para sa mga residente ng Barangay San Perfecto. Walang babayaran mula checkup hanggang gamot batay sa karamdaman."
  );

  addResponse(
    ["oras", "bukas", "open", "opening", "hours", "time"].some((keyword) => normalized.includes(keyword)),
    "Operating hours: Monday-Friday, 8:00 AM - 5:00 PM. Sarado ang Saturday at Sunday."
  );

  addResponse(
    ["address", "location", "saan", "lugar", "direksyon"].some((keyword) => normalized.includes(keyword)),
    "Address: San Perfecto St., Barangay San Perfecto, City of San Juan, Metro Manila. Coordinates: 14.602968, 121.021655."
  );

  addResponse(
    ["contact", "phone", "number", "tawag", "email"].some((keyword) => normalized.includes(keyword)),
    "Phone: +63 (2) 8123 4567 / 0917-123-4567. Email: sample_email@sanjuan.gov.ph."
  );

  addResponse(
    ["password", "forgot", "recover", "reset"].some((keyword) => normalized.includes(keyword)),
    "Kung nakalimutan ang password, pumunta sa Account page at i-click ang 'Forgot Password?' para sa patient o health worker. Kailangan ang security question at answer."
  );

  addResponse(
    ["hindi residente", "non-resident", "non resident", "resident"].some((keyword) => normalized.includes(keyword)),
    "Ang serbisyo ng San Perfecto Health Center ay para lamang sa mga residente ng Barangay San Perfecto."
  );

  addResponse(
    ["faq", "faqs", "tanong"].some((keyword) => normalized.includes(keyword)),
    "May FAQs page para sa iba pang karaniwang tanong."
  );

  if (responses.length === 0) {
    return "Pasensya, wala pa akong sagot diyan. Maaari mong tingnan ang FAQs o Contact page para sa karagdagang detalye.";
  }

  return responses.join("\n\n");
};

const FALLBACK_RESPONSE =
  "Pasensya, wala pa akong sagot diyan. Maaari mong tingnan ang FAQs o Contact page para sa karagdagang detalye.";

const canUseLiveChat = (role) => role === "patient" || role === "health_worker";

function ChatbotWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState("faq");
  const [showEscalationOptions, setShowEscalationOptions] = useState(false);
  const [lastEscalatedQuestion, setLastEscalatedQuestion] = useState("");
  const [reportSubject, setReportSubject] = useState("JuanitoAI support request");
  const [reportBody, setReportBody] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [supportTarget, setSupportTarget] = useState(null);
  const [supportTargetLoading, setSupportTargetLoading] = useState(false);
  const [supportConversationKey, setSupportConversationKey] = useState("");
  const [supportThreadMessages, setSupportThreadMessages] = useState([]);
  const [supportInputValue, setSupportInputValue] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! Ako si JuanitoAI Assistant. FAQ helper ako para sa San Perfecto Health Center. Magtanong lang tungkol sa account, konsulta, oras, o contact details.",
    },
  ]);
  const scrollRef = useRef(null);
  const supportChannelRef = useRef(null);

  const conversationMessages = useMemo(() => {
    return mode === "chat" ? supportThreadMessages : messages;
  }, [messages, mode, supportThreadMessages]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationMessages, isOpen]);

  useEffect(() => {
    const activeChannel = supportChannelRef.current;
    return () => {
      if (activeChannel) {
        void supabase.removeChannel(activeChannel);
        supportChannelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || mode !== "chat" || !supportConversationKey) {
      return undefined;
    }

    let ignore = false;

    const loadThread = async () => {
      setSupportLoading(true);
      setSupportError("");
      try {
        const rows = await fetchSupportConversationMessages(supportConversationKey);
        if (!ignore) {
          setSupportThreadMessages(rows || []);
        }
      } catch (error) {
        if (!ignore) {
          setSupportError(error?.message || "Unable to load live chat.");
        }
      } finally {
        if (!ignore) {
          setSupportLoading(false);
        }
      }
    };

    void loadThread();

    const channel = supabase
      .channel(`juanito-support-${supportConversationKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_key=eq.${supportConversationKey}`,
        },
        () => {
          void loadThread();
        }
      )
      .subscribe();

    supportChannelRef.current = channel;

    return () => {
      ignore = true;
      void supabase.removeChannel(channel);
      if (supportChannelRef.current === channel) {
        supportChannelRef.current = null;
      }
    };
  }, [isOpen, mode, supportConversationKey]);

  const ensureSupportTarget = async () => {
    if (supportTarget?.user_id) {
      return supportTarget;
    }

    setSupportTargetLoading(true);
    try {
      const target = await fetchSupportChatTarget();
      setSupportTarget(target);
      return target;
    } finally {
      setSupportTargetLoading(false);
    }
  };

  const handleResetToFaq = () => {
    setMode("faq");
    setShowEscalationOptions(false);
    setLastEscalatedQuestion("");
    setSupportConversationKey("");
    setSupportThreadMessages([]);
    setSupportInputValue("");
    setReportError("");
    setReportMessage("");
    setReportSubmitting(false);
    setSupportError("");
  };

  const sendMessage = (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    const response = buildBotResponse(trimmed);

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text: trimmed },
      { id: `bot-${Date.now() + 1}`, role: "assistant", text: response },
    ]);
    setInputValue("");

    if (response === FALLBACK_RESPONSE) {
      setShowEscalationOptions(true);
      setLastEscalatedQuestion(trimmed);
      setReportBody(trimmed);
      setReportSubject("JuanitoAI support request");
      return;
    }

    setShowEscalationOptions(false);
    setLastEscalatedQuestion("");
  };

  const startLiveChat = async () => {
    if (!user?.id) {
      setReportError("Kailangan mong naka-login para sa live chat.");
      return;
    }

    if (!canUseLiveChat(user?.role)) {
      setReportError("Live chat is available for patients and health workers only.");
      return;
    }

    setReportError("");
    setReportMessage("");

    try {
      const target = await ensureSupportTarget();
      if (!target?.user_id) {
        throw new Error("Support admin mailbox is not available.");
      }

      const conversationKey = buildSupportConversationKey(user.id, target.user_id);
      setSupportConversationKey(conversationKey);
      setMode("chat");
      setShowEscalationOptions(false);
      setSupportThreadMessages([]);

      if (lastEscalatedQuestion) {
        setSupportInputValue(lastEscalatedQuestion);
      }
    } catch (error) {
      setReportError(error?.message || "Unable to start live chat.");
    }
  };

  const submitSupportReport = async (event) => {
    event.preventDefault();

    const subject = String(reportSubject || "").trim();
    const body = String(reportBody || "").trim();
    if (!subject || !body) {
      setReportError("Subject and problem details are required.");
      return;
    }

    setReportSubmitting(true);
    setReportError("");
    setReportMessage("");

    try {
      await sendSupportProblemReport({ subject, body });
      setReportMessage("Naipadala na ang report mo sa admin.");
      setShowEscalationOptions(false);
      setReportBody("");
      setMode("faq");
      setLastEscalatedQuestion("");
    } catch (error) {
      setReportError(error?.message || "Unable to submit support report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSupportSend = async (event) => {
    event.preventDefault();

    const trimmed = String(supportInputValue || "").trim();
    if (!trimmed) {
      return;
    }

    if (!user?.id) {
      setSupportError("Kailangan mong naka-login para mag-live chat.");
      return;
    }

    if (!canUseLiveChat(user?.role)) {
      setSupportError("Live chat is available for patients and health workers only.");
      return;
    }

    setSupportSending(true);
    setSupportError("");

    try {
      const target = await ensureSupportTarget();
      if (!target?.user_id) {
        throw new Error("Support admin mailbox is not available.");
      }

      const conversationKey = supportConversationKey || buildSupportConversationKey(user.id, target.user_id);
      setSupportConversationKey(conversationKey);
      await createSupportConversationMessage({
        recipientUserId: target.user_id,
        subject: "JuanitoAI live chat",
        body: trimmed,
        messageType: "support_chat",
        conversationKey,
      });

      setSupportInputValue("");
      const nextMessages = await fetchSupportConversationMessages(conversationKey);
      setSupportThreadMessages(nextMessages || []);
    } catch (error) {
      setSupportError(error?.message || "Unable to send live chat message.");
    } finally {
      setSupportSending(false);
    }
  };

  const visibleFaqMessages = mode === "faq" ? messages : [];
  const visibleSupportMessages = mode === "chat" ? supportThreadMessages : [];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === "chat") {
      void handleSupportSend(event);
      return;
    }

    sendMessage(inputValue);
  };

  const handleSuggestion = (question) => {
    if (mode !== "faq") {
      handleResetToFaq();
    }
    sendMessage(question);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 font-sans select-none">
      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] sm:h-[580px] rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col transition-all duration-300 ease-out select-text">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-inner font-bold text-sm tracking-widest">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.188.904z" />
                </svg>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-white leading-tight">JuanitoAI</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                    {mode === "chat" ? "Live support with admin" : "Online FAQ Helper"}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
              aria-label="Close chatbot"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium flex items-center justify-center gap-1.5 shrink-0">
            <span>
              {mode === "chat"
                ? "Nakakonekta ka sa admin live chat."
                : "Mabilisang sagot sa iyong katanungan, kabayan!"}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/20 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
            aria-live="polite"
          >
            {supportError ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">
                {supportError}
              </div>
            ) : null}

            {mode === "chat" && !supportLoading && visibleSupportMessages.length === 0 ? (
              <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Live chat is ready.</p>
                <p className="mt-1 leading-relaxed">
                  Ipadala ang iyong concern dito at makikita ito ng admin sa realtime.
                </p>
              </div>
            ) : null}

            {supportLoading && mode === "chat" ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
                Loading live chat...
              </div>
            ) : null}

            {mode === "faq"
              ? visibleFaqMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" ? (
                      <div className="flex items-start gap-2.5 max-w-[85%]">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.188.904z" />
                          </svg>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs whitespace-pre-wrap select-text">
                          {message.text}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-tr from-red-600 to-rose-500 text-white rounded-2xl rounded-tr-none px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm max-w-[85%] whitespace-pre-wrap select-text">
                        {message.text}
                      </div>
                    )}
                  </div>
                ))
              : null}

            {mode === "chat"
              ? visibleSupportMessages.map((message) => {
                  const isMine = String(message.sender_user_id || "") === String(user?.id || "");
                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap select-text ${
                          isMine
                            ? "bg-gradient-to-tr from-red-600 to-rose-500 text-white rounded-tr-none"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none"
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">
                          {isMine ? "You" : message.sender_display_name || "Admin"}
                        </p>
                        {message.body}
                      </div>
                    </div>
                  );
                })
              : null}
          </div>

          {showEscalationOptions && mode === "faq" ? (
            <div className="px-4 pt-3 pb-2 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 shrink-0 space-y-2">
              <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">Need more help?</p>
                <p className="text-sm text-slate-700 mt-1">
                  If JuanitoAI cannot resolve it, you can report the problem or open a live chat with admin.
                </p>
                {reportMessage ? <p className="text-xs font-semibold text-emerald-700 mt-2">{reportMessage}</p> : null}
                {reportError ? <p className="text-xs font-semibold text-red-600 mt-2">{reportError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("report");
                      setReportBody(lastEscalatedQuestion || reportBody || "");
                    }}
                    className="rounded-full bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-all"
                  >
                    Report your problem
                  </button>
                  {canUseLiveChat(user?.role) ? (
                    <button
                      type="button"
                      onClick={() => void startLiveChat()}
                      disabled={supportTargetLoading}
                      className="rounded-full border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {supportTargetLoading ? "Loading admin..." : "Start live chat"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {mode === "report" ? (
            <div className="px-4 pt-3 pb-2 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Report your problem</p>
                <button
                  type="button"
                  onClick={handleResetToFaq}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                >
                  Back to JuanitoAI
                </button>
              </div>
              <form onSubmit={submitSupportReport} className="space-y-2">
                <input
                  type="text"
                  value={reportSubject}
                  onChange={(event) => setReportSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <textarea
                  value={reportBody}
                  onChange={(event) => setReportBody(event.target.value)}
                  rows={4}
                  placeholder="Describe the problem here..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={reportSubmitting || !reportSubject.trim() || !reportBody.trim()}
                    className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {reportSubmitting ? "Sending..." : "Send to admin email"}
                  </button>
                  {canUseLiveChat(user?.role) ? (
                    <button
                      type="button"
                      onClick={() => void startLiveChat()}
                      disabled={supportTargetLoading}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {supportTargetLoading ? "Loading..." : "Live chat"}
                    </button>
                  ) : null}
                </div>
                {reportError ? <p className="text-xs font-medium text-red-600">{reportError}</p> : null}
                {reportMessage ? <p className="text-xs font-medium text-emerald-700">{reportMessage}</p> : null}
              </form>
            </div>
          ) : null}

          {mode === "faq" ? (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950 shrink-0">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Smart suggestions</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-900 snap-x snap-mandatory">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleSuggestion(question)}
                    className="text-[11px] px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-slate-600 dark:text-slate-300 hover:text-red-650 dark:hover:text-red-400 border border-slate-200/50 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/40 transition-all duration-200 whitespace-nowrap snap-start cursor-pointer font-medium"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mode !== "report" ? (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-4 pr-1.5 py-1 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 dark:focus-within:border-red-500/50 transition-all duration-200">
                  <input
                    type="text"
                    value={mode === "chat" ? supportInputValue : inputValue}
                    onChange={(event) => {
                      if (mode === "chat") {
                        setSupportInputValue(event.target.value);
                      } else {
                        setInputValue(event.target.value);
                      }
                    }}
                    placeholder={mode === "chat" ? "Type your message to admin..." : "Magtanong dito..."}
                    className="flex-1 bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs py-1.5 focus:ring-0 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={mode === "chat" ? !supportInputValue.trim() || supportSending : !inputValue.trim()}
                    className="h-8 w-8 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    aria-label="Send message"
                  >
                    <svg className="w-3.5 h-3.5 text-white transform rotate-45 -translate-x-0.5 translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              {mode === "chat" ? (
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={handleResetToFaq}
                    className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                  >
                    Back to JuanitoAI
                  </button>
                  <p className="text-[10px] text-slate-400">Realtime support via Supabase</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-rose-600 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-300"></div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative h-14 w-14 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 border border-white/10 cursor-pointer"
          aria-label="Open chatbot"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="relative">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatbotWidget;
