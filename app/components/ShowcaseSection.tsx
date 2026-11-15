"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { eyebrow as eyebrowClass, monoLabel, sectionHeading } from "@/app/components/styles";

export type ShowcaseTab = {
  title: string;
  description: string;
  panel: ReactNode;
};

type ShowcaseSectionProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  tabs: ShowcaseTab[];
};

/**
 * Numbered feature section: tabs on the left, the active tab's mockup on the
 * right. On desktop the active tab auto-advances when its progress bar fills
 * (see .showcase-progress in globals.css); hovering the section pauses it.
 * Below lg the bar is display:none, so nothing animates and tabs are manual,
 * with the panel shown inline under the open tab.
 */
export default function ShowcaseSection({ id, eyebrow, heading, tabs }: ShowcaseSectionProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  return (
    <section
      id={id}
      className="my-10 scroll-mt-24 border-y border-border md:my-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-6 md:gap-4 md:px-6">
        <p className={eyebrowClass}>{eyebrow}</p>
        <h2 className={`${sectionHeading} max-w-2xl`}>{heading}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">
        <div className="flex min-w-0 flex-col lg:border-r lg:border-border">
          {tabs.map((tab, i) => {
            const isActive = i === active;
            return (
              <div key={tab.title} className="border-b border-border last:border-b-0 lg:flex-1">
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => setActive(i)}
                  className={`relative flex w-full cursor-pointer flex-col gap-2 p-4 text-left transition-colors md:p-6 lg:h-full ${
                    isActive ? "bg-background" : "bg-muted/40 hover:bg-background"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-y-0 left-0 hidden w-1 lg:block">
                      <span
                        key={active}
                        className="showcase-progress block h-full w-full bg-brand"
                        style={{ animationPlayState: paused ? "paused" : "running" }}
                        onAnimationEnd={() => setActive((active + 1) % tabs.length)}
                      />
                    </span>
                  )}
                  <span className={monoLabel}>{tab.title}</span>
                  <span className={`text-base text-muted-foreground ${isActive ? "" : "hidden lg:block"}`}>
                    {tab.description}
                  </span>
                </button>
                {isActive && (
                  <div className="flex min-w-0 items-center justify-center border-t border-border bg-muted/40 p-6 lg:hidden">
                    {tab.panel}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden min-h-[440px] min-w-0 items-center justify-center bg-muted/40 p-10 lg:flex">
          <motion.div
            key={active}
            className="flex w-full items-center justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {tabs[active].panel}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
