import React from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Trash2, CheckCheck, Sparkles } from 'lucide-react';
import { motion, PanInfo, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { NotificationItem } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { 
  isRealUserSession, 
  deleteUserNotification, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  clearAllUserNotifications 
} from '../lib/supabaseService';

interface NotificationsProps {
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  onClose: () => void;
}

/**
 * Individual Notification Card with fluid, hardware-accelerated horizontal swipe kinematics.
 * 
 * Kinematic Architecture & Glitch Fixes:
 * 1. Uses `dragSnapToOrigin={true}` and `dragMomentum={false}` to guarantee the card always
 *    snaps cleanly back to center when released, eliminating layout sticking glitches.
 * 2. Directly binds `useMotionValue(0)` and `useTransform` to drag position `x` for 60fps
 *    background reveal indicators without causing re-renders during motion.
 * 3. Removes all CSS `transition: transform` or `transition-all` declarations on the draggable
 *    surface to prevent the browser's CSS transition engine from fighting Framer Motion's frame updates.
 * 4. Combines displacement threshold (75px) with velocity detection (> 250px/s) to support
 *    both deliberate drags and quick flick gestures.
 */
function NotificationCard({
  notification,
  onMarkRead,
  onDelete
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Motion value tracking the instantaneous x-axis drag displacement
  const x = useMotionValue(0);

  // Dynamic transforms for the "Mark Read" right-swipe indicator
  const markReadOpacity = useTransform(x, [0, 30, 80], [0, 0.4, 1]);
  const markReadScale = useTransform(x, [0, 80], [0.8, 1.05]);
  const markReadBgOpacity = useTransform(x, [0, 80], [0, 0.15]);

  // Dynamic transforms for the "Delete" left-swipe indicator
  const deleteOpacity = useTransform(x, [0, -30, -80], [0, 0.4, 1]);
  const deleteScale = useTransform(x, [0, -80], [0.8, 1.05]);
  const deleteBgOpacity = useTransform(x, [0, -80], [0, 0.18]);

  /**
   * Evaluates swipe termination kinematics.
   * Dispatches read or delete events based on displacement and velocity.
   */
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const isSwipeRight = info.offset.x > 75 || (info.offset.x > 30 && info.velocity.x > 250);
    const isSwipeLeft = info.offset.x < -75 || (info.offset.x < -30 && info.velocity.x < -250);

    if (isSwipeRight) {
      onMarkRead(notification.id);
    } else if (isSwipeLeft) {
      onDelete(notification.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -160, scale: 0.9, transition: { duration: 0.22, ease: "easeOut" } }}
      transition={{ type: "spring", stiffness: 450, damping: 32 }}
      className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/5 select-none"
    >
      {/* Dynamic Background Reveal: Right Swipe (Green / Mark as Read) */}
      <motion.div
        style={{ opacity: markReadBgOpacity }}
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-brand-primary/30 to-transparent pointer-events-none"
      />
      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-0">
        <motion.div
          style={{ opacity: markReadOpacity, scale: markReadScale }}
          className="flex items-center gap-2 text-brand-primary font-black text-[11px] uppercase tracking-wider"
        >
          <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center">
            <CheckCheck size={16} className="text-brand-primary" />
          </div>
          <span>Mark Read</span>
        </motion.div>
      </div>

      {/* Dynamic Background Reveal: Left Swipe (Red / Delete) */}
      <motion.div
        style={{ opacity: deleteBgOpacity }}
        className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-red-500/30 to-transparent pointer-events-none"
      />
      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none z-0">
        <motion.div
          style={{ opacity: deleteOpacity, scale: deleteScale }}
          className="flex items-center gap-2 text-red-400 font-black text-[11px] uppercase tracking-wider"
        >
          <span>Delete</span>
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
            <Trash2 size={16} className="text-red-400" />
          </div>
        </motion.div>
      </div>

      {/* Draggable Card Foreground */}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.18}
        dragSnapToOrigin={true}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.01, cursor: 'grabbing' }}
        className={cn(
          "relative p-5 z-10 touch-pan-y cursor-grab active:cursor-grabbing rounded-2xl shadow-xl",
          // Only transition colors/opacity - NEVER transform!
          "transition-colors duration-200",
          !notification.read
            ? "bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-brand-primary/20"
            : "bg-[#111113] border border-white/5 opacity-75"
        )}
      >
        {/* Unread Glowing Pulse Dot */}
        {!notification.read && (
          <span className="absolute top-5 right-5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary shadow-[0_0_10px_rgba(204,255,0,0.8)]" />
          </span>
        )}

        <div className="flex items-start gap-4">
          {/* Notification Category Icon */}
          <div
            className={cn(
              "shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border transition-colors duration-200",
              notification.type === 'success' && "border-brand-primary/30 text-brand-primary bg-brand-primary/10",
              notification.type === 'alert' && "border-red-500/30 text-red-400 bg-red-500/10",
              notification.type === 'info' && "border-brand-secondary/30 text-brand-secondary bg-brand-secondary/10",
              notification.read && "border-white/5 text-white/30 bg-white/[0.02]"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> :
             notification.type === 'alert' ? <AlertCircle size={20} /> :
             <Info size={20} />}
          </div>

          {/* Content Description */}
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3
                className={cn(
                  "text-sm font-bold truncate leading-tight transition-colors duration-200",
                  !notification.read ? "text-white" : "text-white/50"
                )}
              >
                {notification.title}
              </h3>
              <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wider shrink-0">
                {notification.time}
              </span>
            </div>

            <p
              className={cn(
                "text-xs leading-relaxed line-clamp-2 transition-colors duration-200",
                !notification.read ? "text-white/70" : "text-white/30"
              )}
            >
              {notification.message}
            </p>

            {/* Quick Action Bar for Desktop / Non-touch accessibility */}
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] text-white/20 font-medium tracking-wide">
                Swipe left to delete • right to read
              </span>
              <div className="flex items-center gap-2">
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(notification.id);
                    }}
                    title="Mark as read"
                    className="p-1 text-white/30 hover:text-brand-primary hover:bg-white/5 rounded-lg transition-colors text-[10px] flex items-center gap-1 font-semibold"
                  >
                    <CheckCheck size={13} />
                    <span>Read</span>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  title="Delete notification"
                  className="p-1 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors text-[10px] flex items-center gap-1 font-semibold"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Notifications Management Drawer / Hub.
 * Manages user inbox state, bulk operations (mark all read, clear all),
 * and renders smooth gesture-driven swipe cards.
 */
