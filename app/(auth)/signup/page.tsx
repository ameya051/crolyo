"use client";

import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signInWithGoogle, signUpWithEmail } from "@/app/actions/auth";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpValues } from "@/lib/validations/auth";

export default function SignUpPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
  };

  const onSubmit = async (data: SignUpValues) => {
    setAuthError(null);
    const result = await signUpWithEmail(data);
    if (result && "error" in result) {
      setAuthError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-[400px] bg-card p-8 rounded-[24px] shadow-sm border border-border mx-auto relative overflow-hidden">
        <div className="flex flex-col items-center text-center relative z-10">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Crolyo Logo"
              width={56}
              height={56}
              className="mb-4 drop-shadow-sm hover:opacity-80 transition-opacity"
            />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            We&apos;ve sent you a confirmation link. Click it to verify your
            account and sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px] bg-card p-8 rounded-[24px] shadow-sm border border-border mx-auto relative overflow-hidden">
      <div className="flex flex-col items-center mb-8 relative z-10">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Crolyo Logo"
            width={56}
            height={56}
            className="mb-4 drop-shadow-sm hover:opacity-80 transition-opacity"
          />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Sign up for Crolyo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Already have an account?{" "}
          <Link href="/signin" className="text-foreground font-semibold hover:underline">
            Login
          </Link>
        </p>
      </div>

      <div className="relative z-10">
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center">
            {authError}
          </div>
        )}

        <Button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="cursor-pointer w-full flex items-center justify-center gap-2 bg-background border border-border text-foreground font-medium rounded-xl py-3.5 hover:bg-surface transition-colors shadow-sm mb-6 disabled:opacity-50"
        >
          {googleLoading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </Button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-3 text-muted-foreground font-medium">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <div className="space-y-2 flex-1">
              <Label htmlFor="firstName" className="text-xs text-muted-foreground font-semibold px-1">First name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                className="bg-background border-border/60 shadow-sm h-10 rounded-xl px-3.5 focus-visible:ring-1 focus-visible:ring-primary/50"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-red-600 dark:text-red-400 px-1">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="lastName" className="text-xs text-muted-foreground font-semibold px-1">Last name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                className="bg-background border-border/60 shadow-sm h-10 rounded-xl px-3.5 focus-visible:ring-1 focus-visible:ring-primary/50"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-red-600 dark:text-red-400 px-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-muted-foreground font-semibold px-1">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="bg-background border-border/60 shadow-sm h-10 rounded-xl px-3.5 focus-visible:ring-1 focus-visible:ring-primary/50"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <Label htmlFor="password" className="text-xs text-muted-foreground font-semibold">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-background border-border/60 shadow-sm h-11 rounded-xl px-4 focus-visible:ring-1 focus-visible:ring-primary/50"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer w-full mt-6 font-semibold rounded-xl py-4 transition-all
              bg-gradient-to-b from-orange-400 to-orange-500 text-white
              shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_1px_2px_rgba(0,0,0,0.1)]
              dark:from-orange-500 dark:to-orange-600
              dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_1px_2px_rgba(0,0,0,0.4)]
              hover:opacity-90 active:scale-[0.98]
              ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
          </Button>
        </form>
      </div>
    </div>
  );
}
