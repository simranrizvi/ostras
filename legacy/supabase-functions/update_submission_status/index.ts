import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Missing auth", { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) return new Response("Invalid JWT", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") return new Response("Unauthorized", { status: 403 });

  const { submission_id, status } = await req.json();
  if (!submission_id || !["approved", "rejected"].includes(status)) {
    return new Response("Invalid input", { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({ status })
    .eq("id", submission_id);

  if (updateError) {
    console.error(updateError);
    return new Response("Update failed", { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Status updated" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
