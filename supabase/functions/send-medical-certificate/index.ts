import { createClient } from "npm:@supabase/supabase-js@^2.100.0";
import { jsPDF } from "npm:jspdf@^4.2.1";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const extractAccessToken = (rawAuthHeader: string) => {
  const normalized = String(rawAuthHeader || "").trim();
  if (!normalized) return "";

  const withoutBearer = normalized.replace(/^Bearer\s+/i, "").trim();
  return withoutBearer.replace(/^Bearer\s+/i, "").trim();
};

const formatDateKey = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatPasswordFromDob = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const buildCertificatePdf = ({
  patientName,
  patientDob,
  diagnosis,
  consultationDate,
  password,
}: {
  patientName: string;
  patientDob: string;
  diagnosis: string;
  consultationDate: string;
  password: string;
}) => {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    encryption: {
      userPassword: password,
      ownerPassword: crypto.randomUUID(),
      userPermissions: ["print"],
    },
  });

  doc.setProperties({
    title: "Medical Certificate",
    subject: "Barangay San Perfecto Health Center",
    author: "Barangay San Perfecto Health Center",
    creator: "San Perfecto Health Information System",
  });

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.roundedRect(12, 12, 186, 273, 4, 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BARANGAY SAN PERFECTO HEALTH CENTER", 105, 26, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text("Medical Certificate", 105, 34, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.line(22, 40, 188, 40);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const details = [
    ["Patient Name", patientName || "N/A"],
    ["Date of Birth", patientDob || "N/A"],
    ["Consultation Date", consultationDate || "N/A"],
    ["Diagnosis", diagnosis || "N/A"],
  ];

  let cursorY = 54;
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 24, cursorY);
    doc.setFont("helvetica", "normal");
    const wrappedValue = doc.splitTextToSize(String(value), 130);
    doc.text(wrappedValue, 58, cursorY);
    cursorY += Math.max(10, wrappedValue.length * 6);
  });

  doc.setDrawColor(226, 232, 240);
  doc.line(22, 126, 188, 126);

  doc.setFont("helvetica", "bold");
  doc.text("Certification", 24, 138);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This document certifies that the patient listed above was evaluated by Barangay San Perfecto Health Center.",
    24,
    148,
    { maxWidth: 160 }
  );
  doc.text(
    "Present this certificate only for its intended medical purpose.",
    24,
    160,
    { maxWidth: 160 }
  );

  doc.setFont("helvetica", "bold");
  doc.text("Issued by", 24, 188);
  doc.setFont("helvetica", "normal");
  doc.text("Barangay San Perfecto Health Center", 24, 196);
  doc.text("San Juan City, Metro Manila", 24, 202);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Password to open this PDF is the patient's birthdate in DDMMYYYY format.", 24, 260, { maxWidth: 160 });

  return new Uint8Array(doc.output("arraybuffer"));
};

