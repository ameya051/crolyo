"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  signInSchema,
  signUpSchema,
  type SignInValues,
  type SignUpValues,
  type AuthActionResult,
} from "@/lib/validations/auth";

export async function signInWithGoogle() {
  logger.info("auth.google_sign_in.started");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  });

  if (error) {
    logger.warn("auth.google_sign_in.failed", { provider: "google", errorCode: error.code });
    redirect("/signin?error=oauth");
  }

  if (data.url) {
    logger.info("auth.google_sign_in.redirecting", { provider: "google" });
    redirect(data.url);
  }

  logger.warn("auth.google_sign_in.missing_redirect_url", { provider: "google" });
}

export async function signInWithEmail(
  data: SignInValues
): Promise<AuthActionResult> {
  logger.info("auth.email_sign_in.started");
  const validated = signInSchema.safeParse(data);
  if (!validated.success) {
    logger.warn("auth.email_sign_in.validation_failed");
    return { error: "Invalid email or password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    logger.warn("auth.email_sign_in.failed", { errorCode: error.code });
    return { error: "Invalid email or password." };
  }

  logger.info("auth.email_sign_in.succeeded");
  redirect("/overview");
}

export async function signUpWithEmail(
  data: SignUpValues
): Promise<AuthActionResult> {
  logger.info("auth.email_sign_up.started");
  const validated = signUpSchema.safeParse(data);
  if (!validated.success) {
    logger.warn("auth.email_sign_up.validation_failed");
    return { error: "Please check your input and try again." };
  }

  const { firstName, lastName, email, password } = validated.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: `${firstName} ${lastName}` },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  });

  if (error) {
    logger.warn("auth.email_sign_up.failed", { errorCode: error.code });
    return { error: error.message };
  }

  logger.info("auth.email_sign_up.succeeded");
  return { success: true };
}

export async function signOut() {
  logger.info("auth.sign_out.started");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.error("auth.sign_out.failed", error, { errorCode: error.code });
    return;
  }
  logger.info("auth.sign_out.succeeded");
  redirect("/signin");
}
