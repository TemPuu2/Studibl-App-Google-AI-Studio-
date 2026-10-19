import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getDocumentProgress, saveDocumentProgress, isRealUserSession } from './supabaseService';
import { supabase } from '../supabaseClient';

export type ProgressUnit = {
  id: string; // Document ID
  percentage: number;
  lastUnitId: string;
  consumedUnitIds: string[]; // Serialized Set
  maxTotalUnits: number;
};

interface DocumentProgressContextType {
  getProgress: (docId: string) => number;
  getLastPosition: (docId: string) => string;
  updateProgress: (docId: string, unitId: string, totalUnits: number) => void;
  resetProgress: (docId: string) => void;
}

const DocumentProgressContext = createContext<DocumentProgressContextType | undefined>(undefined);

const STORAGE_KEY = 'studibl_doc_progress';

export function DocumentProgressProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth() || {};
  const [progressMap, setProgressMap] = useState<Record<string, ProgressUnit>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  // Pull from Supabase
  useEffect(() => {
    if (user && isRealUserSession(user.id)) {
      const loadProgress = async () => {
        try {
          const dbProgress = await getDocumentProgress(user.id);
          if (dbProgress && dbProgress.length > 0) {
            const parsedMap: Record<string, ProgressUnit> = {};
            dbProgress.forEach((row: any) => {
              parsedMap[row.id] = {
                id: row.id,
                percentage: row.percentage,
                lastUnitId: row.last_unit_id,
                consumedUnitIds: row.consumed_unit_ids || [],
                maxTotalUnits: row.max_total_units
              };
            });
            setProgressMap(parsedMap);
          } else {
            // Overwrite with empty state if no document progress is found on Supabase
            setProgressMap({});
          }
        } catch (e) {
          console.error("Error loading document progress from Supabase:", e);
        }
      };
      loadProgress();
    }
  }, [user]);

  // Sync to localStorage and Supabase
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap));

    if (user && isRealUserSession(user.id)) {
      const syncProgress = async () => {
        try {
          for (const [docId, progress] of Object.entries(progressMap)) {
            await saveDocumentProgress(user.id, docId, progress);
          }
        } catch (e) {
          console.error("Error syncing document progress to Supabase:", e);
        }
      };
      syncProgress();
    }
  }, [progressMap, user]);

  const getProgress = useCallback((docId: string) => {
    return progressMap[docId]?.percentage || 0;
  }, [progressMap]);

  const getLastPosition = useCallback((docId: string) => {
    return progressMap[docId]?.lastUnitId || '';
  }, [progressMap]);

  const updateProgress = useCallback((docId: string, unitId: string, totalUnits: number) => {
    if (totalUnits <= 0) return;

    setProgressMap(prev => {
      const existing = prev[docId] || {
        id: docId,
        percentage: 0,
        lastUnitId: '',
        consumedUnitIds: [],
        maxTotalUnits: 0
      };

      const consumedSet = new Set(existing.consumedUnitIds);
      consumedSet.add(unitId);

      const effectiveTotalUnits = Math.max(existing.maxTotalUnits, totalUnits);

      // Percentage is calculated based on cumulative consumed units across all categories
      const newPercentage = Math.round((consumedSet.size / effectiveTotalUnits) * 100);
      
      // Never decrease progress unless explicitly reset
      const finalPercentage = Math.min(100, Math.max(existing.percentage, newPercentage));

      // Only update if something actually changed
      if (
        existing.percentage === finalPercentage && 
        existing.lastUnitId === unitId &&
        existing.consumedUnitIds.length === consumedSet.size &&
        existing.maxTotalUnits === effectiveTotalUnits
      ) {
        return prev;
      }

      return {
        ...prev,
        [docId]: {
          id: docId,
          percentage: finalPercentage,
          lastUnitId: unitId,
          consumedUnitIds: Array.from(consumedSet),
          maxTotalUnits: effectiveTotalUnits
        }
      };
    });
  }, []);

  const resetProgress = useCallback(async (docId: string) => {
    setProgressMap(prev => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });

    if (user && isRealUserSession(user.id)) {
      try {
        await supabase
          .from('document_progress')
          .delete()
          .eq('id', docId)
          .eq('user_id', user.id);
      } catch (e) {
        console.error("Error deleting document progress:", e);
      }
    }
  }, [user]);

  return (
    <DocumentProgressContext.Provider value={{ getProgress, getLastPosition, updateProgress, resetProgress }}>
      {children}
    </DocumentProgressContext.Provider>
  );
}

export function useDocumentProgress() {
  const context = useContext(DocumentProgressContext);
  if (context === undefined) {
    throw new Error('useDocumentProgress must be used within a DocumentProgressProvider');
  }
  return context;
}
