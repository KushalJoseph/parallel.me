"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { supabase } from "@/lib/supabase";
import { getRoom, getUserId, getMessages, sendMessage, connectRoom, deleteRoom } from "@/app/actions";

type Message = {
  id: string;
  text: string;
  senderId?: string;
  isSystem?: boolean;
};

// Singleton audio context to respect browser limits and policies
let audioCtx: AudioContext | null = null;

// Programmatically generate a lightweight notification sound using the Web Audio API
const playTone = (type: "send" | "receive") => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    
    if (!audioCtx) audioCtx = new Ctx();
    
    // Resume context if browser autoplay policy suspended it initially
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    if (audioCtx.state === "suspended") return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === "send") {
      // Soft ascending bloop for sending
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // Gentle pop for receiving
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    console.warn("Audio playback failed", err);
  }
};

export default function ChatPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(23 * 3600 + 59 * 60 + 50);
  const [showSettings, setShowSettings] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [identityChips, setIdentityChips] = useState([
    "Share first name",
    "Share city",
  ]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [isChannelReady, setIsChannelReady] = useState(false);
  const [myConnected, setMyConnected] = useState(false);
  const [otherConnected, setOtherConnected] = useState(false);
  const [isPermanent, setIsPermanent] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isUserA, setIsUserA] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const suggestionIndexRef = useRef(0);

  // Two distinct pools so each user sees different prompts
  const promptsA = [
    "What's something small that made you smile today?",
    "If you could relive one moment from this week, which would it be?",
    "What's a song that matches your mood right now?",
    "What's something you've been overthinking lately?",
    "If your day had a movie title, what would it be?",
    "What's a compliment you received that stuck with you?",
    "What's the last thing that genuinely surprised you?",
    "If you could master any skill overnight, what would it be?",
    "What does your ideal quiet evening look like?",
    "What's something you wish people asked you about more?",
    "What's a memory that always makes you feel warm?",
    "If you could send a message to your future self, what would you say?",
    "What's the bravest thing you've done recently?",
    "What's a small act of kindness you witnessed lately?",
    "What would you do if you had zero fear for a day?",
  ];
  const promptsB = [
    "What's one thing that felt heavy on your mind today?",
    "What's a place that feels like home to you, even if it isn't?",
    "What's a show or book that changed how you see something?",
    "What do you wish you had more time for?",
    "What's the most interesting conversation you've had recently?",
    "What's a tradition or habit that's uniquely yours?",
    "What would your perfect weekend morning look like?",
    "What's something you're quietly proud of?",
    "If you could have dinner with anyone alive, who would it be?",
    "What's a lesson you learned the hard way?",
    "What does 'being understood' look like to you?",
    "What's a dream you haven't told many people about?",
    "What's something you believed as a kid that you still carry?",
    "What's a question you wish someone would ask you?",
    "What's one thing you'd change about how people connect today?",
  ];

  const rotateSuggestion = (userIsA?: boolean) => {
    const useA = userIsA !== undefined ? userIsA : isUserA;
    const pool = useA ? promptsA : promptsB;
    suggestionIndexRef.current = (suggestionIndexRef.current + 1) % pool.length;
    setAiSuggestion(pool[suggestionIndexRef.current]);
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleEndChat = async () => {
    if (!channel || !isChannelReady) return;
    try {
      // Broadcast to the other user that the chat has been ended
      await channel.send({ type: "broadcast", event: "end_chat", payload: { endedBy: myUserId } });
      // Delete from database
      await deleteRoom(roomId);
      router.push("/write");
    } catch (err) {
      console.error("Failed to end chat:", err);
    }
  };

  const handleConnect = async () => {
    if (myConnected || isPermanent || !isChannelReady) return;
    setConnectLoading(true);
    try {
      const res = await connectRoom(roomId);
      
      setMyConnected(true);
      if (res.isPermanent) {
        setIsPermanent(true);
      }
      
      if (res.justConnected) {
        channel.send({ type: "broadcast", event: "mutual_connect", payload: { systemMsg: res.systemMsg } }).catch(console.error);
        setMessages((prev) => [...prev, res.systemMsg]);
        playTone("receive");
      } else {
        channel.send({ type: "broadcast", event: "connect_clicked", payload: { senderId: myUserId } }).catch(console.error);
      }
    } catch (err) {
      console.error("Failed to connect:", err);
    } finally {
      setConnectLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showNudge]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (nudgeDismissed) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // Simulate an AI whisper perfectly interrupting after 8s of absolute silence
    typingTimerRef.current = setTimeout(() => {
      if (messages.length > 0) setShowNudge(true);
    }, 8000);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [messages, nudgeDismissed, input]);

  useEffect(() => {
    if (!roomId) return;
    let activeChannel: any = null;
    let expirePoll: any = null;

    let cancelled = false;

    console.log("[CHAT] effect started — roomId:", roomId);

    // Phase 1: connect to Supabase immediately — don't wait for history
    Promise.all([getUserId(), getRoom(roomId)])
      .then(([uid, roomData]) => {
        console.log(
          "[CHAT] Promise.all resolved — cancelled:",
          cancelled,
          "uid:",
          uid,
          "supabaseChannel:",
          roomData?.supabaseChannel,
          "roomStatus:",
          roomData?.status,
        );

        if (cancelled) {
          console.log("[CHAT] cancelled before setup — bailing out");
          return;
        }

        setMyUserId(uid);
        const userIsA = roomData.userAId === uid;
        setIsUserA(userIsA);
        setMyConnected(userIsA ? roomData.userAConnected : roomData.userBConnected);
        setOtherConnected(userIsA ? roomData.userBConnected : roomData.userAConnected);
        setIsPermanent(roomData.isPermanent);

        // Seed initial suggestion using a random starting index
        const pool = userIsA ? promptsA : promptsB;
        const startIdx = Math.floor(Math.random() * pool.length);
        suggestionIndexRef.current = startIdx;
        setAiSuggestion(pool[startIdx]);
        
        if (roomData.status === "expired") {
          console.log("[CHAT] room already expired — redirecting to /sunset");
          routerRef.current.push("/sunset");
          return;
        }

        // Phase 2: load history in parallel — channel is already live
        getMessages(roomId)
          .then((history) => {
            if (cancelled) return;
            if (history && history.length > 0) {
              setMessages(history);
            }
          })
          .catch((err) => console.error("[CHAT] Failed to load history:", err));

        // Helper: wire up listeners on a channel object and subscribe
        const setupChannel = (channelName: string, attempt = 1) => {
          if (cancelled) return;
          console.log(`[CHAT] creating channel (attempt ${attempt}):`, channelName);

          const ch = supabase.channel(channelName, {
            config: { broadcast: { ack: true } }
          });
          activeChannel = ch;

          ch.on("broadcast", { event: "message" }, ({ payload }) => {
            if (cancelled) return;
            console.log("[CHAT] ← incoming broadcast message:", payload);
            if (payload.senderId !== uid && !payload.isSystem) {
              playTone("receive");
            }
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.id)) return prev;
              return [...prev, payload];
            });
            // Rotate the AI suggestion on every incoming message
            rotateSuggestion();
          });

          ch.on("broadcast", { event: "connect_clicked" }, ({ payload }) => {
            if (cancelled) return;
            if (payload.senderId !== uid) {
              setOtherConnected(true);
            }
          });

          ch.on("broadcast", { event: "mutual_connect" }, ({ payload }) => {
            if (cancelled) return;
            setOtherConnected(true);
            setIsPermanent(true);
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.systemMsg.id)) return prev;
              return [...prev, payload.systemMsg];
            });
            playTone("receive");
          });

          ch.on("broadcast", { event: "end_chat" }, ({ payload }) => {
            if (cancelled) return;
            // The other user ended the chat — show a system message and redirect
            setMessages((prev) => [
              ...prev,
              {
                id: "end-chat-" + Date.now(),
                text: "The other user has ended this conversation.",
                isSystem: true,
              },
            ]);
            playTone("receive");
            // Redirect after a short delay so they can read the message
            setTimeout(() => { if (!cancelled) routerRef.current.push("/write"); }, 2500);
          });

          ch.subscribe((status) => {
            console.log("[CHAT] subscribe status:", status, "| cancelled:", cancelled);
            if (cancelled) {
              console.log("[CHAT] subscribe callback fired but cancelled — ignoring status:", status);
              return;
            }
            if (status === "SUBSCRIBED") {
              console.log("[CHAT] ✓ channel SUBSCRIBED — ready to send/receive");
              setChannel(ch);
              setIsChannelReady(true);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn(`[CHAT] ✗ channel error — status: ${status}, attempt: ${attempt}`);
              // Retry: remove the stale channel, wait for Supabase cleanup, then re-create
              if (attempt < 4 && !cancelled) {
                supabase.removeChannel(ch);
                activeChannel = null;
                const delay = attempt * 500;
                console.log(`[CHAT] retrying in ${delay}ms...`);
                setTimeout(() => setupChannel(channelName, attempt + 1), delay);
              } else {
                setChannel(null);
                setIsChannelReady(false);
              }
            } else if (status === "CLOSED") {
              setChannel(null);
              setIsChannelReady(false);
            }
          });
        };

        setupChannel(roomData.supabaseChannel);

        expirePoll = setInterval(async () => {
          try {
            const freshRoom = await getRoom(roomId);
            if (freshRoom.status === "expired") {
              console.log(
                "[CHAT] room expired (poll) — redirecting to /sunset",
              );
              clearInterval(expirePoll);
              routerRef.current.push("/sunset");
            }
          } catch (e) {}
        }, 60000);
      })
      .catch((err) => {
        console.error("[CHAT] Promise.all failed:", err);
      });

    return () => {
      console.log(
        "[CHAT] cleanup — activeChannel:",
        activeChannel ? "exists" : "null",
        "| setting cancelled=true",
      );
      cancelled = true;
      setChannel(null);
      setIsChannelReady(false);
      if (activeChannel) supabase.removeChannel(activeChannel);
      if (expirePoll) clearInterval(expirePoll);
    };
  }, [roomId]); // router intentionally omitted — accessed via routerRef

  const handleSend = () => {
    console.log(
      "[CHAT] handleSend called — guards: input:",
      !!input.trim(),
      "| channel:",
      !!channel,
      "| myUserId:",
      !!myUserId,
      "| isChannelReady:",
      isChannelReady,
    );

    if (!input.trim() || !channel || !myUserId || !isChannelReady) {
      console.warn(
        "[CHAT] handleSend blocked — failing guard. input:",
        !!input.trim(),
        "channel:",
        !!channel,
        "myUserId:",
        !!myUserId,
        "isChannelReady:",
        isChannelReady,
      );
      return;
    }

    const payload = {
      id: Math.random().toString(),
      text: input.trim(),
      senderId: myUserId,
    };

    console.log("[CHAT] → sending payload:", payload);

    // Optimistic update — show immediately, broadcast in background
    setMessages((prev) => [...prev, payload]);
    setInput("");
    setShowNudge(false);
    rotateSuggestion();
    
    // Play send sound effect
    playTone("send");

    channel
      .send({ type: "broadcast", event: "message", payload })
      .then((result: unknown) => console.log("[CHAT] send result:", result))
      .catch((err: unknown) => console.error("[CHAT] Broadcast failed:", err));

    sendMessage(roomId, payload).catch((err: unknown) => console.error("Failed to persist message", err));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const shareIdentity = (chip: string) => {
    if (!channel || !myUserId || !isChannelReady) return;

    setIdentityChips((prev) => prev.filter((c) => c !== chip));

    // We do NOT use real user data to maintain anonymity logic for this prototype.
    const value = chip.includes("name") ? "Jamie" : "Brooklyn";
    const payload = {
      id: crypto.randomUUID(),
      text: `They shared their ${chip.split(" ")[1]} — it's ${value}.`,
      isSystem: true,
    };

    // Show sender's local version immediately
    setMessages((prev) => [
      ...prev,
      {
        ...payload,
        text: `You shared your ${chip.split(" ")[1]} — it's ${value}.`,
      },
    ]);
    
    // Play sound for sharing an identity chip as well
    playTone("send");

    channel
      .send({ type: "broadcast", event: "message", payload })
      .catch((err: unknown) => {
        console.error("Failed to send identity share:", err);
        setIdentityChips((prev) => [...prev, chip]);
      });

    // Persist system message
    sendMessage(roomId, payload).catch(console.error);
  };

  useEffect(() => {
    const timer = setInterval(
      () => setTimeLeft((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  // Rotate AI suggestion every 10 seconds
  useEffect(() => {
    if (!aiSuggestion) return; // don't start until seeded
    const suggestionTimer = setInterval(() => rotateSuggestion(), 10000);
    return () => clearInterval(suggestionTimer);
  }, [isUserA, aiSuggestion]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isExpiringSoon = timeLeft < 3600;

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative">
      {/* Top Bar */}
      <header className="flex-none flex items-center justify-between px-6 md:px-8 py-5 z-20 sticky top-0 bg-background/50 backdrop-blur-md border-b border-border/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/write")}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors font-mono text-xs"
            aria-label="Back to write"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            back
          </button>
          
          <div className="flex items-center justify-start h-14 md:h-20 opacity-80 hover:opacity-100 transition-opacity">
            <img src="/logo.png" alt="Parallel" className="h-full w-auto object-contain pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isPermanent ? (
            <div className="font-mono text-sm md:text-base tracking-widest text-green-500 drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]">
              Connected ✓
            </div>
          ) : (
            <>
              <div
                className={`font-mono text-sm md:text-base tracking-widest flex-1 text-center ${isExpiringSoon ? "text-accent drop-shadow-[0_0_5px_rgba(200,68,42,0.5)]" : "text-text-secondary/70"}`}
              >
                {formatTime(timeLeft)}
              </div>
              <button
                onClick={handleConnect}
                disabled={myConnected || connectLoading || !isChannelReady}
                className={`px-4 py-2 rounded-full font-mono text-xs font-medium transition-all ${
                  myConnected
                    ? "bg-surface text-text-secondary/50 border border-border/20 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-500 shadow-[0_2px_12px_rgba(34,197,94,0.3)] hover:shadow-[0_4px_16px_rgba(34,197,94,0.4)] active:scale-[0.97]"
                }`}
              >
                {connectLoading ? "..." : myConnected ? "Waiting for other user..." : "Make Friend"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEndConfirm(true)}
            className="text-xs px-3 py-1.5 bg-red-600 text-white font-mono font-medium rounded-lg hover:bg-red-500 transition-all shadow-[0_2px_10px_rgba(220,38,38,0.3)] active:scale-[0.97]"
          >
            End Chat
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-text-secondary hover:text-white transition-colors"
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4 pt-4 flex flex-col gap-[18px] hide-scrollbar z-10">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className={`flex w-full ${msg.isSystem ? "justify-center my-4" : msg.senderId === myUserId ? "justify-end" : "justify-start"}`}
            >
              {msg.isSystem ? (
                <div className="px-5 py-2 bg-surface/40 backdrop-blur-[2px] rounded-full border border-border/20 text-xs md:text-sm font-mono text-text-secondary shadow-sm">
                  {msg.text}
                </div>
              ) : (
                <div
                  className={`max-w-[85%] md:max-w-[65%] px-[22px] py-[15px] leading-[1.6] text-[17px] font-body shadow-md
                    ${
                      msg.senderId === myUserId
                        ? "bg-[#F0EBE3] text-[#0A0908] rounded-[24px] rounded-br-[4px]"
                        : "bg-surface border border-border/40 text-text-primary rounded-[24px] rounded-bl-[4px]"
                    }`}
                >
                  {msg.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* AI Suggestion — rotates every 10s and on each message */}
        <AnimatePresence mode="wait">
          {aiSuggestion && (
            <motion.div
              key={aiSuggestion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-center w-full my-6 sticky bottom-4 z-20"
            >
              <button
                onClick={() => { setInput(aiSuggestion); textareaRef.current?.focus(); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                className="px-6 py-5 bg-surface/90 backdrop-blur-md rounded-2xl border border-border/40 text-center max-w-[85%] shadow-2xl hover:border-accent-warm/40 transition-all duration-200 cursor-pointer group"
              >
                <p className="font-display italic text-text-secondary/90 group-hover:text-text-primary text-xl leading-snug mb-2 transition-colors">
                  "{aiSuggestion}"
                </p>
                <span className="text-accent-warm/50 group-hover:text-accent-warm text-[10px] font-mono uppercase tracking-widest transition-colors">tap to use</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} className="h-2 flex-none" />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 md:px-8 pb-6 bg-gradient-to-t from-background via-background/90 to-transparent sticky bottom-0 z-20">

        {/* Progressive Identity Chips */}
        {identityChips.length > 0 && messages.length > 1 && (
          <div className="flex flex-wrap gap-2.5 mb-4 px-1">
            <AnimatePresence>
              {identityChips.map((chip) => (
                <motion.button
                  key={chip}
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => shareIdentity(chip)}
                  className="px-4 py-[6px] rounded-full bg-surface border border-border/50 text-xs font-mono text-text-secondary hover:text-white hover:border-white/50 transition-colors shadow-sm"
                >
                  {chip}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Input Container */}
        <div className="flex items-end gap-3 bg-surface/80 backdrop-blur-lg border border-border/40 rounded-[28px] pl-6 pr-2 py-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] focus-within:border-border transition-colors w-full">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none border-none py-[10px] font-body text-[17px] text-text-primary placeholder:text-text-secondary/40 self-center leading-snug"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !isChannelReady}
            className={`flex-none p-3.5 rounded-full transition-all duration-300 ${input.trim() ? "bg-accent text-white scale-100 opacity-100 shadow-[0_0_15px_rgba(200,68,42,0.4)]" : "bg-border/30 text-text-secondary/30 scale-95 opacity-50 pointer-events-none"}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* End Chat Confirmation Modal */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="font-display text-lg text-text-primary mb-2">End this conversation?</h3>
              <p className="text-sm text-text-secondary/70 font-body leading-relaxed mb-6">
                This will permanently delete the chat and all its messages for both users. The other person will be notified. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-text-secondary font-mono text-sm hover:text-text-primary hover:border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowEndConfirm(false); handleEndChat(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 font-mono text-sm hover:bg-red-900/40 hover:text-red-300 transition-colors"
                >
                  End Chat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
