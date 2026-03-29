"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ConversationItem } from "@/app/actions";

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setDisplay("Expired");
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDisplay(
        `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")} left`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!display) return null;

  return (
    <span
      className={`font-mono text-xs tabular-nums ${
        display === "Expired"
          ? "text-red-500/60"
          : "text-accent-warm/70"
      }`}
    >
      {display}
    </span>
  );
}

export function ConversationCard({
  item,
  onClick,
}: {
  item: ConversationItem;
  onClick: () => void;
}) {
  const isPending = item.type === "pending";

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015, x: 3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`w-full text-left px-5 py-4 rounded-xl border transition-colors cursor-pointer ${
        isPending
          ? "bg-amber-950/30 border-amber-800/30 hover:border-amber-700/50"
          : "bg-surface border-border/50 hover:border-accent-warm/50"
      }`}
    >
      {/* Status dot + title */}
      <div className="flex items-center gap-2.5 mb-2">
        {isPending ? (
          <motion.div
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-amber-400 flex-none"
          />
        ) : (
          <div className="w-2 h-2 rounded-full bg-accent-warm flex-none" />
        )}
        <span className="font-body text-[15px] text-text-primary truncate font-medium leading-snug">
          {item.title}
        </span>
      </div>

      {/* Subtitle */}
      <p className="font-mono text-xs text-text-secondary/60 truncate pl-[18px] mb-3 leading-relaxed">
        {isPending ? "Searching for your parallel..." : item.icebreakerPreview}
      </p>

      {/* Bottom row: date/time + countdown (if active) */}
      <div className="flex items-center justify-between pl-[18px]">
        <span className="font-mono text-[11px] text-text-secondary/40">
          {formatDateTime(item.createdAt)}
        </span>
        {!isPending && (
          <Countdown expiresAt={item.expiresAt} />
        )}
        {isPending && (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="font-mono text-[11px] text-amber-500/60"
          >
            waiting
          </motion.span>
        )}
      </div>
    </motion.button>
  );
}
