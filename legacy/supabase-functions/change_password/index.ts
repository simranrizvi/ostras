import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response("Unauthorized: No token", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { old_password, new_password, email } = await req.json();

  if (!old_password || !new_password || !email) {
    return new Response("Missing fields", { status: 400 });
  }

  // Step 1: Verify old password
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: old_password,
  });

  if (signInError) {
    return new Response("Old password is incorrect", { status: 400 });
  }

  // Step 2: Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: new_password,
  });

  if (updateError) {
    console.error(updateError);
    return new Response("Failed to update password", { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Password updated successfully" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
