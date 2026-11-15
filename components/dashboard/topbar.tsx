"use client";

import Link from "next/link";
import Image from "next/image";

import { SiteSwitcher } from "@/components/dashboard/site-switcher";
import { useSites } from "@/components/dashboard/sites-provider";
import { UserMenu, type DashboardUser } from "@/components/dashboard/user-menu";

export function Topbar({ user }: { user: DashboardUser }) {
  const { sites, isLoading } = useSites();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      {/* Same ruled column as <main> in DashboardShell, so the side rules run unbroken. */}
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 border-x border-border px-4 sm:px-6 lg:px-8">
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
        <span className="hidden text-lg font-semibold tracking-tight text-foreground sm:inline">
          Crolyo
        </span>
      </Link>

      {isLoading ? <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" /> : <SiteSwitcher sites={sites} />}

      <div className="ml-auto flex items-center gap-2">
        <UserMenu user={user} />
      </div>
      </div>
    </header>
  );
}
