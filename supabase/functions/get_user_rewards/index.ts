import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Missing Auth", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return new Response("Invalid Token", { status: 401 });

  const { data, error: fetchError } = await supabase
    .from("rewards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (fetchError) return new Response("Error fetching", { status: 500 });

  // ✅ No reward case
  if (!data || data.length === 0) {
    return new Response(
      JSON.stringify({ message: "You have not received any rewards yet." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ✅ Return rewards
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
