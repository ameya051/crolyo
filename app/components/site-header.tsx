"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import Image from "next/image";

const navLink =
  "rounded-lg px-3 py-1 font-mono text-sm font-semibold uppercase text-foreground transition-colors hover:bg-muted hover:text-brand";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center hover:opacity-70">
          <Image src="/logo.png" alt="Crolyo Logo" width={32} height={32} className="size-8 object-contain" />
          <span className="text-lg font-semibold tracking-tight text-foreground">Crolyo</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <Link href="/docs" className={navLink}>
            Docs
          </Link>
        </nav>
      </div>

      {/* Mobile menu */}
      <div className="flex items-center sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon", className: "h-9 w-9" })}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
            <span className="sr-only">Toggle menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem>
              <Link href="/docs" className="w-full cursor-pointer">Docs</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/signin" className="w-full cursor-pointer">Log in</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/signup" className="w-full cursor-pointer font-medium">Sign up</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop actions */}
      <div className="hidden items-center gap-2 sm:flex">
        <Link href="/signin" className={buttonVariants({ variant: "outline", className: "px-3" })}>
          Log in
        </Link>
        <Link href="/signup" className={buttonVariants({ className: "px-3" })}>
          Sign up
        </Link>
      </div>
    </header>
  );
}
