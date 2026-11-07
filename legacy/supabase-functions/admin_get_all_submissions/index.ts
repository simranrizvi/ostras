import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.user_metadata.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { data, error: fetchError } = await supabase
    .from("submissions")
    .select("*");

  if (fetchError) return new Response("Failed to fetch", { status: 500 });

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
