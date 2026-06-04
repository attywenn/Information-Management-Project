import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    // Import Supabase client
    const { createClient } = await import("npm:@supabase/supabase-js@^2.38.4");

    // Use service role key for admin operations - no user verification needed
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    if (!serviceKey || !supabaseUrl) {
      console.error("Missing environment variables");
      return jsonResponse(500, { error: "Server configuration error" });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // List buckets to check if avatars bucket exists
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      // Even if listing fails, try to create anyway
    }

    // Check if avatars bucket already exists
    const avatarsBucketExists = buckets?.some((b) => b.name === "avatars");

    if (avatarsBucketExists) {
      console.log("Avatars bucket already exists");
      return jsonResponse(200, { success: true, message: "Avatars bucket already exists", created: false });
    }

    // Create the avatars bucket if it doesn't exist
    console.log("Creating avatars bucket...");
    const { data: newBucket, error: createError } = await adminClient.storage.createBucket("avatars", {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: 5242880, // 5MB
    });

    if (createError) {
      // Check if error is because bucket already exists (race condition)
      if (createError.message?.includes("already exists")) {
        console.log("Avatars bucket already exists (caught in create attempt)");
        return jsonResponse(200, { success: true, message: "Avatars bucket already exists", created: false });
      }
      console.error("Error creating avatars bucket:", createError);
      return jsonResponse(500, { error: "Failed to create avatars bucket", details: createError?.message });
    }

    console.log("Avatars bucket created successfully");
    return jsonResponse(201, {
      success: true,
      message: "Avatars bucket created successfully",
      created: true,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(500, {
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
