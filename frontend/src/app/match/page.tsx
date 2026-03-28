"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

const ICEBREAKER = "What's the heaviest thing you're carrying today that nobody can see?";
const WORDS = ICEBREAKER.split(" ");

export default function MatchRevealPage() {
  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 59, s: 59 });
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    // Show CTA after the words finish animating (simulated as ~5 seconds)
    const ctaWait = setTimeout(() => setShowCTA(true), 5000);
    
    // Simple mock countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let {h, m, s} = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        return {h, m, s};
      });
    }, 1000);

    return () => {
      clearTimeout(ctaWait);
      clearInterval(timer);
    };
  }, []);

  const formatTime = (t: {h:number, m:number, s:number}) => {
    return `${t.h.toString().padStart(2, '0')}:${t.m.toString().padStart(2, '0')}:${t.s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 min-h-[100dvh]">
      <div className="z-10 flex flex-col items-center w-full max-w-2xl mt-[-5vh]">
        
        {/* The two merged shapes */}
        <motion.div 
          initial={{ y: 30, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="flex items-center justify-center mb-10"
        >
          <div className="w-[72px] h-[72px] rounded-full bg-text-primary shadow-[0_0_20px_rgba(240,235,227,0.4)] transform -translate-x-[25px] scale-110 z-10" />
          <div className="w-[72px] h-[72px] rounded-full bg-accent-warm shadow-[0_0_20px_rgba(232,168,124,0.4)] transform translate-x-[25px] scale-110" />
        </motion.div>

        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="font-mono text-xs md:text-sm tracking-[0.25em] text-accent uppercase mb-16"
        >
          Your Parallel has arrived
        </motion.p>

        {/* Icebreaker */}
        <div className="flex flex-wrap justify-center gap-[0.4rem] gap-y-3 mb-20 px-2 lg:px-8">
          {WORDS.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                delay: 1.5 + (i * 0.25), // poetic typewriter reveal
                duration: 0.8,
                ease: "easeOut"
              }}
              className="font-display italic text-[36px] md:text-5xl text-text-primary text-center leading-tight"
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5, duration: 1 }}
          className="font-mono text-xl md:text-[26px] tracking-widest text-text-secondary/70 mb-16"
        >
          {formatTime(timeLeft)}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: showCTA ? 1 : 0, y: showCTA ? 0 : 15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`transition-opacity ${showCTA ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          <Link 
            href="/chat/mock-room-id"
            className="group flex flex-col items-center gap-3 text-white transition-opacity"
          >
            <div className="text-xl md:text-2xl font-body border-b border-text-secondary pb-2 group-hover:border-white transition-colors duration-300">
              Enter the conversation <span className="ml-3 font-light text-2xl">→</span>
            </div>
          </Link>
        </motion.div>

      </div>
    </main>
  );
}
