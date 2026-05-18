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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(500, { error: "Supabase secrets not configured." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return jsonResponse(401, { error: "Missing access token." });

  const { data: { user: requester }, error: requesterError } = await adminClient.auth.getUser(accessToken);
  if (requesterError || !requester) return jsonResponse(401, { error: "Invalid access token." });

  // Ensure requester is admin
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", requester.id).maybeSingle();
  if (!profile || profile.role !== "admin") return jsonResponse(403, { error: "Administrator privileges required." });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const adminPhone = String(body.adminPhone || "").trim();

  // Update admin phone if provided
  if (adminPhone) {
    await adminClient.from("profiles").update({ contact_number: adminPhone, updated_at: new Date().toISOString() }).eq("id", requester.id);
  }

  // Find non-admin profiles with empty contact_number
  const { data: orphanProfiles, error: findError } = await adminClient
    .from("profiles")
    .select("id")
    .not("contact_number", "is", "null")
    .or("contact_number.eq.''")
    .not("role", "eq", "admin");

  // The above .or may not behave in all clients; as a fallback fetch where contact_number is null or empty
  let targets = orphanProfiles || [];
  if (findError) {
    const { data: fallback } = await adminClient
      .from("profiles")
      .select("id")
      .filter("contact_number", "is", null)
      .or("role.eq.health_worker,role.eq.patient");
    targets = fallback || [];
  }

  const deletedUsers: string[] = [];
  for (const row of targets) {
    try {
      const userId = (row as any).id;
      // Delete auth user
      try { await adminClient.auth.admin.deleteUser(userId); } catch { /* continue */ }
      // Delete profile row
      await adminClient.from("profiles").delete().eq("id", userId);
      deletedUsers.push(userId);
    } catch {
      // ignore individual failures
    }
  }

  return jsonResponse(200, { success: true, deletedCount: deletedUsers.length });
});
