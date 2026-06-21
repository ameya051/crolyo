"use client";

import { motion } from "motion/react";

function WorkflowAnimation() {
  return (
    <div className="relative w-full h-[450px] sm:h-[550px] bg-surface/30 border border-border/50 rounded-3xl overflow-hidden flex items-center justify-center p-4 sm:p-8">
      {/* Background Grid */}
      <div className="absolute inset-0 dot-bg opacity-30" />
      
      {/* Connecting animated line */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[60%] sm:h-[70%] bg-border/40 z-0">
        <motion.div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-16 bg-gradient-to-b from-transparent via-brand to-transparent rounded-full blur-[1px]"
          animate={{ top: ["-10%", "110%", "110%", "-10%", "-10%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear", times: [0, 0.4, 0.5, 0.9, 1] }}
        />
      </div>

      <div className="relative w-full max-w-sm flex flex-col justify-between h-full py-4 sm:py-8 z-10">
        
        {/* Browser Mockup (Top) */}
        <motion.div 
          className="bg-background border border-border/60 shadow-xl rounded-2xl overflow-hidden self-end w-64 sm:w-72"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          {/* Browser Header */}
          <div className="bg-surface-light/50 border-b border-border/40 px-3 py-2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive/60" />
            <div className="w-2 h-2 rounded-full bg-brand/60" />
            <div className="w-2 h-2 rounded-full bg-slack-green/60" />
            <div className="ml-2 bg-background border border-border/40 rounded-md h-4 w-24 flex-1 max-w-[120px]" />
          </div>
          {/* Browser Content */}
          <div className="p-4 bg-surface/20 min-h-[120px] flex flex-col justify-end">
            <motion.div 
              className="bg-brand text-white text-[13px] px-3.5 py-2 rounded-2xl rounded-br-sm ml-auto w-fit mb-3 shadow-sm origin-bottom-right"
              animate={{ opacity: [0, 1, 1, 0, 0], scale: [0.9, 1, 1, 0.9, 0.9] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.05, 0.85, 0.9, 1] }}
            >
              Does this work with Next.js?
            </motion.div>
            <motion.div 
              className="bg-surface text-foreground border border-border/60 shadow-sm text-[13px] px-3.5 py-2 rounded-2xl rounded-bl-sm w-fit origin-bottom-left"
              animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.9, 0.9, 1, 1, 0.9] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.55, 0.6, 0.85, 0.9] }}
            >
              Yes! Native support.
            </motion.div>
          </div>
        </motion.div>

        {/* Slack Mockup (Bottom) */}
        <motion.div 
          className="bg-[#1a1d21] border border-border/40 shadow-2xl rounded-2xl overflow-hidden self-start w-64 sm:w-72"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
        >
          {/* Slack Header */}
          <div className="bg-[#222529] border-b border-[#3f4144]/50 px-4 py-2.5 flex items-center gap-2">
            <span className="text-[#d1d2d3] font-bold text-sm tracking-wide">#support</span>
          </div>
          {/* Slack Content */}
          <div className="p-4 bg-[#1a1d21]">
            <div className="flex gap-3 mb-3">
              <div className="w-8 h-8 rounded bg-brand flex-shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-sm">C</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#d1d2d3] font-bold text-[13px]">Crolyo</span>
                  <span className="bg-[#2eb67d] text-white text-[9px] px-1 rounded uppercase tracking-wider font-bold">App</span>
                </div>
                <motion.div 
                  className="text-[#d1d2d3] text-[13px] mt-0.5 leading-snug"
                  animate={{ opacity: [0, 0, 1, 1, 0] }}
                  transition={{ duration: 6, repeat: Infinity, times: [0, 0.15, 0.2, 0.85, 0.9] }}
                >
                  <span className="text-[#ababad]">Visitor:</span> Does this work with Next.js?
                </motion.div>
              </div>
            </div>
            
            {/* Thread Reply */}
            <motion.div 
              className="flex gap-2.5 ml-11 relative before:absolute before:left-[-15px] before:top-[-10px] before:w-[2px] before:h-[20px] before:bg-[#3f4144] before:rounded-full"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 6, repeat: Infinity, times: [0, 0.45, 0.5, 0.85, 0.9] }}
            >
              <div className="w-6 h-6 rounded bg-indigo-500 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">You</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#d1d2d3] font-bold text-[13px]">You</span>
                </div>
                <div className="text-[#d1d2d3] text-[13px] mt-0.5 leading-snug">
                  Yes! Native support.
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default function WorkflowSection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Left Content */}
          <div className="order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 mb-6">
                <span className="text-xs font-semibold text-brand uppercase tracking-wider">The Workflow</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Stop logging into helpdesks. <br className="hidden sm:block" />
                <span className="text-muted-foreground">Start replying from Slack.</span>
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                You're coding, and a potential customer has a question on your pricing page. By the time you get the email, log into another dashboard, and reply... they've already left.
              </p>
              
              <ul className="space-y-4">
                {[
                  "Receive visitor messages instantly in your #support channel",
                  "Reply in a Slack thread—it routes back to the visitor",
                  "Close deals in seconds without breaking your flow"
                ].map((feature, i) => (
                  <motion.li 
                    key={i} 
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + (i * 0.1), duration: 0.5 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-foreground font-medium">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Right Content - Animation */}
          <div className="order-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <WorkflowAnimation />
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
