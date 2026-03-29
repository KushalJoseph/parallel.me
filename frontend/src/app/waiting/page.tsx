"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { pollEntry } from "@/app/actions";

const WAIT_TEXTS = [
  "Reading your wavelength...",
  "Searching for your parallel...",
  "Someone is out there..."
];

export default function WaitingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryId = searchParams.get("entryId");
  const [textIndex, setTextIndex] = useState(0);
  const [isMatched, setIsMatched] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    // Cycle text every 2.5s
    const textInterval = setInterval(() => {
      setTextIndex(curr => (curr + 1) % WAIT_TEXTS.length);
    }, 2500);

    // Poll backend every 5s
    let pollInterval: NodeJS.Timeout;
    
    const checkMatch = async () => {
      if (!entryId) return;
      try {
        const data = await pollEntry(entryId);
        if (data.status === "matched" && mounted.current) {
          setIsMatched(true);
          clearInterval(pollInterval);
          
          // Wait for 1.2s visual flash before navigating
          setTimeout(() => {
            if (mounted.current) router.push(`/match?roomId=${data.roomId}`);
          }, 1200);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    
    if (entryId) {
      pollInterval = setInterval(checkMatch, 5000);
      checkMatch(); // Check immediately on mount
    }

    return () => {
      mounted.current = false;
      clearInterval(textInterval);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [router, entryId]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-[100dvh]">
      <div className="relative w-64 h-64 flex items-center justify-center z-10">
        <motion.div
          animate={isMatched ? { rotate: 0 } : { rotate: 360 }}
          transition={isMatched ? { duration: 0.5, type: "spring" } : { duration: 8, ease: "linear", repeat: Infinity }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {/* User shape (solid white) */}
          <motion.div
            animate={isMatched ? { x: -25, scale: 1.15 } : { x: -50, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute shrink-0 w-[72px] h-[72px] rounded-full bg-text-primary shadow-[0_0_20px_rgba(240,235,227,0.4)]"
          />
          {/* Ghost shape (them) */}
          <motion.div
            animate={isMatched 
              ? { x: 25, scale: 1.15, backgroundColor: "rgba(232,168,124,1)", borderColor: "rgba(232,168,124,1)" } // Turns to solid peach
              : { x: 50, scale: 1, backgroundColor: "rgba(20,18,16,0)", borderColor: "rgba(240,235,227,0.3)" }
            }
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute shrink-0 w-[72px] h-[72px] rounded-full border-2 backdrop-blur-sm shadow-[0_0_20px_rgba(232,168,124,0)]"
            style={{ boxShadow: isMatched ? "0 0 20px rgba(232,168,124,0.4)" : undefined }}
          />
        </motion.div>

        {/* Flash effect when matched */}
        <AnimatePresence>
          {isMatched && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute w-32 h-32 bg-accent-warm rounded-full blur-[20px] mix-blend-screen pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-16 h-8 relative flex items-center justify-center z-10 w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!isMatched ? (
            <motion.p
              key={textIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="absolute font-body text-xl md:text-2xl text-text-primary tracking-wide text-center w-full"
            >
              {WAIT_TEXTS[textIndex]}
            </motion.p>
          ) : (
            <motion.p
              key="matched"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute font-display italic text-2xl md:text-3xl text-accent-warm text-center w-full"
            >
              Parallel found.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
