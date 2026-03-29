"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function LandingClient() {
  const tagline = "Find the one person who feels exactly what you feel, right now.";
  const words = tagline.split(" ");

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden min-h-[100dvh]">

      <div className="z-10 flex flex-col items-center text-center max-w-lg w-full mt-[-10vh]">
        {/* Wordmark */}
        <motion.h1
          className="font-display italic text-3xl font-medium mb-16 tracking-wide text-text-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          Parallel
        </motion.h1>

        {/* Tagline */}
        <div className="flex flex-wrap justify-center gap-x-[6px] gap-y-1 mb-24 max-w-[340px] md:max-w-md">
          {words.map((word, i) => (
            <motion.span
              key={i}
              className="text-[26px] md:text-[32px] leading-tight text-text-primary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.05 + 0.3,
                duration: 0.4,
                ease: "easeOut",
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          <Link
            href="/how-it-works"
            className="bg-accent hover:bg-accent/90 text-white px-10 py-[18px] rounded-full font-body text-base font-medium tracking-wide transition-colors"
          >
            Begin
          </Link>
        </motion.div>
      </div>

      {/* Blurred Chat Glimpse */}
      <motion.div
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[90%] md:w-full max-w-md h-[30vh] md:h-[35vh] flex flex-col justify-end p-6 gap-4 overflow-hidden pointer-events-none"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.9, delay: 0.6 }}
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 50%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 50%, black 100%)",
        }}
      >
        <div className="w-3/4 max-w-[240px] h-[52px] bg-surface/80 rounded-2xl rounded-tl-sm self-start blur-[1px]" />
        <div className="w-2/3 max-w-[200px] h-[52px] bg-accent/20 rounded-2xl rounded-tr-sm self-end blur-[1px]" />
        <div className="w-5/6 max-w-[280px] h-16 bg-surface/80 rounded-2xl rounded-tl-sm self-start blur-[1px]" />

        {/* Input Bar Mock */}
        <div className="w-full flex justify-center mt-4">
          <div className="w-full h-12 bg-surface rounded-full opacity-50 blur-[1px]" />
        </div>
      </motion.div>
    </main>
  );
}
