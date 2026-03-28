"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function TransitionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Emotion moments have a lift animation instead of horizontal slide
  const isEmotionalMoment = pathname === "/match" || pathname === "/sunset";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={isEmotionalMoment ? { opacity: 0, y: 20 } : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={isEmotionalMoment ? { opacity: 0, y: -20 } : { opacity: 0, x: -20 }}
        transition={{
          duration: isEmotionalMoment ? 0.6 : 0.4,
          ease: "easeOut"
        }}
        className="flex-1 flex flex-col w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
