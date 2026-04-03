"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    num: "01",
    title: "Write.",
    desc: "Pour it out. No audience. No filter. \nJust you and a blank page.",
    shape: <div className="w-24 h-24 rounded-full bg-surface/50 border border-border/50 backdrop-blur-md flex items-center justify-center shrink-0 mb-8 shadow-sm flex-none"><motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="w-12 h-12 rounded-full border border-text-secondary/60" /></div>
  },
  {
    num: "02",
    title: "Match.",
    desc: "Our AI finds the one stranger \nfeeling exactly what you feel.",
    shape: <div className="w-24 h-24 flex items-center justify-center shrink-0 mb-8 relative flex-none"><motion.div animate={{ x: [-12, 12, -12], scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="absolute w-12 h-12 rounded-full bg-accent/50 blur-[2px] shadow-lg" /><motion.div animate={{ x: [12, -12, 12], scale: [1.1, 1, 1.1], opacity: [0.9, 0.6, 0.9] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }} className="absolute w-12 h-12 rounded-full bg-accent-warm/50 blur-[2px] shadow-lg" /></div>
  },
  {
    num: "03",
    title: "Talk.",
    desc: "24 hours. Anonymous. Real. \nThen it's gone forever.",
    shape: <div className="w-24 h-24 overflow-hidden rounded-[1.25rem] bg-surface/50 backdrop-blur-md flex-none border border-border/50 flex flex-col items-center justify-end px-3 pt-4 shrink-0 mb-8 shadow-sm"><motion.div animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -6], scaleX: [0.7, 1, 1, 0.8] }} transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", times: [0, 0.2, 0.8, 1] }} className="w-full h-1 rounded-full bg-accent/70 max-w-[32px] mb-4 origin-center" /><div className="w-full h-[38px] border border-border/60 border-b-0 rounded-t-xl bg-surface shadow-[0_-4px_12px_rgba(0,0,0,0.02)] relative" /></div>
  }
];

function StepCard({ step }: { step: typeof steps[0] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 20%"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.95, 1, 1, 0.95]);

  return (
    <motion.div 
      ref={ref}
      style={{ opacity, scale }}
      className="min-h-[100dvh] flex flex-col items-center justify-center snap-center text-center px-6 relative"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true, margin: "-100px" }}
      >
        {step.shape}
      </motion.div>
      <div className="font-mono text-accent text-[11px] font-semibold uppercase tracking-[0.4em] mb-6">{step.num}</div>
      <h2 className="font-display italic text-7xl md:text-[90px] mb-8 leading-none tracking-tight text-text-primary">{step.title}</h2>
      <p className="font-body text-text-secondary whitespace-pre-line text-[22px] md:text-[26px] leading-relaxed max-w-sm">{step.desc}</p>
    </motion.div>
  );
}

export default function HowItWorks() {
  return (
    <main className="flex-1 text-text-primary w-full h-[100dvh] overflow-y-auto snap-y snap-mandatory hide-scrollbar relative scroll-smooth">
      <div className="fixed top-10 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <h1 className="font-display italic text-2xl text-text-secondary/50 font-medium">Parallel</h1>
      </div>
      
      {steps.map((step) => (
        <StepCard key={step.num} step={step} />
      ))}

      <div className="min-h-[60vh] flex flex-col items-center justify-start snap-start pt-32 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <Link 
            href="/auth"
            className="group relative bg-gradient-to-r from-accent to-accent-warm text-white px-10 md:px-14 py-5 rounded-full font-body text-xl font-medium tracking-wider transition-all shadow-[0_0_40px_rgba(200,68,42,0.4)] hover:shadow-[0_0_60px_rgba(226,79,68,0.6)] border border-white/20 active:scale-[0.97] overflow-hidden flex items-center gap-4"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10">Create your account</span>
            <span className="text-2xl font-light opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10">→</span>
          </Link>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </main>
  );
}
