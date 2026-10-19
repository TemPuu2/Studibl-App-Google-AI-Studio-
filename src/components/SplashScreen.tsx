import React from 'react';
import { motion } from 'motion/react';
import { Target } from 'lucide-react';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-primary/20 blur-[120px] rounded-full"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.05, 0.1, 0.05]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-secondary/10 blur-[150px] rounded-full"
        />
      </div>

      {/* Center Content */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-24 h-24 rounded-3xl bg-brand-primary/10 border-2 border-brand-primary/20 flex items-center justify-center mb-8 relative group"
        >
          <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-3xl group-hover:blur-2xl transition-all" />
          <Target size={48} className="text-brand-primary relative z-10" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-4xl font-black text-white tracking-tighter mb-2"
        >
          Studibl<span className="text-brand-primary">.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-[10px] uppercase tracking-[0.4em] font-black text-white ml-2"
        >
          Initializing Academic OS
        </motion.p>
      </div>

      {/* Loading Progress Bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-48">
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-brand-primary to-transparent"
          />
        </div>
        <div className="flex justify-between mt-3">
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Studibl Core v3.4</span>
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest animate-pulse">Loading Assets...</span>
        </div>
      </div>
    </motion.div>
  );
}
