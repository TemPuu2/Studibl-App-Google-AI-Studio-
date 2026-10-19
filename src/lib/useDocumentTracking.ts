import { useEffect, useRef } from 'react';
import { useDocumentProgress } from './DocumentProgressContext';

export function useDocumentTracking(
  docId: string,
  totalUnits: number,
  activeUnitId: string | null, // Specified if the unit is explicitly chosen (like PDF pages)
  containerRef: React.RefObject<HTMLElement | null>, // For scroll-based tracking (text files)
  unitSelector?: string, // CSS selector for units inside container
  active: boolean = true,
  refreshDeps: any[] = [] // New: trigger re-scan of units
) {
  const { updateProgress } = useDocumentProgress();
  const visibleUnitsRef = useRef<Map<string, number>>(new Map()); // unitId -> startTime
  const MIN_READ_TIME = 3000; // 3 seconds to avoid rapid scrolling
  const PAGE_READ_TIME = 10000; // 10 seconds for explicit units like PDF pages

  // Handle explicit unit changes (e.g. PDF page turns)
  useEffect(() => {
    if (!active || activeUnitId === null || totalUnits <= 0) return;

    let startTime = Date.now();
    let accumulatedTime = 0;
    let isTabVisible = !document.hidden;

    const checkProgress = () => {
      if (isTabVisible) {
        accumulatedTime += Date.now() - startTime;
      }
      startTime = Date.now();

      if (accumulatedTime >= PAGE_READ_TIME) {
        updateProgress(docId, activeUnitId, totalUnits);
        return true;
      }
      return false;
    };

    const interval = setInterval(() => {
      if (checkProgress()) {
        clearInterval(interval);
      }
    }, 1000); // Check every second

    const handleVisibility = () => {
      if (!document.hidden) {
        startTime = Date.now();
        isTabVisible = true;
      } else {
        checkProgress();
        isTabVisible = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [docId, activeUnitId, totalUnits, active, updateProgress]);

  // Handle scroll-based unit tracking (IntersectionObserver)
  useEffect(() => {
    if (!active || !containerRef.current || !unitSelector || totalUnits <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const unitId = entry.target.getAttribute('data-unit-id');
          if (!unitId) return;

          if (entry.isIntersecting) {
            visibleUnitsRef.current.set(unitId, Date.now());
          } else {
            const startTime = visibleUnitsRef.current.get(unitId);
            if (startTime) {
              const timeSpent = Date.now() - startTime;
              if (timeSpent >= MIN_READ_TIME) {
                updateProgress(docId, unitId, totalUnits);
              }
              visibleUnitsRef.current.delete(unitId);
            }
          }
        });
      },
      { threshold: 0.6 } // 60% of unit must be visible
    );

    const units = containerRef.current.querySelectorAll(unitSelector);
    units.forEach(unit => observer.observe(unit));

    return () => {
      observer.disconnect();
      visibleUnitsRef.current.clear();
    };
  }, [docId, totalUnits, unitSelector, active, updateProgress, containerRef, ...refreshDeps]);

  // Pause tracking when tab is inactive or in background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded: reset tracking start times
        visibleUnitsRef.current.clear();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
