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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) return new Response("Invalid token", { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) return new Response("Error fetching profile", { status: 500 });

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});