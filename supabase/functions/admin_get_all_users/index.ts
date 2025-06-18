import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Logging env vars to debug
console.log("Function started");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("Env:", { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response("Unauthorized", { status: 401 });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response("Invalid token", { status: 401 });

    console.log("User metadata:", user.user_metadata);

    if ((user.user_metadata.role || "").toLowerCase() !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }

   const { data, error: fetchError } = await supabase
  .from("users")
  .select("user_id, full_name, email")
  .eq("role", "user")
  .order("created_at", { ascending: false });

    if (fetchError) return new Response("Fetch error", { status: 500 });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Function crashed:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
});
