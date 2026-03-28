"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    num: "01",
    title: "Write.",
    desc: "Pour it out. No audience. No filter. \nJust you and a blank page.",
    shape: <div className="w-24 h-24 rounded-full bg-surface border border-border/50 flex items-center justify-center shrink-0 mb-8"><div className="w-10 h-10 rounded-full bg-border" /></div>
  },
  {
    num: "02",
    title: "Match.",
    desc: "Our AI finds the one stranger \nfeeling exactly what you feel.",
    shape: <div className="w-24 h-24 flex gap-1 items-center justify-center shrink-0 mb-8"><div className="w-10 h-10 rounded-full bg-accent/40 blur-[2px]" /><div className="w-10 h-10 rounded-full bg-accent/20 blur-[2px]" /></div>
  },
  {
    num: "03",
    title: "Talk.",
    desc: "24 hours. Anonymous. Real. \nThen it's gone forever.",
    shape: <div className="w-24 h-24 overflow-hidden rounded-[1.25rem] bg-surface border border-border flex flex-col items-center justify-end px-3 pt-4 shrink-0 mb-8"><div className="w-full h-[2px] bg-accent/50 max-w-[40px] mb-3" /><div className="w-full h-10 border border-border border-b-0 rounded-t-xl bg-surface relative" /></div>
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
      <div className="font-mono text-accent/80 text-xl tracking-wider mb-5">{step.num}</div>
      <h2 className="font-display italic text-[40px] md:text-5xl mb-6">{step.title}</h2>
      <p className="font-body text-text-secondary whitespace-pre-line text-xl md:text-2xl leading-relaxed max-w-sm">{step.desc}</p>
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
            className="text-text-primary font-body text-xl border-b border-text-secondary/50 pb-2 hover:text-white hover:border-white transition-all flex items-center gap-3"
          >
            Create your account <span className="text-2xl font-light">→</span>
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
