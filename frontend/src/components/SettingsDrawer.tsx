"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Settings, X, Trash2, Flag, Bell } from "lucide-react";
import { useState } from "react";

export function SettingsDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-surface/95 border-l border-border/50 shadow-2xl z-50 flex flex-col pt-16 px-8 pb-8"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-text-secondary hover:text-white transition-colors"
            >
              <X size={24} strokeWidth={1.5} />
            </button>

            <h2 className="font-display italic text-3xl mb-12">Settings</h2>

            <div className="flex flex-col gap-8 flex-1">
              {/* Notifications Toggle */}
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-3 text-text-primary">
                  <Bell size={18} strokeWidth={1.5} className="text-text-secondary" />
                  <span className="font-body text-lg">Notifications</span>
                </div>
                <button 
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-accent-warm' : 'bg-border/50'}`}
                >
                  <motion.div 
                    layout
                    className="w-5 h-5 bg-white rounded-full absolute top-[2px]"
                    animate={{ left: notificationsEnabled ? "26px" : "2px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              <div className="h-[1px] w-full bg-border/30" />

              {/* Report */}
              <button className="flex items-center gap-3 text-text-primary hover:text-accent-warm w-full transition-colors group">
                <Flag size={18} strokeWidth={1.5} className="text-text-secondary group-hover:text-accent-warm" />
                <span className="font-body text-lg">Report this conversation</span>
              </button>

              <div className="h-[1px] w-full bg-border/30" />

              {/* Delete Account */}
              <button className="flex items-center gap-3 text-accent hover:text-red-500 w-full transition-colors mt-4 group">
                <Trash2 size={18} strokeWidth={1.5} className="group-hover:text-red-500" />
                <span className="font-body text-lg">Delete my account</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-8 border-t border-border/30">
              <p className="font-mono text-xs text-text-secondary/50">
                12 conversations. All gone forever.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
