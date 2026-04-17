import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardNavigation from "../components/dashboardNavigation.jsx";
import { useAuth } from "../context/useAuth.js";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faCalendarDays, faFileMedical, faStethoscope, faBox } from "@fortawesome/free-solid-svg-icons";
import PatientAccountManagement from "../components/PatientAccountManagement.jsx";
import HealthWorkerAccountManagement from "../components/HealthWorkerAccountManagement.jsx";
import { supabase } from "../utils/supabase.js";
import {
    addConsultationDispensedItem,
    bookPatientAppointment,
    changePortalPassword,
    completeConsultationRecord,
    createHealthWorkerAccountByAdmin,
    deleteHealthWorkerAccountByAdmin,
    fetchMyInboxMessages,
    fetchHealthWorkerDirectory,
    fetchAppointmentFeed,
    fetchConsultationFeed,
    fetchPatientDirectory,
    fetchInventoryItems,
    upsertInventoryItem,
    adjustInventoryQuantity,
    updateMyProfileSettings,
    getMyProfileBundle,
    fetchPatientAndHealthWorkerStats,
} from "../services/supabaseBackendService.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement);

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

const DASHBOARD_COLLECTION_ROUTES = new Set(["/dashboard", "/schedules", "/history", "/consultation", "/inventory", "/inbox"]);

const SETTINGS_STORAGE_PREFIX = "sanperfecto-settings";
const MEDICATION_REMINDER_STORAGE_PREFIX = "sanperfecto-medication-reminder";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AGE_GROUPS = [
    {
        label: "0-18 months (Infant)",
        matches: ({ ageMonths }) => typeof ageMonths === "number" && ageMonths >= 0 && ageMonths <= 18,
    },
    {
        label: "1.5 to 3 yrs old (Early Childhood)",
        matches: ({ ageYears, ageMonths }) =>
            typeof ageYears === "number" &&
            typeof ageMonths === "number" &&
            ageYears <= 3 &&
            ageMonths > 18,
    },
    {
        label: "4-12 (Children)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears >= 4 && ageYears <= 12,
    },
    {
        label: "13-17 (Young Teenagers)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears >= 13 && ageYears <= 17,
    },
    {
        label: "18-35 (Young Adults)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears >= 18 && ageYears <= 35,
    },
    {
        label: "36-59 (Mature Adults)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears >= 36 && ageYears <= 59,
    },
    {
        label: "60-99 (Senior Citizens)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears >= 60 && ageYears <= 99,
    },
    {
        label: ">100 (Centenarians)",
        matches: ({ ageYears }) => typeof ageYears === "number" && ageYears > 100,
    },
];

const SECURITY_QUESTIONS = [
    "Name of your cat",
    "Favorite actor/actress",
    "Favorite food",
    "Name of your first school",
    "Your childhood nickname",
];

const SEX_OPTIONS = ["Male", "Female", "Prefer not to say"];

const GENDER_OPTIONS = [
    "Straight",
    "Gay",
    "Lesbian",
    "Bisexual",
    "Transgender Woman",
    "Transgender Man",
    "Non-binary",
    "Queer",
    "Prefer not to say",
    "Other / Unknown (please specify)",
];

const KEYBOARD_SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const KEYBOARD_ALLOWED_PATTERN = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;

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

const getUserFirstName = (user) => user?.firstname?.trim() || user?.displayName?.trim()?.split(/\s+/)[0] || user?.username || "Patient";

const getPatientIdentity = (user) => user?.patientCode || user?.patientId || buildPatientCode(user?.username || user?.email || "anonymous");

const getGreetingPrefix = (date) => {
    const hour = date.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
};

const buildGreeting = (date, user) => `${getGreetingPrefix(date)}, ${getUserFirstName(user)}!`;

const getVisibleInboxMessages = (messages, user) => {
    if (user?.role !== "patient") {
        return [];
    }

    return (messages || []).map((message) => ({
        id: message.id,
        label: message.subject || "Notification",
        body: message.body || "",
        createdAt: message.created_at
            ? new Date(message.created_at).toLocaleString("en-PH")
            : "",
        qrValue: message.qr_value || message.qrValue || "",
        appointmentCode: message.appointment_id || message.appointmentCode || "",
    }));
};

const formatDuration = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
};

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

const calculateAgeNumber = (dobValue) => {
    if (!dobValue) return null;
    const dob = new Date(dobValue);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1;
    }

    return age >= 0 ? age : null;
};

const calculateAgeInMonths = (dobValue) => {
    if (!dobValue) return null;
    const dob = new Date(dobValue);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
    if (today.getDate() < dob.getDate()) {
        months -= 1;
    }

    return months >= 0 ? months : null;
};

const getAgeGroupLabel = ({ ageYears, ageMonths }) => {
    const matchedGroup = AGE_GROUPS.find((group) => group.matches({ ageYears, ageMonths }));
    return matchedGroup ? matchedGroup.label : "Unknown age";
};

const normalizeDiagnosis = (diagnosis) => {
    const value = String(diagnosis || "").trim();
    return value || "Unspecified diagnosis";
};

const evaluatePasswordStrength = (password) => {
    const safe = String(password || "");
    let score = 0;

    if (safe.length >= 8) score += 1;
    if (safe.length >= 12) score += 1;
    if (/[A-Z]/.test(safe)) score += 1;
    if (/[a-z]/.test(safe)) score += 1;
    if (/\d/.test(safe)) score += 1;
    if (KEYBOARD_SPECIAL_CHAR_PATTERN.test(safe)) score += 1;

    if (score <= 2) {
        return { label: "Weak", textClass: "text-red-600", barClass: "bg-red-500", widthClass: "w-1/3" };
    }
    if (score <= 4) {
        return { label: "Medium", textClass: "text-amber-600", barClass: "bg-amber-500", widthClass: "w-2/3" };
    }
    return { label: "Strong", textClass: "text-emerald-600", barClass: "bg-emerald-500", widthClass: "w-full" };
};

const validateHealthWorkerPassword = (password) => {
    if (!password) {
        return "Password is required.";
    }
    if (password.includes(" ")) {
        return "Spaces are not allowed in password.";
    }
    if (!KEYBOARD_ALLOWED_PATTERN.test(password)) {
        return "Use only letters, numbers, and common keyboard symbols in password.";
    }
    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter.";
    }
    if (!KEYBOARD_SPECIAL_CHAR_PATTERN.test(password)) {
        return "Password must contain at least one special character.";
    }
    return "";
};

const buildAddressLine = (accountUser) => {
    if (!accountUser) return "N/A";
    if (accountUser.fullAddress) return accountUser.fullAddress;

    const address = accountUser.address && typeof accountUser.address === "object" ? accountUser.address : {};
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

const buildAppointmentPatientSegment = (patientCode) => {
    const digits = String(patientCode || "").replace(/\D/g, "");
    return `PA${digits.slice(-4).padStart(4, "0")}`;
};

const buildAppointmentQrValue = (patientCode) => {
    const patientSegment = buildAppointmentPatientSegment(patientCode);
    const randomBytes = new Uint8Array(2);

    if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(randomBytes);
    } else {
        randomBytes[0] = Math.floor(Math.random() * 256);
        randomBytes[1] = Math.floor(Math.random() * 256);
    }

    const randomCode = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `${patientSegment}-${randomCode}`;
};

const splitAppointmentQrValue = (qrValue) => {
    const [patientSegment = "", randomCode = ""] = String(qrValue || "").split("-");
    return { patientSegment, randomCode };
};

