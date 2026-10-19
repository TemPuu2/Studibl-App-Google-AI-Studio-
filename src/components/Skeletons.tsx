import React from 'react';
import Skeleton from './ui/Skeleton';
import { cn } from '../lib/utils';

export const DashboardSkeleton = () => (
  <div className="h-full px-6 pt-3 pb-12 overflow-y-auto scrollbar-hide space-y-8">
    {/* Daily Mission Card Skeleton */}
    <Skeleton className="w-full h-48" borderRadius="32px" />
    
    {/* Live Activity Ticker Skeleton */}
    <Skeleton className="w-full h-10" borderRadius="9999px" />
    
    {/* Quick Access Skeleton */}
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-20" borderRadius="16px" />
      <Skeleton className="h-20" borderRadius="16px" />
      <Skeleton className="h-20" borderRadius="16px" />
    </div>

    {/* Study Goals Skeleton */}
    <Skeleton className="w-full h-32" borderRadius="24px" />

    {/* Mastery Graph Skeleton */}
    <div className="glass-card p-6">
      <Skeleton className="w-24 h-4 mb-4" />
      <div className="flex gap-2 items-end h-20">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={`dash-graph-${i}`} className="flex-1" height={`${Math.random() * 60 + 40}%`} />
        ))}
      </div>
    </div>

    {/* Active Courses Skeleton */}
    <div className="space-y-4">
      <Skeleton className="w-32 h-6 mb-4" />
      <Skeleton className="w-full h-20" borderRadius="24px" />
      <Skeleton className="w-full h-20" borderRadius="24px" />
    </div>
  </div>
);

export const AITutorSkeleton = () => (
  <div className="flex flex-col h-full bg-dark-bg">
    {/* Header Skeleton */}
    <div className="px-6 pt-2 pb-4 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10" borderRadius="12px" />
        <div className="space-y-2">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-32 h-2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-10 h-10" borderRadius="12px" />
        <Skeleton className="w-10 h-10" borderRadius="12px" />
      </div>
    </div>
    
    {/* Messages Skeleton */}
    <div className="flex-1 px-6 py-6 space-y-8 overflow-hidden">
      <div className="flex justify-start">
        <Skeleton className="w-3/4 h-32" borderRadius="24px 24px 24px 4px" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="w-1/2 h-16" borderRadius="24px 24px 4px 24px" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="w-full h-48" borderRadius="24px 24px 24px 4px" />
      </div>
    </div>

    {/* Input Area Skeleton */}
    <div className="p-6">
      <Skeleton className="w-full h-14" borderRadius="32px" />
    </div>
  </div>
);

export const LecturesSkeleton = () => (
  <div className="h-full px-6 py-8 space-y-8 overflow-y-auto">
    <div className="flex items-center justify-between">
      <Skeleton className="w-40 h-8" />
      <Skeleton className="w-24 h-10" borderRadius="12px" />
    </div>
    
    <Skeleton className="w-full h-12" borderRadius="16px" />
    
    <div className="flex gap-2 pb-4 overflow-hidden">
      <Skeleton className="w-20 h-8" borderRadius="9999px" />
      <Skeleton className="w-20 h-8" borderRadius="9999px" />
      <Skeleton className="w-20 h-8" borderRadius="9999px" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={`lec-skel-${i}`} className="w-full h-40" borderRadius="24px" />
      ))}
    </div>
  </div>
);

/**
 * Skeleton loader for the Community Feed (Posts) tab
 */
