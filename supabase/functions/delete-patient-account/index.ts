import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
    return jsonResponse(403, { error: "Only administrators can delete patient accounts." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const patientUserId = String(body.patientUserId || "").trim();
  if (!patientUserId) {
    return jsonResponse(400, { error: "Missing required field: patientUserId." });
  }

  const reason = String(body.reason || "").trim();

  if (requester.id === patientUserId) {
    return jsonResponse(400, { error: "You cannot delete your own account from this screen." });
  }

  const { data: patientProfile, error: patientProfileError } = await adminClient
    .from("patient_profiles")
    .select("user_id")
    .eq("user_id", patientUserId)
    .maybeSingle();

  if (patientProfileError) {
    return jsonResponse(400, { error: patientProfileError.message || "Unable to load patient profile." });
  }

  if (!patientProfile) {
    return jsonResponse(404, { error: "Patient account not found." });
  }

  // Log the deletion action
  const now = new Date().toISOString();
  await adminClient.from("audit_logs").insert({
    admin_id: requester.id,
    patient_id: patientUserId,
    action: "account_deleted",
    details: { reason },
    created_at: now,
  });

  // Delete the patient auth account
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(patientUserId);
  if (deleteError) {
    return jsonResponse(400, {
      error: deleteError.message || "Unable to delete patient account.",
    });
  }

  return jsonResponse(200, {
    success: true,
    userId: patientUserId,
    message: "Patient account deleted successfully.",
  });
});