export default function Notifications({
  notifications,
  setNotifications,
  onClose
}: NotificationsProps) {
  const { user } = useAuth() || {};

  /**
   * Marks all unread notifications in the list as read locally and in the database.
   */
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (user && isRealUserSession(user.id)) {
      markAllNotificationsAsRead(user.id).catch(err => {
        console.error('Failed to sync mark all read to Supabase:', err);
      });
    }
  };

  /**
   * Clears all notifications from the inbox locally and in the database.
   */
  const clearAllNotifications = () => {
    setNotifications([]);
    if (user && isRealUserSession(user.id)) {
      clearAllUserNotifications(user.id).catch(err => {
        console.error('Failed to sync clear all notifications to Supabase:', err);
      });
    }
  };

  /**
   * Deletes a single notification by ID locally and in the database.
   */
  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (user && isRealUserSession(user.id)) {
      deleteUserNotification(user.id, id).catch(err => {
        console.error('Failed to sync delete notification to Supabase:', err);
      });
    }
  };

  /**
   * Marks an individual notification as read locally and in the database.
   */
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (user && isRealUserSession(user.id)) {
      markNotificationAsRead(user.id, id).catch(err => {
        console.error('Failed to sync mark notification as read to Supabase:', err);
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="h-full flex flex-col pt-4">
      {/* Header with Title and Quick Batch Actions */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-dark-border bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
            <Bell size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Inbox</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-primary text-dark-bg">
                  {unreadCount} NEW
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest leading-none">
              Notification Center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {notifications.length > 0 && (
            <>
              {unreadCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="px-2.5 py-1.5 hover:bg-white/5 rounded-xl transition-colors text-white/50 hover:text-brand-primary flex items-center gap-1.5 text-xs font-semibold"
                >
                  <CheckCheck size={16} />
                  <span className="hidden sm:inline text-[11px]">Mark All Read</span>
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={clearAllNotifications}
                title="Clear all notifications"
                className="px-2.5 py-1.5 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-red-400 flex items-center gap-1.5 text-xs font-semibold"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline text-[11px]">Clear All</span>
              </motion.button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Notification Cards List View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-hide">
        {notifications.length > 0 && (
          <div className="px-2 mb-1 flex items-center justify-between text-[10px] text-white/30 font-bold uppercase tracking-wider">
            <span>Recent Updates</span>
            <span>{notifications.length} {notifications.length === 1 ? 'Message' : 'Messages'}</span>
          </div>
        )}

        <AnimatePresence initial={false} mode="popLayout">
          {notifications.map((notification, nIdx) => (
            <NotificationCard
              key={`notif-${notification.id || nIdx}-${nIdx}`}
              notification={notification}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
            />
          ))}
        </AnimatePresence>

        {/* Empty State when zero notifications remain */}
        {notifications.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4 text-white/20 shadow-inner">
              <Sparkles size={28} className="text-brand-primary/40" />
            </div>
            <h3 className="text-white/80 text-base font-bold mb-1">You're All Caught Up</h3>
            <p className="text-white/40 text-xs max-w-[220px] leading-relaxed">
              No new alerts or activity notifications. Check back later after completing your study missions!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
