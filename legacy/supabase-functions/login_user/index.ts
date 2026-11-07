import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

serve(async (req) => {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response("Missing credentials", { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return new Response("Invalid credentials", { status: 401 });
    }

    // Fetch user's role
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    return new Response(
      JSON.stringify({
        access_token: data.session.access_token,
        user_id: data.user.id,
        role: userData?.role || "user"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response("Login error", { status: 500 });
  }
});
