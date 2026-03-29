"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { submitEntry, getUser } from "@/app/actions";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  picture: string | null;
};

export default function WritePage() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = text.trim() === "" ? 0 : words.length;
  const isReady = text.length >= 10;

  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    getUser().then(setUser);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await submitEntry(text);

      if (data.status === "matched") {
        router.push(`/match?roomId=${data.roomId}`);
      } else {
        router.push(`/waiting?entryId=${data.entryId}`);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      alert("Something went wrong. Please try again.");
    }
  };

  const userInitial = (user?.name || user?.email || "?")[0].toUpperCase();

  return (
    <main className="flex-1 flex flex-col px-6 md:px-12 py-8 min-h-[100dvh] relative max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="relative z-30 flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
        <div className="font-mono text-sm text-text-secondary">
          {dateString}
        </div>

        {/* User avatar + menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            type="button"
            className="p-1 rounded-full focus:outline-none pointer-events-auto"
            aria-label="Account menu"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-border/40"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface border border-border/50 flex items-center justify-center text-xs font-mono text-text-secondary">
                {userInitial}
              </div>
            )}
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-10 w-52 bg-surface/95 backdrop-blur-md border border-border/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 z-50 pointer-events-auto"
              >
                {(user?.email || user?.name) && (
                  <>
                    <p className="font-mono text-xs text-text-secondary truncate">
                      {user.email || user.name}
                    </p>
                    <div className="h-px bg-border/30" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => window.location.assign("/auth/logout")}
                  className="font-mono text-xs text-text-secondary hover:text-white text-left transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Write Area */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col mt-8 z-10 relative"
      >
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
              className={`absolute top-0 left-0 h-full ${isReady ? "bg-accent-warm" : "bg-text-secondary"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((text.length / 10) * 100, 100)}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
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
            {(isReady || isSubmitting) && (
              <motion.button
                disabled={isSubmitting}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                type="submit"
                className="whitespace-nowrap bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-8 py-3 rounded-full font-body font-medium transition-colors ml-auto shadow-[0_0_20px_rgba(200,68,42,0.2)]"
              >
                {isSubmitting ? "Searching..." : "Find my parallel"}{" "}
                <span className="ml-1">→</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>
    </main>
  );
}
