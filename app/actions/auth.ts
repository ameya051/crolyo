"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  type SignInValues,
  type SignUpValues,
  type AuthActionResult,
} from "@/lib/validations/auth";

export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect("/signin?error=oauth");
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithEmail(
  data: SignInValues
): Promise<AuthActionResult> {
  const validated = signInSchema.safeParse(data);
  if (!validated.success) {
    return { error: "Invalid email or password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/overview");
}

export async function signUpWithEmail(
  data: SignUpValues
): Promise<AuthActionResult> {
  const validated = signUpSchema.safeParse(data);
  if (!validated.success) {
    return { error: "Please check your input and try again." };
  }

  const { firstName, lastName, email, password } = validated.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: `${firstName} ${lastName}` },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
