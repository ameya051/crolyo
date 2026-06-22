import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join us - Crolyo",
  description: "Sign in or sign up to Crolyo.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {children}
    </div>
  );
}
