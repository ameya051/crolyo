"use client";

import { motion } from "motion/react";

function ZeroBloatSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-light/40 to-surface/40">
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full bg-brand/20 blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="relative w-24 h-24 rounded-2xl bg-surface border border-border/80 shadow-sm flex flex-col items-center justify-center gap-1 overflow-hidden"
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Subtle scanning line */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-1 bg-brand/40 blur-[1px]"
            animate={{ y: [0, 96, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-foreground font-bold text-sm tracking-tight mt-1">98 KB</span>
        </motion.div>
      </div>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-light/40 to-surface/40 p-6">
      <div className="w-full max-w-sm rounded-xl bg-surface border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-light/50">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-brand/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-slack-green/60" />
        </div>
        <div className="p-5 font-mono text-[12px] sm:text-[13px] leading-relaxed overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 5 }}
            className="text-muted-foreground mb-3"
          >
            <span className="text-brand/50">{"<!--"}</span> Drop this before {"</body>"} <span className="text-brand/50">{"-->"}</span>
          </motion.div>
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.8, duration: 1.5, ease: "easeOut", repeat: Infinity, repeatDelay: 5 }}
            className="overflow-hidden whitespace-nowrap border-l-2 border-brand/30 pl-3"
          >
            <span className="text-brand font-medium">{"<script"}</span>
            <br />
            <span className="pl-4 text-slack-green">src</span>
            <span className="text-foreground">=</span>
            <span className="text-muted-foreground">"https://crolyo.com/widget.js"</span>
            <br />
            <span className="pl-4 text-slack-green">data-site</span>
            <span className="text-foreground">=</span>
            <span className="text-muted-foreground">"site_abc123"</span>
            <br />
            <span className="text-brand font-medium">{"></script>"}</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-surface-light/40 to-surface/40 px-8 pt-8">
      <div className="w-full h-[180px] relative flex items-end justify-between gap-1.5 sm:gap-3 pb-8">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 border-b border-border/40" />
        <div className="absolute top-1/2 left-0 right-0 border-b border-border/40 border-dashed" />
        
        {/* Bars */}
        {[20, 35, 25, 60, 45, 80, 100].map((height, i) => (
          <motion.div
            key={i}
            className="w-full relative z-10"
            initial={{ height: 0 }}
            whileInView={{ height: `${height}%` }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={`absolute inset-0 rounded-t-sm sm:rounded-t-md ${i === 6 ? 'bg-brand' : 'bg-brand/20'}`} />
            {i === 6 && (
              <motion.div
                className="absolute -top-1 left-0 right-0 h-full bg-brand blur-md opacity-30"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>
        ))}

        {/* Floating conversion badge */}
        <motion.div
          className="absolute top-4 right-4 z-20 bg-surface/90 backdrop-blur-md border border-border px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2.5"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slack-green" />
            <span className="absolute w-2.5 h-2.5 rounded-full bg-slack-green animate-ping opacity-75" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-wide">+32% Conversion</span>
        </motion.div>
      </div>
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-light/40 to-surface/40 overflow-hidden">
      {/* Background circles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-border/30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-border/50" />
      
      <motion.div 
        className="relative w-[150px] h-[300px] rounded-[2.5rem] border-[6px] border-surface bg-background shadow-2xl flex flex-col z-10"
        initial={{ y: 20, rotate: -2 }}
        whileInView={{ y: 0, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, type: "spring" }}
      >
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-5 bg-surface rounded-b-2xl mx-8 z-10" />
        
        {/* Content Skeleton */}
        <div className="flex-1 p-4 pt-8 space-y-4">
          <div className="space-y-2.5">
            <div className="h-2 w-1/2 bg-surface-light rounded-full" />
            <div className="h-2 w-3/4 bg-surface-light rounded-full" />
          </div>
          <div className="h-32 w-full bg-surface-light rounded-2xl" />
        </div>

        {/* Animated Slack Notification */}
        <motion.div
          className="absolute top-12 left-2 right-2 bg-surface/95 backdrop-blur-xl border border-border/80 shadow-lg rounded-2xl p-2.5 flex items-start gap-2.5"
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          whileInView={{ y: 0, opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.5,
            delay: 0.8,
            type: "spring",
            stiffness: 150,
            damping: 15,
          }}
        >
          <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
             {/* Tiny slack-like icon shapes */}
             <div className="absolute w-1.5 h-1.5 rounded-full bg-[#E01E5A] top-1 left-1" />
             <div className="absolute w-1.5 h-1.5 rounded-full bg-[#36C5F0] top-1 right-1" />
             <div className="absolute w-1.5 h-1.5 rounded-full bg-[#2EB67D] bottom-1 right-1" />
             <div className="absolute w-1.5 h-1.5 rounded-full bg-[#ECB22E] bottom-1 left-1" />
          </div>
          <div className="space-y-1.5 flex-1 pt-0.5">
            <div className="h-1.5 w-12 bg-foreground/30 rounded-full" />
            <div className="h-1.5 w-full bg-foreground/15 rounded-full" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function BentoSection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden dot-bg">
      {/* Background Gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[400px] bg-brand/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <motion.div 
          className="mb-16 md:mb-24 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 leading-tight">
            Everything you need. <br />
            <span className="text-muted-foreground">Nothing to slow you down.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Built for indie hackers and early-stage founders who want to close deals, not manage complex helpdesks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 auto-rows-[340px]">
          {/* Card 1: Zero Bloat */}
          <motion.div 
            className="group relative flex flex-col rounded-[2rem] border border-border/60 bg-surface/40 hover:bg-surface/60 transition-colors overflow-hidden md:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex-1 relative overflow-hidden rounded-t-[2rem]">
              <ZeroBloatSkeleton />
            </div>
            <div className="p-6 sm:p-8 bg-surface/50 backdrop-blur-sm border-t border-border/40 z-10">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Zero Bloat</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Under 100KB payload. Keep your Lighthouse score perfect and your conversion rates high.
              </p>
            </div>
          </motion.div>

          {/* Card 2: 2-Minute Setup */}
          <motion.div 
            className="group relative flex flex-col rounded-[2rem] border border-border/60 bg-surface/40 hover:bg-surface/60 transition-colors overflow-hidden md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex-1 relative overflow-hidden rounded-t-[2rem]">
              <SetupSkeleton />
            </div>
            <div className="p-6 sm:p-8 bg-surface/50 backdrop-blur-sm border-t border-border/40 z-10">
              <h3 className="text-lg font-semibold mb-2 text-foreground">2-Minute Setup</h3>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Copy, paste, done. No complex routing rules or AI to train. Just an instant connection to your website visitors.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Support is Sales */}
          <motion.div 
            className="group relative flex flex-col rounded-[2rem] border border-border/60 bg-surface/40 hover:bg-surface/60 transition-colors overflow-hidden md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex-1 relative overflow-hidden rounded-t-[2rem]">
              <SalesSkeleton />
            </div>
            <div className="p-6 sm:p-8 bg-surface/50 backdrop-blur-sm border-t border-border/40 z-10">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Support is Sales</h3>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                Answer objections while users are actively holding their credit card on your checkout page. Fast replies equal trust and more MRR.
              </p>
            </div>
          </motion.div>

          {/* Card 4: Mobile Ready */}
          <motion.div 
            className="group relative flex flex-col rounded-[2rem] border border-border/60 bg-surface/40 hover:bg-surface/60 transition-colors overflow-hidden md:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex-1 relative overflow-hidden rounded-t-[2rem]">
              <MobileSkeleton />
            </div>
            <div className="p-6 sm:p-8 bg-surface/50 backdrop-blur-sm border-t border-border/40 z-10">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Mobile Ready</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Reply from the Slack mobile app while walking your dog. Your customers get answers.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
