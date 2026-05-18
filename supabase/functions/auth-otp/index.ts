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

const sendSmsViaGateway = async (phone: string, message: string, apiKey: string) => {
  const url = `https://api.smsmobileapi.com/sendsms/?recipients=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET" });
  try {
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch {
    return { ok: res.ok, status: res.status, body: null };
  }
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

    let phone = "";

    if (profile.role === "patient") {
      const { data: patientProfile } = await adminClient
        .from("patient_profiles")
        .select("contact_number")
        .eq("user_id", requester.id)
        .maybeSingle();
      phone = String(patientProfile?.contact_number || "").trim();
    } else {
      phone = String(requester.phone || "").trim();
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

    const { error: insertError } = await adminClient
      .from("auth_otps")
      .insert([{ user_id: requester.id, phone, otp_hash: otpHash, purpose: purpose, expires_at: expiresAt }]);

    if (insertError) {
      return jsonResponse(500, { error: "Unable to store OTP." });
    }

    const message = `Maligayang araw! Your OTP for San Perfecto Health Center e-services is ${otp}. Hindi ka ba nag-request ng OTP? Isumbong sa security admin! Email: wnciplays@gmail.com`;
    const smsResult = await sendSmsViaGateway(phone, message, smsApiKey);

    if (!smsResult.ok) {
      return jsonResponse(502, { error: "Failed to send SMS.", sms: smsResult });
    }

    return jsonResponse(200, { success: true, message: "OTP sent." });
  }

  if (action === "verify") {
    const code = String(body.code || "").trim();
    if (!code) return jsonResponse(400, { error: "OTP code is required." });

    // Find latest unconsumed OTP for this user and purpose
    const { data: rows, error: selectError } = await adminClient
      .from("auth_otps")
      .select("id, otp_hash, attempts, consumed, expires_at")
      .eq("user_id", requester.id)
      .eq("purpose", purpose)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectError) return jsonResponse(500, { error: "Failed to query OTPs." });
    if (!rows || rows.length === 0) return jsonResponse(404, { error: "No OTP found for verification." });

    const otpRow = rows[0] as any;
    if (otpRow.consumed) return jsonResponse(400, { error: "OTP already used." });

    const now = new Date();
    if (new Date(otpRow.expires_at) < now) return jsonResponse(400, { error: "OTP expired." });

    const providedHash = await hashText(code);
    if (providedHash === otpRow.otp_hash) {
      await adminClient.from("auth_otps").update({ consumed: true }).eq("id", otpRow.id);
      return jsonResponse(200, { success: true });
    }

    // Increment attempts
    await adminClient.from("auth_otps").update({ attempts: (otpRow.attempts || 0) + 1 }).eq("id", otpRow.id);
    return jsonResponse(400, { error: "Invalid OTP code." });
  }

  return jsonResponse(400, { error: "Unknown action. Use action 'initiate' or 'verify'." });
});
