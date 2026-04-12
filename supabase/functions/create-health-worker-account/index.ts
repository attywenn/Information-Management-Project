import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const keyboardSpecialCharPattern = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const keyboardAllowedPattern = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+$/;

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

Deno.serve(async (req) => {
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

  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const surname = String(body.surname || "").trim();
  const firstname = String(body.firstname || "").trim();
  const middlename = String(body.middlename || "").trim();
  const dob = String(body.dob || "").trim();
  const securityQuestionId = Number(body.securityQuestionId);
  const securityAnswer = String(body.securityAnswer || "").trim();

  if (!username || !email || !password || !surname || !firstname || !dob || !securityAnswer) {
    return jsonResponse(400, { error: "Missing required fields." });
  }

  if (Number.isNaN(new Date(dob).getTime())) {
    return jsonResponse(400, { error: "Invalid birthdate." });
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
    .or(`username.eq.${username},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (duplicateAccount) {
    return jsonResponse(409, { error: "Username or email already exists." });
  }

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
    app_metadata: { app_role: "health_worker" },
    user_metadata: {
      app_role: "health_worker",
      username,
      display_name: `${firstname} ${surname}`.trim(),
      surname,
      firstname,
      middlename,
      dob,
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

  return jsonResponse(200, {
    userId: createdUserData.user.id,
    username,
    email,
    licenseNumber,
  });
});
