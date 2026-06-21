"use client";

import { ModeToggle } from "@/components/ui/mode-toggle";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";
import Link from "next/link";

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  return (
    <header className="fixed top-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <motion.div
        className="pointer-events-auto flex items-center justify-between bg-surface/80 backdrop-blur-xl border border-border shadow-sm shadow-black/5"
        initial={{ y: -50, opacity: 0 }}
        animate={{ 
          y: 0, 
          opacity: 1,
          width: isScrolled ? "700px" : "1000px",
          padding: isScrolled ? "0.6rem 1.5rem" : "1rem 2rem",
          borderRadius: "9999px"
        }}
        transition={{ 
          duration: 0.5, 
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ maxWidth: "100%" }}
      >
        <div className="flex-1 flex justify-start">
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            Crolyo
          </span>
        </div>
        
        <nav className="hidden md:flex items-center justify-center gap-8 text-sm font-semibold text-muted-foreground">
          <Link href="#" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#" className="hover:text-foreground transition-colors">About</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
        </nav>

        <div className="flex-1 flex justify-end">
          <ModeToggle />
        </div>
      </motion.div>
    </header>
  );
}
