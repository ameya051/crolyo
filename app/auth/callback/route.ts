import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if the user already exists in the public users table
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email!)
          .single();

        if (!existingUser) {
          // Insert a new row using the secret key (bypasses RLS)
          const adminClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
          );

          await adminClient.from("users").insert({
            email: user.email,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              "User",
          });
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // If something went wrong, redirect to signin with an error
  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
