import { useEffect, useRef, useCallback } from 'react';
import { useVideoProgress, TimeSegment } from './VideoProgressContext';

export function useVideoTracking(
  videoId: string,
  playerRef: any, // The YT.Player instance
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
    if (!isPlayingRef.current || !playerRef || typeof playerRef.getDuration !== 'function') return;
    
    const duration = playerRef.getDuration();
    if (duration > 0) {
      updateVideoProgress(videoId, [segmentStartRef.current, time], duration, time);
    }
    segmentStartRef.current = time;
    lastTimeRef.current = time;
  }, [videoId, playerRef, updateVideoProgress]);

  useEffect(() => {
    if (!playerRef || !active) return;

    const poll = () => {
      if (!playerRef || typeof playerRef.getPlayerState !== 'function' || typeof playerRef.getCurrentTime !== 'function' || document.hidden) return;

      const playerState = playerRef.getPlayerState();
      const isPlayerPlaying = playerState === 1; // YT.PlayerState.PLAYING
      
      const currentTime = playerRef.getCurrentTime();

      // Handle play/pause transition
      if (isPlayerPlaying && !isPlayingRef.current) {
        isPlayingRef.current = true;
        startSegment(currentTime);
      } else if (!isPlayerPlaying && isPlayingRef.current) {
        endSegment(currentTime);
        isPlayingRef.current = false;
      }

      if (!isPlayerPlaying) return;

      const diff = currentTime - lastTimeRef.current;

      // Detect seeks (time jump > 3s)
      if (Math.abs(diff) > 3) {
        // End old segment at last recorded time
        endSegment(lastTimeRef.current);
        // Start new segment at jump destination
        startSegment(currentTime);
      } else {
        lastTimeRef.current = currentTime;
        
        // Periodically pulse updates (every 5s of continuous watch)
        if (currentTime - segmentStartRef.current >= 5 && typeof playerRef.getDuration === 'function') {
            const duration = playerRef.getDuration();
            updateVideoProgress(videoId, [segmentStartRef.current, currentTime], duration, currentTime);
            segmentStartRef.current = currentTime;
        }
      }
    };

    pollIntervalRef.current = window.setInterval(poll, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [playerRef, active, videoId, endSegment, startSegment, updateVideoProgress]);

  // Handle app backgrounding per requirements
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isPlayingRef.current && playerRef && typeof playerRef.getCurrentTime === 'function') {
        endSegment(playerRef.getCurrentTime());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [playerRef, endSegment]);

  return {
    resumePosition: getVideoProgress(videoId)?.lastPosition || 0
  };
}