const normalizeAppointmentQrValue = (qrValue) => String(qrValue || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const extractAppointmentQrCandidates = (rawValue) => {
    const rawText = String(rawValue || "").trim();
    if (!rawText) {
        return [];
    }

    const text = rawText.toUpperCase();
    const candidates = [text];

    const paPatternMatches = text.match(/PA\s*\d{4}\s*[-_ ]\s*[A-Z0-9]{4}|PA\s*\d{4}[A-Z0-9]{4}/g) || [];
    const patientPatternMatches = text.match(/PATIENT\s*\d{6,}/g) || [];
    candidates.push(...paPatternMatches, ...patientPatternMatches);

    const normalizedCandidates = candidates
        .map(normalizeAppointmentQrValue)
        .filter(Boolean);

    return Array.from(new Set(normalizedCandidates));
};

const getAppointmentLookupCandidates = (appointment) => {
    const qrValue = String(appointment?.qrValue || "").trim();
    const patientCode = String(appointment?.patientCode || "").trim();
    const candidates = [qrValue, patientCode].filter(Boolean);

    if (qrValue.includes("-")) {
        const [patientSegment = "", randomCode = ""] = qrValue.split("-");
        candidates.push(`${patientSegment}-${randomCode}`);
    }

    return Array.from(new Set(candidates.map(normalizeAppointmentQrValue)));
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

const getMedicationReminderStorageKey = (user, medication) => {
    const patientKey = user?.patientCode || user?.patientId || user?.username || user?.id || "anonymous";
    const medicineKey = medication?.medicineId || medication?.medicineName || "medicine";
    const intakeKey = Number(medication?.medicineIntakePerDay || 0) || 0;
    return `${MEDICATION_REMINDER_STORAGE_PREFIX}-${patientKey}-${medicineKey}-${intakeKey}`;
};

const createConsultationMedicineItemDraft = (medicineId = "") => ({
    medicineId,
    quantity: 1,
    intakePerDay: 1,
    intakeInstruction: "",
});

const createDefaultSettingsDraft = (user) => ({
    avatarDataUrl: user?.avatarDataUrl || "",
    avatarFile: null,
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

const sanitizeAvatarValue = (avatarValue) => {
    const value = String(avatarValue || "").trim();
    if (!value) {
        return "";
    }

    // Never persist base64 image blobs in localStorage, they can exceed browser quota.
    if (value.startsWith("data:")) {
        return "";
    }

    return value;
};

const buildPersistedSettingsDraft = (draft) => ({
    surname: draft?.surname || "",
    firstname: draft?.firstname || "",
    middlename: draft?.middlename || "",
    houseNumber: draft?.houseNumber || "",
    streetName: draft?.streetName || "",
    purokSubdivision: draft?.purokSubdivision || "",
    email: draft?.email || "",
    dob: draft?.dob || "",
    password: draft?.password || "",
    pinCode: draft?.pinCode || "",
    adminId: draft?.adminId || "",
    licenseId: draft?.licenseId || "",
    theme: draft?.theme || "light",
    avatarDataUrl: sanitizeAvatarValue(draft?.avatarDataUrl),
});

const mergeSettingsDraftWithStoredValues = (initialDraft, storedDraftRaw) => {
    const storedDraft = storedDraftRaw && typeof storedDraftRaw === "object" ? storedDraftRaw : {};
    const merged = { ...initialDraft };

    Object.entries(storedDraft).forEach(([key, value]) => {
        if (key === "theme") {
            if (value === "dark" || value === "light") {
                merged.theme = value;
            }
            return;
        }

        if (key === "avatarDataUrl") {
            const sanitizedAvatar = sanitizeAvatarValue(value);
            if (sanitizedAvatar) {
                merged.avatarDataUrl = sanitizedAvatar;
            }
            return;
        }

        if (typeof value === "string") {
            if (value.trim()) {
                merged[key] = value;
            }
            return;
        }

        if (value !== null && value !== undefined) {
            merged[key] = value;
        }
    });

    merged.avatarDataUrl = sanitizeAvatarValue(merged.avatarDataUrl || initialDraft.avatarDataUrl);
    merged.avatarFile = null;
    return merged;
};

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

const buildDaySchedule = (date) => {
    const key = formatDateKey(date);
    const mmdd = key.slice(5);
    const holidayName = HOLIDAY_LOOKUP[mmdd] || null;
    const capacity = DAILY_MAX_APPOINTMENTS;
    const booked = 0;
    const emptySlotBookings = APPOINTMENT_TIME_SLOTS.reduce((accumulator, slot) => {
        accumulator[slot] = 0;
        return accumulator;
    }, {});

    return {
        dateKey: key,
        capacity,
        booked,
        holidayName,
        symptomCounts: {},
        slotBookings: emptySlotBookings,
    };
};

const buildAppointmentScheduleMap = (appointments = []) => {
    return appointments.reduce((accumulator, appointment) => {
        if (!appointment?.dateKey || appointment.status === "cancelled") {
            return accumulator;
        }

        const current = accumulator[appointment.dateKey] || buildDaySchedule(parseDateKey(appointment.dateKey));
        const nextSlotBookings = { ...(current.slotBookings || {}) };
        const nextSymptomCounts = { ...(current.symptomCounts || {}) };

        nextSlotBookings[appointment.timeSlot] = (nextSlotBookings[appointment.timeSlot] || 0) + 1;
        (appointment.symptoms || []).forEach((symptom) => {
            nextSymptomCounts[symptom] = (nextSymptomCounts[symptom] || 0) + 1;
        });

        accumulator[appointment.dateKey] = {
            ...current,
            booked: (current.booked || 0) + 1,
            symptomCounts: nextSymptomCounts,
            slotBookings: nextSlotBookings,
        };

        return accumulator;
    }, {});
};

function UserDashboard() {
    const { user, updateUser, logout } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const patientCode = getPatientIdentity(user);

    const [stats, setStats] = useState({ patientCount: 0, healthWorkerCount: 0 });
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState("");

    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");

    const [manageError, setManageError] = useState("");
    const [manageMessage, setManageMessage] = useState("");
    const [deletingHealthWorkerUserId, setDeletingHealthWorkerUserId] = useState("");
    const [isPatientDirectoryOpen, setIsPatientDirectoryOpen] = useState(false);
    const [lastCreatedLicenseNumber, setLastCreatedLicenseNumber] = useState("");
    const [createdHealthWorkers, setCreatedHealthWorkers] = useState([]);
    const [patientDirectory, setPatientDirectory] = useState([]);
    const [manageForm, setManageForm] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        surname: "",
        firstname: "",
        middlename: "",
        dob: "",
        sex: SEX_OPTIONS[2],
        gender: GENDER_OPTIONS[10],
        genderOther: "",
        securityQuestion: SECURITY_QUESTIONS[0],
        securityAnswer: "",
    });

    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [appointments, setAppointments] = useState([]);
    const [consultations, setConsultations] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedDateKey, setSelectedDateKey] = useState("");
    const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [otherSymptomText, setOtherSymptomText] = useState("");
    const [appointmentMessage, setAppointmentMessage] = useState("");
    const [scheduleError, setScheduleError] = useState("");
    const [showDailyConsultationHistory, setShowDailyConsultationHistory] = useState(false);
    const [historySelectedRecordId, setHistorySelectedRecordId] = useState("");
    const [patientHistorySelectedRecordId, setPatientHistorySelectedRecordId] = useState("");
    const [inboxMessages, setInboxMessages] = useState([]);
    const [adminInboxMessages, setAdminInboxMessages] = useState([]);
    const [activeInboxMessage, setActiveInboxMessage] = useState(null);
    const [qrModalAppointment, setQrModalAppointment] = useState(null);
    const [consultationScanValue, setConsultationScanValue] = useState("");
    const [consultationScannedPatientCode, setConsultationScannedPatientCode] = useState("");
    const [consultationTarget, setConsultationTarget] = useState(null);
    const [consultationStartedAt, setConsultationStartedAt] = useState("");
    const [consultationForm, setConsultationForm] = useState({
        diagnosis: "",
        prescribedMedicines: [createConsultationMedicineItemDraft()],
        includeAssistiveDevice: false,
        assistiveDeviceId: "",
        assistiveDeviceQuantity: 1,
        assistiveDeviceReason: "",
        note: "",
        proofImageMode: "upload",
        proofImageDataUrl: "",
        proofImageName: "",
    });
    const [consultationMessage, setConsultationMessage] = useState("");
    const [consultationError, setConsultationError] = useState("");
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [qrScannerError, setQrScannerError] = useState("");
    const qrScannerInstanceRef = useRef(null);
    const qrScannerElementId = "consultation-qr-reader";
    const qrScannerImageInputRef = useRef(null);
    const [proofCameraError, setProofCameraError] = useState("");
    const [isProofCameraOpen, setIsProofCameraOpen] = useState(false);
    const proofCameraVideoRef = useRef(null);
    const proofCameraStreamRef = useRef(null);
    const proofCaptureInputRef = useRef(null);
    const PROOF_IMAGE_MAX_BYTES = 300 * 1024;
    const PROOF_IMAGE_ASPECT_RATIO = 4 / 3;

    const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load the selected proof photo."));
        image.src = dataUrl;
    });

    const fileToDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Unable to read the selected proof photo."));
        reader.readAsDataURL(file);
    });

    const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Unable to compress the selected proof photo."));
                return;
            }
            resolve(blob);
        }, type, quality);
    });

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Unable to finalize the selected proof photo."));
        reader.readAsDataURL(blob);
    });

    const getCoverCropRect = (sourceWidth, sourceHeight, aspectRatio) => {
        const sourceRatio = sourceWidth / sourceHeight;
        if (sourceRatio > aspectRatio) {
            const cropWidth = Math.round(sourceHeight * aspectRatio);
            return {
                cropX: Math.round((sourceWidth - cropWidth) / 2),
                cropY: 0,
                cropWidth,
                cropHeight: sourceHeight,
            };
        }

        const cropHeight = Math.round(sourceWidth / aspectRatio);
        return {
            cropX: 0,
            cropY: Math.round((sourceHeight - cropHeight) / 2),
            cropWidth: sourceWidth,
            cropHeight,
        };
    };

    const compressProofImageDataUrl = async (sourceDataUrl, fileNameBase = "consultation-proof") => {
        const image = await loadImageFromDataUrl(sourceDataUrl);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!sourceWidth || !sourceHeight) {
            throw new Error("The selected proof photo has an invalid size.");
        }

        const crop = getCoverCropRect(sourceWidth, sourceHeight, PROOF_IMAGE_ASPECT_RATIO);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
            throw new Error("Image compression is not supported in this browser.");
        }

        let targetWidth = Math.min(crop.cropWidth, 1280);
        let targetHeight = Math.round(targetWidth / PROOF_IMAGE_ASPECT_RATIO);
        const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
        let bestBlob = null;

        for (let pass = 0; pass < 5; pass += 1) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            context.clearRect(0, 0, targetWidth, targetHeight);
            context.drawImage(
                image,
                crop.cropX,
                crop.cropY,
                crop.cropWidth,
                crop.cropHeight,
                0,
                0,
                targetWidth,
                targetHeight
            );

            for (const quality of qualitySteps) {
                const blob = await canvasToBlob(canvas, "image/jpeg", quality);
                if (!bestBlob || blob.size < bestBlob.size) {
                    bestBlob = blob;
                }
                if (blob.size <= PROOF_IMAGE_MAX_BYTES) {
                    const dataUrl = await blobToDataUrl(blob);
                    return {
                        dataUrl,
                        fileName: `${fileNameBase}.jpg`,
                        sizeBytes: blob.size,
                    };
                }
            }

            targetWidth = Math.max(640, Math.round(targetWidth * 0.85));
            targetHeight = Math.round(targetWidth / PROOF_IMAGE_ASPECT_RATIO);
        }

        if (!bestBlob) {
            throw new Error("Unable to compress the selected proof photo.");
        }

        const finalDataUrl = await blobToDataUrl(bestBlob);
        return {
            dataUrl: finalDataUrl,
            fileName: `${fileNameBase}.jpg`,
            sizeBytes: bestBlob.size,
        };
    };
    const [inventoryViewMode, setInventoryViewMode] = useState("all");
    const [inventoryMessage, setInventoryMessage] = useState("");
    const [inventoryError, setInventoryError] = useState("");
    const [inventoryForm, setInventoryForm] = useState({ name: "", category: "medicine", quantity: 0, unit: "pcs" });
    const [inventoryAmounts, setInventoryAmounts] = useState({});
    const [settingsDraft, setSettingsDraft] = useState(() => {
        const initialDraft = createDefaultSettingsDraft(user);
        const storedDraft = loadStoredJson(getSettingsStorageKey(user), {});
        return mergeSettingsDraftWithStoredValues(initialDraft, storedDraft);
    });
    const [settingsMessage, setSettingsMessage] = useState("");
    const [settingsError, setSettingsError] = useState("");
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
        reason: "",
    });
    const [passwordChangeSubmitting, setPasswordChangeSubmitting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
    const [medicationReminderHasStarted, setMedicationReminderHasStarted] = useState(false);
    const [medicationReminderNextIntakeAt, setMedicationReminderNextIntakeAt] = useState("");
    const visibleInboxMessages = useMemo(() => getVisibleInboxMessages(inboxMessages, user), [inboxMessages, user]);
    const scheduleByDate = useMemo(() => buildAppointmentScheduleMap(appointments), [appointments]);
    const visibleAdminInboxMessages = useMemo(() => {
        if (user?.role !== "admin") {
            return [];
        }

        return adminInboxMessages.map((message) => ({
            id: message.id,
            label: message.subject || "Notification",
            body: message.body || "",
            createdAt: message.created_at
                ? new Date(message.created_at).toLocaleString("en-PH")
                : "",
        }));
    }, [adminInboxMessages, user?.role]);
    const inboxItemsForActiveSelection = user?.role === "admin" ? visibleAdminInboxMessages : visibleInboxMessages;
    const activeVisibleInboxMessage = activeInboxMessage && inboxItemsForActiveSelection.some((message) => message.id === activeInboxMessage.id)
        ? activeInboxMessage
        : null;
    const staffConsultationHistory = useMemo(() => {
        if (user?.role !== "health_worker" && user?.role !== "admin") {
            return [];
        }

        return consultations
            .slice()
            .sort((a, b) => {
                const aTime = new Date(a.completedAt || a.startedAt || `${a.dateKey || "1970-01-01"}T00:00:00`).getTime();
                const bTime = new Date(b.completedAt || b.startedAt || `${b.dateKey || "1970-01-01"}T00:00:00`).getTime();
                return bTime - aTime;
            });
    }, [consultations, user?.role]);
    const selectedStaffHistoryRecord = useMemo(() => {
        if (!staffConsultationHistory.length) {
            return null;
        }

        if (!historySelectedRecordId) {
            return staffConsultationHistory[0];
        }

        return (
            staffConsultationHistory.find((entry) => String(entry.id) === String(historySelectedRecordId)) ||
            staffConsultationHistory[0]
        );
    }, [historySelectedRecordId, staffConsultationHistory]);
    const recentStaffConsultationHistory = useMemo(() => staffConsultationHistory.slice(0, 5), [staffConsultationHistory]);
    const patientMedicationReminderContext = useMemo(() => {
        if (user?.role !== "patient") {
            return { latestMedication: null, intakePerDay: 0 };
        }

        const currentPatientCode = user?.patientCode || buildPatientCode(user?.username || "");
        const patientMedicineConsultations = consultations
            .filter((entry) => entry.patientCode === currentPatientCode && (entry.medicineId || entry.medicineName))
            .sort((a, b) => {
                const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });

        const latestMedication = patientMedicineConsultations[0] || null;
        const intakePerDay = latestMedication ? Number(latestMedication.medicineIntakePerDay || 0) : 0;

        return {
            latestMedication,
            intakePerDay,
        };
    }, [consultations, user]);
    const medicationReminderStorageKey = useMemo(() => {
        if (user?.role !== "patient" || !patientMedicationReminderContext.latestMedication) {
            return "";
        }
        return getMedicationReminderStorageKey(user, patientMedicationReminderContext.latestMedication);
    }, [patientMedicationReminderContext.latestMedication, user]);

    useEffect(() => {
        if (!medicationReminderStorageKey) {
            setMedicationReminderHasStarted(false);
            setMedicationReminderNextIntakeAt("");
            return;
        }

        const storedRaw = window.localStorage.getItem(medicationReminderStorageKey);
        if (!storedRaw) {
            setMedicationReminderHasStarted(false);
            setMedicationReminderNextIntakeAt("");
            return;
        }

        try {
            const parsed = JSON.parse(storedRaw);
            if (parsed && typeof parsed === "object") {
                const hasStarted = Boolean(parsed.hasStarted);
                const nextIntakeAt = typeof parsed.nextIntakeAt === "string" ? parsed.nextIntakeAt : "";
                setMedicationReminderHasStarted(hasStarted);
                setMedicationReminderNextIntakeAt(nextIntakeAt);
                return;
            }
        } catch {
            // Backward compatibility for old ISO timestamp format.
        }

        const legacyStartedAtMs = Date.parse(storedRaw);
        const intakePerDay = Number(patientMedicationReminderContext.intakePerDay || 0);
        const intakeCycleMinutes = intakePerDay > 0 ? Math.max(1, Math.round((24 * 60) / intakePerDay)) : 0;
        const intakeCycleMs = intakeCycleMinutes * 60 * 1000;

        if (Number.isFinite(legacyStartedAtMs) && legacyStartedAtMs > 0 && intakeCycleMs > 0) {
            const nowMs = Date.now();
            const elapsedMs = Math.max(0, nowMs - legacyStartedAtMs);
            const cycleCount = Math.floor(elapsedMs / intakeCycleMs);
            const nextIntakeMs = legacyStartedAtMs + (cycleCount + 1) * intakeCycleMs;
            setMedicationReminderHasStarted(true);
            setMedicationReminderNextIntakeAt(new Date(nextIntakeMs).toISOString());
            return;
        }

        setMedicationReminderHasStarted(false);
        setMedicationReminderNextIntakeAt("");
    }, [medicationReminderStorageKey, patientMedicationReminderContext.intakePerDay]);

    useEffect(() => {
        if (!medicationReminderStorageKey) {
            return;
        }

        if (!medicationReminderHasStarted) {
            window.localStorage.removeItem(medicationReminderStorageKey);
            return;
        }

        const payload = {
            hasStarted: true,
            nextIntakeAt: medicationReminderNextIntakeAt || "",
        };
        window.localStorage.setItem(medicationReminderStorageKey, JSON.stringify(payload));
    }, [medicationReminderHasStarted, medicationReminderNextIntakeAt, medicationReminderStorageKey]);

    useEffect(() => {
        const intakePerDay = Number(patientMedicationReminderContext.intakePerDay || 0);
        const intakeCycleMinutes = intakePerDay > 0 ? Math.max(1, Math.round((24 * 60) / intakePerDay)) : 0;
        const intakeCycleMs = intakeCycleMinutes * 60 * 1000;
        const nextIntakeMs = Date.parse(medicationReminderNextIntakeAt || "");

        if (!medicationReminderHasStarted || intakeCycleMs <= 0) {
            return;
        }

        if (!Number.isFinite(nextIntakeMs)) {
            setMedicationReminderNextIntakeAt(new Date(currentDateTime.getTime() + intakeCycleMs).toISOString());
            return;
        }

        const nowMs = currentDateTime.getTime();
        if (nowMs < nextIntakeMs) {
            return;
        }

        const cyclesPassed = Math.floor((nowMs - nextIntakeMs) / intakeCycleMs) + 1;
        const updatedNextIntakeMs = nextIntakeMs + cyclesPassed * intakeCycleMs;
        setMedicationReminderNextIntakeAt(new Date(updatedNextIntakeMs).toISOString());
    }, [
        currentDateTime,
        medicationReminderHasStarted,
        medicationReminderNextIntakeAt,
        patientMedicationReminderContext.intakePerDay,
    ]);

    useEffect(() => {
        const isStaffRole = user?.role === "health_worker" || user?.role === "admin";
        if (!isStaffRole) {
            setHistorySelectedRecordId("");
            return;
        }

        setHistorySelectedRecordId((previousId) => {
            if (previousId && staffConsultationHistory.some((entry) => String(entry.id) === String(previousId))) {
                return previousId;
            }
            return staffConsultationHistory[0]?.id ? String(staffConsultationHistory[0].id) : "";
        });
    }, [staffConsultationHistory, user?.role]);

    useEffect(() => {
        if (user?.role !== "patient") {
            setPatientHistorySelectedRecordId("");
            return;
        }

        const patientConsultationHistory = consultations
            .filter((entry) => entry.patientCode === patientCode)
            .slice()
            .sort((a, b) => {
                const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });

        setPatientHistorySelectedRecordId((previousId) => {
            if (previousId && patientConsultationHistory.some((entry) => String(entry.id) === String(previousId))) {
                return previousId;
            }
            return patientConsultationHistory[0]?.id ? String(patientConsultationHistory[0].id) : "";
        });
    }, [consultations, patientCode, user?.role]);

    const shouldLoadStaffStats = (user?.role === "admin" || user?.role === "health_worker") && path === "/dashboard";
    const statsQuery = useQuery({
        queryKey: ["dashboard-stats", user?.role, path],
        queryFn: fetchPatientAndHealthWorkerStats,
        enabled: Boolean(shouldLoadStaffStats),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        if (!shouldLoadStaffStats) {
            setStats({ patientCount: 0, healthWorkerCount: 0 });
            setStatsLoading(false);
            setStatsError("");
            return;
        }

        setStatsLoading(statsQuery.isLoading || statsQuery.isFetching);
        setStatsError(statsQuery.error?.message || "");
        if (statsQuery.data) {
            setStats(statsQuery.data);
        }
    }, [shouldLoadStaffStats, statsQuery.data, statsQuery.error, statsQuery.isFetching, statsQuery.isLoading]);

    const profileQuery = useQuery({
        queryKey: ["my-profile-bundle", user?.id],
        queryFn: getMyProfileBundle,
        enabled: Boolean((path === "/dashboard" || path === "/settings") && user),
        staleTime: 30_000,
    });

    useEffect(() => {
        if (path !== "/dashboard" || !user) {
            setProfile(null);
            setProfileLoading(false);
            setProfileError("");
            return;
        }

        setProfileLoading(profileQuery.isLoading || profileQuery.isFetching);
        setProfileError(profileQuery.error?.message || "");

        if (profileQuery.data) {
            const bundle = profileQuery.data;
            setProfile({
                username: bundle.username || "",
                surname: bundle.surname || "",
                firstname: bundle.firstname || "",
                middlename: bundle.middlename || "",
                dob: bundle.dob || "",
                age: calculateAge(bundle.dob),
                address: buildAddressLine(bundle),
                email: bundle.email || "",
                contactNumber: bundle.contactNumber || "",
                role: bundle.role || "",
                profileImageUrl: bundle.avatarDataUrl || bundle.avatarUrl || "",
                patientCode: bundle.patientCode || "",
                workerId: bundle.workerId || "",
                adminId: bundle.adminId || "",
            });
        }
    }, [path, profileQuery.data, profileQuery.error, profileQuery.isFetching, profileQuery.isLoading, user]);

    useEffect(() => {
        if (path !== "/settings" || !user || !profileQuery.data) {
            return;
        }

        const bundle = profileQuery.data;
        const baseUser = {
            ...user,
            ...bundle,
            avatarDataUrl: bundle.avatarDataUrl || user?.avatarDataUrl || "",
            address:
                bundle.address && typeof bundle.address === "object"
                    ? bundle.address
                    : user?.address || {},
        };

        const initialDraft = createDefaultSettingsDraft(baseUser);
        const storedDraft = loadStoredJson(getSettingsStorageKey(baseUser), {});
        setSettingsDraft(mergeSettingsDraftWithStoredValues(initialDraft, storedDraft));
    }, [path, profileQuery.data, user]);

    const adminAgeRangeBarData = useMemo(() => {
        const labels = AGE_GROUPS.map((group) => group.label);
        const countsByLabel = Object.fromEntries(labels.map((label) => [label, 0]));

        (patientDirectory || []).forEach((patient) => {
            const ageYears = calculateAgeNumber(patient?.dob);
            const ageMonths = calculateAgeInMonths(patient?.dob);
            const rangeLabel = getAgeGroupLabel({ ageYears, ageMonths });
            if (countsByLabel[rangeLabel] !== undefined) {
                countsByLabel[rangeLabel] += 1;
            }
        });

        return {
            labels,
            datasets: [
                {
                    label: "Patients",
                    data: labels.map((label) => countsByLabel[label] || 0),
                    backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#0ea5e9", "#3b82f6", "#1d4ed8"],
                    borderRadius: 8,
                    maxBarThickness: 48,
                },
            ],
        };
    }, [patientDirectory]);

    const renderDashboardIdentityCard = () => {
        const roleLabelMap = {
            admin: "Administrator",
            health_worker: "Health Worker",
            patient: "Patient",
        };
        const roleTintMap = {
            admin: "from-red-50 to-white border-red-100 text-red-700",
            health_worker: "from-sky-50 to-white border-sky-100 text-sky-700",
            patient: "from-amber-50 to-white border-amber-100 text-amber-700",
        };
        const roleLabel = roleLabelMap[user?.role] || "Portal User";
        const roleTint = roleTintMap[user?.role] || "from-slate-50 to-white border-slate-100 text-slate-700";

        return (
            <section className={`bg-linear-to-r ${roleTint} rounded-3xl border shadow-sm p-5 md:p-6`}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="flex items-center gap-4 md:gap-5">
                        <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                            {profile?.profileImageUrl ? (
                                <img src={profile.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-2xl md:text-3xl font-bold text-brand-red">
                                    {profile?.username?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile Snapshot</p>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                                {profile
                                    ? `${profile.surname || "N/A"}, ${profile.firstname || "N/A"}${profile.middlename ? `, ${profile.middlename}` : ""}`
                                    : "Loading profile..."}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {roleLabel}
                                </span>
                                {profile?.patientCode && (
                                    <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                        ID: {profile.patientCode}
                                    </span>
                                )}
                                {profile?.workerId && (
                                    <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                        Worker: {profile.workerId}
                                    </span>
                                )}
                                {profile?.adminId && (
                                    <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                        Admin: {profile.adminId}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Link
                            to="/settings"
                            className="inline-flex items-center justify-center text-sm font-semibold text-white bg-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                        >
                            Edit profile
                        </Link>
                    </div>
                </div>

                {profileLoading ? (
                    <div className="mt-4 h-16 bg-white/70 rounded-2xl animate-pulse"></div>
                ) : profileError ? (
                    <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{profileError}</p>
                ) : profile ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-white/80 bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date of Birth</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{profile.dob || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/90 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Age</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{profile.age || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/90 p-3 sm:col-span-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Address</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 wrap-break-word">{profile.address || "N/A"}</p>
                        </div>
                    </div>
                ) : null}
            </section>
        );
    };

    const healthWorkerInsights = useMemo(() => {
        const emptyTopDiagnosis = {
            labels: ["No consultation data"],
            datasets: [
                {
                    label: "Cases",
                    data: [0],
                    backgroundColor: "#0ea5e9",
                    borderRadius: 8,
                },
            ],
        };

        const emptyAttendance = {
            labels: ["No booking data"],
            datasets: [
                {
                    label: "Booked",
                    data: [0],
                    backgroundColor: "#94a3b8",
                },
                {
                    label: "Attended (Consulted)",
                    data: [0],
                    backgroundColor: "#22c55e",
                },
                {
                    label: "Absences",
                    data: [0],
                    backgroundColor: "#ef4444",
                },
            ],
        };

        if (user?.role !== "health_worker") {
            return {
                topDiagnosisByAgeRangeData: emptyTopDiagnosis,
                attendanceVsAbsenceData: emptyAttendance,
            };
        }

        const patientAccounts = patientDirectory;
        const patientMap = patientAccounts.reduce((acc, account) => {
            const code = account.patientCode || account.patientId;
            if (code) {
                acc[code] = account;
            }
            return acc;
        }, {});

        const diagnosisCountsByRange = {};
        AGE_GROUPS.forEach((group) => {
            diagnosisCountsByRange[group.label] = {};
        });
        diagnosisCountsByRange["Unknown age"] = {};

        consultations.forEach((entry) => {
            const patient = patientMap[entry.patientCode];
            const ageYears = calculateAgeNumber(patient?.dob);
            const ageMonths = calculateAgeInMonths(patient?.dob);
            const rangeLabel = getAgeGroupLabel({ ageYears, ageMonths });
            const diagnosisLabel = normalizeDiagnosis(entry.diagnosis);

            diagnosisCountsByRange[rangeLabel][diagnosisLabel] = (diagnosisCountsByRange[rangeLabel][diagnosisLabel] || 0) + 1;
        });

        const rangeOrder = [...AGE_GROUPS.map((group) => group.label), "Unknown age"];
        const topDiagnosisRows = rangeOrder
            .map((rangeLabel) => {
                const diagnosisEntries = Object.entries(diagnosisCountsByRange[rangeLabel] || {});
                if (!diagnosisEntries.length) {
                    return { rangeLabel, diagnosisLabel: "No data", count: 0 };
                }

                const [diagnosisLabel, count] = diagnosisEntries.sort((a, b) => b[1] - a[1])[0];
                return { rangeLabel, diagnosisLabel, count };
            })
            .filter((row) => row.count > 0);

        const topDiagnosisByAgeRangeData = topDiagnosisRows.length
            ? {
                  labels: topDiagnosisRows.map((row) => `${row.rangeLabel}: ${row.diagnosisLabel}`),
                  datasets: [
                      {
                          label: "Top diagnosis cases",
                          data: topDiagnosisRows.map((row) => row.count),
                          backgroundColor: "#0ea5e9",
                          borderRadius: 8,
                      },
                  ],
              }
            : emptyTopDiagnosis;

        const bookedByDate = {};
        appointments.forEach((entry) => {
            if (!entry?.dateKey) return;
            bookedByDate[entry.dateKey] = (bookedByDate[entry.dateKey] || 0) + 1;
        });

        const consultedByDate = {};
        consultations.forEach((entry) => {
            if (!entry?.dateKey) return;
            consultedByDate[entry.dateKey] = (consultedByDate[entry.dateKey] || 0) + 1;
        });

        const allDates = Array.from(new Set([...Object.keys(bookedByDate), ...Object.keys(consultedByDate)])).sort();

        const attendanceVsAbsenceData = allDates.length
            ? {
                  labels: allDates.map((dateKey) => formatLongDate(dateKey)),
                  datasets: [
                      {
                          label: "Booked",
                          data: allDates.map((dateKey) => bookedByDate[dateKey] || 0),
                          backgroundColor: "#94a3b8",
                          borderRadius: 6,
                      },
                      {
                          label: "Attended (Consulted)",
                          data: allDates.map((dateKey) => consultedByDate[dateKey] || 0),
                          backgroundColor: "#22c55e",
                          borderRadius: 6,
                      },
                      {
                          label: "Absences",
                          data: allDates.map((dateKey) => Math.max((bookedByDate[dateKey] || 0) - (consultedByDate[dateKey] || 0), 0)),
                          backgroundColor: "#ef4444",
                          borderRadius: 6,
                      },
                  ],
              }
            : emptyAttendance;

        return {
            topDiagnosisByAgeRangeData,
            attendanceVsAbsenceData,
        };
    }, [appointments, consultations, patientDirectory, user?.role]);

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

    const dashboardCollectionsEnabled = Boolean(user?.role && DASHBOARD_COLLECTION_ROUTES.has(path));
    const dashboardCollectionsQuery = useQuery({
        queryKey: ["dashboard-collections", user?.role, user?.id, path],
        enabled: dashboardCollectionsEnabled,
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: async () => {
            const isPatient = user?.role === "patient";
            const patientPageSize = path === "/history" ? 100 : 25;
            const shouldLoadAppointments = path === "/dashboard" || path === "/schedules" || path === "/consultation";
            const shouldLoadConsultations = path === "/dashboard" || path === "/history" || path === "/consultation";
            const shouldLoadInventory = user?.role !== "patient" && (path === "/consultation" || path === "/inventory");
            const shouldLoadPatientDirectory = user?.role !== "patient" && (path === "/history" || path === "/consultation" || (user?.role === "health_worker" && path === "/dashboard"));
            const shouldLoadInbox = isPatient && (path === "/dashboard" || path === "/inbox");

            const [appointmentRows, consultationRows, inboxRows, inventoryRows, patientRows] = await Promise.all([
                shouldLoadAppointments
                    ? fetchAppointmentFeed({ page: 1, pageSize: isPatient ? patientPageSize : 100, patientUserId: isPatient ? user?.id : null })
                    : Promise.resolve([]),
                shouldLoadConsultations
                    ? fetchConsultationFeed({ page: 1, pageSize: isPatient ? patientPageSize : 100, patientUserId: isPatient ? user?.id : null })
                    : Promise.resolve([]),
                shouldLoadInbox ? fetchMyInboxMessages() : Promise.resolve([]),
                shouldLoadInventory ? fetchInventoryItems({ activeOnly: path === "/consultation" }) : Promise.resolve([]),
                shouldLoadPatientDirectory
                    ? fetchPatientDirectory({ page: 1, pageSize: 100, summaryOnly: !(user?.role === "health_worker" && path === "/dashboard") })
                    : Promise.resolve([]),
            ]);

            return {
                appointmentRows: appointmentRows || [],
                consultationRows: consultationRows || [],
                inboxRows: inboxRows || [],
                inventoryRows: inventoryRows || [],
                patientRows: patientRows || [],
            };
        },
    });

    useEffect(() => {
        if (!user?.role) {
            setAppointments([]);
            setConsultations([]);
            setInventoryItems([]);
            setInboxMessages([]);
            setPatientDirectory([]);
            return;
        }

        if (dashboardCollectionsQuery.error) {
            setScheduleError(dashboardCollectionsQuery.error?.message || "Unable to load dashboard data.");
            return;
        }

        if (!dashboardCollectionsQuery.data) {
            return;
        }

        const { appointmentRows, consultationRows, inboxRows, inventoryRows, patientRows } = dashboardCollectionsQuery.data;
        setAppointments(appointmentRows);
        setConsultations(consultationRows);
        setInboxMessages(inboxRows);
        setInventoryItems(inventoryRows);
        setPatientDirectory(patientRows);
        setScheduleError("");
    }, [dashboardCollectionsQuery.data, dashboardCollectionsQuery.error, user?.role]);

    useEffect(() => {
        if (!dashboardCollectionsEnabled) {
            return;
        }

        const invalidateDashboardData = () => {
            queryClient.invalidateQueries({ queryKey: ["dashboard-collections"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["admin-inbox"] });
            queryClient.invalidateQueries({ queryKey: ["admin-health-workers"] });
        };

        const channel = supabase
            .channel(`dashboard-refresh-${user?.role || "guest"}-${user?.id || "anon"}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, invalidateDashboardData)
            .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, invalidateDashboardData)
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, invalidateDashboardData)
            .on("postgres_changes", { event: "*", schema: "public", table: "patient_profiles" }, invalidateDashboardData)
            .on("postgres_changes", { event: "*", schema: "public", table: "health_worker_profiles" }, invalidateDashboardData)
            .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, invalidateDashboardData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dashboardCollectionsEnabled, queryClient, user?.id, user?.role]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    }, []);

    const adminWorkersQuery = useQuery({
        queryKey: ["admin-health-workers", path],
        queryFn: () => fetchHealthWorkerDirectory({ page: 1, pageSize: 100 }),
        enabled: user?.role === "admin" && (path === "/manage-accounts" || path === "/health-worker-accounts"),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        if (user?.role !== "admin") {
            return;
        }

        if (adminWorkersQuery.error) {
            setManageError(adminWorkersQuery.error?.message || "Unable to load health worker accounts.");
            return;
        }

        if (adminWorkersQuery.data) {
            setManageError("");
            setCreatedHealthWorkers(adminWorkersQuery.data);
        }
    }, [adminWorkersQuery.data, adminWorkersQuery.error, user?.role]);

    const adminInboxQuery = useQuery({
        queryKey: ["admin-inbox", path],
        queryFn: fetchMyInboxMessages,
        enabled: user?.role === "admin" && (path === "/dashboard" || path === "/inbox"),
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    useEffect(() => {
        if (user?.role !== "admin") {
            return;
        }

        if (adminInboxQuery.error) {
            setAdminInboxMessages([]);
            return;
        }

        if (adminInboxQuery.data) {
            setAdminInboxMessages(adminInboxQuery.data);
        }
    }, [adminInboxQuery.data, adminInboxQuery.error, user?.role]);

    const getDefaultConsultationForm = (medicineId = "") => ({
        diagnosis: "",
        prescribedMedicines: [createConsultationMedicineItemDraft(medicineId)],
        includeAssistiveDevice: false,
        assistiveDeviceId: "",
        assistiveDeviceQuantity: 1,
        assistiveDeviceReason: "",
        note: "",
        proofImageMode: "upload",
        proofImageDataUrl: "",
        proofImageName: "",
    });

    const verifyConsultationCodeValue = (rawCode, options = {}) => {
        const { fromScanner = false } = options;
        setConsultationError("");
        setConsultationMessage("");

        const code = String(rawCode || "").trim();
        if (!code) {
            setConsultationError("Scan or enter a patient QR code first.");
            return false;
        }

        const normalizedCandidates = extractAppointmentQrCandidates(code);
        if (normalizedCandidates.length === 0) {
            setConsultationError("Unable to read a valid appointment code from the scanned QR.");
            return false;
        }

        const resolvedScannedCode = normalizedCandidates[0];
        const matchedAppointment = appointments.find((appointment) =>
            getAppointmentLookupCandidates(appointment).some((candidate) => normalizedCandidates.includes(candidate))
        );

        if (!matchedAppointment) {
            setConsultationError(fromScanner
                ? `Scanned code (${resolvedScannedCode}) is not linked to any appointment.`
                : "This QR code is not linked to any appointment.");
            setConsultationTarget(null);
            setConsultationScannedPatientCode("");
            return false;
        }

        const defaultMedicineId = inventoryItems.find((item) => item.category === "medicine" && item.quantity > 0)?.id || "";

        setConsultationScanValue(resolvedScannedCode);
        setConsultationScannedPatientCode(matchedAppointment.patientCode);
        setConsultationTarget(matchedAppointment);
        setConsultationStartedAt("");
        setConsultationForm(getDefaultConsultationForm(defaultMedicineId));

        if (matchedAppointment.status === "consulted") {
            setConsultationMessage(
                fromScanner
                    ? `QR code detected and verified for ${matchedAppointment.patientName}. This appointment is already completed, and its consultation result is shown below.`
                    : `Patient verified for ${matchedAppointment.patientName}. This appointment is already completed, so the consultation result is shown below.`
            );
            return true;
        }

        setConsultationMessage(
            fromScanner
                ? `QR code detected and verified for ${matchedAppointment.patientName}. Select a booked slot to continue.`
                : `Patient verified for ${matchedAppointment.patientName}. Select a booked slot to continue.`
        );

        return true;
    };

    const stopQrScanner = async () => {
        const instance = qrScannerInstanceRef.current;
        if (!instance) {
            return;
        }

        try {
            if (instance.isScanning) {
                await instance.stop();
            }
        } catch {
            // Ignore scanner stop errors; clear will still run.
        }

        try {
            await instance.clear();
        } catch {
            // Ignore cleanup errors.
        }

        qrScannerInstanceRef.current = null;
    };

    const stopProofCamera = () => {
        if (proofCameraStreamRef.current) {
            proofCameraStreamRef.current.getTracks().forEach((track) => track.stop());
            proofCameraStreamRef.current = null;
        }

        if (proofCameraVideoRef.current) {
            proofCameraVideoRef.current.srcObject = null;
        }

        setIsProofCameraOpen(false);
    };

    const openProofCaptureInput = () => {
        if (proofCaptureInputRef.current) {
            proofCaptureInputRef.current.value = "";
            proofCaptureInputRef.current.click();
        }
    };

    const openProofCamera = async () => {
        setProofCameraError("");

        if (!navigator.mediaDevices?.getUserMedia) {
            setProofCameraError("Live preview camera is not available here. Use device camera capture below.");
            openProofCaptureInput();
            return false;
        }

        try {
            stopProofCamera();

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        aspectRatio: { ideal: 4 / 3 },
                        width: { ideal: 1024 },
                        height: { ideal: 768 },
                    },
                    audio: false,
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }

            proofCameraStreamRef.current = stream;
            if (proofCameraVideoRef.current) {
                proofCameraVideoRef.current.srcObject = stream;
                await proofCameraVideoRef.current.play();
            }

            setIsProofCameraOpen(true);
            return true;
        } catch (error) {
            stopProofCamera();
            if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
                setProofCameraError("Camera permission was denied. Allow camera access, or use device camera capture below.");
                return false;
            }
            if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
                setProofCameraError("No camera device was detected. Use device camera capture below.");
                return false;
            }
            setProofCameraError("Unable to open live camera preview. Use device camera capture below.");
            return false;
        }
    };

    const captureProofPhoto = async () => {
        const videoElement = proofCameraVideoRef.current;
        if (!videoElement || !isProofCameraOpen) {
            setProofCameraError("Camera preview is not ready yet. Please wait and try again.");
            return;
        }

        const frameWidth = videoElement.videoWidth;
        const frameHeight = videoElement.videoHeight;
        if (!frameWidth || !frameHeight) {
            setProofCameraError("Camera frame is not ready yet. Please try again in a moment.");
            return;
        }

        try {
            const frameCanvas = document.createElement("canvas");
            const crop = getCoverCropRect(frameWidth, frameHeight, PROOF_IMAGE_ASPECT_RATIO);
            const targetWidth = Math.min(crop.cropWidth, 1280);
            const targetHeight = Math.round(targetWidth / PROOF_IMAGE_ASPECT_RATIO);
            frameCanvas.width = targetWidth;
            frameCanvas.height = targetHeight;

            const frameContext = frameCanvas.getContext("2d", { alpha: false });
            if (!frameContext) {
                throw new Error("Unable to capture photo from camera. Please try again.");
            }

            frameContext.drawImage(
                videoElement,
                crop.cropX,
                crop.cropY,
                crop.cropWidth,
                crop.cropHeight,
                0,
                0,
                targetWidth,
                targetHeight
            );

            const initialBlob = await canvasToBlob(frameCanvas, "image/jpeg", 0.9);
            const compressed = initialBlob.size <= PROOF_IMAGE_MAX_BYTES
                ? {
                    dataUrl: await blobToDataUrl(initialBlob),
                    fileName: `consultation-proof-${Date.now()}.jpg`,
                    sizeBytes: initialBlob.size,
                }
                : await compressProofImageDataUrl(await blobToDataUrl(initialBlob), `consultation-proof-${Date.now()}`);

            setConsultationForm((prev) => ({
                ...prev,
                proofImageDataUrl: compressed.dataUrl,
                proofImageName: compressed.fileName,
            }));
            setProofCameraError("");
            stopProofCamera();
        } catch (error) {
            setProofCameraError(error?.message || "Unable to compress the captured photo. Please try again.");
        }
    };

    const closeQrScanner = () => {
        void stopQrScanner();
        setIsQrScannerOpen(false);
    };

    const triggerQrImageScan = () => {
        if (!qrScannerImageInputRef.current) {
            return;
        }
        qrScannerImageInputRef.current.value = "";
        qrScannerImageInputRef.current.click();
    };

    const scanQrFromImageFile = async (file) => {
        if (!file) {
            return;
        }

        setQrScannerError("");

        try {
            await stopQrScanner();

            const scanner = new Html5Qrcode(qrScannerElementId, {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                verbose: false,
            });
            qrScannerInstanceRef.current = scanner;

            const decodedText = await scanner.scanFile(file, true);
            await stopQrScanner();
            setIsQrScannerOpen(false);
            verifyConsultationCodeValue(decodedText, { fromScanner: true });
        } catch {
            await stopQrScanner();
            setQrScannerError("Unable to decode QR from this image. Try a clearer photo or use the live camera scanner.");
        }
    };

    const openQrScanner = async () => {
        setQrScannerError("");

        try {
            await stopQrScanner();
            setIsQrScannerOpen(true);

            await new Promise((resolve) => window.setTimeout(resolve, 0));

            const scanner = new Html5Qrcode(qrScannerElementId, {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                verbose: false,
            });
            qrScannerInstanceRef.current = scanner;

            const scannerConfig = {
                fps: 10,
                qrbox: { width: 240, height: 240 },
                aspectRatio: 1.333,
            };

            const onScanSuccess = async (decodedText) => {
                if (!decodedText) {
                    return;
                }
                await stopQrScanner();
                setIsQrScannerOpen(false);
                verifyConsultationCodeValue(decodedText, { fromScanner: true });
            };

            const onScanFailure = () => {
                // Keep scanning; no UI noise for normal frame misses.
            };

            try {
                await scanner.start(
                    { facingMode: "environment" },
                    scannerConfig,
                    onScanSuccess,
                    onScanFailure
                );
            } catch {
                const cameras = await Html5Qrcode.getCameras();
                if (!cameras || cameras.length === 0) {
                    throw new Error("NoCamera");
                }

                await scanner.start(
                    cameras[0].id,
                    scannerConfig,
                    onScanSuccess,
                    onScanFailure
                );
            }
        } catch (error) {
            await stopQrScanner();
            setIsQrScannerOpen(false);

            if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError" || error?.name === "SecurityError") {
                setQrScannerError("Camera permission was denied. Allow camera access, then try again.");
                return;
            }
            if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError" || error?.message === "NoCamera") {
                setQrScannerError("No camera device was detected on this device.");
                return;
            }
            if (!window.isSecureContext) {
                setQrScannerError("Camera scanning requires a secure page (HTTPS). Open the app on HTTPS or localhost, then try again.");
                return;
            }
            setQrScannerError("Unable to access camera scanner on this browser. You can still paste the code manually.");
        }
    };

    useEffect(() => {
        return () => {
            void stopQrScanner();
            stopProofCamera();
        };
    }, []);

    useEffect(() => {
        if (consultationForm.proofImageMode !== "take") {
            stopProofCamera();
            setProofCameraError("");
        }
    }, [consultationForm.proofImageMode]);

    const handleManageSubmit = async (e) => {
        e.preventDefault();
        setManageError("");
        setManageMessage("");
        setLastCreatedLicenseNumber("");

        const passwordRuleError = validateHealthWorkerPassword(manageForm.password);
        if (passwordRuleError) {
            setManageError(passwordRuleError);
            return;
        }
        if (manageForm.password !== manageForm.confirmPassword) {
            setManageError("Passwords do not match.");
            return;
        }
        if (!manageForm.securityAnswer.trim()) {
            setManageError("Security answer is required.");
            return;
        }
        if (!manageForm.dob) {
            setManageError("Birthdate is required.");
            return;
        }
        if (manageForm.gender === "Other / Unknown (please specify)" && !manageForm.genderOther.trim()) {
            setManageError("Please specify gender when selecting Other / Unknown.");
            return;
        }

        try {
            await new Promise((resolve) => setTimeout(resolve, 250));
            const resolvedGender = manageForm.gender === "Other / Unknown (please specify)"
                ? manageForm.genderOther.trim()
                : manageForm.gender;

            const securityQuestionId = SECURITY_QUESTIONS.findIndex((question) => question === manageForm.securityQuestion) + 1;
            const createdWorker = await createHealthWorkerAccountByAdmin({
                email: manageForm.email.trim(),
                password: manageForm.password,
                surname: manageForm.surname.trim(),
                firstname: manageForm.firstname.trim(),
                middlename: manageForm.middlename.trim(),
                dob: manageForm.dob,
                sex: manageForm.sex,
                gender: resolvedGender,
                securityQuestionId: securityQuestionId > 0 ? securityQuestionId : 1,
                securityAnswer: manageForm.securityAnswer.trim(),
            });

            const licenseNumber = createdWorker.licenseNumber;

            const workerAccount = {
                role: "health_worker",
                email: manageForm.email.trim(),
                password: manageForm.password,
                surname: manageForm.surname.trim(),
                firstname: manageForm.firstname.trim(),
                middlename: manageForm.middlename.trim(),
                dob: manageForm.dob,
                sex: manageForm.sex,
                gender: resolvedGender,
                displayName: `${manageForm.firstname} ${manageForm.surname}`.trim() || manageForm.email.trim(),
                workerId: licenseNumber,
                systemLicenseNumber: licenseNumber,
                securityQuestion: manageForm.securityQuestion,
                securityAnswer: manageForm.securityAnswer.trim(),
                userId: createdWorker.userId || "",
                createdAt: new Date().toISOString(),
            };

            setCreatedHealthWorkers((prev) => [
                workerAccount,
                ...prev.filter(
                    (account) =>
                        String(account.email || "").toLowerCase() !== String(workerAccount.email || "").toLowerCase()
                ),
            ]);
            setLastCreatedLicenseNumber(licenseNumber);
            setManageMessage(`Health worker account created. License Number: ${licenseNumber}`);

            setManageForm({
                email: "",
                password: "",
                confirmPassword: "",
                surname: "",
                firstname: "",
                middlename: "",
                dob: "",
                sex: SEX_OPTIONS[2],
                gender: GENDER_OPTIONS[10],
                genderOther: "",
                securityQuestion: SECURITY_QUESTIONS[0],
                securityAnswer: "",
            });
        } catch (manageSubmitError) {
            setManageError(manageSubmitError?.message || "Unable to save account.");
        }
    };

    const handleDeleteHealthWorker = async (account) => {
        setManageError("");
        setManageMessage("");

        if (!account?.userId) {
            setManageError("Unable to delete account: missing user identifier.");
            return;
        }

        const confirmed = window.confirm("Are you sure to delete?");
        if (!confirmed) {
            return;
        }

        setDeletingHealthWorkerUserId(account.userId);
        try {
            await deleteHealthWorkerAccountByAdmin({ userId: account.userId });

            setCreatedHealthWorkers((prev) => prev.filter((worker) => worker.userId !== account.userId));
            await queryClient.invalidateQueries({ queryKey: ["admin-health-workers"] });
            setManageMessage("Health worker account deleted successfully.");
        } catch (deleteError) {
            setManageError(deleteError?.message || "Unable to delete health worker account.");
        } finally {
            setDeletingHealthWorkerUserId("");
        }
    };

    const renderDashboardHome = () => {
        if (!user) return null;
        if (user.role === "admin") {    
            return (    
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            {buildGreeting(currentDateTime, user)}
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
                                    <div className="rounded-xl bg-slate-200 h-48 w-full"></div>
                                </div>
                            ) : statsError ? (
                                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                            ) : (
                                <div className="h-72">
                                    <Bar
                                        data={adminAgeRangeBarData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    ticks: { precision: 0 },
                                                    title: { display: true, text: "Number of Patients" },
                                                },
                                                x: {
                                                    ticks: {
                                                        autoSkip: false,
                                                        maxRotation: 25,
                                                        minRotation: 25,
                                                    },
                                                },
                                            },
                                            plugins: {
                                                legend: { display: false },
                                            },
                                        }}
                                    />
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

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-slate-800">Consultation history</h2>
                            <Link to="/history" className="text-sm font-semibold text-brand-red hover:text-brand-dark">Open History</Link>
                        </div>
                        {recentStaffConsultationHistory.length === 0 ? (
                            <p className="text-sm text-slate-500">No consultation records yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {recentStaffConsultationHistory.map((entry) => (
                                    <article key={`admin-consult-history-${entry.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-bold text-slate-800">{entry.patientName}</p>
                                        <p className="text-sm text-slate-700 mt-1">Diagnosis: {entry.diagnosis || "N/A"}</p>
                                        <p className="text-xs text-slate-500 mt-1">{formatLongDate(entry.dateKey)} at {entry.timeSlot || "N/A"}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Link
                            to="/patient-accounts"
                            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <div className="mb-4 w-11 h-11 rounded-xl bg-pink-50 flex items-center justify-center">
                                <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-pink-600" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Patient Accounts</h3>
                            <p className="text-sm text-slate-600 mt-2">Manage patient accounts, view consultations, audit logs, and administrative controls.</p>
                        </Link>
                        <Link
                            to="/health-worker-accounts"
                            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <div className="mb-4 w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
                                <FontAwesomeIcon icon={faStethoscope} className="w-5 h-5 text-green-600" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Health Worker Accounts</h3>
                            <p className="text-sm text-slate-600 mt-2">View health worker information, performance stats, and activity logs.</p>
                        </Link>
                    </div>
                </div>
            );
        }
        if (user.role === "health_worker") {
            const patientDirectoryList = patientDirectory
                .slice()
                .sort((a, b) => {
                    const nameA = `${a.surname || ""} ${a.firstname || ""}`.trim().toLowerCase();
                    const nameB = `${b.surname || ""} ${b.firstname || ""}`.trim().toLowerCase();
                    return nameA.localeCompare(nameB);
                });

            return (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">
                            {buildGreeting(currentDateTime, user)}
                        </h1>
                        <p className="text-slate-600">
                            You are logged in as <span className="font-semibold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md text-xs uppercase tracking-wide">Health Worker</span>
                        </p>
                    </div>
                    {renderDashboardIdentityCard()}
                    <button
                        type="button"
                        onClick={() => setIsPatientDirectoryOpen(true)}
                        className="mt-6 w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left hover:shadow-md hover:border-slate-300 transition-all"
                    >
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Patient Overview</h2>
                        {statsLoading ? (
                            <div className="h-10 bg-slate-200 rounded animate-pulse w-24"></div>
                        ) : statsError ? (
                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{statsError}</p>
                        ) : (
                            <>
                                <p className="text-5xl font-bold text-brand-red">
                                    {stats.patientCount}
                                </p>
                                <p className="text-xs uppercase tracking-wide text-slate-500 mt-3">Click to view patient directory</p>
                            </>
                        )}
                    </button>
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
                        <Link
                            to="/history"
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <div className="mb-3 w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                                <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">History</h3>
                            <p className="text-sm text-slate-500 mt-1">View full consultation history and outcomes.</p>
                        </Link>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-slate-800">Consultation history</h2>
                            <Link to="/history" className="text-sm font-semibold text-brand-red hover:text-brand-dark">Open History</Link>
                        </div>
                        {recentStaffConsultationHistory.length === 0 ? (
                            <p className="text-sm text-slate-500">No consultation records yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {recentStaffConsultationHistory.map((entry) => (
                                    <article key={`worker-consult-history-${entry.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-bold text-slate-800">{entry.patientName}</p>
                                        <p className="text-sm text-slate-700 mt-1">Diagnosis: {entry.diagnosis || "N/A"}</p>
                                        <p className="text-xs text-slate-500 mt-1">{formatLongDate(entry.dateKey)} at {entry.timeSlot || "N/A"}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800">Top Diagnosis by Age Range</h3>
                            <p className="text-sm text-slate-500 mt-1">Shows the most common diagnosis per age group based on completed consultations.</p>
                            <div className="mt-4 h-72">
                                <Bar
                                    data={healthWorkerInsights.topDiagnosisByAgeRangeData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: true },
                                        },
                                        scales: {
                                            x: {
                                                ticks: {
                                                    autoSkip: false,
                                                    maxRotation: 35,
                                                    minRotation: 20,
                                                },
                                            },
                                            y: {
                                                beginAtZero: true,
                                                ticks: { precision: 0 },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800">Booked vs Attended per Day</h3>
                            <p className="text-sm text-slate-500 mt-1">Compare booked consultations against attended consultations and absences daily.</p>
                            <div className="mt-4 h-72">
                                <Bar
                                    data={healthWorkerInsights.attendanceVsAbsenceData}
                                    options={{
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: true },
                                        },
                                        scales: {
                                            x: {
                                                ticks: {
                                                    maxRotation: 40,
                                                    minRotation: 20,
                                                },
                                            },
                                            y: {
                                                beginAtZero: true,
                                                ticks: { precision: 0 },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {isPatientDirectoryOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
                            <div className="w-full max-w-6xl rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Patient Directory</h2>
                                        <p className="text-sm text-slate-600 mt-1">Names, profile details, and pictures of registered patients.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsPatientDirectoryOpen(false)}
                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                </div>

                                {patientDirectory.length === 0 ? (
                                    <p className="text-sm text-slate-600">No registered patients found.</p>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {patientDirectoryList.map((patient, index) => {
                                            const fullName = `${patient.surname || "N/A"}, ${patient.firstname || "N/A"}, ${patient.middlename || "N/A"}`;
                                            const patientId = patient.patientCode || patient.patientId || "N/A";
                                            return (
                                                <article key={`patient-directory-${patientId}-${patient.username || patient.email || index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-14 w-14 rounded-full bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                                                            {patient.avatarDataUrl ? (
                                                                <img src={patient.avatarDataUrl} alt="Patient" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-lg font-bold text-brand-red">
                                                                    {(patient.firstname?.[0] || patient.username?.[0] || "P").toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">{patient.firstname || patient.username || "Patient"}</p>
                                                            <p className="text-xs text-slate-500">{patientId}</p>
                                                        </div>
                                                    </div>

                                                    <div className="text-sm text-slate-700 space-y-1">
                                                        <p><span className="font-semibold">Full name:</span> {fullName}</p>
                                                        <p><span className="font-semibold">Age:</span> {calculateAge(patient.dob)}</p>
                                                        <p><span className="font-semibold">Email:</span> {patient.email || "N/A"}</p>
                                                        <p><span className="font-semibold">Contact:</span> {patient.contactNumber || "N/A"}</p>
                                                        <p className="leading-5"><span className="font-semibold">Address:</span> {buildAddressLine(patient)}</p>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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

        const recentInbox = visibleInboxMessages.slice(0, 3);
        const latestMedication = patientMedicationReminderContext.latestMedication;
        const intakePerDay = patientMedicationReminderContext.intakePerDay;
        const hasMedicationReminder = Boolean(latestMedication && intakePerDay > 0);
        const intakeCycleMinutes = intakePerDay > 0 ? Math.max(1, Math.round((24 * 60) / intakePerDay)) : 0;
        const intakeCycleMs = intakeCycleMinutes * 60 * 1000;
        const nextIntakeTimestampMs = Date.parse(medicationReminderNextIntakeAt || "");
        const hasStartedIntake = medicationReminderHasStarted;

        let nextIntakeAt = null;
        let remainingCycleMinutes = 0;
        let intakeProgressPercent = 0;

        if (hasMedicationReminder && hasStartedIntake && intakeCycleMs > 0 && Number.isFinite(nextIntakeTimestampMs)) {
            const nowMs = currentDateTime.getTime();
            const remainingMs = Math.max(0, nextIntakeTimestampMs - nowMs);
            const elapsedInCurrentCycleMs = Math.max(0, intakeCycleMs - remainingMs);

            nextIntakeAt = new Date(nextIntakeTimestampMs);
            remainingCycleMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
            intakeProgressPercent = Math.min(100, Math.round((elapsedInCurrentCycleMs / intakeCycleMs) * 100));
        }

        const reminderHours = Math.floor(remainingCycleMinutes / 60);
        const reminderMinutes = remainingCycleMinutes % 60;
        const intakeFrequencyLabel = intakePerDay > 0
            ? `${intakePerDay}x/day`
            : "";
        const medicineLabel = latestMedication?.medicineName || "your prescribed medicine";
        const nextIntakeClockLabel = nextIntakeAt
            ? nextIntakeAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })
            : "";
        const handleStartTakingNow = () => {
            if (intakeCycleMs <= 0) {
                return;
            }

            const startedAtMs = Date.now();
            const nextIntakeMs = startedAtMs + intakeCycleMs;
            setMedicationReminderHasStarted(true);
            setMedicationReminderNextIntakeAt(new Date(nextIntakeMs).toISOString());
        };

        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                    {buildGreeting(currentDateTime, user)}
                </h1>
                <p className="text-slate-600">
                    Welcome to your <span className="font-semibold text-brand-red px-2 py-0.5 bg-red-50 rounded-md text-xs uppercase tracking-wide">Patient Portal</span>
                </p>
                {renderDashboardIdentityCard()}

                <section className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-12">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-3">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-sky-600" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Patient ID</h3>
                        <p className="text-sm text-slate-500 mt-1 break-all">{patientCode}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-5">
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

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-2">
                        <div className="mb-4 w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileMedical} className="w-5 h-5 text-brand-red" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Date & Time</h3>
                        <p className="text-sm text-slate-600 mt-1">{currentDateTime.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{currentDateTime.toLocaleTimeString("en-PH")}</p>
                    </div>

                    <div className="bg-linear-to-br from-red-600 to-red-700 p-6 rounded-2xl shadow-sm text-white xl:col-span-2">
                        <h3 className="font-bold text-lg">Medicine Intake Reminder</h3>
                        {hasMedicationReminder ? (
                            <>
                                <p className="text-sm text-red-100 mt-2 leading-relaxed">
                                    {`Take ${medicineLabel} ${intakeFrequencyLabel}.`}
                                </p>
                                {!hasStartedIntake ? (
                                    <div className="mt-4 space-y-3">
                                        <p className="text-xs text-red-100">
                                            Tap Start Taking Now to begin your intake countdown.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleStartTakingNow}
                                            className="w-full rounded-lg bg-white text-red-700 font-semibold text-sm px-3 py-2 hover:bg-red-50 transition-all"
                                        >
                                            Start Taking Now
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-xs text-red-100 mb-1">
                                            <span>Frequency: {intakeFrequencyLabel}</span>
                                            <span>{latestMedication.medicineQuantity} dispensed</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-red-400/60 overflow-hidden">
                                            <div className="h-full bg-white" style={{ width: `${intakeProgressPercent}%` }} />
                                        </div>
                                        <p className="text-xs text-red-100 mt-2">
                                            Next intake: {reminderHours} hour{reminderHours === 1 ? "" : "s"} {reminderMinutes} minute{reminderMinutes === 1 ? "" : "s"}
                                        </p>
                                        <p className="text-xs text-red-100 mt-1">
                                            <span className="font-bold">Next schedule time:</span> {nextIntakeClockLabel || "N/A"}
                                        </p>
                                    </div>
                                )}
                                {latestMedication.medicineIntakeInstruction ? (
                                    <p className="text-xs text-red-100 mt-3">
                                        {latestMedication.medicineIntakeInstruction}
                                    </p>
                                ) : null}
                            </>
                        ) : (
                            <div className="mt-4 h-24" />
                        )}
                    </div>
                </section>

                <section className="grid gap-4 grid-cols-1 xl:grid-cols-12">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-8">
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

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-4">
                        <h3 className="font-bold text-lg text-slate-800">Quick Access</h3>
                        <div className="mt-3 space-y-2">
                            <Link to="/schedules" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Schedule Consultation</Link>
                            <Link to="/history" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Consultation History</Link>
                            <Link to="/settings" className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Account Settings</Link>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm xl:col-span-12">
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
                                <p className="text-sm font-semibold text-slate-800 mt-1">{visibleInboxMessages.length} total inbox notifications</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Medication Cycle</p>
                                <p className="text-sm font-semibold text-slate-800 mt-1">
                                    {hasMedicationReminder
                                        ? hasStartedIntake
                                            ? `Next intake: ${reminderHours}h ${reminderMinutes}m (${nextIntakeClockLabel})`
                                            : "Start intake countdown"
                                        : ""}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        );
    };

    const renderSettings = () => {
        const isPatient = user?.role === "patient";
        const isHealthWorker = user?.role === "health_worker";
        const isAdmin = user?.role === "admin";
        const isCooldownManagedRole = isPatient || isHealthWorker;
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

        const daysUntilAllowed = (lastIso, cooldownDays) => {
            if (!lastIso) return 0;
            const lastDate = new Date(lastIso);
            if (Number.isNaN(lastDate.getTime())) return 0;
            const elapsed = Date.now() - lastDate.getTime();
            const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
            if (elapsed >= cooldownMs) return 0;
            return Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
        };

        const normalizePart = (value) => String(value || "").trim().toLowerCase();

        const profileBundle = profileQuery.data || {};
        const currentAvatarUrl = sanitizeAvatarValue(profileBundle.avatarDataUrl || user?.avatarDataUrl || "");
        const avatarCooldownDaysLeft = isCooldownManagedRole
            ? daysUntilAllowed(profileBundle.lastAvatarUpdatedAt || user?.lastAvatarUpdatedAt, 7)
            : 0;
        const addressCooldownDaysLeft = isCooldownManagedRole
            ? daysUntilAllowed(profileBundle.lastAddressUpdatedAt || user?.lastAddressUpdatedAt, 30)
            : 0;

        const isAvatarOnCooldown = avatarCooldownDaysLeft > 0;
        const isAddressOnCooldown = addressCooldownDaysLeft > 0;

        const baselineAddress = profileBundle.address && typeof profileBundle.address === "object"
            ? profileBundle.address
            : user?.address && typeof user.address === "object"
                ? user.address
                : {};

        const isAvatarChangeRequested = Boolean(settingsDraft.avatarFile)
            || (sanitizeAvatarValue(settingsDraft.avatarDataUrl) && sanitizeAvatarValue(settingsDraft.avatarDataUrl) !== currentAvatarUrl);
        const isAddressChangeRequested =
            normalizePart(settingsDraft.houseNumber) !== normalizePart(baselineAddress.houseNumber || user?.houseNumber)
            || normalizePart(settingsDraft.streetName) !== normalizePart(baselineAddress.street || baselineAddress.streetName || user?.streetName)
            || normalizePart(settingsDraft.purokSubdivision) !== normalizePart(baselineAddress.purokSubdivision || user?.purokSubdivision);

        const handleAvatarChange = (file) => {
            if (isAvatarOnCooldown) {
                setSettingsError(`Profile photo is on cooldown. You can change it again in ${avatarCooldownDaysLeft} day(s).`);
                return;
            }

            if (!file) {
                setSettingsDraft((previous) => ({ ...previous, avatarDataUrl: "", avatarFile: null }));
                return;
            }

            // Store the file for upload
            setSettingsDraft((previous) => ({ ...previous, avatarFile: file }));

            // Create a preview
            const reader = new FileReader();
            reader.onload = () => {
                setSettingsDraft((previous) => ({
                    ...previous,
                    avatarDataUrl: typeof reader.result === "string" ? reader.result : "",
                }));
            };
            reader.readAsDataURL(file);
        };

        const saveSettings = async (e) => {
            e.preventDefault();
            setSettingsError("");
            setSettingsMessage("");

            if (isCooldownManagedRole && isAvatarOnCooldown && isAvatarChangeRequested) {
                setSettingsError(`Profile photo is on cooldown. You can change it again in ${avatarCooldownDaysLeft} day(s).`);
                return;
            }

            if (isCooldownManagedRole && isAddressOnCooldown && isAddressChangeRequested) {
                setSettingsError(`Address is on cooldown. You can update it again in ${addressCooldownDaysLeft} day(s).`);
                return;
            }

            if (isCooldownManagedRole && isAvatarChangeRequested) {
                const confirmedAvatarChange = window.confirm(
                    "Are you sure to change profile picture? You can only change your profile photo every 7 days (OK/Cancel)"
                );
                if (!confirmedAvatarChange) {
                    return;
                }
            }

            if (isCooldownManagedRole && isAddressChangeRequested) {
                const confirmedAddressChange = window.confirm(
                    "Are you sure to change address? You can only change address every 30 days (OK/Cancel)"
                );
                if (!confirmedAddressChange) {
                    return;
                }
            }

            try {
                const bundle = await updateMyProfileSettings({
                    surname: settingsDraft.surname,
                    firstname: settingsDraft.firstname,
                    middlename: settingsDraft.middlename,
                    houseNumber: settingsDraft.houseNumber,
                    streetName: settingsDraft.streetName,
                    purokSubdivision: settingsDraft.purokSubdivision,
                    email: settingsDraft.email,
                    dob: settingsDraft.dob,
                    pinCode: settingsDraft.pinCode,
                    adminId: settingsDraft.adminId,
                    licenseId: settingsDraft.licenseId,
                    avatarFile: settingsDraft.avatarFile || null,
                    avatarUrl: settingsDraft.avatarDataUrl,
                });

                const resolvedAddress = bundle.address && typeof bundle.address === "object"
                    ? bundle.address
                    : {
                        houseNumber: settingsDraft.houseNumber,
                        street: settingsDraft.streetName,
                        streetName: settingsDraft.streetName,
                        purokSubdivision: settingsDraft.purokSubdivision,
                    };

                updateUser({
                    surname: bundle.surname || settingsDraft.surname,
                    firstname: bundle.firstname || settingsDraft.firstname,
                    middlename: bundle.middlename || settingsDraft.middlename,
                    dob: bundle.dob || settingsDraft.dob,
                    address: resolvedAddress,
                    addressId: bundle.addressId || null,
                    houseNumber: bundle.houseNumber || settingsDraft.houseNumber,
                    streetName: bundle.streetName || settingsDraft.streetName,
                    purokSubdivision: bundle.purokSubdivision || settingsDraft.purokSubdivision,
                    fullAddress: bundle.fullAddress || buildAddressLine({
                        address: resolvedAddress,
                        houseNumber: bundle.houseNumber || settingsDraft.houseNumber,
                        streetName: bundle.streetName || settingsDraft.streetName,
                        purokSubdivision: bundle.purokSubdivision || settingsDraft.purokSubdivision,
                    }),
                    email: bundle.email || settingsDraft.email,
                    pinCode: bundle.pinCode || settingsDraft.pinCode,
                    adminId: bundle.adminId || settingsDraft.adminId,
                    systemLicenseNumber: bundle.systemLicenseNumber || settingsDraft.licenseId,
                    workerId: bundle.workerId || settingsDraft.licenseId,
                    avatarDataUrl: bundle.avatarDataUrl || settingsDraft.avatarDataUrl,
                });

                setSettingsDraft((previous) => ({
                    ...previous,
                    avatarDataUrl: bundle.avatarDataUrl || previous.avatarDataUrl,
                    avatarFile: null,
                }));

                const persistedSettings = buildPersistedSettingsDraft({
                    ...settingsDraft,
                    avatarDataUrl: bundle.avatarDataUrl || settingsDraft.avatarDataUrl,
                });

                try {
                    window.localStorage.setItem(storageKey, JSON.stringify(persistedSettings));
                } catch (storageError) {
                    // Clear only this settings key and retry with a minimal payload.
                    window.localStorage.removeItem(storageKey);
                    window.localStorage.setItem(
                        storageKey,
                        JSON.stringify({
                            surname: persistedSettings.surname,
                            firstname: persistedSettings.firstname,
                            middlename: persistedSettings.middlename,
                            houseNumber: persistedSettings.houseNumber,
                            streetName: persistedSettings.streetName,
                            purokSubdivision: persistedSettings.purokSubdivision,
                            email: persistedSettings.email,
                            dob: persistedSettings.dob,
                            adminId: persistedSettings.adminId,
                            licenseId: persistedSettings.licenseId,
                            pinCode: persistedSettings.pinCode,
                            theme: persistedSettings.theme,
                            avatarDataUrl: sanitizeAvatarValue(persistedSettings.avatarDataUrl),
                        })
                    );
                    console.warn("Settings storage was near quota. Saved a minimal profile payload.", storageError);
                }
                
                // Invalidate profile-related queries to ensure fresh data with updated address
                await queryClient.invalidateQueries({ queryKey: ["my-profile-bundle"] });
                await queryClient.invalidateQueries({ queryKey: ["dashboard-collections"] });
                
                setSettingsMessage("Settings saved successfully.");
            } catch (error) {
                setSettingsError(error?.message || "Unable to save settings.");
            }
        };

        const handleChangePassword = async (e) => {
            e.preventDefault();
            setSettingsError("");
            setSettingsMessage("");

            if (!passwordForm.currentPassword) {
                setSettingsError("Current password is required.");
                return;
            }

            const passwordRuleError = validateHealthWorkerPassword(passwordForm.newPassword);
            if (passwordRuleError) {
                setSettingsError(passwordRuleError);
                return;
            }

            if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
                setSettingsError("New password and confirm password do not match.");
                return;
            }

            if (!isAdmin && !passwordForm.reason.trim()) {
                setSettingsError("Reason for change password is required.");
                return;
            }

            setPasswordChangeSubmitting(true);
            try {
                await changePortalPassword({
                    role: user?.role,
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                    confirmNewPassword: passwordForm.confirmNewPassword,
                    reason: passwordForm.reason,
                });

                if (isAdmin) {
                    await queryClient.invalidateQueries({ queryKey: ["admin-inbox"] });
                }

                setPasswordForm({
                    currentPassword: "",
                    newPassword: "",
                    confirmNewPassword: "",
                    reason: "",
                });
                setSettingsMessage("Password changed successfully.");
            } catch (changePasswordError) {
                setSettingsError(changePasswordError?.message || "Unable to change password.");
            } finally {
                setPasswordChangeSubmitting(false);
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
                            <div className="max-w-xs space-y-1.5">
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Edit Profile Picture</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                                    disabled={isAvatarOnCooldown}
                                    className={`${inputClass} w-full max-w-xs`}
                                />
                                {isCooldownManagedRole && isAvatarOnCooldown && (
                                    <p className="text-xs text-amber-600">
                                        You can change your profile photo again in {avatarCooldownDaysLeft} day(s).
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Surname</label>
                            <input
                                type="text"
                                value={settingsDraft.surname}
                                disabled
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>First Name</label>
                            <input
                                type="text"
                                value={settingsDraft.firstname}
                                disabled
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Middle Name</label>
                            <input
                                type="text"
                                value={settingsDraft.middlename}
                                disabled
                                className={`${inputClass} opacity-70 cursor-not-allowed`}
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
                                    disabled={isCooldownManagedRole && isAddressOnCooldown}
                                    className={`${inputClass} ${isCooldownManagedRole && isAddressOnCooldown ? "opacity-70 cursor-not-allowed" : ""}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold mb-1 ${mutedClass}`}>Street Name</label>
                                <input
                                    type="text"
                                    value={settingsDraft.streetName}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, streetName: e.target.value }))}
                                    disabled={isCooldownManagedRole && isAddressOnCooldown}
                                    className={`${inputClass} ${isCooldownManagedRole && isAddressOnCooldown ? "opacity-70 cursor-not-allowed" : ""}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-semibold mb-1 ${mutedClass}`}>Purok or Subdivision</label>
                                <input
                                    type="text"
                                    value={settingsDraft.purokSubdivision}
                                    onChange={(e) => setSettingsDraft((prev) => ({ ...prev, purokSubdivision: e.target.value }))}
                                    disabled={isCooldownManagedRole && isAddressOnCooldown}
                                    className={`${inputClass} ${isCooldownManagedRole && isAddressOnCooldown ? "opacity-70 cursor-not-allowed" : ""}`}
                                />
                            </div>
                            {isCooldownManagedRole && isAddressOnCooldown && (
                                <p className="text-xs text-amber-600">
                                    You can change address again in {addressCooldownDaysLeft} day(s).
                                </p>
                            )}
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

                <form onSubmit={handleChangePassword} className={`rounded-2xl shadow-sm border p-6 space-y-4 ${panelClass}`}>
                    <div>
                        <h2 className="text-lg font-bold">Change Password</h2>
                        <p className={`text-sm mt-1 ${mutedClass}`}>Update your account password securely.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Current Password</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) =>
                                    setPasswordForm((previous) => ({ ...previous, currentPassword: e.target.value }))
                                }
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>New Password</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) =>
                                    setPasswordForm((previous) => ({ ...previous, newPassword: e.target.value }))
                                }
                                className={inputClass}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Confirm New Password</label>
                            <input
                                type="password"
                                value={passwordForm.confirmNewPassword}
                                onChange={(e) =>
                                    setPasswordForm((previous) => ({ ...previous, confirmNewPassword: e.target.value }))
                                }
                                className={inputClass}
                                required
                            />
                        </div>
                        {!isAdmin && (
                            <div>
                                <label className={`block text-sm font-semibold mb-1 ${mutedClass}`}>Reason for Change Password</label>
                                <input
                                    type="text"
                                    value={passwordForm.reason}
                                    onChange={(e) =>
                                        setPasswordForm((previous) => ({ ...previous, reason: e.target.value }))
                                    }
                                    className={inputClass}
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={passwordChangeSubmitting}
                            className="rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {passwordChangeSubmitting ? "Changing Password..." : "Change Password"}
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
        const passwordStrength = evaluatePasswordStrength(manageForm.password);
        const passwordRuleError = validateHealthWorkerPassword(manageForm.password);
        const hasConfirmPassword = manageForm.confirmPassword.length > 0;
        const isPasswordMatched = hasConfirmPassword && manageForm.password === manageForm.confirmPassword;

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
                {lastCreatedLicenseNumber && (
                    <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        Generated License Number: <span className="font-bold">{lastCreatedLicenseNumber}</span>
                    </p>
                )}
                
                <form
                    onSubmit={handleManageSubmit}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                        <div className="mt-2 rounded-full h-1.5 bg-slate-100 overflow-hidden">
                            <div className={`h-full ${passwordStrength.barClass} ${passwordStrength.widthClass}`} />
                        </div>
                        <p className={`text-xs font-semibold mt-2 ${passwordStrength.textClass}`}>Password strength: {passwordStrength.label}</p>
                        {manageForm.password && passwordRuleError && (
                            <p className="text-xs text-red-600 mt-1">{passwordRuleError}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">Required: at least 1 uppercase letter, at least 1 special character, no spaces, common keyboard symbols only.</p>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="hw-confirm-password">Confirm Password</label>
                        <input
                            id="hw-confirm-password"
                            type="password"
                            className={inputClass}
                            value={manageForm.confirmPassword}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, confirmPassword: e.target.value }))
                            }
                            required
                        />
                        {hasConfirmPassword && (
                            <p className={`text-xs mt-1 font-semibold ${isPasswordMatched ? "text-emerald-600" : "text-red-600"}`}>
                                {isPasswordMatched ? "Password matched" : "Password does not match"}
                            </p>
                        )}
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

                    <div>
                        <label className={labelClass} htmlFor="hw-dob">Birthdate</label>
                        <input
                            id="hw-dob"
                            type="date"
                            className={inputClass}
                            value={manageForm.dob}
                            onChange={(e) =>
                                setManageForm((f) => ({ ...f, dob: e.target.value }))
                            }
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelClass} htmlFor="hw-sex">Sex</label>
                            <select
                                id="hw-sex"
                                className={inputClass}
                                value={manageForm.sex}
                                onChange={(e) => setManageForm((f) => ({ ...f, sex: e.target.value }))}
                                required
                            >
                                {SEX_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="hw-gender">Gender</label>
                            <select
                                id="hw-gender"
                                className={inputClass}
                                value={manageForm.gender}
                                onChange={(e) => setManageForm((f) => ({ ...f, gender: e.target.value }))}
                                required
                            >
                                {GENDER_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {manageForm.gender === "Other / Unknown (please specify)" && (
                        <div>
                            <label className={labelClass} htmlFor="hw-gender-other">Please specify gender</label>
                            <input
                                id="hw-gender-other"
                                type="text"
                                className={inputClass}
                                value={manageForm.genderOther}
                                onChange={(e) => setManageForm((f) => ({ ...f, genderOther: e.target.value }))}
                                required
                            />
                        </div>
                    )}

                    <hr className="border-slate-100" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div>
                            <label className={`${labelClass} text-slate-900`}>Security Question</label>
                            <p className="text-xs text-slate-500 mb-2">Requested upon login as an additional security measure.</p>
                            <select
                                className={inputClass}
                                value={manageForm.securityQuestion}
                                onChange={(e) =>
                                    setManageForm((f) => ({
                                        ...f,
                                        securityQuestion: e.target.value,
                                    }))
                                }
                                required
                            >
                                {SECURITY_QUESTIONS.map((question) => (
                                    <option key={question} value={question}>{question}</option>
                                ))}
                            </select>
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

                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 className="text-xl font-bold text-slate-800">Created Health Worker Accounts</h2>
                    {createdHealthWorkers.length === 0 ? (
                        <p className="text-sm text-slate-600">No health worker accounts created yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {createdHealthWorkers
                                .slice()
                                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                                .map((account, index) => (
                                    <article key={`created-health-worker-${account.workerId || account.email || index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-semibold text-slate-800">
                                            {account.surname || "N/A"}, {account.firstname || "N/A"}, {account.middlename || "N/A"}
                                        </p>
                                        <p className="text-xs text-slate-600">Email: {account.email || "N/A"}</p>
                                        <p className="text-xs text-slate-600">Sex: {account.sex || "N/A"}</p>
                                        <p className="text-xs text-slate-600">Gender: {account.gender || "N/A"}</p>
                                        <p className="text-xs font-bold text-brand-red mt-1">License Number: {account.systemLicenseNumber || account.workerId || "N/A"}</p>
                                        <div className="mt-3">
                                            <button
                                                type="button"
                                                className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                                onClick={() => handleDeleteHealthWorker(account)}
                                                disabled={deletingHealthWorkerUserId === account.userId}
                                            >
                                                {deletingHealthWorkerUserId === account.userId ? "Deleting..." : "Delete Account"}
                                            </button>
                                        </div>
                                    </article>
                                ))}
                        </div>
                    )}
                </section>
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
        const pendingPatientAppointment = isPatient
            ? appointments
                .filter((entry) => entry.patientCode === patientCode && entry.status === "booked")
                .map((entry) => ({
                    ...entry,
                    slotStartAt: buildSlotStartDate(entry.dateKey, entry.timeSlot),
                }))
                .filter((entry) => entry.slotStartAt && entry.slotStartAt.getTime() > currentDateTime.getTime())
                .sort((a, b) => a.slotStartAt - b.slotStartAt)[0] || null
            : null;

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

        const handleBookSchedule = async (e) => {
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
            if (isPatient && pendingPatientAppointment) {
                setScheduleError(
                    `You already have a pending appointment on ${formatLongDate(pendingPatientAppointment.dateKey)} at ${pendingPatientAppointment.timeSlot}. Please wait until that checkup is done before booking another schedule.`
                );
                return;
            }
            const selectedSlotStart = buildSlotStartDate(selectedDateKey, selectedTimeSlot);
            if (selectedSlotStart && selectedSlotStart.getTime() <= currentDateTime.getTime()) {
                setScheduleError("Selected appointment hour has already passed. Please choose another appointment hour.");
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
            let qrValue = buildAppointmentQrValue(patientCode);
            let appointmentId = `${selectedDateKey}-${selectedTimeSlot}-${Date.now()}`;

            try {
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    try {
                        const persistedAppointmentId = await bookPatientAppointment({
                            scheduledDate: selectedDateKey,
                            timeSlot: selectedTimeSlot,
                            symptoms: selectedSymptoms,
                            otherSymptom: otherSymptomText || null,
                            qrValue,
                        });

                        if (persistedAppointmentId) {
                            appointmentId = persistedAppointmentId;
                        }
                        break;
                    } catch (bookingError) {
                        const message = bookingError?.message || "";
                        if (/appointments_qr_value_key/i.test(message) || /duplicate appointment qr value/i.test(message)) {
                            qrValue = buildAppointmentQrValue(patientCode);
                            if (attempt < 4) {
                                continue;
                            }
                        }
                        throw bookingError;
                    }
                }
            } catch (bookingError) {
                setScheduleError(bookingError?.message || "Unable to save appointment in backend.");
                return;
            }

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
                    patientCode: qrValue,
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
                                        setShowDailyConsultationHistory(false);
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
                        {pendingPatientAppointment && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                You already have a pending checkup on {formatLongDate(pendingPatientAppointment.dateKey)} at {pendingPatientAppointment.timeSlot}. New booking is disabled until that appointment is reached.
                            </p>
                        )}
                        {!selectedSchedule ? (
                            <p className="text-slate-600">Select a date in the calendar to continue.</p>
                        ) : selectedStatus !== "available" ? (
                            <p className="text-slate-600">
                                {selectedStatus === "holiday" && `Holiday: ${selectedSchedule.holidayName}`}
                                {selectedStatus === "outside_window" && "This date is outside the allowed booking window (today up to 2 weeks only)."}
                            </p>
                        ) : pendingPatientAppointment ? (
                            <p className="text-slate-600">Booking is currently locked while you have a pending appointment.</p>
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
                                            const slotStartAt = buildSlotStartDate(selectedDateKey, slot);
                                            const isSlotPast = slotStartAt ? slotStartAt.getTime() <= currentDateTime.getTime() : false;
                                            return (
                                            <option key={slot} value={slot} disabled={isSlotFull || isSlotPast}>
                                                {slot} ({slotBooked}/{SLOT_MAX_APPOINTMENTS}) {isSlotPast ? "- Passed" : isSlotFull ? "- Full" : ""}
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
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDailyConsultationHistory((previous) => !previous)}
                                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        {showDailyConsultationHistory ? "Hide consultation history" : "Show consultation history"}
                                    </button>
                                </div>

                                {showDailyConsultationHistory && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                        <h4 className="text-base font-bold text-slate-800">Consultations on {formatLongDate(selectedDateKey)}</h4>
                                        {consultations.filter((entry) => entry.dateKey === selectedDateKey).length === 0 ? (
                                            <p className="text-sm text-slate-600">No completed consultations yet for this date.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {consultations
                                                    .filter((entry) => entry.dateKey === selectedDateKey)
                                                    .sort((a, b) => {
                                                        const aStart = buildSlotStartDate(a.dateKey, a.timeSlot)?.getTime() || 0;
                                                        const bStart = buildSlotStartDate(b.dateKey, b.timeSlot)?.getTime() || 0;
                                                        return aStart - bStart;
                                                    })
                                                    .map((entry) => (
                                                        <article key={`daily-history-${entry.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                            <p className="text-sm font-bold text-slate-800">{entry.patientName}</p>
                                                            <p className="text-sm text-slate-700 mt-1">Diagnosis: {entry.diagnosis}</p>
                                                            <p className="text-sm text-slate-700">Medicine: {entry.prescribedMedicineSummary || `${entry.medicineName} x ${entry.medicineQuantity}`}</p>
                                                            <p className="text-xs text-slate-500 mt-1">Booked time: {entry.timeSlot}</p>
                                                            <p className="text-xs text-slate-500">Consultation duration: {entry.durationLabel || formatDuration(entry.durationSeconds || 0)}</p>
                                                        </article>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                )}
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

        const consultableAppointments = appointments.filter(
            (appointment) => appointment.status === "booked" || appointment.status === "consulted"
        );
        const matchingAppointments = consultationScannedPatientCode
            ? consultableAppointments.filter((appointment) => {
                const patientCode = String(appointment?.patientCode || appointment?.patientId || "").trim();
                return patientCode === consultationScannedPatientCode;
            })
            : [];
        const medicineOptions = inventoryItems.filter((item) => item.category === "medicine" && item.quantity > 0);
        const assistiveDeviceOptions = inventoryItems.filter((item) => item.category === "aid" && item.quantity > 0);
        const selectedPatientProfile = consultationTarget
            ? patientDirectory.find(
                (account) =>
                    account.patientCode === consultationTarget.patientCode ||
                    account.patientId === consultationTarget.patientCode
            )
            : null;
        const consultationElapsedSeconds = consultationStartedAt
            ? Math.max(0, Math.floor((currentDateTime.getTime() - new Date(consultationStartedAt).getTime()) / 1000))
            : 0;
        const selectedConsultationResult = consultationTarget
            ? consultations.find((entry) => entry.appointmentId === consultationTarget.id) || null
            : null;
        const isConsultationAlreadyCompleted = consultationTarget?.status === "consulted";
        const resultDispensedItems = selectedConsultationResult?.dispensedItems || [];
        const resultMedicineSummary = selectedConsultationResult?.dispensedMedicineSummary
            || selectedConsultationResult?.prescribedMedicineSummary
            || (selectedConsultationResult?.medicineName
                ? `${selectedConsultationResult.medicineName} x ${selectedConsultationResult.medicineQuantity || 0}`
                : "N/A");
        const resultAssistiveSummary = selectedConsultationResult?.dispensedAssistiveSummary || "";
        const resultStartedAtLabel = selectedConsultationResult?.startedAt
            ? new Date(selectedConsultationResult.startedAt).toLocaleString("en-PH")
            : "N/A";
        const resultCompletedAtLabel = selectedConsultationResult?.completedAt
            ? new Date(selectedConsultationResult.completedAt).toLocaleString("en-PH")
            : "N/A";

        const verifyScan = (e) => {
            e.preventDefault();
            verifyConsultationCodeValue(consultationScanValue, { fromScanner: false });
        };

        const startConsultation = () => {
            if (!consultationTarget) {
                setConsultationError("Verify and select a booked appointment first.");
                return;
            }

            if (isConsultationAlreadyCompleted) {
                setConsultationError("This appointment already has a completed consultation. Review the result below.");
                return;
            }

            setConsultationError("");
            setConsultationStartedAt(new Date().toISOString());
            setConsultationMessage("Consultation timer started. Complete the consultation after assessment.");
        };

        const handleProofImageChange = async (file) => {
            if (!file) {
                setConsultationForm((prev) => ({ ...prev, proofImageDataUrl: "", proofImageName: "" }));
                return;
            }

            try {
                const dataUrl = await fileToDataUrl(file);
                const fileBaseName = String(file.name || "consultation-proof").replace(/\.[^.]+$/, "") || "consultation-proof";
                const compressed = await compressProofImageDataUrl(dataUrl, fileBaseName);

                setConsultationForm((prev) => ({
                    ...prev,
                    proofImageDataUrl: compressed.dataUrl,
                    proofImageName: compressed.fileName,
                }));
                setProofCameraError("");
            } catch (error) {
                setProofCameraError(error?.message || "Unable to process the selected proof photo.");
            }
        };

        const updatePrescribedMedicineAt = (index, field, value) => {
            setConsultationForm((prev) => ({
                ...prev,
                prescribedMedicines: prev.prescribedMedicines.map((entry, entryIndex) =>
                    entryIndex === index
                        ? { ...entry, [field]: value }
                        : entry
                ),
            }));
        };

        const addPrescribedMedicine = () => {
            setConsultationForm((prev) => ({
                ...prev,
                prescribedMedicines: [...prev.prescribedMedicines, createConsultationMedicineItemDraft("")],
            }));
        };

        const removePrescribedMedicineAt = (index) => {
            setConsultationForm((prev) => {
                const nextItems = prev.prescribedMedicines.filter((_, entryIndex) => entryIndex !== index);
                return {
                    ...prev,
                    prescribedMedicines: nextItems.length > 0 ? nextItems : [createConsultationMedicineItemDraft(medicineOptions[0]?.id || "")],
                };
            });
        };

        const completeConsultation = async (e) => {
            e.preventDefault();
            setConsultationError("");
            setConsultationMessage("");

            if (!consultationTarget) {
                setConsultationError("Verify the patient QR code and choose a booked appointment first.");
                return;
            }

            if (isConsultationAlreadyCompleted) {
                setConsultationError("This appointment is already completed. You can review the saved consultation result.");
                return;
            }

            const diagnosis = consultationForm.diagnosis.trim();
            const note = consultationForm.note.trim();
            const prescribedMedicines = consultationForm.prescribedMedicines || [];

            const parsedMedicines = prescribedMedicines.map((entry, index) => {
                const selectedMedicine = inventoryItems.find((item) => item.id === entry.medicineId && item.category === "medicine");
                return {
                    entryNumber: index + 1,
                    selectedMedicine,
                    quantity: Number(entry.quantity),
                    intakePerDay: Number(entry.intakePerDay),
                    intakeInstruction: String(entry.intakeInstruction || "").trim(),
                };
            });

            const selectedMedicineIds = parsedMedicines
                .map((entry) => entry.selectedMedicine?.id)
                .filter(Boolean);
            const hasDuplicateMedicines = new Set(selectedMedicineIds).size !== selectedMedicineIds.length;

            const includeAssistiveDevice = Boolean(consultationForm.includeAssistiveDevice);
            const selectedAssistiveDevice = includeAssistiveDevice
                ? inventoryItems.find((item) => item.id === consultationForm.assistiveDeviceId && item.category === "aid")
                : null;
            const assistiveDeviceQuantity = Number(consultationForm.assistiveDeviceQuantity);
            const assistiveDeviceReason = String(consultationForm.assistiveDeviceReason || "").trim();

            if (!diagnosis) {
                setConsultationError("Please enter a diagnosis.");
                return;
            }
            if (!parsedMedicines.length) {
                setConsultationError("Please add at least one prescribed medicine.");
                return;
            }
            if (hasDuplicateMedicines) {
                setConsultationError("Each prescribed medicine must be unique. Update duplicate entries.");
                return;
            }
            if (!note) {
                setConsultationError("Please add a note to the patient.");
                return;
            }
            for (const medicine of parsedMedicines) {
                if (!medicine.selectedMedicine) {
                    setConsultationError(`Please choose a medicine for prescribed entry #${medicine.entryNumber}.`);
                    return;
                }
                if (!Number.isInteger(medicine.quantity) || medicine.quantity <= 0) {
                    setConsultationError(`Medicine quantity for entry #${medicine.entryNumber} must be a positive whole number.`);
                    return;
                }
                if (medicine.selectedMedicine.quantity < medicine.quantity) {
                    setConsultationError(`Not enough stock for ${medicine.selectedMedicine.name}.`);
                    return;
                }
                if (!Number.isInteger(medicine.intakePerDay) || medicine.intakePerDay <= 0) {
                    setConsultationError(`Intake/day for entry #${medicine.entryNumber} must be a positive whole number.`);
                    return;
                }
            }
            if (includeAssistiveDevice) {
                if (!selectedAssistiveDevice) {
                    setConsultationError("Please choose an assistive device to dispense.");
                    return;
                }
                if (!Number.isInteger(assistiveDeviceQuantity) || assistiveDeviceQuantity <= 0) {
                    setConsultationError("Assistive device quantity must be a positive whole number.");
                    return;
                }
                if (selectedAssistiveDevice.quantity < assistiveDeviceQuantity) {
                    setConsultationError("Not enough assistive device stock available.");
                    return;
                }
                if (!assistiveDeviceReason) {
                    setConsultationError("Please specify the reason for giving the assistive device.");
                    return;
                }
            }
            if (!consultationStartedAt) {
                setConsultationError("Click Start consultation before completing this record.");
                return;
            }
            if (!consultationForm.proofImageDataUrl) {
                setConsultationError("Consultation proof photo is required before completion.");
                return;
            }

            const durationSeconds = Math.max(1, consultationElapsedSeconds);
            const completedAt = new Date().toISOString();
            let consultationRecordId = `${consultationTarget.id}-consulted`;
            const primaryMedicine = parsedMedicines[0];
            const additionalMedicines = parsedMedicines.slice(1);

            try {
                const persistedConsultationId = await completeConsultationRecord({
                    appointmentId: consultationTarget.id,
                    diagnosis,
                    note,
                    startedAt: consultationStartedAt,
                    completedAt,
                    proofImageUrl: consultationForm.proofImageDataUrl,
                    medicineItemId: primaryMedicine.selectedMedicine.id,
                    medicineQuantity: primaryMedicine.quantity,
                    medicineIntakePerDay: primaryMedicine.intakePerDay,
                    medicineIntakeInstruction: primaryMedicine.intakePerDay > 3 ? note : primaryMedicine.intakeInstruction,
                });

                if (persistedConsultationId) {
                    consultationRecordId = persistedConsultationId;
                }

                for (const medicine of additionalMedicines) {
                    await addConsultationDispensedItem({
                        consultationId: consultationRecordId,
                        itemId: medicine.selectedMedicine.id,
                        quantity: medicine.quantity,
                        medicineIntakePerDay: medicine.intakePerDay,
                        medicineIntakeInstruction: medicine.intakePerDay > 3 ? note : medicine.intakeInstruction,
                        movementNote: "Additional medicine dispensed to patient",
                    });
                }

                if (includeAssistiveDevice && selectedAssistiveDevice) {
                    await addConsultationDispensedItem({
                        consultationId: consultationRecordId,
                        itemId: selectedAssistiveDevice.id,
                        quantity: assistiveDeviceQuantity,
                        medicineIntakePerDay: 1,
                        medicineIntakeInstruction: "",
                        movementNote: `Assistive device issued: ${assistiveDeviceReason}`,
                    });
                }
            } catch (completeError) {
                setConsultationError(completeError?.message || "Unable to save consultation in backend.");
                return;
            }

            const consultationRecord = {
                id: consultationRecordId,
                appointmentId: consultationTarget.id,
                patientName: consultationTarget.patientName,
                patientCode: consultationTarget.patientCode,
                dateKey: consultationTarget.dateKey,
                timeSlot: consultationTarget.timeSlot,
                diagnosis,
                medicineId: primaryMedicine.selectedMedicine.id,
                medicineName: primaryMedicine.selectedMedicine.name,
                medicineQuantity: primaryMedicine.quantity,
                medicineIntakePerDay: primaryMedicine.intakePerDay,
                medicineIntakeInstruction: primaryMedicine.intakePerDay > 3 ? note : primaryMedicine.intakeInstruction,
                dispensedItems: [
                    ...parsedMedicines.map((medicine) => ({
                        itemId: medicine.selectedMedicine.id,
                        itemName: medicine.selectedMedicine.name,
                        itemCategory: "medicine",
                        unit: medicine.selectedMedicine.unit || "",
                        quantity: medicine.quantity,
                        medicineIntakePerDay: medicine.intakePerDay,
                        medicineIntakeInstruction: medicine.intakePerDay > 3 ? note : medicine.intakeInstruction,
                    })),
                    ...(includeAssistiveDevice && selectedAssistiveDevice
                        ? [{
                            itemId: selectedAssistiveDevice.id,
                            itemName: selectedAssistiveDevice.name,
                            itemCategory: "aid",
                            unit: selectedAssistiveDevice.unit || "",
                            quantity: assistiveDeviceQuantity,
                            medicineIntakePerDay: 1,
                            medicineIntakeInstruction: "",
                        }]
                        : []),
                ],
                prescribedMedicineSummary: parsedMedicines
                    .map((medicine) => `${medicine.selectedMedicine.name} x ${medicine.quantity}`)
                    .join(", "),
                dispensedMedicineSummary: parsedMedicines
                    .map((medicine) => `${medicine.selectedMedicine.name} x ${medicine.quantity}`)
                    .join(", "),
                dispensedAssistiveSummary: includeAssistiveDevice && selectedAssistiveDevice
                    ? `${selectedAssistiveDevice.name} x ${assistiveDeviceQuantity}`
                    : "",
                note,
                workerName: buildPatientDisplayName(user),
                startedAt: consultationStartedAt,
                completedAt,
                durationSeconds,
                durationLabel: formatDuration(durationSeconds),
                proofImageDataUrl: consultationForm.proofImageDataUrl,
                proofImageName: consultationForm.proofImageName,
            };

            const inventoryAdjustments = new Map();
            parsedMedicines.forEach((medicine) => {
                const current = inventoryAdjustments.get(medicine.selectedMedicine.id) || 0;
                inventoryAdjustments.set(medicine.selectedMedicine.id, current + medicine.quantity);
            });
            if (includeAssistiveDevice && selectedAssistiveDevice) {
                const current = inventoryAdjustments.get(selectedAssistiveDevice.id) || 0;
                inventoryAdjustments.set(selectedAssistiveDevice.id, current + assistiveDeviceQuantity);
            }

            setInventoryItems((prev) =>
                prev.map((item) =>
                    inventoryAdjustments.has(item.id)
                        ? { ...item, quantity: item.quantity - inventoryAdjustments.get(item.id) }
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
            setConsultationMessage("Consultation completed. Prescribed medicines and assistive device records were saved.");
            setConsultationError("");
            setConsultationTarget(null);
            setConsultationStartedAt("");
            setConsultationScannedPatientCode("");
            setConsultationScanValue("");
            setConsultationForm(getDefaultConsultationForm(medicineOptions[0]?.id || ""));
        };

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Consultation</h1>
                    <p className="text-slate-600">Verify a patient QR code to continue consultation or review an already completed result.</p>
                    <Link
                        to="/history"
                        className="inline-flex items-center mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Open Consultation History
                    </Link>
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
                                Verify code
                            </button>
                            <button
                                type="button"
                                onClick={openQrScanner}
                                className="ml-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Open Camera Scanner
                            </button>
                        </form>

                        {consultationError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{consultationError}</p>}
                        {consultationMessage && <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{consultationMessage}</p>}
                        {qrScannerError && <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">{qrScannerError}</p>}

                        {selectedPatientProfile && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm text-slate-700">
                                <p className="font-bold text-slate-800">Patient profile</p>
                                <p><span className="font-semibold">Name:</span> {selectedPatientProfile.surname || "N/A"}, {selectedPatientProfile.firstname || "N/A"}, {selectedPatientProfile.middlename || "N/A"}</p>
                                <p><span className="font-semibold">Patient ID:</span> {selectedPatientProfile.patientCode || selectedPatientProfile.patientId || consultationTarget?.patientCode}</p>
                                <p><span className="font-semibold">DOB / Age:</span> {selectedPatientProfile.dob || "N/A"} / {calculateAge(selectedPatientProfile.dob)}</p>
                                <p><span className="font-semibold">Address:</span> {buildAddressLine(selectedPatientProfile)}</p>
                                <p><span className="font-semibold">Contact:</span> {selectedPatientProfile.contactNumber || "N/A"}</p>
                            </div>
                        )}

                        {consultationScannedPatientCode && (
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-slate-700">Appointments for {consultationScannedPatientCode}</p>
                                <div className="space-y-2">
                                    {matchingAppointments.length === 0 ? (
                                        <p className="text-sm text-slate-500">No booked or completed appointment found for this patient.</p>
                                    ) : (
                                        matchingAppointments.map((appointment) => (
                                            <button
                                                key={appointment.id}
                                                type="button"
                                                onClick={() => {
                                                    setConsultationTarget(appointment);
                                                    setConsultationStartedAt("");
                                                    if (appointment.status === "consulted") {
                                                        setConsultationMessage(`Selected completed consultation for ${appointment.patientName} on ${appointment.dateKey} at ${appointment.timeSlot}.`);
                                                    } else {
                                                        setConsultationMessage(`Selected ${appointment.patientName} on ${appointment.dateKey} at ${appointment.timeSlot}.`);
                                                    }
                                                }}
                                                className={`w-full rounded-xl border p-3 text-left transition-all ${
                                                    consultationTarget?.id === appointment.id
                                                        ? "border-brand-red bg-red-50"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-semibold text-slate-800">{appointment.patientName}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                                        appointment.status === "consulted"
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-sky-100 text-sky-700"
                                                    }`}>
                                                        {appointment.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500">{formatLongDate(appointment.dateKey)} at {appointment.timeSlot}</p>
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
                            <p className="text-slate-600">Verify a QR code and select an appointment to open consultation or review completed results.</p>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                                    <p className="font-bold text-slate-800">Patient Information</p>
                                    <p><span className="font-semibold">Name:</span> {selectedPatientProfile ? `${selectedPatientProfile.surname || "N/A"}, ${selectedPatientProfile.firstname || "N/A"}, ${selectedPatientProfile.middlename || "N/A"}` : consultationTarget.patientName}</p>
                                    <p><span className="font-semibold">Patient ID:</span> {selectedPatientProfile?.patientCode || selectedPatientProfile?.patientId || consultationTarget.patientCode}</p>
                                    <p><span className="font-semibold">DOB / Age:</span> {selectedPatientProfile?.dob || "N/A"} / {calculateAge(selectedPatientProfile?.dob)}</p>
                                    <p><span className="font-semibold">Contact:</span> {selectedPatientProfile?.contactNumber || "N/A"}</p>
                                    <p><span className="font-semibold">Address:</span> {selectedPatientProfile ? buildAddressLine(selectedPatientProfile) : "N/A"}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-1">
                                    <p className="font-bold text-slate-800">Consultation Data</p>
                                    <p><span className="font-semibold">Schedule:</span> {formatLongDate(consultationTarget.dateKey)} at {consultationTarget.timeSlot}</p>
                                    <p><span className="font-semibold">Symptoms:</span> {consultationTarget.symptoms.join(", ")}</p>
                                </div>

                                {isConsultationAlreadyCompleted ? (
                                    <>
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                            <p className="text-sm font-bold text-emerald-900">Consultation already completed</p>
                                            <p className="text-xs text-emerald-700 mt-1">This appointment already has a saved result. Review it below.</p>
                                        </div>
                                        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm text-slate-700">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Consultation result</h3>
                                            <p><span className="font-semibold text-slate-900">Diagnosis:</span> {selectedConsultationResult?.diagnosis || "N/A"}</p>
                                            <p><span className="font-semibold text-slate-900">Medicines dispensed:</span> {resultMedicineSummary}</p>
                                            {resultDispensedItems.filter((item) => item.itemCategory === "medicine").map((item, index) => (
                                                <p key={`consulted-medicine-${item.itemId || index}`}><span className="font-semibold text-slate-900">Medicine {index + 1}:</span> {item.itemName || "Medicine"} x {item.quantity || 0}</p>
                                            ))}
                                            {resultAssistiveSummary ? (
                                                <p><span className="font-semibold text-slate-900">Assistive devices dispensed:</span> {resultAssistiveSummary}</p>
                                            ) : null}
                                            <p><span className="font-semibold text-slate-900">Patient note:</span> {selectedConsultationResult?.note || "N/A"}</p>
                                        </section>
                                        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-700">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Timeline</h3>
                                            <p><span className="font-semibold text-slate-900">Started:</span> {resultStartedAtLabel}</p>
                                            <p><span className="font-semibold text-slate-900">Completed:</span> {resultCompletedAtLabel}</p>
                                            <p><span className="font-semibold text-slate-900">Duration:</span> {selectedConsultationResult?.durationLabel || formatDuration(selectedConsultationResult?.durationSeconds || 0)}</p>
                                            <p><span className="font-semibold text-slate-900">Attending health worker:</span> {selectedConsultationResult?.workerName || "N/A"}</p>
                                        </section>
                                    </>
                                ) : (
                                    <>
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">Consultation duration</p>
                                                    <p className="text-lg font-bold text-slate-900">{formatDuration(consultationElapsedSeconds)}</p>
                                                </div>
                                                {!consultationStartedAt ? (
                                                    <button type="button" onClick={startConsultation} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Start consultation</button>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Timer running</span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="diagnosis">Diagnosis</label>
                                            <textarea id="diagnosis" value={consultationForm.diagnosis} onChange={(e) => setConsultationForm((prev) => ({ ...prev, diagnosis: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" rows="3" placeholder="Diagnose the patient" />
                                        </div>

                                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-bold text-slate-800">Prescribed medicine</p>
                                                <button type="button" onClick={addPrescribedMedicine} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Add more prescribed medicine</button>
                                            </div>
                                            {consultationForm.prescribedMedicines.map((medicineEntry, medicineIndex) => (
                                                <div key={`prescribed-medicine-${medicineIndex}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medicine #{medicineIndex + 1}</p>
                                                        {consultationForm.prescribedMedicines.length > 1 && (
                                                            <button type="button" onClick={() => removePrescribedMedicineAt(medicineIndex)} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Remove</button>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-3 sm:grid-cols-3">
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor={`medicine-${medicineIndex}`}>Medicine</label>
                                                            <select id={`medicine-${medicineIndex}`} value={medicineEntry.medicineId} onChange={(e) => updatePrescribedMedicineAt(medicineIndex, "medicineId", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red">
                                                                <option value="">Choose a medicine</option>
                                                                {medicineOptions.map((item) => (
                                                                    <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor={`quantity-${medicineIndex}`}>Quantity</label>
                                                            <input id={`quantity-${medicineIndex}`} type="number" min="1" value={medicineEntry.quantity} onChange={(e) => updatePrescribedMedicineAt(medicineIndex, "quantity", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor={`intake-frequency-${medicineIndex}`}>Intake / day</label>
                                                            <input id={`intake-frequency-${medicineIndex}`} type="number" min="1" value={medicineEntry.intakePerDay} onChange={(e) => updatePrescribedMedicineAt(medicineIndex, "intakePerDay", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <p className="text-xs text-slate-500">Quick choices: Intake/day can be 1, 2, or 3. For more than 3, write guidance in Note to patient.</p>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-bold text-slate-800">Assistive device</p>
                                                <button type="button" onClick={() => setConsultationForm((prev) => ({ ...prev, includeAssistiveDevice: !prev.includeAssistiveDevice, assistiveDeviceId: !prev.includeAssistiveDevice ? prev.assistiveDeviceId : "", assistiveDeviceQuantity: !prev.includeAssistiveDevice ? prev.assistiveDeviceQuantity : 1, assistiveDeviceReason: !prev.includeAssistiveDevice ? prev.assistiveDeviceReason : "" }))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${consultationForm.includeAssistiveDevice ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                                                    {consultationForm.includeAssistiveDevice ? "Assistive device enabled" : "Give assistive device"}
                                                </button>
                                            </div>
                                            {consultationForm.includeAssistiveDevice && (
                                                <div className="space-y-3">
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="assistive-device">Assistive device</label>
                                                            <select id="assistive-device" value={consultationForm.assistiveDeviceId} onChange={(e) => setConsultationForm((prev) => ({ ...prev, assistiveDeviceId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red">
                                                                <option value="">Choose an assistive device</option>
                                                                {assistiveDeviceOptions.map((item) => (
                                                                    <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="assistive-quantity">Quantity</label>
                                                            <input id="assistive-quantity" type="number" min="1" value={consultationForm.assistiveDeviceQuantity} onChange={(e) => setConsultationForm((prev) => ({ ...prev, assistiveDeviceQuantity: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="assistive-reason">Please specify the reason for giving assistive device</label>
                                                        <textarea id="assistive-reason" value={consultationForm.assistiveDeviceReason} onChange={(e) => setConsultationForm((prev) => ({ ...prev, assistiveDeviceReason: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" rows="2" placeholder="Example: temporary mobility support due to ankle injury" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="note">Note to patient</label>
                                            <input id="note" type="text" value={consultationForm.note} onChange={(e) => setConsultationForm((prev) => ({ ...prev, note: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red" placeholder="Example: take 3x a day" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="consult-proof">Consultation proof photo (required)</label>
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setConsultationForm((prev) => ({ ...prev, proofImageMode: "upload" }));
                                                        setProofCameraError("");
                                                    }}
                                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${consultationForm.proofImageMode === "upload" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                                                >
                                                    Upload photo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setConsultationForm((prev) => ({ ...prev, proofImageMode: "take" }));
                                                        const opened = await openProofCamera();
                                                        if (!opened) {
                                                            openProofCaptureInput();
                                                        }
                                                    }}
                                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${consultationForm.proofImageMode === "take" ? "bg-sky-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                                                >
                                                    Take a photo
                                                </button>
                                            </div>
                                            {consultationForm.proofImageMode === "upload" ? (
                                                <>
                                                    <input id="consult-proof" type="file" accept="image/*" onChange={(e) => handleProofImageChange(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                                    <p className="text-xs text-slate-500 mt-1">Upload an existing consultation proof image from this computer.</p>
                                                </>
                                            ) : (
                                                <div className="space-y-2">
                                                    <input
                                                        ref={proofCaptureInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        onChange={(e) => handleProofImageChange(e.target.files?.[0] || null)}
                                                        className="hidden"
                                                    />
                                                    {proofCameraError && (
                                                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{proofCameraError}</p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={openProofCaptureInput}
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Use device camera capture
                                                    </button>
                                                    <div className="rounded-xl border border-slate-200 bg-black overflow-hidden">
                                                        <video ref={proofCameraVideoRef} className="w-full aspect-4/3 object-cover" playsInline muted />
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={captureProofPhoto}
                                                            disabled={!isProofCameraOpen}
                                                            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Capture photo
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={openProofCamera}
                                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                        >
                                                            Reopen live camera
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500">Use live preview capture on supported browsers, or device camera capture for broader mobile compatibility.</p>
                                                </div>
                                            )}
                                            {consultationForm.proofImageDataUrl && (
                                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-xs text-slate-500 mb-2">Selected: {consultationForm.proofImageName || "Captured image"}</p>
                                                    <img src={consultationForm.proofImageDataUrl} alt="Consultation proof" className="w-full aspect-4/3 object-cover rounded-lg" />
                                                </div>
                                            )}
                                        </div>

                                        <button type="submit" className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Complete Consultation</button>
                                    </>
                                )}
                            </>
                        )}
                    </form>
                </div>

                {isQrScannerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">QR Camera Scanner</h3>
                                    <p className="text-sm text-slate-600">Position the patient QR code inside the camera view.</p>
                                </div>
                                <button type="button" onClick={closeQrScanner} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
                            </div>
                            <input
                                ref={qrScannerImageInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => void scanQrFromImageFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={triggerQrImageScan}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Scan QR from image
                                </button>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-100 overflow-hidden p-2">
                                <div id={qrScannerElementId} className="w-full min-h-72 rounded-lg overflow-hidden" />
                            </div>
                        </div>
                    </div>
                )}
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

        const getInventoryGroup = (item) => {
            const normalizedName = String(item?.name || "").toLowerCase();

            if (/vitamin|ascorbic|multivit|mineral|supplement/.test(normalizedName)) {
                return "vitamins";
            }

            if (/eyeglass|eye\s*glass|glasses|spectacle|lens|antiradiation/.test(normalizedName)) {
                return "eyeglasses";
            }

            if (item?.category === "aid") {
                return "assistive";
            }

            if (item?.category === "medicine") {
                return "medicine";
            }

            return "others";
        };

        const visibleItems = inventoryItems.filter((item) => {
            if (inventoryViewMode === "all") {
                return true;
            }

            const group = getInventoryGroup(item);
            if (inventoryViewMode === "medicine") {
                return group === "medicine";
            }
            if (inventoryViewMode === "vitamins") {
                return group === "vitamins";
            }
            if (inventoryViewMode === "eyeglasses") {
                return group === "eyeglasses";
            }
            if (inventoryViewMode === "assistive") {
                return group === "assistive";
            }
            if (inventoryViewMode === "others") {
                return group === "others";
            }

            return true;
        });
        const isAdmin = user?.role === "admin";

        const refreshInventory = async () => {
            await queryClient.invalidateQueries({ queryKey: ["dashboard-collections", user?.role] });
        };

        const addInventoryItem = async (e) => {
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

            try {
                await upsertInventoryItem({
                    name: inventoryForm.name.trim(),
                    category: inventoryForm.category,
                    quantity: Number(inventoryForm.quantity),
                    unit: inventoryForm.unit.trim() || "pcs",
                });

                await refreshInventory();
                setInventoryMessage("Inventory item saved.");
                setInventoryForm({ name: "", category: "medicine", quantity: 0, unit: "pcs" });
            } catch (saveError) {
                setInventoryError(saveError?.message || "Unable to save inventory item.");
            }
        };

        const updateInventoryAmount = async (itemId, mode) => {
            const amount = Number(inventoryAmounts[itemId] || 0);
            if (!Number.isInteger(amount) || amount <= 0) {
                setInventoryError("Type a valid amount.");
                return;
            }

            setInventoryError("");
            try {
                await adjustInventoryQuantity({
                    itemId,
                    quantity: amount,
                    movementType: mode === "add" ? "add" : "reduce",
                });

                await refreshInventory();
                setInventoryAmounts((prev) => ({ ...prev, [itemId]: "" }));
                setInventoryMessage(
                    mode === "add"
                        ? `Added ${amount} item(s) to inventory.`
                        : `Reduced ${amount} item(s) from inventory.`
                );
            } catch (saveError) {
                setInventoryError(saveError?.message || "Unable to update inventory quantity.");
            }
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
                            { value: "medicine", label: "Medicine" },
                            { value: "vitamins", label: "Vitamins" },
                            { value: "eyeglasses", label: "Eyeglasses" },
                            { value: "assistive", label: "Assistive Devices/Walking Aids" },
                            { value: "others", label: "Others" },
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
        if (user?.role === "health_worker" || user?.role === "admin") {
            const selectedRecord = selectedStaffHistoryRecord;
            const startedAtLabel = selectedRecord?.startedAt
                ? new Date(selectedRecord.startedAt).toLocaleString("en-PH")
                : "N/A";
            const completedAtLabel = selectedRecord?.completedAt
                ? new Date(selectedRecord.completedAt).toLocaleString("en-PH")
                : "N/A";
            const selectedPatientHistoryProfile = selectedRecord
                ? patientDirectory.find((account) => {
                    const accountCode = account.patientCode || account.patientId || "";
                    return accountCode && accountCode === selectedRecord.patientCode;
                })
                : null;
            const resolvedPatientContact =
                selectedRecord?.patientContact || selectedPatientHistoryProfile?.contactNumber || "N/A";
            const resolvedPatientAddress = selectedRecord?.patientAddress
                || (selectedPatientHistoryProfile ? buildAddressLine(selectedPatientHistoryProfile) : "N/A");
            const selectedRecordMedicineSummary = selectedRecord?.dispensedMedicineSummary
                || selectedRecord?.prescribedMedicineSummary
                || `${selectedRecord?.medicineName || "N/A"} x ${selectedRecord?.medicineQuantity || 0}`;
            const selectedRecordAssistiveSummary = selectedRecord?.dispensedAssistiveSummary || "";
            const selectedRecordProofImage = selectedRecord?.proofImageDataUrl || "";

            return (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-1">History</h1>
                        <p className="text-slate-600">All completed consultation records.</p>
                    </div>

                    {staffConsultationHistory.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-600">
                            No completed consultations yet.
                        </div>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                                <h2 className="text-base font-bold text-slate-800 mb-3">Consultation list</h2>
                                <div className="space-y-2 max-h-130 overflow-y-auto pr-1">
                                    {staffConsultationHistory.map((entry) => {
                                        const isActive = String(entry.id) === String(selectedRecord?.id);
                                        return (
                                            <button
                                                key={`staff-history-${entry.id}`}
                                                type="button"
                                                onClick={() => setHistorySelectedRecordId(String(entry.id))}
                                                className={`w-full rounded-xl border p-3 text-left transition-all ${
                                                    isActive
                                                        ? "border-brand-red bg-red-50"
                                                        : "border-slate-200 bg-white hover:bg-slate-50"
                                                }`}
                                            >
                                                <p className="text-sm font-bold text-slate-800">{entry.patientName || "Unknown patient"}</p>
                                                <p className="text-xs text-slate-600 mt-1">{formatLongDate(entry.dateKey)} at {entry.timeSlot || "N/A"}</p>
                                                <p className="text-sm text-slate-700 mt-1 line-clamp-1">Diagnosis: {entry.diagnosis || "N/A"}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <h2 className="text-xl font-bold text-slate-900">Consultation details</h2>
                                {!selectedRecord ? (
                                    <p className="text-sm text-slate-600">Select a consultation record to view details.</p>
                                ) : (
                                    <div className="space-y-4 text-sm text-slate-700">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Patient Information</h3>
                                                <p><span className="font-semibold text-slate-900">Name:</span> {selectedRecord.patientName || "N/A"}</p>
                                                <p><span className="font-semibold text-slate-900">Patient Code:</span> {selectedRecord.patientCode || "N/A"}</p>
                                                <p><span className="font-semibold text-slate-900">Contact:</span> {resolvedPatientContact}</p>
                                                <p><span className="font-semibold text-slate-900">Address:</span> {resolvedPatientAddress}</p>
                                            </section>

                                            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Consultation Timeline</h3>
                                                <p><span className="font-semibold text-slate-900">Started:</span> {startedAtLabel}</p>
                                                <p><span className="font-semibold text-slate-900">Completed:</span> {completedAtLabel}</p>
                                                <p><span className="font-semibold text-slate-900">Schedule:</span> {formatLongDate(selectedRecord.dateKey)} at {selectedRecord.timeSlot || "N/A"}</p>
                                            </section>
                                        </div>

                                        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Treatment Summary</h3>
                                            <p><span className="font-semibold text-slate-900">Diagnosis:</span> {selectedRecord.diagnosis || "N/A"}</p>
                                            <p><span className="font-semibold text-slate-900">Medicine given:</span> {selectedRecordMedicineSummary}</p>
                                            {selectedRecordAssistiveSummary ? (
                                                <p><span className="font-semibold text-slate-900">Assistive device given:</span> {selectedRecordAssistiveSummary}</p>
                                            ) : null}
                                            <p><span className="font-semibold text-slate-900">Note:</span> {selectedRecord.note || "N/A"}</p>
                                        </section>

                                        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Consultation Proof Photo</h3>
                                            {selectedRecordProofImage ? (
                                                <div className="w-full aspect-4/3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                                    <img
                                                        src={selectedRecordProofImage}
                                                        alt={`Consultation proof for ${selectedRecord.patientName || "patient"}`}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-slate-600">No consultation proof photo was uploaded for this record.</p>
                                            )}
                                        </section>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (user?.role !== "patient") {
            return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">History</h1>
                    <p className="text-slate-600">This section is private to patient accounts.</p>
                </div>
            );
        }

        const patientConsultationHistory = consultations
            .filter((entry) => entry.patientCode === patientCode)
            .slice()
            .sort((a, b) => {
                const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });
        const selectedPatientHistoryRecord = patientConsultationHistory.find(
            (entry) => String(entry.id) === String(patientHistorySelectedRecordId)
        ) || patientConsultationHistory[0] || null;
        const selectedPatientDispensedItems = selectedPatientHistoryRecord?.dispensedItems || [];
        const selectedPatientMedicineItems = selectedPatientDispensedItems.filter((item) => item.itemCategory === "medicine");
        const selectedPatientAssistiveItems = selectedPatientDispensedItems.filter((item) => item.itemCategory === "aid");
        const selectedPatientMedicineSummary = selectedPatientHistoryRecord?.dispensedMedicineSummary
            || selectedPatientHistoryRecord?.prescribedMedicineSummary
            || `${selectedPatientHistoryRecord?.medicineName || "N/A"} x ${selectedPatientHistoryRecord?.medicineQuantity || 0}`;
        const selectedPatientAssistiveSummary = selectedPatientHistoryRecord?.dispensedAssistiveSummary
            || (selectedPatientAssistiveItems.length > 0
                ? selectedPatientAssistiveItems.map((item) => `${item.itemName || "Assistive device"} x ${item.quantity || 0}`).join(", ")
                : "");
        const selectedIntakePerDay = Number(selectedPatientHistoryRecord?.medicineIntakePerDay || 0);
        const selectedIntakeEveryHours = selectedIntakePerDay > 0 ? Math.max(1, Math.round(24 / selectedIntakePerDay)) : 0;

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">History</h1>
                    <p className="text-slate-600">Consultation records and medicine logs. Click any record to view complete details.</p>
                </div>

                {patientConsultationHistory.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-600">
                        No completed consultations yet.
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                            <h2 className="text-base font-bold text-slate-800 mb-3">Consultation logs</h2>
                            <div className="space-y-2 max-h-130 overflow-y-auto pr-1">
                                {patientConsultationHistory.map((entry) => {
                                    const isActive = String(entry.id) === String(selectedPatientHistoryRecord?.id);
                                    const entryMedicineSummary = entry.dispensedMedicineSummary
                                        || entry.prescribedMedicineSummary
                                        || `${entry.medicineName || "N/A"} x ${entry.medicineQuantity || 0}`;
                                    const entryAssistiveSummary = entry.dispensedAssistiveSummary || "";
                                    return (
                                        <button
                                            key={`patient-history-${entry.id}`}
                                            type="button"
                                            onClick={() => setPatientHistorySelectedRecordId(String(entry.id))}
                                            className={`w-full rounded-xl border p-3 text-left transition-all ${
                                                isActive
                                                    ? "border-brand-red bg-red-50"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <p className="text-sm font-bold text-slate-800">Medicine given: {entryMedicineSummary}</p>
                                            {entryAssistiveSummary ? (
                                                <p className="text-xs text-slate-600 mt-1">Assistive device: {entryAssistiveSummary}</p>
                                            ) : null}
                                            <p className="text-xs text-slate-600 mt-1">{formatLongDate(entry.dateKey)} at {entry.timeSlot || "N/A"}</p>
                                            <p className="text-sm text-slate-700 mt-1 line-clamp-1">Diagnosis: {entry.diagnosis || "N/A"}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                            <h2 className="text-xl font-bold text-slate-900">Record details</h2>
                            {!selectedPatientHistoryRecord ? (
                                <p className="text-sm text-slate-600">Select a record to view full details.</p>
                            ) : (
                                <div className="space-y-4 text-sm text-slate-700">
                                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Consultation Summary</h3>
                                        <p><span className="font-semibold text-slate-900">Diagnosis:</span> {selectedPatientHistoryRecord.diagnosis || "N/A"}</p>
                                        <p><span className="font-semibold text-slate-900">Medicines given:</span> {selectedPatientMedicineSummary}</p>
                                        {selectedPatientMedicineItems.length > 0 ? (
                                            <div className="space-y-1">
                                                {selectedPatientMedicineItems.map((item, index) => {
                                                    const itemIntakePerDay = Number(item.medicineIntakePerDay || 0);
                                                    const itemEveryHours = itemIntakePerDay > 0 ? Math.max(1, Math.round(24 / itemIntakePerDay)) : 0;
                                                    return (
                                                        <p key={`patient-medicine-detail-${item.itemId || index}`}>
                                                            <span className="font-semibold text-slate-900">Medicine {index + 1}:</span> {item.itemName || "Medicine"} x {item.quantity || 0}
                                                            {itemIntakePerDay > 0 ? `, ${itemIntakePerDay}x/day` : ""}
                                                            {itemEveryHours > 0 ? `, every ${itemEveryHours} hour(s)` : ""}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <>
                                                <p><span className="font-semibold text-slate-900">Intake frequency:</span> {selectedIntakePerDay > 0 ? `${selectedIntakePerDay}x a day` : "N/A"}</p>
                                                <p><span className="font-semibold text-slate-900">Suggested interval:</span> {selectedIntakeEveryHours > 0 ? `Every ${selectedIntakeEveryHours} hour(s)` : "N/A"}</p>
                                                {selectedPatientHistoryRecord.medicineIntakeInstruction ? (
                                                    <p><span className="font-semibold text-slate-900">Custom instruction:</span> {selectedPatientHistoryRecord.medicineIntakeInstruction}</p>
                                                ) : null}
                                            </>
                                        )}
                                        {selectedPatientAssistiveSummary ? (
                                            <p><span className="font-semibold text-slate-900">Assistive device given:</span> {selectedPatientAssistiveSummary}</p>
                                        ) : null}
                                        <p><span className="font-semibold text-slate-900">Patient note:</span> {selectedPatientHistoryRecord.note || "N/A"}</p>
                                    </section>

                                    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Timeline</h3>
                                        <p><span className="font-semibold text-slate-900">Schedule:</span> {formatLongDate(selectedPatientHistoryRecord.dateKey)} at {selectedPatientHistoryRecord.timeSlot || "N/A"}</p>
                                        <p><span className="font-semibold text-slate-900">Started:</span> {selectedPatientHistoryRecord.startedAt ? new Date(selectedPatientHistoryRecord.startedAt).toLocaleString("en-PH") : "N/A"}</p>
                                        <p><span className="font-semibold text-slate-900">Completed:</span> {selectedPatientHistoryRecord.completedAt ? new Date(selectedPatientHistoryRecord.completedAt).toLocaleString("en-PH") : "N/A"}</p>
                                        <p><span className="font-semibold text-slate-900">Duration:</span> {selectedPatientHistoryRecord.durationLabel || formatDuration(selectedPatientHistoryRecord.durationSeconds || 0)}</p>
                                        <p><span className="font-semibold text-slate-900">Attending health worker:</span> {selectedPatientHistoryRecord.workerName || "N/A"}</p>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderInbox = () => {
        if (user?.role !== "patient" && user?.role !== "admin") {
            return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">Inbox</h1>
                    <p className="text-slate-600">This section is available for patient and admin accounts.</p>
                </div>
            );
        }

        const inboxItems = user?.role === "admin" ? visibleAdminInboxMessages : visibleInboxMessages;
        const inboxDescription = user?.role === "admin"
            ? "Security and system notifications."
            : "Appointment reminders and notifications.";

        if (inboxItems.length === 0) {
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
                    <p className="text-slate-600">{inboxDescription}</p>
                </div>
                {inboxItems.map((message) => (
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
        if (path === "/manage-accounts") return renderManageAccounts();

        if (path === "/patient-accounts") {
            return <PatientAccountManagement />;
        }
        if (path === "/health-worker-accounts") {
            return <HealthWorkerAccountManagement />;
        }
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
        <div className="dashboard-modern flex h-dvh overflow-hidden font-sans">
            <DashboardNavigation />
            <main className="dashboard-main flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
                            <div className="flex flex-col items-center gap-2">
                                {(() => {
                                    const { patientSegment, randomCode } = splitAppointmentQrValue(qrModalAppointment.qrValue);
                                    return (
                                        <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold tracking-[0.12em] text-slate-700">
                                            <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{patientSegment || "N/A"}</span>
                                            <span className="text-slate-400">-</span>
                                            <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{randomCode || "N/A"}</span>
                                        </div>
                                    );
                                })()}
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Patient ID and random code</p>
                            </div>
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

            {activeVisibleInboxMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{activeVisibleInboxMessage.label}</h2>
                                <p className="text-slate-500 text-sm mt-1">{activeVisibleInboxMessage.createdAt}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveInboxMessage(null)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                        <p className="text-slate-700 leading-7 whitespace-pre-wrap">{activeVisibleInboxMessage.body}</p>
                        {activeVisibleInboxMessage.qrValue && (
                            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <QRCodeSVG value={activeVisibleInboxMessage.qrValue} size={200} includeMargin />
                                <div className="flex flex-col items-center gap-2">
                                    {(() => {
                                        const { patientSegment, randomCode } = splitAppointmentQrValue(activeVisibleInboxMessage.qrValue);
                                        return (
                                            <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold tracking-[0.12em] text-slate-700">
                                                <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{patientSegment || "N/A"}</span>
                                                <span className="text-slate-400">-</span>
                                                <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{randomCode || "N/A"}</span>
                                            </div>
                                        );
                                    })()}
                                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Patient ID and random code</p>
                                </div>
                            </div>
                        )}
                        {activeVisibleInboxMessage.appointmentCode && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Appointment Code</p>
                                <p className="mt-1 text-sm font-semibold text-slate-800 break-all">{activeVisibleInboxMessage.appointmentCode}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserDashboard;