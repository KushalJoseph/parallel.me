"use client";

import { motion } from "framer-motion";

import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center min-h-[100dvh]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[340px] flex flex-col items-center mt-[-10vh]"
      >
        <h1 className="font-display italic text-4xl font-medium mb-10 tracking-wide text-text-primary">
          Parallel
        </h1>
        
        <p className="font-body text-text-primary text-[22px] mb-[68px]">
          No name. No profile. Just you.
        </p>

        <div className="w-full flex flex-col gap-[18px] mb-10">
          <button 
            onClick={() => window.location.assign("/auth/login?returnTo=/write")}
            className="w-full bg-white text-black font-body text-base font-medium py-[18px] rounded-full flex items-center justify-center gap-3 hover:bg-white/90 transition-colors shadow-sm"
          >
            <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          
          <button 
            onClick={() => window.location.assign("/auth/login?returnTo=/write")}
            className="w-full bg-surface border border-border text-text-primary font-body text-base font-medium py-[18px] rounded-full flex items-center justify-center gap-3 hover:bg-surface/80 transition-colors shadow-sm"
          >
            <svg className="w-[22px] h-[22px] mb-[2px]" viewBox="0 0 24 24">
              <path fill="currentColor" d="M17.05 20.28c-1.13 1.63-2.32 3.27-4.08 3.3-1.74.03-2.31-1.03-4.3-1.03-2.01 0-2.63 1.02-4.29 1.06-1.72.03-3.07-1.8-4.2-3.44-2.31-3.32-4.08-9.4-.17-13.56C1.94 4.5 3.98 3.28 6.08 3.24c1.69-.03 3.3 1.13 4.33 1.13 1.04 0 2.85-1.39 4.88-1.18 2.1.22 3.99 1.06 5.06 2.62-4.29 2.49-3.57 8.32.74 10.03-.96 2.42-2.19 4.86-4.04 4.44z" />
              <path fill="currentColor" d="M15.13 4.2C16.14 2.97 16.79 1.25 16.6.43 15.02.5 13.06 1.48 12 2.72c-1.02 1.15-1.78 2.91-1.52 3.73 1.69.1 3.66-.99 4.65-2.25z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        <button 
          onClick={() => router.push("/api/auth/login")}
          className="text-[15px] font-mono text-text-secondary hover:text-text-primary transition-colors tracking-wide"
        >
          Or continue with email
        </button>
      </motion.div>
    </main>
  );
}
