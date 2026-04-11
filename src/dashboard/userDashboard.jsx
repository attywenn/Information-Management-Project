import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DashboardNavigation from "../components/dashboardNavigation.jsx";
import { useAuth } from "../context/useAuth.js";
import { Pie, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { QRCodeSVG } from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faCalendarDays, faFileMedical, faStethoscope, faBox } from "@fortawesome/free-solid-svg-icons";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const COMMON_SYMPTOMS = [
    "Fever",
    "Cough",
    "Colds",
    "Headache",
    "Sore throat",
    "Body pain",
    "Stomach ache",
    "Diarrhea",
    "Dizziness",
    "Others",
];

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const STORAGE_KEYS = {
    scheduleByDate: "sanperfecto-schedule-by-date",
    inboxMessages: "sanperfecto-inbox-messages",
    appointments: "sanperfecto-appointments",
    consultations: "sanperfecto-consultations",
    inventory: "sanperfecto-inventory",
    accounts: "sanperfecto-accounts",
};

const SETTINGS_STORAGE_PREFIX = "sanperfecto-settings";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAILY_MAX_APPOINTMENTS = 100;
const SLOT_MAX_APPOINTMENTS = 20;
const BOOKING_WINDOW_DAYS = 14;
const APPOINTMENT_TIME_SLOTS = [
    "8:00 AM - 10:00 AM",
    "10:00 AM - 12:00 PM",
    "12:00 PM - 2:00 PM",
    "2:00 PM - 4:00 PM",
    "4:00 PM - 6:00 PM",
    "6:00 PM - 8:00 PM",
    "8:00 PM - 10:00 PM",
];

const INITIAL_INVENTORY = [
    { id: "med-paracetamol", name: "Paracetamol", category: "medicine", quantity: 120, unit: "tablets" },
    { id: "med-ibuprofen", name: "Ibuprofen", category: "medicine", quantity: 90, unit: "tablets" },
    { id: "med-loperamide", name: "Loperamide", category: "medicine", quantity: 75, unit: "capsules" },
    { id: "med-amoxicillin", name: "Amoxicillin", category: "medicine", quantity: 60, unit: "capsules" },
    { id: "aid-cane", name: "Walking Cane", category: "aid", quantity: 18, unit: "pcs" },
    { id: "aid-walker", name: "Walker", category: "aid", quantity: 10, unit: "pcs" },
    { id: "aid-wheelchair", name: "Wheelchair", category: "aid", quantity: 6, unit: "pcs" },
];

