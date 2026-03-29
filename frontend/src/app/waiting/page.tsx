"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { pollEntry } from "@/app/actions";

const WAIT_TEXTS = [
  "Reading your wavelength...",
  "Searching for your parallel...",
  "Someone is out there...",
];

export default function WaitingPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  const searchParams = useSearchParams();
  const entryId = searchParams.get("entryId");
  const [textIndex, setTextIndex] = useState(0);
  const [isMatched, setIsMatched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Cycle text every 2.5s — independent of polling
    const textInterval = setInterval(() => {
      setTextIndex((curr) => (curr + 1) % WAIT_TEXTS.length);
    }, 2500);

    let pollInterval: NodeJS.Timeout;

    const checkMatch = async () => {
      if (cancelled) return;
      try {
        const data = await pollEntry(entryId!);
        if (data.status === "matched" && !cancelled) {
          setIsMatched(true);
          clearInterval(pollInterval);
          // Wait for the visual flash to play before navigating
          setTimeout(() => {
            if (!cancelled)
              routerRef.current.push(`/match?roomId=${data.roomId}`);
          }, 1200);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    if (entryId) {
      // Set the interval first so pollInterval is defined before checkMatch's
      // await resolves and tries to clearInterval it on an immediate match.
      pollInterval = setInterval(checkMatch, 5000);
      checkMatch();
    }

    return () => {
      cancelled = true;
      clearInterval(textInterval);
      clearInterval(pollInterval);
    };
  }, [entryId]); // router intentionally omitted — accessed via routerRef

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-[100dvh] relative">
      {/* Brand Logo Header */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 h-16 md:h-24 opacity-70 pointer-events-none z-20">
        <img src="/logo.png" alt="Parallel" className="h-full w-auto object-contain" />
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push("/write")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors font-mono text-sm"
        aria-label="Back to write"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        back
      </button>

      <div className="relative w-64 h-64 flex items-center justify-center z-10">
        <motion.div
          animate={isMatched ? { rotate: 0 } : { rotate: 360 }}
          transition={
            isMatched
              ? { duration: 0.5, type: "spring" }
              : { duration: 8, ease: "linear", repeat: Infinity }
          }
          className="absolute inset-0 flex items-center justify-center"
        >
          {/* User shape (solid white) */}
          <motion.div
            animate={isMatched ? { x: -25, scale: 1.15 } : { x: -50, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute shrink-0 w-[72px] h-[72px] rounded-full bg-text-primary shadow-[0_0_80px_rgba(226,79,68,0.7)]"
          />
          {/* Ghost shape (them) */}
          <motion.div
            animate={isMatched 
              ? { x: 25, scale: 1.15, backgroundColor: "rgba(244,147,66,1)", borderColor: "rgba(244,147,66,1)" } // Turns to solid peach
              : { x: 50, scale: 1, backgroundColor: "rgba(20,18,16,0)", borderColor: "rgba(44,33,28,0.4)" }
            }
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute shrink-0 w-[72px] h-[72px] rounded-full border-2 backdrop-blur-sm shadow-[0_0_40px_rgba(244,147,66,0)]"
            style={{ boxShadow: isMatched ? "0 0 100px rgba(244,147,66,0.9)" : undefined }}
          />
        </motion.div>

        {/* Flash bloom when matched */}
        <AnimatePresence>
          {isMatched && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0.9 }}
                animate={{ scale: 4.5, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="absolute w-32 h-32 bg-accent-warm rounded-full blur-[40px] mix-blend-screen pointer-events-none"
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