const sendResendEmail = async ({
  apiKey,
  fromEmail,
  replyToEmail,
  toEmail,
  patientName,
  password,
  pdfBase64,
  consultationDate,
  diagnosis,
}: {
  apiKey: string;
  fromEmail: string;
  replyToEmail: string;
  toEmail: string;
  patientName: string;
  password: string;
  pdfBase64: string;
  consultationDate: string;
  diagnosis: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: replyToEmail,
      subject: "Medical Certificate from Barangay San Perfecto Health Center",
      text: [
        "Magandang araw! Ito ang iyong Medical Certificate mula sa Barangay San Perfecto Health Center:",
        `Patient: ${patientName}`,
        `Consultation Date: ${consultationDate}`,
        `Diagnosis: ${diagnosis}`,
        `PDF Password: ${password}`,
      ].join("\n"),
      html: `
        <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
            <div style="background:linear-gradient(135deg,#991b1b,#ef4444);color:#fff;border-radius:20px 20px 0 0;padding:28px 30px;">
              <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">Barangay San Perfecto Health Center</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Medical Certificate</h1>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 20px 20px;padding:28px 30px;box-shadow:0 10px 30px rgba(15,23,42,.06);">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Magandang araw! Ito ang iyong Medical Certificate mula sa Barangay San Perfecto Health Center.</p>
              <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#f8fafc;margin:18px 0;">
                <p style="margin:0 0 6px;font-size:13px;color:#475569;"><strong>Patient:</strong> ${patientName}</p>
                <p style="margin:0 0 6px;font-size:13px;color:#475569;"><strong>Consultation Date:</strong> ${consultationDate}</p>
                <p style="margin:0;font-size:13px;color:#475569;"><strong>Diagnosis:</strong> ${diagnosis}</p>
              </div>
              <p style="margin:0 0 10px;font-size:14px;color:#334155;">Your encrypted PDF is attached to this email.</p>
              <div style="display:inline-block;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:700;letter-spacing:.02em;">PDF Password: ${password}</div>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;">For your privacy, please do not share the password with anyone else.</p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: "medical-certificate.pdf",
          content: pdfBase64,
          content_type: "application/pdf",
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Resend email request failed.");
  }

  return payload;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "San Perfecto Health Center <onboarding@resend.dev>";
  const resendReplyToEmail = Deno.env.get("RESEND_REPLY_TO_EMAIL") || resendFromEmail;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse(500, { error: "Server secrets are not configured." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = extractAccessToken(authHeader);

  if (!accessToken) {
    return jsonResponse(401, { error: "Missing authorization header with access token." });
  }

  const {
    data: { user: requester },
    error: requesterError,
  } = await adminClient.auth.getUser(accessToken);
  if (requesterError || !requester) {
    return jsonResponse(401, { error: "Invalid access token." });
  }

  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, email, display_name")
    .eq("id", requester.id)
    .maybeSingle();

  if (profileError || !profileRow) {
    return jsonResponse(404, { error: "Profile not found." });
  }

  if (profileRow.role !== "patient") {
    return jsonResponse(403, { error: "Only patients can request a medical certificate." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const consultationId = String(body.consultationId || "").trim();

  const patientProfilePromise = adminClient
    .from("patient_profiles")
    .select("user_id, surname, firstname, middlename, dob")
    .eq("user_id", requester.id)
    .maybeSingle();

  const consultationPromise = consultationId
    ? adminClient
        .from("consultations")
        .select("id, patient_user_id, diagnosis, completed_at, created_at")
        .eq("id", consultationId)
        .eq("patient_user_id", requester.id)
        .maybeSingle()
    : adminClient
        .from("consultations")
        .select("id, patient_user_id, diagnosis, completed_at, created_at")
        .eq("patient_user_id", requester.id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const [patientProfileResult, consultationResult] = await Promise.all([patientProfilePromise, consultationPromise]);
  const patientProfile = patientProfileResult.data;
  const patientProfileError = patientProfileResult.error;
  const consultation = consultationResult.data;
  const consultationError = consultationResult.error;

  if (patientProfileError || !patientProfile) {
    return jsonResponse(404, { error: "Patient profile not found." });
  }

  if (consultationError) {
    return jsonResponse(400, { error: consultationError.message || "Unable to load consultation." });
  }

  if (!consultation) {
    return jsonResponse(404, { error: "No completed consultation found to generate a certificate." });
  }

  const patientName = `${patientProfile.firstname || ""} ${patientProfile.surname || ""}`.trim() || profileRow.display_name || "Patient";
  const password = formatPasswordFromDob(patientProfile.dob || "");

  if (!password) {
    return jsonResponse(400, { error: "Patient birthdate is missing or invalid. Cannot create the PDF password." });
  }

  const consultationDate = formatDateKey(consultation.completed_at || consultation.created_at || "");
  const diagnosis = String(consultation.diagnosis || "").trim() || "N/A";

  const pdfBytes = buildCertificatePdf({
    patientName,
    patientDob: formatDateKey(patientProfile.dob || ""),
    diagnosis,
    consultationDate,
    password,
  });

  const pdfBase64 = bytesToBase64(pdfBytes);

  try {
    const emailResult = await sendResendEmail({
      apiKey: resendApiKey,
      fromEmail: resendFromEmail,
      replyToEmail: resendReplyToEmail,
      toEmail: profileRow.email,
      patientName,
      password,
      pdfBase64,
      consultationDate,
      diagnosis,
    });

    await adminClient.from("audit_logs").insert({
      patient_id: requester.id,
      action: "medical_certificate_sent",
      details: {
        consultationId: consultation.id,
        emailId: emailResult?.id || null,
        passwordHint: "ddmmyyyy",
      },
      created_at: new Date().toISOString(),
    });

    return jsonResponse(200, {
      success: true,
      message: "Medical certificate sent to your registered email.",
      email: profileRow.email,
      consultationId: consultation.id,
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Unable to send the medical certificate email.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});