import { useEffect, useRef, useCallback } from 'react';
import { useVideoProgress, TimeSegment } from './VideoProgressContext';

export function useMediaTracking(
  mediaId: string,
  mediaRef: React.RefObject<HTMLMediaElement | null>,
  active: boolean = true
) {
  const { updateVideoProgress, getVideoProgress } = useVideoProgress();
  const lastTimeRef = useRef<number>(0);
  const segmentStartRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const pollIntervalRef = useRef<number | null>(null);

  const startSegment = useCallback((time: number) => {
    segmentStartRef.current = time;
    lastTimeRef.current = time;
  }, []);

  const endSegment = useCallback((time: number) => {
    const media = mediaRef.current;
    if (!media || !isPlayingRef.current) return;
    
    const duration = media.duration;
    if (duration > 0) {
      updateVideoProgress(mediaId, [segmentStartRef.current, time], duration, time);
    }
    segmentStartRef.current = time;
    lastTimeRef.current = time;
  }, [mediaId, mediaRef, updateVideoProgress]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !active) return;

    const poll = () => {
      if (!media || document.hidden) return;

      const currentTime = media.currentTime;
      const isMediaPlaying = !media.paused && !media.ended;
      
      // Handle play/pause transition
      if (isMediaPlaying && !isPlayingRef.current) {
        isPlayingRef.current = true;
        startSegment(currentTime);
      } else if (!isMediaPlaying && isPlayingRef.current) {
        endSegment(currentTime);
        isPlayingRef.current = false;
      }

      if (!isMediaPlaying) return;

      const diff = currentTime - lastTimeRef.current;

      // Detect seeks (time jump > 3s)
      if (Math.abs(diff) > 3) {
        endSegment(lastTimeRef.current);
        startSegment(currentTime);
      } else {
        lastTimeRef.current = currentTime;
        
        // Periodically pulse updates (every 5s of continuous play)
        if (currentTime - segmentStartRef.current >= 5) {
            updateVideoProgress(mediaId, [segmentStartRef.current, currentTime], media.duration, currentTime);
            segmentStartRef.current = currentTime;
        }
      }
    };

    pollIntervalRef.current = window.setInterval(poll, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (isPlayingRef.current) {
        endSegment(media.currentTime);
      }
    };
  }, [mediaRef, active, mediaId, endSegment, startSegment, updateVideoProgress]);

  // Handle app backgrounding
  useEffect(() => {
    const handleVisibility = () => {
      const media = mediaRef.current;
      if (document.hidden && isPlayingRef.current && media) {
        endSegment(media.currentTime);
      } else if (!document.hidden && isPlayingRef.current && media) {
        startSegment(media.currentTime);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [mediaRef, endSegment, startSegment]);

  return {
    resumePosition: getVideoProgress(mediaId)?.lastPosition || 0
  };
}
