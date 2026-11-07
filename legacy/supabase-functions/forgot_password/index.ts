import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Must use service key
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return new Response("Invalid email", { status: 400 });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://dummy-redirect.com/reset-password", // 👈 Update this
  });

  if (error) {
    console.error(error);
    return new Response("Error sending reset link", { status: 500 });
  }

  return new Response(JSON.stringify({ message: "Reset link sent" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
