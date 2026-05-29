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

const keyboardSpecialCharPattern = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const keyboardAllowedPattern = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;
const allowedSexOptions = ["Male", "Female", "Prefer not to say"];

const normalizePhoneNumber = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.startsWith("+")) {
    return raw;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+63${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return `+63${digits}`;
  }

  if (digits.startsWith("63")) {
    return `+${digits}`;
  }

  return `+${digits}`;
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const isValidPassword = (password: string) => {
  if (!password || password.includes(" ")) return false;
  if (!keyboardAllowedPattern.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!keyboardSpecialCharPattern.test(password)) return false;
  return true;
};

const buildUsernameBase = (email: string) => {
  const localPart = String(email || "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
  return localPart || "user";
};

const generateUniqueInternalUsername = async (
  adminClient: any,
  email: string,
) => {
  const base = buildUsernameBase(email);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0
      ? Date.now().toString(36)
      : `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}`;
    const candidate = `u_${base}_${suffix}`;

    const { data: existingByUsername } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (!existingByUsername) {
      return candidate;
    }
  }

  return `u_${base}_${crypto.randomUUID().replace(/-/g, "")}`;
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

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Supabase secrets are not configured." });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing authorization header." });
  }

  const extractAccessToken = (rawAuthHeader: string) => {
    const normalized = rawAuthHeader.trim();
    if (!normalized) return "";

    const withoutBearer = normalized.replace(/^Bearer\s+/i, "").trim();
    // Some clients accidentally send "Bearer Bearer <token>". Normalize it safely.
    return withoutBearer.replace(/^Bearer\s+/i, "").trim();
  };

  const accessToken = extractAccessToken(authHeader);
  if (!accessToken) {
    return jsonResponse(401, { error: "Missing access token in authorization header." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user: requester },
    error: requesterError,
  } = await adminClient.auth.getUser(accessToken);

  if (requesterError || !requester) {
    return jsonResponse(401, { error: "Invalid access token." });
  }

  let requesterRole = requester.app_metadata?.app_role;
  if (requesterRole !== "admin") {
    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .maybeSingle();
    requesterRole = requesterProfile?.role;
  }

  if (requesterRole !== "admin") {
    return jsonResponse(403, { error: "Only administrators can create health worker accounts." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const surname = String(body.surname || "").trim();
  const firstname = String(body.firstname || "").trim();
  const middlename = String(body.middlename || "").trim();
  const dob = String(body.dob || "").trim();
  const sex = String(body.sex || "").trim();
  const gender = String(body.gender || "").trim();
  const phoneNumber = normalizePhoneNumber(String(body.phoneNumber || body.contactNumber || body.phone || ""));
  const securityQuestionId = Number(body.securityQuestionId);
  const securityAnswer = String(body.securityAnswer || "").trim();

  if (!email || !password || !surname || !firstname || !dob || !sex || !gender || !securityAnswer) {
    return jsonResponse(400, { error: "Missing required fields." });
  }

  if (!allowedSexOptions.includes(sex)) {
    return jsonResponse(400, { error: "Invalid sex option." });
  }

  if (Number.isNaN(new Date(dob).getTime())) {
    return jsonResponse(400, { error: "Invalid birthdate." });
  }

  if (!phoneNumber) {
    return jsonResponse(400, { error: "Phone number is required." });
  }

  if (!Number.isInteger(securityQuestionId) || securityQuestionId <= 0) {
    return jsonResponse(400, { error: "Invalid securityQuestionId." });
  }

  if (!isValidPassword(password)) {
    return jsonResponse(400, {
      error:
        "Password must include at least one uppercase letter, one common keyboard special character, and must not contain spaces.",
    });
  }

  const { data: duplicateAccount } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (duplicateAccount) {
    return jsonResponse(409, { error: "Email already exists." });
  }

  const internalUsername = await generateUniqueInternalUsername(adminClient, email);

  const { data: generatedLicense, error: generatedLicenseError } = await adminClient.rpc(
    "generate_health_worker_license",
  );

  if (generatedLicenseError || !generatedLicense) {
    return jsonResponse(500, { error: "Failed to generate health worker license number." });
  }

  const licenseNumber = String(generatedLicense);

  const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: phoneNumber || undefined,
    phone_confirm: Boolean(phoneNumber),
    app_metadata: { app_role: "health_worker" },
    user_metadata: {
      app_role: "health_worker",
      username: internalUsername,
      display_name: `${firstname} ${surname}`.trim(),
      surname,
      firstname,
      middlename,
      dob,
      sex,
      gender,
      phone: phoneNumber,
      contact_number: phoneNumber,
      license_number: licenseNumber,
      security_question_id: securityQuestionId,
      security_answer: securityAnswer,
    },
  });

  if (createUserError || !createdUserData.user) {
    return jsonResponse(400, {
      error: createUserError?.message || "Unable to create health worker account.",
    });
  }

  if (phoneNumber && !createdUserData.user.phone) {
    const { error: phoneUpdateError } = await adminClient.auth.admin.updateUserById(
      createdUserData.user.id,
      {
        phone: phoneNumber,
        phone_confirm: true,
      }
    );

    if (phoneUpdateError) {
      return jsonResponse(400, {
        error: phoneUpdateError.message || "Unable to persist phone number for this account.",
      });
    }
  }

  return jsonResponse(200, {
    userId: createdUserData.user.id,
    email,
    phoneNumber,
    licenseNumber,
  });
});
