import { createClient } from "npm:@supabase/supabase-js@^2.38.4";

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

const hashText = async (text: string) => {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const normalizeOtpCode = (value: unknown) => String(value ?? "").replace(/\D/g, "").trim();

// Normalize Philippine phone numbers to E.164 when possible
const normalizePhoneToE164 = (raw: string) => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (s.startsWith("+")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) return s;
  // common PH formats: 09xxxxxxxxx (11), 9xxxxxxxxx (10), 63xxxxxxxxxx
  if (digits.length === 11 && digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `+63${digits}`;
  if (digits.startsWith("63")) return `+${digits}`;
  // fallback: prefix with +
  return `+${digits}`;
};

// TextBee send helper - uses secrets from Deno.env
const sendSmsViaTextBee = async (phone: string, message: string) => {
  const apiKey = Deno.env.get("SMS_API_KEY");
  const deviceId = Deno.env.get("TEXTBEE_DEVICE_ID");

  if (!apiKey) throw new Error("Missing SMS_API_KEY");
  if (!deviceId) throw new Error("Missing TEXTBEE_DEVICE_ID");

  const response = await fetch(
    `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [phone],
        message,
      }),
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`TextBee send failed: ${JSON.stringify(payload)}`);
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
  const smsApiKey = Deno.env.get("SMS_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !smsApiKey) {
    return jsonResponse(500, { error: "Server secrets not configured." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization") || "";
  const extractAccessToken = (raw: string) => raw.replace(/^Bearer\s+/i, "").trim();
  const accessToken = extractAccessToken(authHeader);

  if (!accessToken) {
    return jsonResponse(401, { error: "Missing authorization header with access token." });
  }

  const { data: { user: requester }, error: requesterError } = await adminClient.auth.getUser(accessToken);
  if (requesterError || !requester) {
    return jsonResponse(401, { error: "Invalid access token." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const action = String(body.action || "").trim().toLowerCase();
  const purpose = String(body.purpose || "auth").trim();
  const requestedNewPhone = normalizePhoneToE164(String(body.newPhone || "").trim());

  if (action === "initiate") {
    // Look up profile and phone source
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role, email")
      .eq("id", requester.id)
      .maybeSingle();

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for user." });
    }

    const requestedPhone = normalizePhoneToE164(String(body.phone || "").trim());
    let phone = "";

    if (profile.role === "patient") {
      const { data: patientProfile } = await adminClient
        .from("patient_profiles")
        .select("contact_number")
        .eq("user_id", requester.id)
        .maybeSingle();
      const storedPatientPhone = normalizePhoneToE164(String(patientProfile?.contact_number || "").trim());
      phone = storedPatientPhone || requestedPhone;
    } else {
      phone = requestedPhone || normalizePhoneToE164(String(requester.phone || "").trim());
    }

    // If admin and no phone, set provided admin phone (configurable by caller)
    if (!phone && profile.role === "admin" && body.adminPhone) {
      const adminPhone = String(body.adminPhone || "").trim();
      if (adminPhone) {
        await adminClient.auth.admin.updateUserById(requester.id, {
          phone: adminPhone,
          phone_confirm: true,
        });
        phone = adminPhone;
      }
    }

    if (!phone) {
      return jsonResponse(400, { error: "No phone number found for this account. Please update contact number." });
    }


    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await hashText(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone || normalizedPhone === "+") {
      return jsonResponse(400, { error: "No valid phone number found for this account. Please update contact number." });
    }

    const { error: insertError } = await adminClient
      .from("auth_otps")
      .insert([
        {
          user_id: requester.id,
          phone: normalizedPhone,
          new_phone: purpose === "phone_change" ? (requestedNewPhone || null) : null,
          otp_hash: otpHash,
          purpose: purpose,
          expires_at: expiresAt,
        },
      ]);

    if (insertError) {
      return jsonResponse(500, { error: "Unable to store OTP." });
    }

    const message = `Maligayang araw! Your OTP for San Perfecto Health Center e-services is ${otp}. Hindi ka ba nag-request ng OTP? Isumbong sa security admin! Email: wnciplays@gmail.com`;
    try {
      const textBeeResult = await sendSmsViaTextBee(normalizedPhone, message);
      return jsonResponse(200, { success: true, message: "OTP sent.", providerResponse: textBeeResult });
    } catch (err: any) {
      return jsonResponse(502, { error: "Failed to send SMS.", details: String(err?.message || err) });
    }
  }

  if (action === "verify") {
    const code = normalizeOtpCode(body.code);
    if (!code) return jsonResponse(400, { error: "OTP code is required." });
    if (!/^\d{6}$/.test(code)) return jsonResponse(400, { error: "OTP code must be a 6-digit number." });

    // Check recent unconsumed OTPs so a valid code still works even if multiple codes were issued.
    const now = new Date();
    const { data: rows, error: selectError } = await adminClient
      .from("auth_otps")
      .select("id, otp_hash, attempts, consumed, expires_at, new_phone")
      .eq("user_id", requester.id)
      .eq("purpose", purpose)
      .eq("consumed", false)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (selectError) return jsonResponse(500, { error: "Failed to query OTPs." });
    if (!rows || rows.length === 0) return jsonResponse(404, { error: "No OTP found for verification." });

    const providedHash = await hashText(code);
    const matchedRow = (rows as any[]).find((row) => row.otp_hash === providedHash);
    if (matchedRow) {
      if (purpose === "phone_change") {
        const resolvedNewPhone = requestedNewPhone || normalizePhoneToE164(String(matchedRow.new_phone || "").trim());
        if (!resolvedNewPhone) {
          return jsonResponse(400, { error: "New phone number is required for phone change verification." });
        }

        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(requester.id, {
          phone: resolvedNewPhone,
          phone_confirm: true,
        });

        if (authUpdateError) {
          return jsonResponse(500, { error: "Unable to update phone number." });
        }

        const { error: profileUpdateError } = await adminClient
          .from("patient_profiles")
          .update({ contact_number: resolvedNewPhone, updated_at: new Date().toISOString() })
          .eq("user_id", requester.id);

        if (profileUpdateError) {
          // For non-patient roles there may be no patient_profiles row. That's fine.
          const { data: roleRow } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", requester.id)
            .maybeSingle();

          if (roleRow?.role === "patient") {
            return jsonResponse(500, { error: "Phone updated in auth, but patient profile update failed." });
          }
        }

        await adminClient.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", requester.id);
      }

      await adminClient.from("auth_otps").update({ consumed: true }).eq("id", matchedRow.id);
      return jsonResponse(200, { success: true });
    }

    // Increment attempts on the most recent active OTP so repeated failures still get tracked.
    const otpRow = rows[0] as any;
    await adminClient.from("auth_otps").update({ attempts: (otpRow.attempts || 0) + 1 }).eq("id", otpRow.id);
    return jsonResponse(400, { error: "Invalid OTP code." });
  }

  return jsonResponse(400, { error: "Unknown action. Use action 'initiate' or 'verify'." });
});
