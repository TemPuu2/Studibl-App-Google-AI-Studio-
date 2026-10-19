import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  getVideoProgress as getDbVideoProgress, 
  saveVideoProgress as saveDbVideoProgress, 
  isRealUserSession 
} from './supabaseService';
import { supabase } from '../supabaseClient';

export type TimeSegment = [number, number];

export interface VideoProgress {
  videoId: string;
  watchedSegments: TimeSegment[];
  progress: number;
  lastPosition: number;
}

interface VideoProgressContextType {
  getVideoProgress: (videoId: string) => VideoProgress | undefined;
  updateVideoProgress: (videoId: string, segment: TimeSegment, totalDuration: number, currentPos: number) => void;
  resetVideoProgress: (videoId: string) => void;
  getUnwatchedSegments: (videoId: string, totalDuration: number) => TimeSegment[];
}

const VideoProgressContext = createContext<VideoProgressContextType | undefined>(undefined);

const STORAGE_KEY = 'studibl_video_progress';

// Helper to merge overlapping or adjacent segments
function mergeSegments(segments: TimeSegment[]): TimeSegment[] {
  if (segments.length <= 1) return segments;

  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const merged: TimeSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function VideoProgressProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth() || {};
  const [progressMap, setProgressMap] = useState<Record<string, VideoProgress>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  // Pull video progress from Supabase on mount or authentication change
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      const loadVideoProgress = async () => {
        try {
          const dbProgress = await getDbVideoProgress(user.id);
          if (dbProgress && dbProgress.length > 0) {
            const parsedMap: Record<string, VideoProgress> = {};
            dbProgress.forEach((row: any) => {
              parsedMap[row.video_id] = {
                videoId: row.video_id,
                watchedSegments: row.watched_segments || [],
                progress: row.progress || 0,
                lastPosition: row.last_position || 0
              };
            });
            setProgressMap(parsedMap);
          } else {
            // Overwrite with empty state if no video progress is found on Supabase
            setProgressMap({});
          }
        } catch (e) {
          console.error("Error loading video progress from Supabase:", e);
        }
      };
      loadVideoProgress();
    }
  }, [user]);

  // Synchronize dynamic video progress back to Supabase
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));

    if (user && isRealUserSession(user.id)) {
      const syncVideoProgress = async () => {
        try {
          for (const [videoId, progress] of Object.entries(progressMap)) {
            await saveDbVideoProgress(user.id, videoId, progress);
          }
        } catch (e) {
          console.error("Error syncing video progress to Supabase:", e);
        }
      };
      syncVideoProgress();
    }
  }, [progressMap, user]);

  const getVideoProgress = useCallback((videoId: string) => {
    return progressMap[videoId];
  }, [progressMap]);

  const updateVideoProgress = useCallback((videoId: string, segment: TimeSegment, totalDuration: number, currentPos: number) => {
    if (totalDuration <= 0) return;

    // Ignore segments < 3 seconds per requirement
    if (segment[1] - segment[0] < 3) return;

    setProgressMap(prev => {
      const existing = prev[videoId] || {
        videoId,
        watchedSegments: [],
        progress: 0,
        lastPosition: 0
      };

      const newSegments = mergeSegments([...existing.watchedSegments, segment]);
      const watchedDuration = newSegments.reduce((total, [start, end]) => total + (end - start), 0);
      
      const newProgress = Math.min(100, Math.round((watchedDuration / totalDuration) * 100));
      
      // Mark complete at ~90% as per requirements
      const finalProgress = newProgress >= 90 ? 100 : newProgress;

      // Only update if state actually meaningful changed
      if (
        existing.progress === finalProgress && 
        Math.abs(existing.lastPosition - currentPos) < 1 &&
        existing.watchedSegments.length === newSegments.length
      ) {
        return prev;
      }

      return {
        ...prev,
        [videoId]: {
          videoId,
          watchedSegments: newSegments,
          progress: finalProgress,
          lastPosition: currentPos
        }
      };
    });
  }, []);

  const resetVideoProgress = useCallback(async (videoId: string) => {
    setProgressMap(prev => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });

    if (user && isRealUserSession(user.id)) {
      try {
        await supabase
          .from('video_progress')
          .delete()
          .eq('video_id', videoId)
          .eq('user_id', user.id);
      } catch (e) {
        console.error("Error resetting video progress:", e);
      }
    }
  }, [user]);

  const getUnwatchedSegments = useCallback((videoId: string, totalDuration: number): TimeSegment[] => {
    const vp = progressMap[videoId];
    if (!vp || vp.watchedSegments.length === 0) return [[0, totalDuration]];
    
    const unwatched: TimeSegment[] = [];
    let current = 0;
    
    vp.watchedSegments.forEach(([start, end]) => {
      if (start > current) {
        unwatched.push([current, start]);
      }
      current = Math.max(current, end);
    });
    
    if (current < totalDuration) {
      unwatched.push([current, totalDuration]);
    }
    
    return unwatched;
  }, [progressMap]);

  return (
    <VideoProgressContext.Provider value={{ getVideoProgress, updateVideoProgress, resetVideoProgress, getUnwatchedSegments }}>
      {children}
    </VideoProgressContext.Provider>
  );
}

export function useVideoProgress() {
  const context = useContext(VideoProgressContext);
  if (context === undefined) {
    throw new Error('useVideoProgress must be used within a VideoProgressProvider');
  }
  return context;
}
