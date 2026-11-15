import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col border-x border-border">
      <header className="flex h-14 items-center border-b border-border px-4 md:px-6">
        <Link href="/" className="flex items-center hover:opacity-70">
          <Image src="/logo.png" alt="Crolyo Logo" width={32} height={32} className="size-8 object-contain" />
          <span className="text-lg font-semibold tracking-tight text-foreground">Crolyo</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
    </div>
  );
}
