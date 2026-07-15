import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  logger.info("auth.callback.started", { flow: code ? "code" : tokenHash && type ? "otp" : "invalid" });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      logger.info("auth.callback.succeeded", { flow: "code" });
      return NextResponse.redirect(`${origin}/overview`);
    }
    logger.warn("auth.callback.failed", { flow: "code", errorCode: error.code });
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      logger.info("auth.callback.succeeded", { flow: "otp", otpType: type });
      return NextResponse.redirect(`${origin}/overview`);
    }
    logger.warn("auth.callback.failed", { flow: "otp", otpType: type, errorCode: error.code });
  }

  logger.warn("auth.callback.redirecting_to_signin");
  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
