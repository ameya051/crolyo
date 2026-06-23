"use client";

import Link from "next/link";
import Image from "next/image";

import { SiteSwitcher } from "@/components/dashboard/site-switcher";
import { UserMenu, type DashboardUser } from "@/components/dashboard/user-menu";

export function Topbar({ user }: { user: DashboardUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <Link
        href="/overview"
        className="flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src="/logo.png"
          alt="Crolyo"
          width={32}
          height={32}
          className="size-8 object-contain"
        />
        <span className="hidden font-heading text-lg font-bold tracking-tight text-foreground sm:inline">
          Crolyo
        </span>
      </Link>

      <SiteSwitcher />

      <div className="ml-auto flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
