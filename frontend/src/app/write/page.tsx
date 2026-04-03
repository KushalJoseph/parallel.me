"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  submitEntry,
  getUserConversations,
  type ConversationItem,
} from "@/app/actions";
import { ConversationCard } from "@/components/ConversationCard";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


function SidebarContent({
  conversations,
  onCardClick,
  onClose,
  onToggle,
}: {
  conversations: ConversationItem[];
  onCardClick: (item: ConversationItem) => void;
  onClose?: () => void;
  onToggle?: () => void;
}) {
  return (
    <>
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h2 className="font-display italic text-lg text-text-primary/70">
          Your moments
        </h2>
        <div className="flex items-center gap-1">
          {/* Desktop: collapse toggle lives here, inside the sidebar */}
          {onToggle && (
            <button
              onClick={onToggle}
              className="hidden md:flex p-1 text-text-secondary hover:text-white transition-colors"
              aria-label="Collapse sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
          )}
          {/* Mobile: close overlay */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1 text-text-secondary hover:text-white transition-colors"
              aria-label="Close sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2.5">
        {conversations.length === 0 ? (
          <p className="font-mono text-xs text-text-secondary/40 text-center mt-8 px-4 leading-relaxed">
            Your conversations will appear here once you submit your first
            moment.
          </p>
        ) : (
          [...conversations]
            .sort((a, b) => {
              const getRank = (item: ConversationItem) => {
                if (item.type === "pending") return 1;
                if (item.type === "active" && !item.isPermanent) return 2;
                return 3;
              };
              const rankA = getRank(a);
              const rankB = getRank(b);
              if (rankA !== rankB) return rankA - rankB;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .map((item) => (
              <ConversationCard
                key={item.type === "pending" ? item.entryId : item.roomId}
                item={item}
                onClick={() => onCardClick(item)}
              />
            ))
        )}
      </div>
    </>
  );
}

export default function WritePage() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (isSubmitting) {
      const interval = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isSubmitting]);

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
  }, []);

  // Poll conversations every 5 seconds
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const fetchConvos = async () => {
      if (cancelled) return;
      try {
        const token = await getIdToken();
        const data = await getUserConversations(token);
        if (!cancelled) setConversations(data);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      }
    };

    fetchConvos();
    const interval = setInterval(fetchConvos, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, loading]);

  // Close user menu on outside click
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
      const token = await getIdToken();
      const data = await submitEntry(token, text);

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

  const handleCardClick = (item: ConversationItem) => {
    if (item.type === "pending") {
      router.push(`/waiting?entryId=${item.entryId}`);
      return;
    }
    try {
      const visited: string[] = JSON.parse(
        localStorage.getItem("visitedRooms") ?? "[]",
      );
      if (visited.includes(item.roomId)) {
        router.push(`/chat/${item.roomId}`);
      } else {
        router.push(`/match?roomId=${item.roomId}`);
      }
    } catch {
      router.push(`/match?roomId=${item.roomId}`);
    }
  };

  const userInitial = ((user?.displayName || user?.email || "?")[0]).toUpperCase();

  const ToggleIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden">
      {/* ── Desktop sidebar — collapsible inline ── */}
      <motion.aside
        initial={false}
        animate={{ width: desktopSidebarOpen ? 320 : 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="hidden md:flex flex-col flex-none overflow-hidden bg-white/10 backdrop-blur-3xl border-r border-white/20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        {/* Fixed-width inner so content doesn't reflow during animation */}
        <div className="w-[320px] h-full flex flex-col">
          <SidebarContent
            conversations={conversations}
            onCardClick={handleCardClick}
            onToggle={() => setDesktopSidebarOpen(false)}
          />
        </div>
      </motion.aside>

      {/* Desktop: reopen button — appears at top-left when sidebar is collapsed */}
      <AnimatePresence>
        {!desktopSidebarOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setDesktopSidebarOpen(true)}
            className="hidden md:flex absolute top-6 left-4 z-10 p-1 text-text-secondary/50 hover:text-white transition-colors"
            aria-label="Open sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Mobile sidebar — overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-20 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 h-full w-[320px] bg-white/20 backdrop-blur-3xl border-r border-white/20 shadow-[10px_0_30px_rgba(0,0,0,0.05)] z-30 flex flex-col md:hidden"
            >
              <SidebarContent
                conversations={conversations}
                onCardClick={(item) => {
                  setMobileSidebarOpen(false);
                  handleCardClick(item);
                }}
                onClose={() => setMobileSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main write area ── */}
      <main className="flex-1 flex flex-col px-6 md:px-12 py-8 min-h-[100dvh] relative overflow-y-auto max-w-4xl mx-auto w-full">
        {/* Header */}
        <header className="relative z-30 flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3">
            {/* Mobile: open overlay */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 text-text-secondary hover:text-white transition-colors"
              aria-label="Open conversations"
            >
              <ToggleIcon />
            </button>
            {/* Desktop: date */}
            <div className="hidden md:block font-mono text-sm text-text-secondary">
              {dateString}
            </div>
          </div>

          {/* User avatar + menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              type="button"
              className="p-1 rounded-full focus:outline-none pointer-events-auto"
              aria-label="Account menu"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
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
                  {(user?.email || user?.displayName) && (
                    <>
                      <p className="font-mono text-xs text-text-secondary truncate">
                        {user.email || user.displayName}
                      </p>
                      <div className="h-px bg-border/30" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut(auth);
                      router.push("/auth");
                    }}
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
          <AnimatePresence mode="wait">
            {!isSubmitting ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex-1 flex flex-col h-full relative"
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

                <div className="pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="w-full sm:w-1/2 h-1 bg-white/30 backdrop-blur-sm border-t border-b border-white/10 shadow-inner rounded-full overflow-hidden relative">
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
                    {isReady && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        type="submit"
                        className="whitespace-nowrap bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-8 py-3 rounded-full font-body font-medium transition-colors ml-auto shadow-[0_0_20px_rgba(200,68,42,0.2)]"
                      >
                        Find my parallel <span className="ml-1">→</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="loading"
                initial={{ opacity: 0, filter: "blur(8px)", scale: 1.05 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center pb-[10vh]"
              >
                <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-16">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-[-10%] bg-accent-warm/30 rounded-full blur-[60px]"
                  />
                  <div className="h-48 md:h-60 w-auto opacity-80 z-10">
                    <img src="/logo.png" alt="Parallel" className="h-full w-auto object-contain pointer-events-none drop-shadow-xl" />
                  </div>
                </div>
                
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="font-display italic text-4xl md:text-5xl text-text-primary flex justify-center tracking-wide"
                >
                  <span className="w-72 md:w-[300px] text-left">Listening{".".repeat(dotCount)}</span>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </main>
    </div>
  );
}
