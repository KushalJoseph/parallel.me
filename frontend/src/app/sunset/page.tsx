"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TransitionLayout } from "@/components/TransitionLayout";

export default function SunsetPage() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 0: Initial full black fade, then to shapes
    // Stage 1: Label fades in
    // Stage 2: Poll appears
    const timings = [
      setTimeout(() => setStage(1), 3500),
      setTimeout(() => setStage(2), 5200),
    ];
    return () => timings.forEach(clearTimeout);
  }, []);

  return (
    <TransitionLayout>
      <motion.main 
        initial={{ filter: "blur(40px)", opacity: 0 }}
        animate={{ filter: "blur(0px)", opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="fixed inset-0 flex flex-col items-center justify-center bg-[#070605] overflow-hidden z-50 text-white"
      >
        <div className="flex flex-col items-center text-center px-6 w-full mt-[-10vh]">
          
          {/* Shapes drifting apart */}
          <div className="flex items-center justify-center mb-16 h-16 relative w-32">
            <motion.div
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: -45, opacity: 0.5 }}
              transition={{ duration: 4, ease: "easeOut", delay: 1 }}
              className="absolute w-10 h-10 rounded-full bg-text-primary/70 backdrop-blur-sm shadow-[0_0_15px_rgba(240,235,227,0.2)]"
            />
            <motion.div
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: 45, opacity: 0.4 }}
              transition={{ duration: 4, ease: "easeOut", delay: 1 }}
              className="absolute w-10 h-10 rounded-full bg-accent-warm/70 backdrop-blur-sm mix-blend-screen shadow-[0_0_15px_rgba(232,168,124,0.2)]"
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 15 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="font-display italic text-2xl md:text-3xl text-text-secondary mb-24"
          >
            This parallel has closed.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: stage >= 2 ? 1 : 0, y: stage >= 2 ? 0 : 10 }}
            transition={{ duration: 1 }}
            className={`flex flex-col items-center max-w-lg w-full ${stage >= 2 ? 'pointer-events-auto' : 'pointer-events-none'}`}
          >
            <p className="font-body text-xl text-text-primary mb-10 tracking-wide text-white/90">
              Did you feel understood?
            </p>
            <div className="flex justify-center gap-6 mb-[12vh] w-full">
              <button className="px-10 py-3.5 rounded-full border border-border/60 text-text-secondary hover:text-white hover:border-white hover:bg-surface transition-all font-body text-lg w-32 shadow-sm">
                yes
              </button>
              <button className="px-10 py-3.5 rounded-full border border-border/60 text-text-secondary hover:text-white hover:border-white hover:bg-surface transition-all font-body text-lg w-32 shadow-sm">
                no
              </button>
            </div>

            <Link 
              href="/write"
              className="font-body text-accent/90 hover:text-accent-warm hover:drop-shadow-[0_0_8px_rgba(232,168,124,0.4)] transition-all tracking-wide text-[19px] flex items-center gap-2"
            >
              Write again <span className="font-light text-2xl ml-1">→</span>
            </Link>
          </motion.div>

        </div>
      </motion.main>
    </TransitionLayout>
  );
}
