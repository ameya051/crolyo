"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  return (
    <header className="fixed top-6 inset-x-0 z-50 max-w-6xl mx-auto flex justify-center px-4 pointer-events-none">
      <motion.div
        className="pointer-events-auto flex items-center justify-between bg-surface/80 backdrop-blur-xl border border-border shadow-sm shadow-black/5"
        initial={{ y: -50, opacity: 0 }}
        animate={{
          y: 0,
          opacity: 1,
          width: isScrolled ? "700px" : "1000px",
          padding: isScrolled ? "0.2rem 1.25rem" : "0.2rem 1.7rem",
          borderRadius: "9999px"
        }}
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ maxWidth: "100%" }}
      >
        <div className="flex-1 flex justify-start items-center">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="Crolyo Logo" width={36} height={36} className="w-9 h-9 object-contain" />
            <span className="font-heading text-xl font-bold tracking-tight text-foreground translate-y-[-2px] hidden sm:block">
              Crolyo
            </span>
          </Link>
        </div>


        {/* Mobile hamburger */}
        <div className="flex sm:hidden flex-1 justify-end items-center">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem>
                <Link href="/docs" className="cursor-pointer w-full">Docs</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="#" className="cursor-pointer w-full">Login</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="#" className="cursor-pointer w-full font-medium text-brand">Sign up</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop buttons */}
        <div className="hidden sm:flex flex-1 justify-end items-center gap-3">
          <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </Link>
          <Button variant="ghost" className="text-sm font-medium h-9 px-4">
            Login
          </Button>
          <Button className="text-sm font-medium h-9 px-4 bg-brand text-white hover:bg-brand/90">
            Sign up
          </Button>
        </div>
      </motion.div>
    </header>
  );
}
