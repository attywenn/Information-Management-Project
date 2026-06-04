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
    return jsonResponse(403, { error: "Only administrators can delete health worker accounts." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const targetUserId = String(body.userId || "").trim();
  if (!targetUserId) {
    return jsonResponse(400, { error: "Missing required field: userId." });
  }

  if (requester.id === targetUserId) {
    return jsonResponse(400, { error: "You cannot delete your own admin account from this screen." });
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetProfileError) {
    return jsonResponse(400, { error: targetProfileError.message || "Unable to load account profile." });
  }

  if (!targetProfile) {
    return jsonResponse(404, { error: "Health worker account not found." });
  }

  if (targetProfile.role !== "health_worker") {
    return jsonResponse(400, { error: "Only health worker accounts can be deleted from this screen." });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return jsonResponse(400, {
      error: deleteError.message || "Unable to delete health worker account.",
    });
  }

  return jsonResponse(200, {
    success: true,
    userId: targetUserId,
  });
});
