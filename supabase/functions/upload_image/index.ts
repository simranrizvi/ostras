import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Missing authorization header", { status: 401 });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return new Response("Invalid JWT", { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return new Response("Missing file", { status: 400 });

    const ext = file.type.split("/")[1];
    const filePath = `submissions/${user.id}/${crypto.randomUUID()}.${ext}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from("submissions")
      .upload(filePath, file.stream(), {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) {
      console.error(storageError);
      return new Response("Failed to upload file", { status: 500 });
    }

    const imageUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${storageData.path}`;

    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      return new Response("DB Insert failed", { status: 500 });
    }

    return new Response(JSON.stringify({
      message: "Image uploaded successfully",
      submission_id: submission.id,
      status: submission.status,
      image_url: submission.image_url,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response("Unexpected error", { status: 500 });
  }
});
