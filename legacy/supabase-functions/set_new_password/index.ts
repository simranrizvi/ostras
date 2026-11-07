import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Supabase Admin client (needs service role key)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { access_token, new_password } = await req.json();

    if (!access_token || !new_password) {
      return new Response("Missing access_token or new_password", { status: 400 });
    }

    // ✅ Decode JWT to extract user ID (sub)
    const payload = JSON.parse(atob(access_token.split(".")[1]));
    const userId = payload.sub;

    if (!userId) {
      return new Response("Invalid token: user ID not found", { status: 400 });
    }

    // ✅ Update password using Admin API
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: new_password,
    });

    if (error) {
      console.error("Update error:", error);
      return new Response("Error updating password", { status: 500 });
    }

    return new Response(JSON.stringify({ message: "Password updated successfully" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
