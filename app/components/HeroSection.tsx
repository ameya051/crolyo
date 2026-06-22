"use client";

import { Button } from "@/components/ui/button";
import { motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

/* ─── Animated chat widget preview ─── */
function ChatPreview() {
  const messages = [
    { id: 1, sender: "visitor", text: "Hey! Do you offer a free trial?", delay: 0.6 },
    { id: 2, sender: "agent", text: "Absolutely — 14 days, no card needed 🎉", delay: 1.8 },
    { id: 3, sender: "visitor", text: "Sweet, signing up now!", delay: 3.0 },
  ];

  return (
    <motion.div
      className="relative w-full max-w-[350px] mx-auto lg:mx-0"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Widget shell */}
      <div className="rounded-2xl border border-border bg-surface/80 backdrop-blur-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface-light">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-gradient-end flex items-center justify-center text-white text-sm font-semibold">
              C
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-slack-green border-2 border-surface" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Crolyo Support</p>
            <p className="text-xs text-muted-foreground">Replies via Slack · Usually instant</p>
          </div>
        </div>

        {/* Messages */}
        <div className="px-4 py-5 space-y-3 min-h-[200px]">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              className={`flex ${msg.sender === "visitor" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, x: msg.sender === "visitor" ? 20 : -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: msg.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.sender === "visitor"
                  ? "bg-brand text-white rounded-br-md"
                  : "bg-surface-light text-foreground border border-border/50 rounded-bl-md"
                  }`}
              >
                {msg.sender === "agent" && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <SlackIcon className="w-3 h-3" />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">via Slack</span>
                  </div>
                )}
                {msg.text}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 4.2, duration: 0.3 }}
          >
            <div className="bg-surface-light border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-brand"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-brand"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-brand"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          </motion.div>
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-light border border-border/50">
            <span className="text-sm text-muted-foreground flex-1">Type a message…</span>
            <div className="w-7 h-7 rounded-lg bg-brand/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Slack badge */}
      <motion.div
        className="absolute -bottom-5 -right-5 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border shadow-lg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <SlackIcon className="w-4 h-4" />
        <span className="text-xs text-muted-foreground font-medium">Connected to #support</span>
        <div className="w-1.5 h-1.5 rounded-full bg-slack-green animate-pulse" />
      </motion.div>
    </motion.div>
  );
}

/* ─── Slack icon ─── */
function SlackIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.527 2.527 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.27a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

/* ─── Floating orbs ─── */
function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
      <div className="relative w-full max-w-6xl h-full">
        {/* Primary orb */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      {/* Secondary orb */}
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -30, 20, 0],
          y: [0, 30, -20, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      {/* Small accent orb */}
      <motion.div
        className="absolute top-1/3 right-1/3 w-[200px] h-[200px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      </div>
    </div>
  );
}



/* ─── Stat badges ─── */
function StatBadges() {
  const stats = [
    { label: "Setup Time", value: "< 2 min", icon: "⚡" },
    { label: "Widget Size", value: "< 100KB", icon: "📦" },
    { label: "Latency", value: "Real-time", icon: "🔄" },
  ];

  return (
    <motion.div
      className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          className="flex items-center gap-1 px-4 py-2 rounded-full bg-muted/50 border border-border backdrop-blur-sm hover:bg-brand/10 hover:border-brand/20 transition-colors"
          whileHover={{
            scale: 1.04,
          }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-sm">{stat.icon}</span>
          <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
          <span className="text-xs text-foreground font-semibold">{stat.value}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Main Hero Section ─── */
export default function HeroSection() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden dot-bg">
      <BackgroundOrbs />

      {/* Top gradient line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

      <div className="relative z-10 max-w-6xl mx-auto min-h-80 mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-40">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left column — Copy */}
          <div className="flex flex-col items-start text-left">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slack-green animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground tracking-wide">Slack-Native Support</span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight text-foreground"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              Support visitors{" "}
              <br className="hidden sm:block" />
              <span className="whitespace-nowrap">
                <span className="relative inline-block">
                  <span className="relative z-10">directly</span>
                  <svg
                    className="absolute -bottom-1 sm:-bottom-2 left-0 w-full h-3 sm:h-4 text-brand -z-10"
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <motion.path
                      d="M 2,15 Q 50,5 98,12"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                </span>{" "}
                from Slack
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="mt-6 text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              Drop a lightweight chat widget on your site. Every message lands in your Slack channel — reply right there, in real-time.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-start sm:items-center justify-start w-full sm:w-auto gap-4 mt-8 sm:mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto px-8 py-3.5 h-auto rounded-xl text-sm font-semibold">
                  <span className="flex items-center justify-center gap-2">
                    Get Started Free
                    <svg className="w-4 h-4 transition-transform group-hover/button:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto px-8 py-3.5 h-auto rounded-xl text-sm font-medium">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                    </svg>
                    Watch Demo
                  </span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Stat badges */}
            {/* <StatBadges /> */}
          </div>

          {/* Right column — Chat preview */}
          <div className="relative flex items-center justify-center lg:justify-end">
            {/* Glow behind the widget */}
            <div className="absolute inset-0 flex items-center justify-center lg:justify-end pointer-events-none">
              <div className="w-[340px] h-[340px] rounded-full bg-brand/10 blur-[100px] animate-pulse-glow" />
            </div>
            <ChatPreview />
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}