const loadStoredJson = (key, fallback) => {
    try {
        const stored = window.localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch {
        return fallback;
    }
};

const formatLongDate = (dateKey) => {
    const date = parseDateKey(dateKey);
    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

const buildPatientDisplayName = (user) => user?.displayName || user?.username || "Patient";

const calculateAge = (dobValue) => {
    if (!dobValue) return "N/A";
    const dob = new Date(dobValue);
    if (Number.isNaN(dob.getTime())) return "N/A";

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1;
    }
    return age >= 0 ? String(age) : "N/A";
};

const buildAddressLine = (accountUser) => {
    if (!accountUser) return "N/A";
    if (accountUser.fullAddress) return accountUser.fullAddress;

    const address = typeof accountUser.address === "object" ? accountUser.address : {};
    const house = address.houseNumber || accountUser.houseNumber || "";
    const street = address.street || address.streetName || accountUser.streetName || "";
    const purok = address.purokSubdivision || accountUser.purokSubdivision || "";

    const localParts = [house, street, purok].filter(Boolean);
    const hierarchy = ["Barangay San Perfecto", "San Juan City", "Metro Manila", "NCR"];
    const parts = [...localParts, ...hierarchy];
    return parts.join(", ");
};

const buildPatientCode = (seedText) => {
    const digits = String(hashText(seedText) % 1000000000000).padStart(12, "0");
    return `PATIENT${digits}`;
};

const buildSlotStartDate = (dateKey, timeSlot) => {
    if (!dateKey || !timeSlot) return null;
    const date = parseDateKey(dateKey);
    const startPart = (timeSlot.split("-")[0] || "").trim();
    const [timeText, meridiemRaw] = startPart.split(" ");
    const meridiem = (meridiemRaw || "").toUpperCase();
    const [h, m] = (timeText || "").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

    let hour = h;
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    date.setHours(hour, m, 0, 0);
    return date;
};

const getSettingsStorageKey = (user) => {
    const keyPart = user?.patientCode || user?.workerId || user?.adminId || user?.username || "anonymous";
    return `${SETTINGS_STORAGE_PREFIX}-${user?.role || "guest"}-${keyPart}`;
};

const createDefaultSettingsDraft = (user) => ({
    avatarDataUrl: user?.avatarDataUrl || "",
    surname: user?.surname || "",
    firstname: user?.firstname || "",
    middlename: user?.middlename || "",
    houseNumber:
        typeof user?.address === "object"
            ? user?.address?.houseNumber || ""
            : user?.houseNumber || "",
    streetName:
        typeof user?.address === "object"
            ? user?.address?.street || user?.address?.streetName || ""
            : user?.streetName || "",
    purokSubdivision:
        typeof user?.address === "object"
            ? user?.address?.purokSubdivision || ""
            : user?.purokSubdivision || "",
    email: user?.email || "",
    dob: user?.dob || "",
    password: user?.password || "",
    pinCode: user?.pinCode || "",
    adminId: user?.adminId || "",
    licenseId: user?.systemLicenseNumber || user?.workerId || "",
    theme: user?.theme || "light",
});

const HOLIDAY_LOOKUP = {
    "01-01": "New Year's Day",
    "04-09": "Araw ng Kagitingan",
    "05-01": "Labor Day",
    "06-12": "Independence Day",
    "11-30": "Bonifacio Day",
    "12-25": "Christmas Day",
    "12-30": "Rizal Day",
};

const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const parseDateKey = (dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const hashText = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const createMockSymptoms = (seed, bookedCount) => {
    const symptomCounts = {};
    const selectable = COMMON_SYMPTOMS.filter((s) => s !== "Others");
    for (let i = 0; i < bookedCount; i += 1) {
        const symptom = selectable[(seed + i) % selectable.length];
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
    }
    return symptomCounts;
};

const createMockSlotBookings = (seed, bookedCount) => {
    const slotBookings = APPOINTMENT_TIME_SLOTS.reduce((acc, slot) => {
        acc[slot] = 0;
        return acc;
    }, {});
    for (let i = 0; i < bookedCount; i += 1) {
        const slot = APPOINTMENT_TIME_SLOTS[(seed + i) % APPOINTMENT_TIME_SLOTS.length];
        slotBookings[slot] += 1;
    }
    return slotBookings;
};

const buildDaySchedule = (date) => {
    const key = formatDateKey(date);
    const mmdd = key.slice(5);
    const holidayName = HOLIDAY_LOOKUP[mmdd] || null;
    const seed = hashText(key);
    const capacity = DAILY_MAX_APPOINTMENTS;
    const booked = holidayName ? 0 : seed % (capacity + 1);

    return {
        dateKey: key,
        capacity,
        booked,
        holidayName,
        symptomCounts: holidayName ? {} : createMockSymptoms(seed, booked),
        slotBookings: holidayName ? {} : createMockSlotBookings(seed, booked),
    };
};

function UserDashboard() {
    const { user, updateUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    const [stats, setStats] = useState({ patientCount: 0, healthWorkerCount: 0 });
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState("");

    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");

    const [manageError, setManageError] = useState("");
    const [manageMessage, setManageMessage] = useState("");
    const [manageForm, setManageForm] = useState({
        username: "",
        email: "",
        password: "",
        surname: "",
        firstname: "",
        middlename: "",
        securityQuestionText: "What is your staff security keyword?",
        securityAnswer: "",
    });

    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [scheduleByDate, setScheduleByDate] = useState(() => loadStoredJson(STORAGE_KEYS.scheduleByDate, {}));
    const [appointments, setAppointments] = useState(() => loadStoredJson(STORAGE_KEYS.appointments, []));
    const [consultations, setConsultations] = useState(() => loadStoredJson(STORAGE_KEYS.consultations, []));
    const [inventoryItems, setInventoryItems] = useState(() => loadStoredJson(STORAGE_KEYS.inventory, INITIAL_INVENTORY));
    const [selectedDateKey, setSelectedDateKey] = useState("");
    const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [otherSymptomText, setOtherSymptomText] = useState("");
    const [appointmentMessage, setAppointmentMessage] = useState("");
    const [scheduleError, setScheduleError] = useState("");
    const [inboxMessages, setInboxMessages] = useState(() => loadStoredJson(STORAGE_KEYS.inboxMessages, []));
    const [activeInboxMessage, setActiveInboxMessage] = useState(null);
    const [qrModalAppointment, setQrModalAppointment] = useState(null);
    const [consultationScanValue, setConsultationScanValue] = useState("");
    const [consultationScannedPatientCode, setConsultationScannedPatientCode] = useState("");
    const [consultationTarget, setConsultationTarget] = useState(null);
    const [consultationForm, setConsultationForm] = useState({
        diagnosis: "",
        medicineId: "",
        medicineQuantity: 1,
        note: "",
    });
    const [consultationMessage, setConsultationMessage] = useState("");
    const [consultationError, setConsultationError] = useState("");
    const [inventoryViewMode, setInventoryViewMode] = useState("all");
    const [inventoryMessage, setInventoryMessage] = useState("");
    const [inventoryError, setInventoryError] = useState("");
    const [inventoryForm, setInventoryForm] = useState({ name: "", category: "medicine", quantity: 0, unit: "pcs" });
    const [inventoryAmounts, setInventoryAmounts] = useState({});
    const [settingsDraft, setSettingsDraft] = useState(() => {
        const initialDraft = createDefaultSettingsDraft(user);
        return { ...initialDraft, ...loadStoredJson(getSettingsStorageKey(user), {}) };
    });
    const [settingsMessage, setSettingsMessage] = useState("");
    const [settingsError, setSettingsError] = useState("");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

    // Frontend-only stats for admin / health workers
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!user?.role || (user.role !== "admin" && user.role !== "health_worker")) {
                setStats({ patientCount: 0, healthWorkerCount: 0 });
                setStatsLoading(false);
                setStatsError("");
                return;
            }

            setStatsLoading(true);
            setStatsError("");
            setStats({ patientCount: 128, healthWorkerCount: 12 });
            setStatsLoading(false);
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [user?.role]);

    // Frontend-only profile data when visiting profile tab
    useEffect(() => {
        const timer = setTimeout(() => {
            if (path !== "/profile" || !user) {
                setProfile(null);
                setProfileLoading(false);
                setProfileError("");
                return;
            }

            setProfileLoading(true);
            setProfileError("");
            setProfile({
                username: user.username,
                surname: user.surname || "",
                firstname: user.firstname || "",
                middlename: user.middlename || "",
                dob: user.dob || "",
                age: calculateAge(user.dob),
                address: buildAddressLine(user),
                email: user.role === "admin" ? "admin@sanperfecto.local" : "",
                role: user.role,
                profileImageUrl: user.avatarDataUrl || "",
            });
            setProfileLoading(false);
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [path, user]);

    const pieData = useMemo(() => {
        return {
            labels: ["Patients", "Health workers"],
            datasets: [
                {
                    data: [stats.patientCount, stats.healthWorkerCount],
                    backgroundColor: ["#ef4444", "#0ea5e9"],
                    borderColor: ["#ffffff", "#ffffff"],
                    borderWidth: 1,
                },
            ],
        };
    }, [stats.patientCount, stats.healthWorkerCount]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEYS.scheduleByDate, JSON.stringify(scheduleByDate));
    }, [scheduleByDate]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(appointments));
    }, [appointments]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEYS.consultations, JSON.stringify(consultations));
    }, [consultations]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventoryItems));
    }, [inventoryItems]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEYS.inboxMessages, JSON.stringify(inboxMessages));
    }, [inboxMessages]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    }, []);

    const handleManageSubmit = async (e) => {
        e.preventDefault();
        setManageError("");
        setManageMessage("");
        try {
            await new Promise((resolve) => setTimeout(resolve, 250));
            setManageMessage("Health worker account saved locally for UI testing.");
            setManageForm({
                username: "",
                email: "",
                password: "",
                surname: "",
                firstname: "",
                middlename: "",
                securityQuestionText: manageForm.securityQuestionText,
                securityAnswer: "",
            });
        } catch {
            setManageError("Unable to save account.");
        }
    };

    const renderDashboardHome = () => {
        if (!user) return null;
        if (user.role === "admin") {    
            return (    
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            Maligayang araw{user.username ? `, ${user.username}` : ""}!
                        </h1>
                        <p className="text-slate-600">
                            You are logged in as <span className="font-semibold text-brand-red px-2 py-0.5 bg-red-50 rounded-md text-xs uppercase tracking-wide">Administrator</span>
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Accounts Overview</h2>
                            {statsLoading ? (
                                <div className="animate-pulse flex space-x-4">
                                    <div className="rounded-full bg-slate-200 h-48 w-48 mx-auto"></div>
                                </div>
                            ) : statsError ? (
                                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                            ) : (
                                <div className="h-64 flex justify-center">
                                    <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                                </div>
                            )}
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center gap-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Registered Patients</p>
                                <p className="text-4xl font-bold text-brand-red">
                                    {stats.patientCount}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Health Workers</p>
                                <p className="text-4xl font-bold text-slate-700">
                                    {stats.healthWorkerCount}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (user.role === "health_worker") {
            return (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            Maligayang araw{user.username ? `, ${user.username}` : ""}!
                        </h1>
                        <p className="text-slate-600">
                            You are logged in as <span className="font-semibold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md text-xs uppercase tracking-wide">Health Worker</span>
                        </p>
                    </div>
                    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-md">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Patient Overview</h2>
                        {statsLoading ? (
                            <div className="h-10 bg-slate-200 rounded animate-pulse w-24"></div>
                        ) : statsError ? (
                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                        ) : (
                            <p className="text-5xl font-bold text-brand-red">
                                {stats.patientCount}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Link
                            to="/consultation"
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <div className="mb-3 w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
                                <FontAwesomeIcon icon={faStethoscope} className="w-5 h-5 text-sky-600" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Consultation</h3>
                            <p className="text-sm text-slate-500 mt-1">Scan booked patient QR codes and record diagnosis.</p>
                        </Link>
                        <Link
                            to="/inventory"
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <div className="mb-3 w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <FontAwesomeIcon icon={faBox} className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Inventory</h3>
                            <p className="text-sm text-slate-500 mt-1">View medicines and assistive devices.</p>
                        </Link>
                    </div>
                </div>
            );
        }
        // Patient
        const patientCode = user?.patientCode || buildPatientCode(user?.username || "");
        const upcomingAppointment = appointments
            .filter((entry) => entry.patientCode === patientCode && entry.status === "booked")
            .map((entry) => ({
                ...entry,
                slotStartAt: buildSlotStartDate(entry.dateKey, entry.timeSlot),
            }))
            .filter((entry) => entry.slotStartAt && entry.slotStartAt.getTime() >= currentDateTime.getTime())
            .sort((a, b) => a.slotStartAt - b.slotStartAt)[0];

        const recentInbox = inboxMessages.slice(0, 3);
        const cycleMinutes = 6 * 60;
        const elapsedMinutes = currentDateTime.getHours() * 60 + currentDateTime.getMinutes();
        const remainingCycleMinutes = cycleMinutes - (elapsedMinutes % cycleMinutes || cycleMinutes);
        const reminderHours = Math.floor(remainingCycleMinutes / 60);
        const reminderMinutes = remainingCycleMinutes % 60;
        const useNextPhrase = reminderHours >= 4;
        const assumedParacetamolIntake = Math.min(20, Math.floor(elapsedMinutes / cycleMinutes) + 1);
        const paracetamolRemaining = Math.max(0, 20 - assumedParacetamolIntake);
        const minutesSinceLastIntake = elapsedMinutes % cycleMinutes;
        const passedHours = Math.floor(minutesSinceLastIntake / 60);
        const passedMinutes = minutesSinceLastIntake % 60;
        const intakeProgressPercent = Math.min(100, Math.round((assumedParacetamolIntake / 20) * 100));

        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                    Maligayang araw{user.username ? `, ${user.username}` : ""}!
                </h1>
                <p className="text-slate-600">
                    Welcome to your <span className="font-semibold text-brand-red px-2 py-0.5 bg-red-50 rounded-md text-xs uppercase tracking-wide">Patient Portal</span>
                </p>

                <section className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-2">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-brand-red" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Upcoming Appointment</h3>
                        {upcomingAppointment ? (
                            <div className="mt-2 space-y-1">
                                <p className="text-sm text-slate-600">
                                    {formatLongDate(upcomingAppointment.dateKey)} at {upcomingAppointment.timeSlot}
                                </p>
                                <p className="text-sm text-slate-500">Symptoms logged: {upcomingAppointment.symptoms?.join(", ") || "None"}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 mt-1">No upcoming appointment</p>
                        )}
                        <Link
                            to="/schedules"
                            className="inline-block mt-4 bg-brand-red text-white font-semibold px-4 py-2 rounded-lg hover:bg-brand-dark transition-all"
                        >
                            Get free consulation now
                        </Link>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-brand-red" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Date & Time</h3>
                        <p className="text-sm text-slate-600 mt-1">{currentDateTime.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{currentDateTime.toLocaleTimeString("en-PH")}</p>
                    </div>

                    <div className="bg-linear-to-br from-red-600 to-red-700 p-6 rounded-2xl shadow-sm text-white">
                        <h3 className="font-bold text-lg">Medicine Intake Reminder</h3>
                        <p className="text-sm text-red-100 mt-2 leading-relaxed">
                            {useNextPhrase
                                ? `You are going to take paracetamol biogesic in the next ${reminderHours} hours ${reminderMinutes} minutes.`
                                : `You are going to take paracetamol biogesic in ${reminderHours} hour${reminderHours === 1 ? "" : "s"} and ${reminderMinutes} minutes.`}
                        </p>
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-red-100 mb-1">
                                <span>Assumed intake: {assumedParacetamolIntake}</span>
                                <span>Remaining: {paracetamolRemaining}</span>
                            </div>
                            <div className="h-2 rounded-full bg-red-400/60 overflow-hidden">
                                <div className="h-full bg-white" style={{ width: `${intakeProgressPercent}%` }} />
                            </div>
                            <p className="text-xs text-red-100 mt-2">
                                Time passed since last intake: {passedHours} hour{passedHours === 1 ? "" : "s"} {passedMinutes} minutes
                            </p>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800">Inbox Widget</h3>
                            <Link to="/inbox" className="text-sm font-semibold text-brand-red hover:text-brand-dark">View all</Link>
                        </div>
                        {recentInbox.length === 0 ? (
                            <p className="text-sm text-slate-500">No recent messages.</p>
                        ) : (
                            <div className="space-y-2">
                                {recentInbox.map((message) => (
                                    <button
                                        key={message.id}
                                        type="button"
                                        onClick={() => setActiveInboxMessage(message)}
                                        className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 hover:border-slate-300 transition-all"
                                    >
                                        <p className="text-sm font-semibold text-slate-800 truncate">{message.label}</p>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{message.body}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-lg text-slate-800">Quick Access</h3>
                        <div className="mt-3 space-y-2">
                            <Link to="/schedules" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Schedule Consultation</Link>
                            <Link to="/history" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Consultation History</Link>
                            <Link to="/settings" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Account Settings</Link>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-3">
                        <h3 className="font-bold text-lg text-slate-800">Patient Needs Overview</h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming Checkup</p>
                                <p className="text-sm font-semibold text-slate-800 mt-1">
                                    {upcomingAppointment ? `${formatLongDate(upcomingAppointment.dateKey)} at ${upcomingAppointment.timeSlot}` : "Pending scheduling"}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Messages Waiting</p>
                                <p className="text-sm font-semibold text-slate-800 mt-1">{inboxMessages.length} total inbox notifications</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Medication Cycle</p>
                                <p className="text-sm font-semibold text-slate-800 mt-1">Next intake in {reminderHours}h {reminderMinutes}m</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        );
    };

    const renderProfile = () => {
        return (
            <div className="w-full max-w-5xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Profile Details</h1>
                    <p className="text-slate-600">
                        View your account information below.
                    </p>
                </div>

                {profileLoading ? (
                    <div className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>
                ) : profileError ? (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{profileError}</p>
                ) : profile ? (
                    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="h-24 w-24 rounded-full bg-red-50 border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
                            {profile.profileImageUrl ? (
                                <img
                                    src={profile.profileImageUrl}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-bold text-brand-red">
                                    {profile.username?.[0]?.toUpperCase() || "U"}
                                </span>
                            )}
                        </div>
                        <div className="w-full text-center md:text-left">
                            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Fullname (SN, FN, MN)</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">
                                {profile.surname || "N/A"}, {profile.firstname || "N/A"}, {profile.middlename || "N/A"}
                            </p>
                            <div className="mt-3 space-y-1 text-sm text-slate-600">
                                <p><span className="font-semibold text-slate-700">Date of Birth:</span> {profile.dob || "N/A"}</p>
                                <p><span className="font-semibold text-slate-700">Age:</span> {profile.age}</p>
                                <p><span className="font-semibold text-slate-700">Address:</span> {profile.address || "N/A"}</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center justify-center text-sm font-semibold text-white bg-brand-red px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-all active:scale-95 shadow-sm"
                    >
                        Edit profile
                    </Link>
                </div>
            </div>
        );
    };

    const renderSettings = () => {
        const isPatient = user?.role === "patient";
        const isHealthWorker = user?.role === "health_worker";
        const isAdmin = user?.role === "admin";
        const storageKey = getSettingsStorageKey(user);
        const inputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 transition-all ${
            settingsDraft.theme === "dark"
                ? "border-slate-600 bg-slate-800 text-slate-100 focus:border-brand-red"
                : "border-slate-300 bg-white text-slate-900 focus:border-brand-red"
        }`;
        const panelClass = settingsDraft.theme === "dark"
            ? "bg-slate-900 text-slate-100 border-slate-700"
            : "bg-white text-slate-900 border-slate-200";
        const mutedClass = settingsDraft.theme === "dark" ? "text-slate-300" : "text-slate-600";

        const handleAvatarChange = (file) => {
            if (!file) {
                setSettingsDraft((previous) => ({ ...previous, avatarDataUrl: "" }));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                setSettingsDraft((previous) => ({
                    ...previous,
                    avatarDataUrl: typeof reader.result === "string" ? reader.result : "",
                }));
            };
            reader.readAsDataURL(file);
        };

        const saveSettings = (e) => {
            e.preventDefault();
            setSettingsError("");
            setSettingsMessage("");

            try {
                const accounts = loadStoredJson(STORAGE_KEYS.accounts, []);
                const updatedAccounts = accounts.map((account) => {
                    const sameRole = account.role === user?.role;
                    const sameIdentity =
                        account.username === user?.username ||
                        account.email === user?.email ||
                        account.patientCode === user?.patientCode ||
                        account.workerId === user?.workerId ||
                        account.adminId === user?.adminId;

                    if (!sameRole || !sameIdentity) {
                        return account;
                    }

                    return {
                        ...account,
                        surname: settingsDraft.surname,
                        firstname: settingsDraft.firstname,
                        middlename: settingsDraft.middlename,
                        address: {
                            ...(typeof account.address === "object" ? account.address : {}),
                            houseNumber: settingsDraft.houseNumber,
                            street: settingsDraft.streetName,
                            streetName: settingsDraft.streetName,
                            purokSubdivision: settingsDraft.purokSubdivision,
                        },
                        fullAddress: `${settingsDraft.houseNumber}, ${settingsDraft.streetName}, ${settingsDraft.purokSubdivision}, BARANGAY SAN PERFECTO, SAN JUAN CITY, METRO MANILA, NCR`,
                        email: settingsDraft.email,
                        dob: settingsDraft.dob,
                        password: settingsDraft.password,
                        pinCode: settingsDraft.pinCode,
                        adminId: settingsDraft.adminId,
                        systemLicenseNumber: settingsDraft.licenseId,
                        workerId: settingsDraft.licenseId,
                        avatarDataUrl: settingsDraft.avatarDataUrl,
                        theme: settingsDraft.theme,
                    };
                });

                window.localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(updatedAccounts));
                window.localStorage.setItem(storageKey, JSON.stringify(settingsDraft));
                updateUser({
                    surname: settingsDraft.surname,
                    firstname: settingsDraft.firstname,
                    middlename: settingsDraft.middlename,
                    address: {
                        houseNumber: settingsDraft.houseNumber,
                        street: settingsDraft.streetName,
                        streetName: settingsDraft.streetName,
                        purokSubdivision: settingsDraft.purokSubdivision,
                    },
                    fullAddress: `${settingsDraft.houseNumber}, ${settingsDraft.streetName}, ${settingsDraft.purokSubdivision}, BARANGAY SAN PERFECTO, SAN JUAN CITY, METRO MANILA, NCR`,
                    email: settingsDraft.email,
                    dob: settingsDraft.dob,
                    password: settingsDraft.password,
                    pinCode: settingsDraft.pinCode,
                    adminId: settingsDraft.adminId,
                    systemLicenseNumber: settingsDraft.licenseId,
                    workerId: settingsDraft.licenseId,
                    avatarDataUrl: settingsDraft.avatarDataUrl,
                    theme: settingsDraft.theme,
                });
                setSettingsMessage("Settings saved locally.");
            } catch {
                setSettingsError("Unable to save settings.");
            }
        };

        const openDeleteModal = () => {
            setDeletePassword("");
            setDeleteError("");
            setDeleteModalOpen(true);
        };

        const confirmDeleteAccount = () => {
            const expectedPassword = settingsDraft.password || user?.password || "";
            if (!deletePassword || deletePassword !== expectedPassword) {
                setDeleteError("Password did not match. Please try again.");
                return;
            }

            const accounts = loadStoredJson(STORAGE_KEYS.accounts, []);
            const filteredAccounts = accounts.filter((account) => {
                const sameRole = account.role === user?.role;
                const sameIdentity =
                    account.username === user?.username ||
                    account.email === user?.email ||
                    account.patientCode === user?.patientCode ||
                    account.workerId === user?.workerId ||
                    account.adminId === user?.adminId;
                return !(sameRole && sameIdentity);
            });

            window.localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(filteredAccounts));
            window.localStorage.removeItem(storageKey);
            setDeleteModalOpen(false);
            logout();
            navigate("/account", { replace: true });
        };

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Settings</h1>
                    <p className={mutedClass}>Manage your account information and account safety.</p>
                </div>

                {settingsMessage && (
                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">{settingsMessage}</p>
                )}
                {settingsError && (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{settingsError}</p>
                )}

                <form onSubmit={saveSettings} className={`rounded-2xl shadow-sm border p-6 space-y-6 ${panelClass}`}>
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                        <div className="h-24 w-24 rounded-full bg-red-50 border-4 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
                            {settingsDraft.avatarDataUrl ? (
                                <img src={settingsDraft.avatarDataUrl} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-brand-red">{user?.username?.[0]?.toUpperCase() || "U"}</span>
                            )}
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                            <h2 className="text-lg font-bold">Account Information</h2>
                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Edit Profile Picture</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Surname</label>
                            <input
                                type="text"
                                value={settingsDraft.surname}
                                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, surname: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>First Name</label>
                            <input
                                type="text"
                                value={settingsDraft.firstname}
                                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, firstname: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Middle Name</label>
                            <input
                                type="text"
                                value={settingsDraft.middlename}
                                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, middlename: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Address</label>
                            <div>
                                <label className={`block text-xs font-semibold mb-1 ${mutedClass}`}>House Number</label>
                                <input
                                    type="text"
                                    value={settingsDraft.houseNumber}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, houseNumber: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold mb-1 ${mutedClass}`}>Street Name</label>
                                <input
                                    type="text"
                                    value={settingsDraft.streetName}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, streetName: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold mb-1 ${mutedClass}`}>Purok or Subdivision</label>
                                <input
                                    type="text"
                                    value={settingsDraft.purokSubdivision}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, purokSubdivision: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Date of Birth</label>
                                <input type="text" value={settingsDraft.dob} readOnly className={`${inputClass} opacity-80 cursor-not-allowed`} />
                            </div>
                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Email</label>
                                <input
                                    type="email"
                                    value={settingsDraft.email}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, email: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {(isHealthWorker || isAdmin) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>
                                    {isHealthWorker ? "License ID" : "Admin ID"}
                                </label>
                                <input
                                    type="text"
                                    value={isHealthWorker ? settingsDraft.licenseId : settingsDraft.adminId}
                                    readOnly
                                    className={`${inputClass} opacity-80 cursor-not-allowed`}
                                />
                            </div>
                            {isAdmin && (
                                <div>
                                    <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>PINCODE</label>
                                    <input
                                        type="password"
                                        value={settingsDraft.pinCode}
                                        onChange={(e) => setSettingsDraft((prev) => ({ ...prev, pinCode: e.target.value }))}
                                        className={inputClass}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Password</label>
                            <input
                                type="password"
                                value={settingsDraft.password}
                                onChange={(e) => setSettingsDraft((prev) => ({ ...prev, password: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
                        <button
                            type="button"
                            onClick={openDeleteModal}
                            className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                            Delete Account
                        </button>
                        <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Save Settings
                        </button>
                    </div>
                </form>

                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
                        <div className={`w-full max-w-xl rounded-3xl border shadow-2xl p-6 space-y-4 ${panelClass}`}>
                            <div>
                                <h2 className="text-2xl font-bold text-red-600">DELETE ACCOUNT</h2>
                                <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                                    {isPatient && "Only voluntarily delete your own account if you are no longer a resident of San Perfecto or if the account owner is deceased."}
                                    {isHealthWorker && "Only voluntarily delete your own account if you are no longer a health worker or if the account owner is deceased."}
                                    {isAdmin && "Only delete your own account if you are no longer an administrator or if the account owner is deceased."}
                                </p>
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Type password to confirm account deletion</label>
                                <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    className={inputClass}
                                />
                            </div>

                            {deleteError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{deleteError}</p>}

                            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalOpen(false)}
                                    className={`rounded-xl px-5 py-3 text-sm font-semibold border ${
                                        settingsDraft.theme === "dark"
                                            ? "border-slate-600 text-slate-100 hover:bg-slate-800"
                                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDeleteAccount}
                                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
                                >
                                    DELETE ACCOUNT
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderManageAccounts = () => {
        if (user?.role !== "admin") {
            return (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 shrink-0" />
                    <p className="font-medium">You do not have permission to manage accounts.</p>
                </div>
            );
        }
        
        const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-all";
        const labelClass = "block text-sm font-semibold text-slate-700 mb-1";

        return (
            <div className="max-w-3xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Health Workers</h1>
                    <p className="text-slate-600">
                        Register new health worker staff into the system.
                    </p>
                </div>
                {manageMessage && (
                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">{manageMessage}</p>
                )}
                {manageError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{manageError}</p>}
                
                <form
                    onSubmit={handleManageSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelClass} htmlFor="hw-username">Username</label>
                            <input
                                id="hw-username"
                                type="text"
                                className={inputClass}
                                value={manageForm.username}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, username: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-email">Email Address</label>
                            <input
                                id="hw-email"
                                type="email"
                                className={inputClass}
                                value={manageForm.email}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, email: e.target.value }))
                                }
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="hw-password">Temporary Password</label>
                        <input
                            id="hw-password"
                            type="password"
                            className={inputClass}
                            value={manageForm.password}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, password: e.target.value }))
                            }
                            required
                        />
                    </div>

                    <hr className="border-slate-100" />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                            <label className={labelClass} htmlFor="hw-surname">Surname</label>
                            <input
                                id="hw-surname"
                                type="text"
                                className={inputClass}
                                value={manageForm.surname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, surname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-firstname">First Name</label>
                            <input
                                id="hw-firstname"
                                type="text"
                                className={inputClass}
                                value={manageForm.firstname}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, firstname: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-middlename">Middle Name</label>
                            <input
                                id="hw-middlename"
                                type="text"
                                className={inputClass}
                                value={manageForm.middlename}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, middlename: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div>
                            <label className={`${labelClass} text-slate-900`}>Security Question</label>
                            <p className="text-xs text-slate-500 mb-2">Requested upon login as an additional security measure.</p>
                            <input
                                type="text"
                                className={inputClass}
                                value={manageForm.securityQuestionText}
                                onChange={(e) =>
                                    setManageForm((f) => ({
                                        ...f,
                                        securityQuestionText: e.target.value,
                                    }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-sec-answer">Answer</label>
                            <input
                                id="hw-sec-answer"
                                type="text"
                                className={inputClass}
                                value={manageForm.securityAnswer}
                                onChange={(e) =>
                                    setManageForm((f) => ({ ...f, securityAnswer: e.target.value }))
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                        >
                            Create Employee Account
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    const renderSchedules = () => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstWeekday = new Date(year, month, 1).getDay();
        const getScheduleForDateKey = (dateKey) => scheduleByDate[dateKey] || buildDaySchedule(parseDateKey(dateKey));
        const today = startOfDay(new Date());
        const maxBookableDate = new Date(today);
        maxBookableDate.setDate(maxBookableDate.getDate() + BOOKING_WINDOW_DAYS);

        const isInPatientBookingWindow = (date) => {
            const value = startOfDay(date).getTime();
            return value >= today.getTime() && value <= maxBookableDate.getTime();
        };

        const minPatientMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const maxPatientMonth = new Date(maxBookableDate.getFullYear(), maxBookableDate.getMonth(), 1);

        const cells = [];
        for (let i = 0; i < firstWeekday; i += 1) {
            cells.push({ type: "empty", key: `empty-${i}` });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, month, day);
            const key = formatDateKey(date);
            cells.push({ type: "day", day, key, schedule: getScheduleForDateKey(key) });
        }

        const selectedSchedule = selectedDateKey ? getScheduleForDateKey(selectedDateKey) : null;
        const selectedDateObj = selectedDateKey ? parseDateKey(selectedDateKey) : null;
        const selectedDateInWindow = selectedDateObj ? isInPatientBookingWindow(selectedDateObj) : false;
        const selectedStatus = selectedSchedule
            ? user?.role === "patient" && !selectedDateInWindow
                ? "outside_window"
                : selectedSchedule.holidayName
                ? "holiday"
                : selectedSchedule.booked >= selectedSchedule.capacity
                    ? "fully_booked"
                    : "available"
            : "";

        const isPatient = user?.role === "patient";
        const isHealthWorker = user?.role === "health_worker";

        const symptomBarData = selectedSchedule
            ? {
                  labels: COMMON_SYMPTOMS,
                  datasets: [
                      {
                          label: "Patients",
                          data: COMMON_SYMPTOMS.map((symptom) => selectedSchedule.symptomCounts?.[symptom] || 0),
                          backgroundColor: "#0ea5e9",
                          borderRadius: 6,
                      },
                  ],
              }
            : null;

        const changeMonth = (delta) => {
            const candidate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
            if (isPatient && (candidate < minPatientMonth || candidate > maxPatientMonth)) {
                return;
            }
            setCalendarMonth(candidate);
            setSelectedDateKey("");
            setSelectedTimeSlot("");
            setAppointmentMessage("");
            setScheduleError("");
        };

        const getPatientHoverText = (schedule, date) => {
            if (!schedule) return "Loading schedule...";
            if (!isInPatientBookingWindow(date)) {
                if (startOfDay(date).getTime() < today.getTime()) {
                    return "Past dates are no longer available for booking.";
                }
                return "Booking is only allowed up to 2 weeks from today.";
            }
            if (schedule.holidayName) return `Holiday: ${schedule.holidayName}`;
            if (schedule.booked >= schedule.capacity) return "Fully booked. No vacancies available";
            return `Available (${schedule.capacity - schedule.booked} slot/s left)`;
        };

        const toggleSymptom = (symptom) => {
            setSelectedSymptoms((prev) => {
                if (prev.includes(symptom)) {
                    if (symptom === "Others") setOtherSymptomText("");
                    return prev.filter((s) => s !== symptom);
                }
                return [...prev, symptom];
            });
        };

        const handleBookSchedule = (e) => {
            e.preventDefault();
            setScheduleError("");
            setAppointmentMessage("");

            if (!selectedSchedule || selectedStatus !== "available") {
                setScheduleError("Please select an available date.");
                return;
            }
            if (!selectedTimeSlot) {
                setScheduleError("Please choose an appointment hour.");
                return;
            }
            if ((selectedSchedule.slotBookings?.[selectedTimeSlot] || 0) >= SLOT_MAX_APPOINTMENTS) {
                setScheduleError("Selected hour is fully booked. Please choose another appointment hour.");
                return;
            }
            if (selectedSymptoms.length === 0) {
                setScheduleError("Please choose at least one symptom.");
                return;
            }
            if (selectedSymptoms.includes("Others") && !otherSymptomText.trim()) {
                setScheduleError("Please specify your symptom for Others.");
                return;
            }

            const nextBooked = selectedSchedule.booked + 1;
            const nextSymptomCounts = { ...(selectedSchedule.symptomCounts || {}) };
            const nextSlotBookings = { ...(selectedSchedule.slotBookings || {}) };
            selectedSymptoms.forEach((symptom) => {
                if (symptom === "Others") {
                    nextSymptomCounts.Others = (nextSymptomCounts.Others || 0) + 1;
                    return;
                }
                nextSymptomCounts[symptom] = (nextSymptomCounts[symptom] || 0) + 1;
            });
            nextSlotBookings[selectedTimeSlot] = (nextSlotBookings[selectedTimeSlot] || 0) + 1;

            const patientName = buildPatientDisplayName(user);
            const patientCode = user?.patientCode || buildPatientCode(user?.username || patientName);
            const qrValue = patientCode;
            const appointmentId = `${selectedDateKey}-${selectedTimeSlot}-${Date.now()}`;
            const bookedAppointment = {
                id: appointmentId,
                patientName,
                patientCode,
                qrValue,
                dateKey: selectedDateKey,
                timeSlot: selectedTimeSlot,
                symptoms: selectedSymptoms,
                otherSymptomText,
                status: "booked",
                createdAt: new Date().toISOString(),
            };

            setScheduleByDate((prev) => ({
                ...prev,
                [selectedDateKey]: {
                    ...selectedSchedule,
                    booked: nextBooked,
                    symptomCounts: nextSymptomCounts,
                    slotBookings: nextSlotBookings,
                },
            }));

            setAppointments((prev) => [bookedAppointment, ...prev]);

            const dateText = formatLongDate(selectedDateKey);
            const timeText = selectedTimeSlot;
            const inboxLabel = `Schedule ${dateText} has been successfully booked for consultation!`;
            const inboxBody = `Hi, ${patientName}! This is an autogenerated message from Barangay San Perfecto Health Center. This is to remind you that you will have a person-to-person consultation at ${timeText}, ${dateText}, at Barangay San Perfecto Health Center. Mag-iingat palagi, ka-Perfecto!`;

            setInboxMessages((prev) => [
                {
                    id: `${appointmentId}-inbox`,
                    label: inboxLabel,
                    body: inboxBody,
                    qrValue,
                    createdAt: new Date().toLocaleString(),
                },
                ...prev,
            ]);

            setAppointmentMessage("Your appointment request has been saved.");
            setSelectedSymptoms([]);
            setSelectedTimeSlot("");
            setOtherSymptomText("");
            setQrModalAppointment(bookedAppointment);
        };

        const patientLegend = [
            { label: "Available", dotClass: "bg-green-500" },
            { label: "Fully booked", dotClass: "bg-orange-500" },
            { label: "Holiday", dotClass: "bg-slate-400" },
        ];

        const workerLegend = [{ label: "Booked by patients", dotClass: "bg-sky-500" }];

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Schedules</h1>
                    <p className="text-slate-600">
                        {isHealthWorker
                            ? "Review booked dates and patient symptom trends."
                            : "Pick an available date for your consultation schedule."}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                        <h2 className="text-xl font-bold text-slate-800">
                            {MONTH_NAMES[month]} {year}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => changeMonth(-1)}
                                disabled={isPatient && calendarMonth <= minPatientMonth}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => changeMonth(1)}
                                disabled={isPatient && calendarMonth >= maxPatientMonth}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                    {isPatient && (
                        <p className="text-xs text-slate-500 mb-4">
                            Booking window: today up to 2 weeks only ({formatDateKey(today)} to {formatDateKey(maxBookableDate)}).
                        </p>
                    )}

                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {DAY_LABELS.map((label) => (
                            <div key={label} className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-center py-1">
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {cells.map((cell) => {
                            if (cell.type === "empty") {
                                return <div key={cell.key} className="h-14 sm:h-20 rounded-xl bg-slate-50/70" />;
                            }

                            const schedule = cell.schedule;
                            const cellDate = parseDateKey(cell.key);
                            const inPatientWindow = isInPatientBookingWindow(cellDate);
                            const isSelected = selectedDateKey === cell.key;
                            const isHoliday = !!schedule?.holidayName;
                            const isFullyBooked = !!schedule && schedule.booked >= schedule.capacity;
                            const isAvailable = !!schedule && !isHoliday && !isFullyBooked && (!isPatient || inPatientWindow);
                            const isBookedForWorker = !!schedule && schedule.booked > 0;
                            const isDisabledForPatient = isPatient && !inPatientWindow;

                            let stateClass = "bg-white border border-slate-200 text-slate-800";
                            if (isPatient) {
                                if (isAvailable) stateClass = "bg-green-100 border border-green-400 text-green-900";
                                if (isFullyBooked) stateClass = "bg-orange-100 border border-orange-400 text-orange-900";
                                if (isHoliday) stateClass = "bg-slate-100 border border-slate-300 text-slate-700";
                                if (isDisabledForPatient) {
                                    stateClass = "bg-white border border-slate-200 text-slate-400";
                                }
                            }
                            if (isHealthWorker) {
                                stateClass = isBookedForWorker
                                    ? "bg-sky-100 border border-sky-400 text-sky-900"
                                    : "bg-white border border-slate-200 text-slate-800";
                                if (isHoliday) {
                                    stateClass = "bg-slate-100 border border-slate-300 text-slate-700";
                                }
                            }

                            return (
                                <button
                                    type="button"
                                    key={cell.key}
                                    disabled={isDisabledForPatient}
                                    title={
                                        isHealthWorker
                                            ? schedule?.holidayName
                                                ? `Holiday: ${schedule.holidayName}`
                                                : `${schedule?.booked || 0} patient booking(s)`
                                            : getPatientHoverText(schedule, cellDate)
                                    }
                                    onClick={() => {
                                        setSelectedDateKey(cell.key);
                                        setSelectedTimeSlot("");
                                        setAppointmentMessage("");
                                        setScheduleError("");
                                    }}
                                    className={`${stateClass} h-14 sm:h-20 rounded-xl transition-all hover:shadow-sm ${
                                        isSelected ? "ring-2 ring-brand-red" : ""
                                    } ${isDisabledForPatient ? "cursor-not-allowed" : ""}`}
                                >
                                    <span className={`text-sm sm:text-base font-semibold ${isHoliday ? "opacity-50" : "opacity-100"}`}>
                                        {cell.day}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        {(isHealthWorker ? workerLegend : patientLegend).map((item) => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {isPatient && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h3 className="text-xl font-bold text-slate-800">Book Consultation</h3>
                        {!selectedSchedule ? (
                            <p className="text-slate-600">Select a date in the calendar to continue.</p>
                        ) : selectedStatus !== "available" ? (
                            <p className="text-slate-600">
                                {selectedStatus === "fully_booked" && "Fully booked. No vacancies available"}
                                {selectedStatus === "holiday" && `Holiday: ${selectedSchedule.holidayName}`}
                                {selectedStatus === "outside_window" && "This date is outside the allowed booking window (today up to 2 weeks only)."}
                            </p>
                        ) : (
                            <form onSubmit={handleBookSchedule} className="space-y-4">
                                <p className="text-sm text-slate-600">
                                    Selected date: <span className="font-semibold text-slate-800">{selectedDateKey}</span>
                                </p>
                                <p className="text-sm text-slate-600">
                                    Remaining slots: {selectedSchedule.capacity - selectedSchedule.booked}
                                </p>
                                <p className="text-sm text-slate-600">Daily appointment hours: 8:00 AM - 10:00 PM</p>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="time-slot">
                                        Appointment hour
                                    </label>
                                    <select
                                        id="time-slot"
                                        value={selectedTimeSlot}
                                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                        required
                                    >
                                        <option value="">Select a time slot</option>
                                        {APPOINTMENT_TIME_SLOTS.map((slot) => {
                                            const slotBooked = selectedSchedule.slotBookings?.[slot] || 0;
                                            const isSlotFull = slotBooked >= SLOT_MAX_APPOINTMENTS;
                                            return (
                                            <option key={slot} value={slot} disabled={isSlotFull}>
                                                {slot} ({slotBooked}/{SLOT_MAX_APPOINTMENTS}) {isSlotFull ? "- Full" : ""}
                                            </option>
                                        );
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-2">Choose your symptoms</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {COMMON_SYMPTOMS.map((symptom) => (
                                            <label key={symptom} className="flex items-center gap-2 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-brand-red focus:ring-brand-red"
                                                    checked={selectedSymptoms.includes(symptom)}
                                                    onChange={() => toggleSymptom(symptom)}
                                                />
                                                {symptom}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {selectedSymptoms.includes("Others") && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="other-symptom">
                                            Others, please specify
                                        </label>
                                        <input
                                            id="other-symptom"
                                            type="text"
                                            value={otherSymptomText}
                                            onChange={(e) => setOtherSymptomText(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                            placeholder="Describe your symptom"
                                        />
                                    </div>
                                )}

                                {scheduleError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{scheduleError}</p>}
                                {appointmentMessage && (
                                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{appointmentMessage}</p>
                                )}

                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-lg bg-brand-red text-white font-semibold hover:bg-brand-dark transition-all"
                                >
                                    Confirm Appointment
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {isHealthWorker && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h3 className="text-xl font-bold text-slate-800">Daily Booking Analytics</h3>
                        {!selectedSchedule ? (
                            <p className="text-slate-600">Select a date to view patient booking data.</p>
                        ) : selectedSchedule.holidayName ? (
                            <p className="text-slate-600">Holiday: {selectedSchedule.holidayName}</p>
                        ) : (
                            <>
                                <p className="text-slate-700 font-medium">
                                    {selectedDateKey}: {selectedSchedule.booked} patient booking(s)
                                </p>
                                <div className="h-72">
                                    <Bar
                                        data={symptomBarData}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    ticks: { precision: 0 },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderConsultation = () => {
        if (user?.role !== "health_worker") {
            return (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 shrink-0" />
                    <p className="font-medium">Only health workers can access consultation tools.</p>
                </div>
            );
        }

        const bookedAppointments = appointments.filter((appointment) => appointment.status === "booked");
        const matchingAppointments = consultationScannedPatientCode
            ? bookedAppointments.filter((appointment) => appointment.patientCode === consultationScannedPatientCode)
            : [];
        const medicineOptions = inventoryItems.filter((item) => item.category === "medicine" && item.quantity > 0);

        const verifyScan = (e) => {
            e.preventDefault();
            setConsultationError("");
            setConsultationMessage("");
            const code = consultationScanValue.trim();
            if (!code) {
                setConsultationError("Scan or enter a patient QR code first.");
                return;
            }

            const matchedAppointment = bookedAppointments.find((appointment) => appointment.qrValue === code);
            if (!matchedAppointment) {
                setConsultationError("This QR code is not linked to a booked appointment.");
                setConsultationTarget(null);
                setConsultationScannedPatientCode("");
                return;
            }

            setConsultationScannedPatientCode(matchedAppointment.patientCode);
            setConsultationTarget(matchedAppointment);
            setConsultationMessage(`Patient verified for ${matchedAppointment.patientName}. Select the booked slot to continue.`);
            setConsultationForm((prev) => ({
                ...prev,
                medicineId: medicineOptions[0]?.id || "",
            }));
        };

        const completeConsultation = (e) => {
            e.preventDefault();
            setConsultationError("");
            setConsultationMessage("");

            if (!consultationTarget) {
                setConsultationError("Verify the patient QR code and choose a booked appointment first.");
                return;
            }

            const diagnosis = consultationForm.diagnosis.trim();
            const note = consultationForm.note.trim();
            const selectedMedicine = inventoryItems.find((item) => item.id === consultationForm.medicineId && item.category === "medicine");
            const quantity = Number(consultationForm.medicineQuantity);

            if (!diagnosis) {
                setConsultationError("Please enter a diagnosis.");
                return;
            }
            if (!selectedMedicine) {
                setConsultationError("Please choose a medicine from inventory.");
                return;
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                setConsultationError("Medicine quantity must be a positive whole number.");
                return;
            }
            if (selectedMedicine.quantity < quantity) {
                setConsultationError("Not enough medicine stock available.");
                return;
            }
            if (!note) {
                setConsultationError("Please add a note to the patient.");
                return;
            }

            const completedAt = new Date().toISOString();
            const consultationRecord = {
                id: `${consultationTarget.id}-consulted`,
                appointmentId: consultationTarget.id,
                patientName: consultationTarget.patientName,
                patientCode: consultationTarget.patientCode,
                dateKey: consultationTarget.dateKey,
                timeSlot: consultationTarget.timeSlot,
                diagnosis,
                medicineId: selectedMedicine.id,
                medicineName: selectedMedicine.name,
                medicineQuantity: quantity,
                note,
                workerName: buildPatientDisplayName(user),
                completedAt,
            };

            setInventoryItems((prev) =>
                prev.map((item) =>
                    item.id === selectedMedicine.id
                        ? { ...item, quantity: item.quantity - quantity }
                        : item
                )
            );

            setAppointments((prev) =>
                prev.map((appointment) =>
                    appointment.id === consultationTarget.id
                        ? { ...appointment, status: "consulted", consultedAt: completedAt }
                        : appointment
                )
            );

            setConsultations((prev) => [consultationRecord, ...prev]);
            setConsultationMessage("Consultation completed and inventory updated.");
            setConsultationError("");
            setConsultationTarget(null);
            setConsultationScannedPatientCode("");
            setConsultationScanValue("");
            setConsultationForm({ diagnosis: "", medicineId: medicineOptions[0]?.id || "", medicineQuantity: 1, note: "" });
        };

        const selectedPatientAppointments = matchingAppointments;

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Consultation</h1>
                    <p className="text-slate-600">Verify the booked patient QR code, then complete diagnosis and medicine dispense.</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">QR Verification</h2>
                        <form onSubmit={verifyScan} className="space-y-3">
                            <input
                                type="text"
                                value={consultationScanValue}
                                onChange={(e) => setConsultationScanValue(e.target.value)}
                                placeholder="Scan or enter PATIENT000000000000"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                            />
                            <button
                                type="submit"
                                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Verify QR
                            </button>
                        </form>

                        {consultationError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{consultationError}</p>}
                        {consultationMessage && <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{consultationMessage}</p>}

                        {consultationScannedPatientCode && (
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-slate-700">Booked appointments for {consultationScannedPatientCode}</p>
                                <div className="space-y-2">
                                    {selectedPatientAppointments.length === 0 ? (
                                        <p className="text-sm text-slate-500">No booked appointment found for this patient.</p>
                                    ) : (
                                        selectedPatientAppointments.map((appointment) => (
                                            <button
                                                key={appointment.id}
                                                type="button"
                                                onClick={() => {
                                                    setConsultationTarget(appointment);
                                                    setConsultationMessage(`Selected ${appointment.patientName} on ${appointment.dateKey} at ${appointment.timeSlot}.`);
                                                }}
                                                className={`w-full rounded-xl border p-3 text-left transition-all ${
                                                    consultationTarget?.id === appointment.id
                                                        ? "border-brand-red bg-red-50"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <p className="font-semibold text-slate-800">{appointment.patientName}</p>
                                                <p className="text-sm text-slate-500">
                                                    {formatLongDate(appointment.dateKey)} at {appointment.timeSlot}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={completeConsultation} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">Consultation Details</h2>
                        {!consultationTarget ? (
                            <p className="text-slate-600">Verify a booked QR code and select an appointment to unlock the consultation form.</p>
                        ) : (
                            <>
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
                                    <p><span className="font-semibold">Patient:</span> {consultationTarget.patientName}</p>
                                    <p><span className="font-semibold">Schedule:</span> {formatLongDate(consultationTarget.dateKey)} at {consultationTarget.timeSlot}</p>
                                    <p><span className="font-semibold">Symptoms:</span> {consultationTarget.symptoms.join(", ")}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="diagnosis">Diagnosis</label>
                                    <textarea
                                        id="diagnosis"
                                        value={consultationForm.diagnosis}
                                        onChange={(e) => setConsultationForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                        rows="3"
                                        placeholder="Diagnose the patient"
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="medicine">Prescribe medicine</label>
                                        <select
                                            id="medicine"
                                            value={consultationForm.medicineId}
                                            onChange={(e) => setConsultationForm((prev) => ({ ...prev, medicineId: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                        >
                                            <option value="">Choose a medicine</option>
                                            {medicineOptions.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.quantity} {item.unit})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="quantity">Quantity</label>
                                        <input
                                            id="quantity"
                                            type="number"
                                            min="1"
                                            value={consultationForm.medicineQuantity}
                                            onChange={(e) => setConsultationForm((prev) => ({ ...prev, medicineQuantity: e.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="note">Note to patient</label>
                                    <input
                                        id="note"
                                        type="text"
                                        value={consultationForm.note}
                                        onChange={(e) => setConsultationForm((prev) => ({ ...prev, note: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red"
                                        placeholder='Example: take 3x a day'
                                    />
                                </div>

                                <button type="submit" className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                                    Complete Consultation
                                </button>
                            </>
                        )}
                    </form>
                </div>
            </div>
        );
    };

    const renderInventory = () => {
        if (user?.role !== "health_worker" && user?.role !== "admin") {
            return (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="w-5 h-5 shrink-0" />
                    <p className="font-medium">Only staff members can access inventory.</p>
                </div>
            );
        }

        const visibleItems = inventoryItems.filter((item) => inventoryViewMode === "medicine" ? item.category === "medicine" : true);
        const isAdmin = user?.role === "admin";

        const addInventoryItem = (e) => {
            e.preventDefault();
            setInventoryError("");
            setInventoryMessage("");

            if (!inventoryForm.name.trim()) {
                setInventoryError("Item name is required.");
                return;
            }
            if (!Number.isFinite(Number(inventoryForm.quantity)) || Number(inventoryForm.quantity) < 0) {
                setInventoryError("Quantity must be zero or greater.");
                return;
            }

            setInventoryItems((prev) => [
                {
                    id: `${inventoryForm.category}-${inventoryForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
                    name: inventoryForm.name.trim(),
                    category: inventoryForm.category,
                    quantity: Number(inventoryForm.quantity),
                    unit: inventoryForm.unit.trim() || "pcs",
                },
                ...prev,
            ]);
            setInventoryMessage("Inventory item added.");
            setInventoryForm({ name: "", category: "medicine", quantity: 0, unit: "pcs" });
        };

        const updateInventoryAmount = (itemId, mode) => {
            const amount = Number(inventoryAmounts[itemId] || 0);
            if (!Number.isInteger(amount) || amount <= 0) {
                setInventoryError("Type a valid amount.");
                return;
            }

            setInventoryError("");
            setInventoryItems((prev) =>
                prev.map((item) =>
                    item.id === itemId
                        ? {
                              ...item,
                              quantity:
                                  mode === "add"
                                      ? item.quantity + amount
                                      : Math.max(0, item.quantity - amount),
                          }
                        : item
                )
            );
            setInventoryAmounts((prev) => ({ ...prev, [itemId]: "" }));
            setInventoryMessage(
                mode === "add"
                    ? `Added ${amount} item(s) to inventory.`
                    : `Reduced ${amount} item(s) from inventory.`
            );
        };

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Inventory</h1>
                    <p className="text-slate-600">Combined medicines and walking aids or assistive devices.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: "all", label: "All items" },
                            { value: "medicine", label: "Medicine only" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setInventoryViewMode(option.value)}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                                    inventoryViewMode === option.value
                                        ? "bg-brand-red text-white"
                                        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {isAdmin && (
                        <form onSubmit={addInventoryItem} className="grid gap-3 md:grid-cols-4">
                            <input
                                type="text"
                                value={inventoryForm.name}
                                onChange={(e) => setInventoryForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Item name"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <select
                                value={inventoryForm.category}
                                onChange={(e) => setInventoryForm((prev) => ({ ...prev, category: e.target.value }))}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="medicine">Medicine</option>
                                <option value="aid">Walking aid / assistive device</option>
                            </select>
                            <input
                                type="number"
                                min="0"
                                value={inventoryForm.quantity}
                                onChange={(e) => setInventoryForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                placeholder="Quantity"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <input
                                type="text"
                                value={inventoryForm.unit}
                                onChange={(e) => setInventoryForm((prev) => ({ ...prev, unit: e.target.value }))}
                                placeholder="Unit"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <button type="submit" className="md:col-span-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                                Add Item
                            </button>
                        </form>
                    )}

                    {inventoryError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{inventoryError}</p>}
                    {inventoryMessage && <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{inventoryMessage}</p>}

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleItems.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900">{item.name}</h3>
                                        <p className="text-xs uppercase tracking-wider text-slate-500">{item.category}</p>
                                    </div>
                                    <p className="text-xl font-bold text-brand-red">{item.quantity}</p>
                                </div>
                                <p className="text-sm text-slate-600">Unit: {item.unit}</p>
                                {isAdmin && (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={inventoryAmounts[item.id] || ""}
                                                onChange={(e) =>
                                                    setInventoryAmounts((prev) => ({
                                                        ...prev,
                                                        [item.id]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Amount"
                                                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                            />
                                            <button type="button" onClick={() => updateInventoryAmount(item.id, "reduce")} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
                                                Reduce
                                            </button>
                                            <button type="button" onClick={() => updateInventoryAmount(item.id, "add")} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderHistory = () => {
        const relevantConsultations = user?.role === "patient"
            ? consultations.filter((entry) => entry.patientCode === (user?.patientCode || buildPatientCode(user?.username || "")))
            : consultations;

        const cards = relevantConsultations.flatMap((entry) => {
            const consultationText = `Successful consultation! ${entry.diagnosis} and ${entry.medicineName} (${entry.medicineQuantity}).`;
            const medicineText = user?.role === "health_worker"
                ? `Medicine given: ${entry.medicineName} x ${entry.medicineQuantity}.`
                : `Medicine received: ${entry.medicineName} x ${entry.medicineQuantity}.`;

            return [
                {
                    id: `${entry.id}-consultation`,
                    title: consultationText,
                    subtext: `${formatLongDate(entry.dateKey)} at ${entry.timeSlot}`,
                    meta: entry.note,
                },
                {
                    id: `${entry.id}-medicine`,
                    title: medicineText,
                    subtext: `${formatLongDate(entry.dateKey)} at ${entry.timeSlot}`,
                    meta: `Diagnosis: ${entry.diagnosis}`,
                },
            ];
        });

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">History</h1>
                    <p className="text-slate-600">Consultation records and medicine logs.</p>
                </div>

                {cards.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-600">
                        No completed consultations yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cards.map((card) => (
                            <article key={card.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-2">
                                <h2 className="text-lg font-bold text-slate-800">{card.title}</h2>
                                <p className="text-sm text-slate-500">{card.subtext}</p>
                                <p className="text-sm text-slate-700">{card.meta}</p>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderInbox = () => {
        if (inboxMessages.length === 0) {
            return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Inbox</h1>
                    <p className="text-slate-600">No messages yet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Inbox</h1>
                    <p className="text-slate-600">Appointment reminders and notifications.</p>
                </div>
                {inboxMessages.map((message) => (
                    <button
                        key={message.id}
                        type="button"
                        onClick={() => setActiveInboxMessage(message)}
                        className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all"
                    >
                        <h2 className="text-lg font-bold text-slate-800">{message.label}</h2>
                        <p className="text-slate-600 mt-2 leading-relaxed line-clamp-2">
                            {message.body}
                        </p>
                        <p className="text-xs text-slate-400 mt-3">{message.createdAt}</p>
                    </button>
                ))}
            </div>
        );
    };

    const renderContent = () => {
        if (path === "/dashboard") return renderDashboardHome();
        if (path === "/profile") return renderProfile();
        if (path === "/manage-accounts") return renderManageAccounts();

        if (path === "/schedules") {
            return renderSchedules();
        }
        if (path === "/history") {
            return renderHistory();
        }
        if (path === "/consultation") {
            return renderConsultation();
        }
        if (path === "/inventory") {
            return renderInventory();
        }
        if (path === "/faqs-dashboard") {
            return (
                <p className="text-3xl text-gray-700">
                    Route for frequently asked questions is currently under development.
                </p>
            );
        }
        if (path === "/inbox") {
            return renderInbox();
        }
        if (path === "/settings") {
            return renderSettings();
        }
        return renderDashboardHome();
    };

    return (
        <div className="flex h-screen overflow-hidden font-sans bg-slate-50">
            <DashboardNavigation />
            <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    {renderContent()}
                </div>
            </main>

            {qrModalAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Appointment QR Proof</h2>
                                <p className="text-slate-600 mt-1">Show this code at Barangay San Perfecto Health Center.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQrModalAppointment(null)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <QRCodeSVG value={qrModalAppointment.qrValue} size={220} includeMargin />
                            <p className="text-sm font-semibold tracking-[0.2em] text-slate-700">
                                {qrModalAppointment.qrValue}
                            </p>
                            <p className="text-sm text-slate-600 text-center">
                                Health workers will scan this code before consultation proceeds.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQrModalAppointment(null)}
                            className="w-full rounded-xl bg-brand-red px-4 py-3 font-semibold text-white hover:bg-brand-dark"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {activeInboxMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{activeInboxMessage.label}</h2>
                                <p className="text-slate-500 text-sm mt-1">{activeInboxMessage.createdAt}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveInboxMessage(null)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                        <p className="text-slate-700 leading-7 whitespace-pre-wrap">{activeInboxMessage.body}</p>
                        {activeInboxMessage.qrValue && (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <QRCodeSVG value={activeInboxMessage.qrValue} size={200} includeMargin />
                                <p className="text-sm font-semibold tracking-[0.2em] text-slate-700">
                                    {activeInboxMessage.qrValue}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserDashboard;