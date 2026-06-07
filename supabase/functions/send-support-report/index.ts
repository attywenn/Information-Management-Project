import { createClient } from "npm:@supabase/supabase-js@^2.100.0";

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

const ADMIN_SUPPORT_EMAIL = "wnciplays@gmail.com";

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

const trimText = (value: unknown) => String(value ?? "").trim();

const buildSupportConversationKey = (senderUserId: string, recipientUserId: string) => {
  const left = String(senderUserId || "").trim();
  const right = String(recipientUserId || "").trim();
  if (!left || !right) return "";
  return `support:${[left, right].sort().join(":")}`;
};

const sendResendEmail = async ({
  apiKey,
  fromEmail,
  replyToEmail,
  toEmail,
  subject,
  body,
  senderName,
  senderRole,
  senderEmail,
}: {
  apiKey: string;
  fromEmail: string;
  replyToEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  senderName: string;
  senderRole: string;
  senderEmail: string;
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
      subject: `[JuanitoAI Report] ${subject}`,
      text: [
        `Sender: ${senderName}`,
        `Role: ${senderRole}`,
        `Email: ${senderEmail || "N/A"}`,
        "",
        body,
      ].join("\n"),
      html: `
        <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
            <div style="background:linear-gradient(135deg,#991b1b,#ef4444);color:#fff;border-radius:20px 20px 0 0;padding:28px 30px;">
              <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">JuanitoAI Support Escalation</p>
              <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">New report from a user</h1>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 20px 20px;padding:28px 30px;box-shadow:0 10px 30px rgba(15,23,42,.06);">
              <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#f8fafc;margin:0 0 18px;">
                <p style="margin:0 0 6px;font-size:13px;color:#475569;"><strong>Sender:</strong> ${senderName}</p>
                <p style="margin:0 0 6px;font-size:13px;color:#475569;"><strong>Role:</strong> ${senderRole}</p>
                <p style="margin:0;font-size:13px;color:#475569;"><strong>Email:</strong> ${senderEmail || "N/A"}</p>
              </div>
              <p style="margin:0;font-size:15px;line-height:1.8;color:#334155;white-space:pre-wrap;">${body}</p>
            </div>
          </div>
        </div>
      `,
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

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse(500, { error: "Server secrets are not configured." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = extractAccessToken(authHeader);

  if (!accessToken) {
    return jsonResponse(401, { error: "Missing authorization header with access token." });
  }

  const { data: authResult, error: authError } = await adminClient.auth.getUser(accessToken);
  const requester = authResult.user;
  if (authError || !requester) {
    return jsonResponse(401, { error: "Invalid access token." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const subject = trimText(body.subject);
  const reportBody = trimText(body.body || body.problem || body.message);
  const senderEmail = trimText(body.senderEmail);

  if (!subject) {
    return jsonResponse(400, { error: "Subject is required." });
  }

  if (!reportBody) {
    return jsonResponse(400, { error: "Problem details are required." });
  }

  const { data: senderProfile, error: senderProfileError } = await adminClient
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", requester.id)
    .maybeSingle();

  if (senderProfileError || !senderProfile) {
    return jsonResponse(404, { error: "Requester profile not found." });
  }

  const { data: adminTarget, error: adminTargetError } = await adminClient
    .from("profiles")
    .select("id, email, display_name")
    .eq("role", "admin")
    .eq("email", ADMIN_SUPPORT_EMAIL)
    .maybeSingle();

  if (adminTargetError || !adminTarget) {
    return jsonResponse(404, { error: "Support admin mailbox is not configured." });
  }

  const conversationKey = buildSupportConversationKey(senderProfile.id, adminTarget.id);

  const { data: messageRow, error: insertError } = await adminClient
    .from("messages")
    .insert({
      sender_user_id: senderProfile.id,
      subject,
      body: reportBody,
      message_type: "support_email",
      conversation_key: conversationKey,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !messageRow?.id) {
    return jsonResponse(500, { error: "Unable to save support report." });
  }

  const { error: recipientError } = await adminClient
    .from("message_recipients")
    .insert({
      message_id: messageRow.id,
      recipient_user_id: adminTarget.id,
    });

  if (recipientError) {
    return jsonResponse(500, { error: "Unable to route support report to the admin inbox." });
  }

  const emailResult = await sendResendEmail({
    apiKey: resendApiKey,
    fromEmail: resendFromEmail,
    replyToEmail: senderProfile.email || senderEmail || resendFromEmail,
    toEmail: ADMIN_SUPPORT_EMAIL,
    subject,
    body: reportBody,
    senderName: senderProfile.display_name || requester.email || "Support user",
    senderRole: senderProfile.role,
    senderEmail: senderProfile.email || senderEmail,
  });

  return jsonResponse(200, {
    success: true,
    message: "Your problem was reported to the admin.",
    messageId: messageRow.id,
    conversationKey,
    emailId: emailResult?.id || null,
  });
});