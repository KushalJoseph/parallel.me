"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRoom } from "@/app/actions";
import { useAuth } from "@/lib/auth-context";

export default function MatchRevealPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const router = useRouter();

  const [timeLeft, setTimeLeft] = useState({ h: 23, m: 59, s: 59 });
  const [showCTA, setShowCTA] = useState(false);
  const [icebreakerWords, setIcebreakerWords] = useState<string[]>([]);
  const { getIdToken } = useAuth();
  
  useEffect(() => {
    if (roomId) {
      getIdToken().then(token => getRoom(token, roomId)).then(data => {
        if (data.status === "active") {
          if (data.icebreakers && data.icebreakers.length > 0) {
            setIcebreakerWords(data.icebreakers[0].split(" "));
          }
          if (data.expiresAt) {
            const diffSeconds = Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
            if (diffSeconds > 0) {
              const h = Math.floor(diffSeconds / 3600);
              const m = Math.floor((diffSeconds % 3600) / 60);
              const s = diffSeconds % 60;
              setTimeLeft({ h, m, s });
            } else {
              setTimeLeft({ h: 0, m: 0, s: 0 });
            }
          }
        }
      }).catch(console.error);
    }
  }, [roomId]);

  useEffect(() => {
    if (icebreakerWords.length === 0) return;
    
    // Show CTA after the words finish animating
    const ctaWait = setTimeout(() => setShowCTA(true), icebreakerWords.length * 250 + 1500);
    
    // Simple mock countdown syncs from the true initial time
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.h === 0 && prev.m === 0 && prev.s === 0) return prev;
        let {h, m, s} = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) return { h: 0, m: 0, s: 0 };
        return {h, m, s};
      });
    }, 1000);

    return () => {
      clearTimeout(ctaWait);
      clearInterval(timer);
    };
  }, [icebreakerWords]);

  const formatTime = (t: {h:number, m:number, s:number}) => {
    return `${t.h.toString().padStart(2, '0')}:${t.m.toString().padStart(2, '0')}:${t.s.toString().padStart(2, '0')}`;
  };

  const handleEnterChat = () => {
    if (!roomId) return;
    try {
      const visited: string[] = JSON.parse(
        localStorage.getItem("visitedRooms") ?? "[]"
      );
      if (!visited.includes(roomId)) {
        visited.push(roomId);
        localStorage.setItem("visitedRooms", JSON.stringify(visited));
      }
    } catch {
      // localStorage unavailable — proceed anyway
    }
    router.push(`/chat/${roomId}`);
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
          <div className="w-[72px] h-[72px] rounded-full bg-text-primary shadow-[0_0_80px_rgba(226,79,68,0.7)] transform -translate-x-[25px] scale-110 z-10" />
          <div className="w-[72px] h-[72px] rounded-full bg-accent-warm shadow-[0_0_100px_rgba(244,147,66,0.9)] transform translate-x-[25px] scale-110" />
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
          {icebreakerWords.map((word, i) => (
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
          <button
            onClick={handleEnterChat}
            disabled={!roomId}
            className="bg-accent hover:bg-accent/90 text-white px-10 py-5 rounded-full font-body text-lg md:text-xl font-medium tracking-wide transition-all shadow-[0_4px_25px_rgba(226,79,68,0.35)] hover:shadow-[0_6px_30px_rgba(226,79,68,0.5)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enter the conversation <span className="ml-2 font-light text-2xl">→</span>
          </button>
        </motion.div>

      </div>
    </main>
  );
}
