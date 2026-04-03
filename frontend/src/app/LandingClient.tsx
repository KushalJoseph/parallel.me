"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LandingClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/write");
    }
  }, [user, loading, router]);

  const tagline = "Find the one person who feels exactly what you feel, right now.";
  const words = tagline.split(" ");

  if (loading) return null; // or a loading state

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden min-h-[100dvh]">

      <div className="z-10 flex flex-col items-center text-center max-w-lg w-full mt-[-10vh]">
        {/* Wordmark (Logo Image) */}
        <motion.div
           className="mb-14 h-40 md:h-56 flex justify-center w-full opacity-90"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 0.3 }}
        >
          <img src="/logo.png" alt="Parallel" className="h-full w-auto object-contain pointer-events-none drop-shadow-sm" />
        </motion.div>

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
            className="group relative bg-gradient-to-r from-accent to-accent-warm text-white px-16 py-5 rounded-full font-body text-xl font-medium tracking-wider transition-all shadow-[0_0_40px_rgba(200,68,42,0.4)] hover:shadow-[0_0_60px_rgba(226,79,68,0.6)] border border-white/20 active:scale-[0.97] overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            Begin
          </Link>
        </motion.div>
      </div>

      {/* Infinite Ghost Marquee */}
      <div
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-[0.15] blur-[2px]"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
      >
        <motion.div
           animate={{ y: ["0%", "-50%"] }}
           transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
           className="flex flex-col gap-12 items-center italic font-display text-2xl md:text-3xl text-text-primary px-8 text-center min-w-max"
        >
          {Array(8).fill([
            "I'm terrified of failing again...", 
            "Today was unexpectedly quiet.", 
            "Why does it feel like I'm falling behind?", 
            "I finally feel like I belong here.", 
            "Just wishing I had someone to tell this to."
          ]).flat().map((text, i) => (
             <span key={i} className="whitespace-nowrap">{text}</span>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
