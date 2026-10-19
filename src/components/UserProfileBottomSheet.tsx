import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, MessageCircle, Info, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import UserAvatar from './UserAvatar';

/**
 * Interface representing user profile details for bottom sheet display
 */
interface UserProfile {
  name: string;
  avatar: string;
  role: string;
  bio?: string;
  online?: boolean;
}

/**
 * Props for UserProfileBottomSheet modal
 */
interface UserProfileBottomSheetProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onChat?: () => void;
  onViewFullProfile?: (user: UserProfile) => void;
  isConnected?: boolean;
  onToggleConnect?: (user: UserProfile) => void;
  isSelf?: boolean;
}

/**
 * Bottom sheet modal displaying quick peer profile info with connect/chat options.
 * When viewing the authenticated user's own profile, connect and chat buttons are strictly hidden.
 */
export default function UserProfileBottomSheet({ 
  user, 
  isOpen, 
  onClose, 
  onChat, 
  onViewFullProfile,
  isConnected,
  onToggleConnect,
  isSelf = false
}: UserProfileBottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && user && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[210] bg-dark-bg rounded-t-[40px] border-t border-white/10 p-8 pt-4 max-w-lg mx-auto"
          >
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
            
            <div className="flex flex-col items-center text-center">
              <div 
                className="relative mb-4 cursor-pointer active:scale-95 transition-transform"
                onClick={() => onViewFullProfile?.(user)}
              >
                <UserAvatar 
                  src={user.avatar} 
                  name={user.name} 
                  className="w-24 h-24 rounded-full ring-4 ring-brand-primary/20 shadow-2xl" 
                />
                {user.online !== undefined && (
                  <div className={user.online ? "absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-dark-bg rounded-full" : "absolute bottom-1 right-1 w-6 h-6 bg-gray-500 border-4 border-dark-bg rounded-full"} />
                )}
              </div>
              
              <h3 
                className="text-xl font-black text-white mb-1 cursor-pointer hover:text-brand-primary transition-colors"
                onClick={() => onViewFullProfile?.(user)}
              >
                {user.name}
              </h3>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-4">{user.role}</p>
              
              <p className="text-sm text-white/50 leading-relaxed max-w-xs mb-8">
                {user.bio || "No bio yet. Let's connect and study together!"}
              </p>

              {/* Action buttons: connect/chat are strictly disabled/hidden for authenticated self */}
              {isSelf ? (
                <div className="flex justify-center w-full max-w-xs">
                  <button 
                    onClick={() => onViewFullProfile?.(user)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-brand-primary text-dark-bg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_20px_rgba(204,255,0,0.2)]"
                  >
                    <Info size={18} />
                    <span>View Full Profile</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
                  <div className="flex flex-col items-center gap-3 group">
                    <button 
                      onClick={() => onToggleConnect?.(user)}
                      className={cn(
                        "w-14 h-14 rounded-2xl border flex items-center justify-center transition-all active:scale-95",
                        isConnected 
                          ? "bg-brand-primary text-dark-bg border-brand-primary" 
                          : "bg-white/5 border-white/10 text-white group-hover:bg-brand-primary group-hover:text-dark-bg"
                      )}
                    >
                      {isConnected ? <Check size={24} /> : <UserPlus size={24} />}
                    </button>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest transition-colors",
                      isConnected ? "text-brand-primary" : "text-white/40 group-hover:text-white"
                    )}>
                      {isConnected ? 'Connected' : 'Connect'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center gap-3 group">
                    <button 
                      onClick={() => {
                        onClose();
                        onChat?.();
                      }}
                      className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:bg-brand-primary group-hover:text-dark-bg transition-all active:scale-95"
                    >
                      <MessageCircle size={24} />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Chat</span>
                  </div>

                  <div className="flex flex-col items-center gap-3 group">
                    <button 
                      onClick={() => onViewFullProfile?.(user)}
                      className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:bg-brand-primary group-hover:text-dark-bg transition-all active:scale-95"
                    >
                      <Info size={24} />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Info</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
