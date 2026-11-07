import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const body = await req.json();
    const {
      email,
      password,
      full_name,
      zip_code,
      birthday,
      gender,
      referral_code,
      role: incomingRole  // 👈 Accept karein agar bheja gaya ho
    } = body;

    if (!email || !password || !full_name || !zip_code || !birthday || !gender) {
      return new Response("Missing required fields", { status: 400 });
    }

    const role = incomingRole ?? "user"; // 👈 Default to "user" if not provided

    // ✅ Create user in Supabase Auth with user_metadata.role
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role
      }
    });

    if (createError || !newUser?.user) {
      return new Response("Failed to create auth user", { status: 400 });
    }

    // ✅ Insert metadata into public.users table
    const { error: insertError } = await supabase.from("users").insert({
      user_id: newUser.user.id,
      email,
      full_name,
      zip_code,
      birthday,
      gender,
      referral_code,
      role // 👈 Match with user_metadata
    });

    if (insertError) {
      return new Response("Failed to insert user metadata", { status: 500 });
    }

    return new Response(
      JSON.stringify({ message: "User registered successfully", user_id: newUser.user.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response("Unexpected error", { status: 500 });
  }
});