export const CommunityFeedSkeleton = () => (
  <div className="space-y-4 px-6 pb-24">
    {[...Array(3)].map((_, i) => (
      <div key={`feed-skel-${i}`} className="bg-dark-card/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-11 h-11" borderRadius="9999px" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="w-28 h-3.5" borderRadius="6px" />
                <Skeleton className="w-16 h-3" borderRadius="9999px" />
              </div>
              <Skeleton className="w-20 h-2.5" borderRadius="4px" />
            </div>
          </div>
          <Skeleton className="w-6 h-6" borderRadius="6px" />
        </div>

        <div className="space-y-2 pt-1">
          <Skeleton className="w-full h-3.5" borderRadius="4px" />
          <Skeleton className="w-4/5 h-3.5" borderRadius="4px" />
          <Skeleton className="w-2/3 h-3.5" borderRadius="4px" />
        </div>

        {i === 1 && (
          <Skeleton className="w-full h-44" borderRadius="20px" />
        )}

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-6" borderRadius="9999px" />
            <Skeleton className="w-14 h-6" borderRadius="9999px" />
          </div>
          <Skeleton className="w-6 h-6" borderRadius="9999px" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for the Community Study Groups tab
 */
export const CommunityGroupsSkeleton = () => (
  <div className="space-y-4 px-6 pb-24">
    {[...Array(4)].map((_, i) => (
      <div key={`group-skel-${i}`} className="bg-dark-card/60 border border-white/5 rounded-3xl p-4 flex gap-4 items-center">
        <Skeleton className="w-16 h-16 shrink-0" borderRadius="20px" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-16 h-4" borderRadius="9999px" />
            <Skeleton className="w-24 h-3.5" borderRadius="6px" />
          </div>
          <Skeleton className="w-4/5 h-3" borderRadius="4px" />
          <Skeleton className="w-20 h-2.5" borderRadius="4px" />
        </div>
        <Skeleton className="w-20 h-8 shrink-0" borderRadius="9999px" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for the Community Direct Chats tab
 */
export const CommunityChatsSkeleton = () => (
  <div className="space-y-4 px-6 pb-24">
    {/* Active peers bar skeleton */}
    <div className="flex gap-4 pb-2 overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <div key={`chat-peer-skel-${i}`} className="flex flex-col items-center gap-2 shrink-0">
          <Skeleton className="w-14 h-14" borderRadius="9999px" />
          <Skeleton className="w-12 h-2.5" borderRadius="4px" />
        </div>
      ))}
    </div>

    {/* Chats list skeleton */}
    <div className="space-y-3 pt-2">
      {[...Array(4)].map((_, i) => (
        <div key={`chat-row-skel-${i}`} className="bg-dark-card/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <Skeleton className="w-12 h-12 shrink-0" borderRadius="9999px" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <Skeleton className="w-28 h-3.5" borderRadius="6px" />
                <Skeleton className="w-12 h-2.5" borderRadius="4px" />
              </div>
              <Skeleton className="w-48 h-3" borderRadius="4px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton loader for Full User Profile in Community
 */
export const CommunityProfileSkeleton = () => (
  <div className="h-full bg-dark-bg flex flex-col overflow-y-auto">
    {/* Banner skeleton */}
    <Skeleton className="w-full h-44 shrink-0" borderRadius="0" />
    
    <div className="px-6 -mt-14 space-y-6 pb-12">
      {/* Profile Header */}
      <div className="flex items-end justify-between">
        <Skeleton className="w-24 h-24 border-4 border-dark-bg" borderRadius="9999px" />
        <Skeleton className="w-28 h-9" borderRadius="9999px" />
      </div>

      <div className="space-y-2">
        <Skeleton className="w-44 h-6" borderRadius="8px" />
        <Skeleton className="w-32 h-3.5" borderRadius="6px" />
        <Skeleton className="w-56 h-3" borderRadius="4px" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 py-2">
        <Skeleton className="h-16" borderRadius="16px" />
        <Skeleton className="h-16" borderRadius="16px" />
        <Skeleton className="h-16" borderRadius="16px" />
      </div>

      {/* Bio skeleton */}
      <Skeleton className="w-full h-20" borderRadius="20px" />

      {/* Posts tab skeleton */}
      <div className="space-y-4 pt-4">
        <Skeleton className="w-32 h-4" borderRadius="6px" />
        <Skeleton className="w-full h-32" borderRadius="24px" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton loader for comments and replies
 */
export const CommunityCommentsSkeleton = () => (
  <div className="space-y-4 py-2">
    {[...Array(3)].map((_, i) => (
      <div key={`comm-reply-skel-${i}`} className="flex gap-3 items-start">
        <Skeleton className="w-9 h-9 shrink-0" borderRadius="9999px" />
        <div className="flex-1 space-y-2 bg-white/5 p-3 rounded-2xl">
          <div className="flex items-center justify-between">
            <Skeleton className="w-24 h-3" borderRadius="4px" />
            <Skeleton className="w-12 h-2.5" borderRadius="4px" />
          </div>
          <Skeleton className="w-full h-3" borderRadius="4px" />
          <Skeleton className="w-3/4 h-3" borderRadius="4px" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for active chat conversation messages in ChatInterface
 */
export const CommunityChatMessagesSkeleton = () => (
  <div className="flex-1 p-6 space-y-4 overflow-hidden">
    <div className="flex justify-start">
      <Skeleton className="w-3/5 h-16" borderRadius="20px 20px 20px 4px" />
    </div>
    <div className="flex justify-end">
      <Skeleton className="w-2/5 h-12" borderRadius="20px 20px 4px 20px" />
    </div>
    <div className="flex justify-start">
      <Skeleton className="w-4/5 h-20" borderRadius="20px 20px 20px 4px" />
    </div>
    <div className="flex justify-end">
      <Skeleton className="w-1/2 h-14" borderRadius="20px 20px 4px 20px" />
    </div>
  </div>
);

export const CommunitySkeleton = () => (
  <div className="h-full flex flex-col">
    <div className="p-6 border-b border-white/5 space-y-4">
      <Skeleton className="w-32 h-6" />
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-10" borderRadius="9999px" />
        <Skeleton className="w-10 h-10" borderRadius="12px" />
      </div>
    </div>
    <div className="flex-1 p-6 space-y-6 overflow-hidden">
      {[...Array(3)].map((_, i) => (
        <div key={`comm-card-skel-${i}`} className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10" borderRadius="9999px" />
            <div className="space-y-1">
              <Skeleton className="w-24 h-3" />
              <Skeleton className="w-16 h-2" />
            </div>
          </div>
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-3/4 h-4" />
          <div className="flex gap-4 pt-2">
            <Skeleton className="w-12 h-4" />
            <Skeleton className="w-12 h-4" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const MissionsSkeleton = () => (
  <div className="h-full px-6 py-8 space-y-8 overflow-y-auto">
    <div className="flex items-center justify-between">
      <Skeleton className="w-40 h-8" />
      <Skeleton className="w-10 h-10" borderRadius="12px" />
    </div>

    <div className="glass-card p-6 flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="w-48 h-4" />
        <Skeleton className="w-32 h-3" />
      </div>
      <Skeleton className="w-16 h-16" borderRadius="9999px" />
    </div>

    <div className="space-y-4">
      <Skeleton className="w-32 h-4" />
      {[...Array(4)].map((_, i) => (
        <div key={`miss-skel-item-${i}`} className="flex gap-4 items-center">
          <Skeleton className="w-12 h-12" borderRadius="12px" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-1/2 h-2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const AnalyticsSkeleton = () => (
  <div className="h-full px-6 py-8 space-y-8 overflow-y-auto">
    <Skeleton className="w-32 h-8" />
    
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-32" borderRadius="24px" />
      <Skeleton className="h-32" borderRadius="24px" />
    </div>
    
    <div className="glass-card p-6 space-y-6">
      <Skeleton className="w-40 h-6" />
      <Skeleton className="w-full h-48" borderRadius="16px" />
    </div>

    <div className="space-y-4">
      <Skeleton className="w-32 h-4" />
      <div className="grid grid-cols-2 gap-4">
         <Skeleton className="h-24" borderRadius="16px" />
         <Skeleton className="h-24" borderRadius="16px" />
      </div>
    </div>
  </div>
);

export const ProfileSkeleton = () => (
  <div className="h-full px-6 py-8 space-y-8 overflow-y-auto bg-dark-bg">
    <div className="flex items-center justify-between pt-4">
      <Skeleton className="w-24 h-6 opacity-40" />
      <div className="flex gap-2">
        <Skeleton className="w-9 h-9" borderRadius="12px" />
        <Skeleton className="w-9 h-9" borderRadius="12px" />
      </div>
    </div>

    <div className="flex flex-col items-center gap-4 py-6">
      <Skeleton className="w-24 h-24" borderRadius="32px" />
      <div className="space-y-2 items-center flex flex-col">
        <Skeleton className="w-40 h-6" />
        <Skeleton className="w-32 h-3" />
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-16" borderRadius="20px" />
      <Skeleton className="h-16" borderRadius="20px" />
      <Skeleton className="h-16" borderRadius="20px" />
    </div>

    <div className="space-y-4">
       <Skeleton className="w-48 h-8" borderRadius="12px" />
       <Skeleton className="w-full h-32" borderRadius="24px" />
       <Skeleton className="w-full h-16" borderRadius="24px" />
    </div>
  </div>
);

export const QuizzesSkeleton = () => (
  <div className="h-full px-6 pt-3 pb-6 overflow-y-auto">
    <Skeleton className="w-48 h-8" borderRadius="12px" />
    
    <div className="glass-card p-6 border-none">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-12 h-12" borderRadius="12px" />
        <div className="space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-24 h-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" borderRadius="20px" />
        <Skeleton className="h-24" borderRadius="20px" />
      </div>
    </div>

    <div className="space-y-4">
      <Skeleton className="w-32 h-5" />
      {[...Array(3)].map((_, i) => (
        <div key={`quiz-skel-card-${i}`} className="glass-card p-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="w-40 h-4" />
            <Skeleton className="w-20 h-2" />
          </div>
          <Skeleton className="w-10 h-10" borderRadius="12px" />
        </div>
      ))}
    </div>
  </div>
);

export const NotificationsSkeleton = () => (
  <div className="h-full px-6 py-8 space-y-8 overflow-y-auto">
    <div className="flex items-center justify-between">
      <Skeleton className="w-48 h-8" />
      <Skeleton className="w-20 h-6" borderRadius="9999px" />
    </div>
    
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={`notif-skel-row-${i}`} className="flex gap-4 p-4 glass-card border-none">
          <Skeleton className="w-10 h-10 shrink-0" borderRadius="12px" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-20 h-2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
