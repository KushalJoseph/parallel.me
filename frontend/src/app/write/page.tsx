"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";

export default function WritePage() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = text.trim() === "" ? 0 : words.length;
  const isReady = wordCount >= 50;

  // Formatting date ex: Saturday, March 28
  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    // Auto-focus on mount
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReady) router.push("/waiting");
  };

  return (
    <main className="flex-1 flex flex-col px-6 md:px-12 py-8 min-h-[100dvh] relative max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center z-10 opacity-60 hover:opacity-100 transition-opacity">
        <div className="font-mono text-sm text-text-secondary">{dateString}</div>
        <button className="p-2 text-text-secondary hover:text-text-primary transition-colors">
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </header>

      {/* Write Area */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col mt-8 z-10 relative">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full bg-transparent resize-none outline-none border-none font-body text-2xl md:text-3xl leading-relaxed text-text-primary placeholder:text-text-secondary/30"
            placeholder="What's sitting with you right now?"
            spellCheck="false"
          />
        </div>

        {/* Footer actions */}
        <div className="pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="w-full sm:w-1/2 h-1 bg-surface rounded-full overflow-hidden relative">
            <motion.div 
              className={`absolute top-0 left-0 h-full ${isReady ? 'bg-accent-warm' : 'bg-text-secondary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((wordCount / 50) * 100, 100)}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
            {/* The progress bar pulses once exactly when it hits 50, handled by CSS or framer motion. Let's do a simple key trick */}
            <AnimatePresence>
              {isReady && (
                <motion.div
                  initial={{ opacity: 0.8, scaleX: 1 }}
                  animate={{ opacity: 0, scaleX: 1.05 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 bg-accent-warm rounded-full"
                />
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isReady && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                type="submit"
                className="whitespace-nowrap bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-full font-body font-medium transition-colors ml-auto shadow-[0_0_20px_rgba(200,68,42,0.2)]"
              >
                Find my parallel <span className="ml-1">→</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>
    </main>
  );
}
