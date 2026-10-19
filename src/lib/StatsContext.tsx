import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { calculateXP } from './xpCalculator';
import { calculateLevelFromXP } from './levelSystem';
import { useAuth } from './AuthContext';
import { 
  getUserStats, 
  saveUserStats, 
  getProgressHistory, 
  saveProgressHistoryItem, 
  getAwardedBadges, 
  saveAwardedBadge, 
  getMissionLogs, 
  saveMissionLog, 
  isRealUserSession,
  clearAwardedBadges
} from './supabaseService';
import { supabase } from '../supabaseClient';
import { 
  LearningEvent, 
  UserPerformanceMetrics, 
  BadgeAward, 
  processLearningEvent, 
  createEmptyMetrics, 
  generateSeededMetricsAndBadges,
  EventRefactoringResult
} from './badgeSystem';

/**
 * Subject categories for the radar map
 */
export type SubjectCategory = 'Logic' | 'Code' | 'Math' | 'Theory' | 'Security' | 'Hardware' | 'Linguistics';

export interface SubjectMastery {
  Logic: number;
  Code: number;
  Math: number;
  Theory: number;
  Security: number;
  Hardware: number;
  Linguistics: number;
}

export interface MissionLogItem {
  id: string;
  title: string;
  type: 'Quiz' | 'Exam' | 'Flashcards' | 'Written' | 'FillBlank';
  score: number;
  total: number;
  accuracy: number;
  timeSpentSeconds: number;
  xpGained: number;
  date: string;
  isExam?: boolean;
  isPerfect: boolean;
  isHighScore: boolean;
  isFastest: boolean;
  status?: 'In Progress' | 'Completed';
  redeemed?: boolean;
  subject?: SubjectCategory;
}

export interface ProgressHistoryItem {
  date: string;
  xp: number;
  accuracy: number;
  studyMinutes: number;
}

interface StatsContextType {
  totalXP: number;
  level: number;
  rankTitle: string;
  overallAccuracy: number;
  studyVelocity: number; 
  subjects: SubjectMastery;
  progressHistory: ProgressHistoryItem[];
  missionLogs: MissionLogItem[];
  totalQuestionsAnswered: number;
  correctAnswersValue: number;
  quizCount: number;
  examCount: number;
  totalStudyMinutes: number;
  loading?: boolean;
  addResult: (params: {
    id?: string;
    status?: 'In Progress' | 'Completed';
    title: string;
    type: MissionLogItem['type'];
    score: number;
    total: number;
    timeSpentSeconds: number;
    subject?: SubjectCategory;
    isExam?: boolean;
    awardImmediately?: boolean;
  }) => void;
  redeemReward: (logId: string) => boolean;
  awardXP: (amount: number, reason?: string) => void;
  performanceMetrics: UserPerformanceMetrics;
  awardedBadges: BadgeAward[];
  pushLearningEvent: (event: LearningEvent) => EventRefactoringResult;
  resetBadgeSystem: () => void;
  clearBadges: () => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

const STATS_STORAGE_KEY = 'studibl_global_stats_v2';

const DEFAULT_STATS = {
  totalXP: 15600,
  totalQuestionsAnswered: 520,
  correctAnswersValue: 460,
  quizCount: 18,
  examCount: 3,
  subjects: {
    Logic: 82,
    Code: 94,
    Math: 72,
    Theory: 88,
    Security: 68,
    Hardware: 54,
    Linguistics: 75,
  } as SubjectMastery,
  progressHistory: [
    { date: '2026-05-04', xp: 2000, accuracy: 82, studyMinutes: 45 },
    { date: '2026-05-05', xp: 2500, accuracy: 88, studyMinutes: 60 },
    { date: '2026-05-06', xp: 1200, accuracy: 85, studyMinutes: 30 },
    { date: '2026-05-07', xp: 3600, accuracy: 92, studyMinutes: 120 },
    { date: '2026-05-08', xp: 1400, accuracy: 78, studyMinutes: 40 },
    { date: '2026-05-09', xp: 4300, accuracy: 94, studyMinutes: 150 },
    { date: '2026-05-10', xp: 600, accuracy: 100, studyMinutes: 15 },
  ] as ProgressHistoryItem[],
  missionLogs: [
    {
      id: 'mock-1',
      title: 'Compiler Architecture Quiz',
      type: 'Quiz' as const,
      score: 9,
      total: 10,
      accuracy: 90,
      timeSpentSeconds: 420,
      xpGained: 66, // (9 * 5) + (1 * 1) + 20 (completion) = 66 XP
      date: '2026-05-10',
      isPerfect: false,
      isHighScore: true,
      isFastest: false,
      redeemed: false,
      subject: 'Code' as const
    },
    {
      id: 'mock-2',
      title: 'MECH 402 Final Logic Protocol',
      type: 'Exam' as const,
      score: 45,
      total: 50,
      accuracy: 90,
      timeSpentSeconds: 2700,
      xpGained: 350, // (45 * 5) + (5 * 1) + 20 (completion) + 100 (exam completion bonus) = 350 XP
      date: '2026-05-09',
      isPerfect: false,
      isHighScore: true,
      isFastest: true,
      redeemed: false,
      subject: 'Logic' as const
    }
  ] as MissionLogItem[],
  totalStudyMinutes: 1540,
  performanceMetrics: undefined as UserPerformanceMetrics | undefined,
  awardedBadges: undefined as BadgeAward[] | undefined,
};

/**
 * Sanitizes and validates user study metrics retrieved from local storage or remote databases.
 * It prevents UI breakage due to missing fields, corrupted schemas, or partial state updates
 * between iterations by merging stored values back into the safe `DEFAULT_STATS` blueprint.
 *
 * @param loadedStats Any stored object parsed from persistent JSON structures.
 * @returns A structurally safe `StatsContextType` object guaranteed to have all required keys.
 */
function sanitizeStats(loadedStats: any): any {
  if (!loadedStats || typeof loadedStats !== 'object') {
    return DEFAULT_STATS;
  }
  
  // Clone complete default stats blueprint and layer in retrieved keys
  const sanitized = { 
    ...DEFAULT_STATS, 
    ...loadedStats 
  };
  
  // Safeguard array values against legacy storage forms or type mismatches
  sanitized.progressHistory = Array.isArray(loadedStats.progressHistory) 
    ? loadedStats.progressHistory.filter((item: any) => item && typeof item === 'object')
    : [...DEFAULT_STATS.progressHistory];
    
  sanitized.missionLogs = Array.isArray(loadedStats.missionLogs)
    ? loadedStats.missionLogs.filter((item: any) => item && typeof item === 'object')
    : [...DEFAULT_STATS.missionLogs];
    
  // Filter out any duplicate awarded badges by keeping a Set of seen badgeId strings.
  // This cleans up and prevents any legacy stored duplicate awards from impacting the application state.
  if (Array.isArray(loadedStats.awardedBadges)) {
    const seenBadges = new Set<string>();
    sanitized.awardedBadges = loadedStats.awardedBadges.filter((item: any) => {
      if (item && typeof item === 'object' && item.badgeId) {
        if (!seenBadges.has(item.badgeId)) {
          seenBadges.add(item.badgeId);
          return true;
        }
      }
      return false;
    });
  } else {
    sanitized.awardedBadges = undefined; // Explicitly trigger seeding fallback below if empty or corrupted
  }
    
  sanitized.subjects = (loadedStats.subjects && typeof loadedStats.subjects === 'object')
    ? { ...DEFAULT_STATS.subjects, ...loadedStats.subjects }
    : { ...DEFAULT_STATS.subjects };
    
  // Ensure integer constraints are strictly enforced for numeric metrics
  sanitized.totalXP = Math.max(0, Math.round(Number(sanitized.totalXP) || 0));
  sanitized.totalQuestionsAnswered = Math.max(0, Math.round(Number(sanitized.totalQuestionsAnswered) || 0));
  sanitized.correctAnswersValue = Math.max(0, Math.round(Number(sanitized.correctAnswersValue) || 0));
  sanitized.quizCount = Math.max(0, Math.round(Number(sanitized.quizCount) || 0));
  sanitized.examCount = Math.max(0, Math.round(Number(sanitized.examCount) || 0));
  sanitized.totalStudyMinutes = Math.max(0, Math.round(Number(sanitized.totalStudyMinutes) || 0));
    
  return sanitized;
}

const EMPTY_STATS = {
  totalXP: 0,
  totalQuestionsAnswered: 0,
  correctAnswersValue: 0,
  quizCount: 0,
  examCount: 0,
  subjects: {
    Logic: 0,
    Code: 0,
    Math: 0,
    Theory: 0,
    Security: 0,
    Hardware: 0,
    Linguistics: 0,
  } as SubjectMastery,
  progressHistory: [] as ProgressHistoryItem[],
  missionLogs: [] as MissionLogItem[],
  totalStudyMinutes: 0,
  performanceMetrics: undefined as UserPerformanceMetrics | undefined,
  awardedBadges: [] as BadgeAward[],
};

export function StatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() || {};
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);
  const [stats, setStats] = useState(() => {
    // CRITICAL: Real authenticated users ALWAYS start with clean empty stats immediately to prevent sandboxed mock leaks!
    const isRealUserVal = user && isRealUserSession(user.id);
    if (isRealUserVal) {
      return { ...EMPTY_STATS, performanceMetrics: createEmptyMetrics(), awardedBadges: [] };
    }

    let baseStats = DEFAULT_STATS;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STATS_STORAGE_KEY + "_guest");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          baseStats = sanitizeStats(parsed);
        } catch (e) {
          baseStats = DEFAULT_STATS;
        }
      }
    }

    if (!baseStats.performanceMetrics || !baseStats.awardedBadges) {
      const seedResult = generateSeededMetricsAndBadges('alex_simmons');
      baseStats = {
        ...baseStats,
        performanceMetrics: baseStats.performanceMetrics || seedResult.metrics,
        awardedBadges: baseStats.awardedBadges || seedResult.awardedBadges
      };
    }
    return baseStats;
  });

  // Keep stats state aligned when user authentication changes dynamically
  useEffect(() => {
    const isRealUserVal = user && isRealUserSession(user.id);
    if (isRealUserVal) {
      setHasLoadedFromDb(false);
      // Instantly load clean empty states first and load real records below
      setStats({
        ...EMPTY_STATS,
        performanceMetrics: createEmptyMetrics(),
        awardedBadges: []
      });
    } else {
      setHasLoadedFromDb(true); // GUEST doesn't need to load from db
      // Revert back to guest database values
      let baseStats = DEFAULT_STATS;
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STATS_STORAGE_KEY + "_guest");
        if (saved) {
          try {
            baseStats = sanitizeStats(JSON.parse(saved));
          } catch (e) {}
        }
      }
      setStats(baseStats);
    }
  }, [user]);

  // Pull stats from Supabase on mount/auth changes with real-time sync subscription
  useEffect(() => {
    let channel: any = null;
    const isReal = user && isRealUserSession(user.id);

    const loadAllStatsFromSupabase = async () => {
      if (!isReal) return;
      try {
        const dbStats = await getUserStats(user.id);
        const dbHistory = await getProgressHistory(user.id);
        const dbBadges = await getAwardedBadges(user.id);
        const dbLogs = await getMissionLogs(user.id);

        setStats((prev: any) => {
          const merged = { ...prev };
          
          if (dbStats) {
            const remoteXP = dbStats.total_xp ?? 0;
            // State verification: preserve local XP if higher than stale remote data during replication
            merged.totalXP = Math.max(prev.totalXP || 0, remoteXP);
            console.log(`[StatsContext:XP] Remote stats loaded. Remote XP: ${remoteXP}, Local XP: ${prev.totalXP}, Merged XP: ${merged.totalXP}`);
            merged.totalQuestionsAnswered = Math.max(prev.totalQuestionsAnswered || 0, dbStats.total_questions_answered ?? 0);
            merged.correctAnswersValue = Math.max(prev.correctAnswersValue || 0, dbStats.correct_answers_value ?? 0);
            merged.quizCount = Math.max(prev.quizCount || 0, dbStats.quiz_count ?? 0);
            merged.examCount = Math.max(prev.examCount || 0, dbStats.exam_count ?? 0);
            merged.totalStudyMinutes = Math.max(prev.totalStudyMinutes || 0, dbStats.total_study_minutes ?? 0);
            merged.subjects = dbStats.subjects ?? {
              Logic: 0,
              Code: 0,
              Math: 0,
              Theory: 0,
              Security: 0,
              Hardware: 0,
              Linguistics: 0,
            };
            merged.performanceMetrics = dbStats.performance_metrics ?? createEmptyMetrics();
          } else {
            merged.totalXP = prev.totalXP || 0;
            merged.totalQuestionsAnswered = prev.totalQuestionsAnswered || 0;
            merged.correctAnswersValue = prev.correctAnswersValue || 0;
            merged.quizCount = prev.quizCount || 0;
            merged.examCount = prev.examCount || 0;
            merged.totalStudyMinutes = prev.totalStudyMinutes || 0;
            merged.subjects = prev.subjects || {
              Logic: 0,
              Code: 0,
              Math: 0,
              Theory: 0,
              Security: 0,
              Hardware: 0,
              Linguistics: 0,
            };
            merged.performanceMetrics = prev.performanceMetrics || createEmptyMetrics();
          }

          // Clean real data: brand-new users have empty progress histories in the DB.
          merged.progressHistory = dbHistory ? dbHistory.map((item: any) => ({
            date: item.date,
            xp: item.xp,
            accuracy: Number(item.accuracy),
            studyMinutes: Number(item.study_minutes)
          })) : (prev.progressHistory || []);

          merged.awardedBadges = dbBadges ? dbBadges.map((badge: any) => ({
            badgeId: badge.badge_id,
            awardedAt: badge.awarded_at,
            reason: badge.reason
          })) : (prev.awardedBadges || []);

          const remoteLogs = dbLogs ? dbLogs.map((log: any) => {
            // Check if locally redeemed to avoid reverting due to replication lag
            const localMatch = (prev.missionLogs || []).find((m: any) => m.id === log.id);
            const isRedeemed = log.redeemed || (localMatch ? localMatch.redeemed : false);

            return {
              id: log.id,
              title: log.title,
              type: log.type,
              score: log.score,
              total: log.total,
              accuracy: Number(log.accuracy),
              timeSpentSeconds: log.time_spent_seconds,
              xpGained: log.xp_gained,
              date: log.date,
              isExam: log.is_exam || log.isExam || false,
              isPerfect: log.is_perfect || log.isPerfect || false,
              isHighScore: log.is_high_score || log.isHighScore || false,
              isFastest: log.is_fastest || log.isFastest || false,
              is_exam: log.is_exam || log.isExam || false,
              is_perfect: log.is_perfect || log.isPerfect || false,
              is_high_score: log.is_high_score || log.isHighScore || false,
              is_fastest: log.is_fastest || log.isFastest || false,
              status: log.status,
              redeemed: isRedeemed,
              subject: log.subject
            };
          }) : [];

          // Preserve any recently added local logs that haven't hit the DB yet
          const remoteLogIds = new Set(remoteLogs.map((l: any) => l.id));
          const unsyncedLocalLogs = (prev.missionLogs || []).filter((l: any) => !remoteLogIds.has(l.id));
          merged.missionLogs = [...unsyncedLocalLogs, ...remoteLogs].slice(0, 50);

          return merged;
        });
        setHasLoadedFromDb(true);
      } catch (e) {
        console.error("Error patching statistics from Supabase:", e);
      }
    };

    if (isReal) {
      loadAllStatsFromSupabase();

      // Setup a realtime connection to synchronize entire state of Stats & logs instantly
      const userId = user!.id;
      channel = supabase
        .channel(`realtime-stats-sync-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_stats', filter: `user_id=eq.${userId}` },
          () => {
            console.log("Realtime user_stats update received.");
            loadAllStatsFromSupabase();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mission_logs', filter: `user_id=eq.${userId}` },
          () => {
            console.log("Realtime mission_logs update received.");
            loadAllStatsFromSupabase();
          }
        )
        .subscribe();
    } else {
      // Revert back to guest database values
      let baseStats = DEFAULT_STATS;
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STATS_STORAGE_KEY + "_guest");
        if (saved) {
          try {
            baseStats = sanitizeStats(JSON.parse(saved));
          } catch (e) {}
        }
      }
      setStats(baseStats);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  // Synchronize local states back to Supabase
  useEffect(() => {
    const isRealUserVal = user && isRealUserSession(user.id);

    if (isRealUserVal) {
      if (!hasLoadedFromDb) {
        console.log("Supabase sync-guard: waiting for DB statistics to load first before permitting serialize.");
        return;
      }

      // Partition local backup storage strictly under user ID so profiles never bleed!
      const userKey = STATS_STORAGE_KEY + "_" + user!.id;
      localStorage.setItem(userKey, JSON.stringify(stats));
    } else {
      // Offline Guest: backup under partitioned _guest space
      localStorage.setItem(STATS_STORAGE_KEY + "_guest", JSON.stringify(stats));
    }
  }, [stats, user, hasLoadedFromDb]);

  const addResult = React.useCallback(({ id, status, title, type, score, total, timeSpentSeconds, subject, isExam, awardImmediately = true }: {
    id?: string;
    status?: 'In Progress' | 'Completed';
    title: string;
    type: MissionLogItem['type'];
    score: number;
    total: number;
    timeSpentSeconds: number;
    subject?: SubjectCategory;
    isExam?: boolean;
    awardImmediately?: boolean;
  }) => {
    setStats((prev: any) => {
      const existingIdx = id ? prev.missionLogs.findIndex((m: any) => m.id === id) : -1;
      const existingItem = existingIdx >= 0 ? prev.missionLogs[existingIdx] : null;

      const accuracy = total > 0 ? (score / total) * 100 : 0;
      const xpBreakdown = calculateXP(score, total, isExam || type === 'Exam');
      const gainedXP = xpBreakdown.totalXP;
      
      // Determine achievements
      const isPerfect = xpBreakdown.isPerfect;
      const isHighScore = prev.missionLogs.every((m: any) => m.title !== title || m.id === id || score >= m.score);
      const isFastest = prev.missionLogs.every((m: any) => m.title !== title || m.id === id || timeSpentSeconds <= m.timeSpentSeconds);

      const targetId = id || `mission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // When awardImmediately is enabled (default for finished quizzes/exams), award XP right away
      const shouldAwardXP = awardImmediately && (!existingItem || !existingItem.redeemed);
      const xpToCredit = shouldAwardXP ? gainedXP : 0;

      const newMissionEntry: MissionLogItem = {
        id: targetId,
        title,
        type,
        score,
        total,
        accuracy,
        timeSpentSeconds,
        xpGained: gainedXP,
        date: existingItem ? existingItem.date : new Date().toISOString().split('T')[0],
        isExam,
        isPerfect,
        isHighScore,
        isFastest,
        status,
        redeemed: shouldAwardXP ? true : (existingItem ? (existingItem.redeemed || false) : false),
        subject
      };

      // Difference computation when updating
      const oldScore = existingItem ? existingItem.score : 0;
      const oldTotal = existingItem ? existingItem.total : 0;
      // Ensure whole minutes representation, with at least 1 minute if user actively completed an activity with positive time
      const oldStudyMinutes = existingItem 
        ? Math.max(existingItem.timeSpentSeconds > 0 ? 1 : 0, Math.round((existingItem.timeSpentSeconds || 0) / 60)) 
        : 0;

      const scoreDiff = score - oldScore;
      const totalDiff = total - oldTotal;
      const studyMinutes = Math.max(timeSpentSeconds > 0 ? 1 : 0, Math.round(timeSpentSeconds / 60));
      const studyMinutesDiff = studyMinutes - oldStudyMinutes;

      // Update subject mastery
      const newSubjects = { ...prev.subjects };
      if (subject && newSubjects[subject] !== undefined) {
        newSubjects[subject] = Math.round((newSubjects[subject] * 0.7) + (accuracy * 0.3));
      }

      // Update progress history
      const today = new Date().toISOString().split('T')[0];
      const newHistory = [...prev.progressHistory];
      const todayIndex = newHistory.findIndex(item => item.date === today);
      
      let updatedProgressHistoryItem;
      if (todayIndex >= 0) {
        const existing = newHistory[todayIndex];
        updatedProgressHistoryItem = {
          ...existing,
          xp: Math.round((existing.xp || 0) + xpToCredit),
          accuracy: existingItem ? accuracy : Math.round(((existing.accuracy + accuracy) / 2) * 100) / 100,
          studyMinutes: Math.max(0, Math.round((existing.studyMinutes || 0) + studyMinutesDiff))
        };
        newHistory[todayIndex] = updatedProgressHistoryItem;
      } else {
        updatedProgressHistoryItem = { 
          date: today, 
          xp: Math.round(xpToCredit), 
          accuracy: Math.round(accuracy * 100) / 100, 
          studyMinutes: Math.max(0, Math.round(studyMinutes)) 
        };
        newHistory.push(updatedProgressHistoryItem);
        if (newHistory.length > 30) newHistory.shift(); // Keep 30 days
      }

      let newMissionLogs = [...prev.missionLogs];
      if (existingIdx >= 0) {
        newMissionLogs[existingIdx] = newMissionEntry;
      } else {
        newMissionLogs = [newMissionEntry, ...prev.missionLogs].slice(0, 50); // Keep last 50 missions
      }

      // Synthesize individual learning events from this completed quiz / exam
      let updatedPerformanceMetrics = prev.performanceMetrics || createEmptyMetrics();
      let updatedAwardedBadges = [...(prev.awardedBadges || [])];

      if (total > 0 && !existingItem) {
        const events: LearningEvent[] = [];
        const avgTimeMs = total > 0 ? (timeSpentSeconds * 1000) / total : 1500;
        const sub = subject || 'Code';
        
        // Extract a clean topic name from titles like "Compiler Architecture Quiz"
        const cleanTitleWords = title.split(' ');
        const topicName = cleanTitleWords[0] || 'Fundamentals';

        for (let q = 0; q < total; q++) {
          const isCorrect = q < score;
          events.push({
            user_id: 'alex_simmons',
            course: sub,
            topic: topicName,
            correct: isCorrect,
            response_time_ms: Math.max(300, Math.round(avgTimeMs + (Math.sin(q) * (avgTimeMs * 0.15)))),
            timestamp: new Date().toISOString(),
            difficulty: isExam ? 'High' : 'Medium',
            isExam: isExam || type === 'Exam'
          });
        }

        const badgeSet = new Set<string>(updatedAwardedBadges.map(b => b.badgeId));
        let tempMetrics = { ...updatedPerformanceMetrics };

        events.forEach(ev => {
          const runRes = processLearningEvent('alex_simmons', ev, tempMetrics, badgeSet);
          tempMetrics = runRes.updatedMetrics;
          runRes.newlyAwardedBadges.forEach(aw => {
            updatedAwardedBadges.push(aw);
            badgeSet.add(aw.badgeId);
          });
        });

        updatedPerformanceMetrics = tempMetrics;
      }

      const newTotalXP = Math.max(0, (prev.totalXP || 0) + xpToCredit);
      if (xpToCredit > 0) {
        console.log(`[StatsContext:XP] addResult credited +${xpToCredit} XP for "${title}". Previous XP: ${prev.totalXP} -> New totalXP: ${newTotalXP}`);
      } else {
        console.log(`[StatsContext:XP] addResult registered "${title}" with +${gainedXP} XP available to redeem. Current totalXP: ${prev.totalXP}`);
      }

      const nextStats = {
        ...prev,
        totalXP: Math.round(newTotalXP),
        totalQuestionsAnswered: Math.max(0, Math.round(prev.totalQuestionsAnswered + totalDiff)),
        correctAnswersValue: Math.max(0, Math.round(prev.correctAnswersValue + scoreDiff)),
        quizCount: (type === 'Quiz' && !existingItem) ? prev.quizCount + 1 : prev.quizCount,
        examCount: (type === 'Exam' && !existingItem) ? prev.examCount + 1 : prev.examCount,
        totalStudyMinutes: Math.max(0, Math.round((prev.totalStudyMinutes || 0) + studyMinutesDiff)),
        subjects: newSubjects,
        progressHistory: newHistory,
        missionLogs: newMissionLogs,
        performanceMetrics: updatedPerformanceMetrics,
        awardedBadges: updatedAwardedBadges
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await saveUserStats(user.id, {
              total_xp: Math.round(nextStats.totalXP),
              total_questions_answered: Math.round(nextStats.totalQuestionsAnswered),
              correct_answers_value: Math.round(nextStats.correctAnswersValue),
              quiz_count: Math.round(nextStats.quizCount),
              exam_count: Math.round(nextStats.examCount || 0),
              total_study_minutes: Math.round(nextStats.totalStudyMinutes),
              subjects: nextStats.subjects,
              performance_metrics: nextStats.performanceMetrics
            });

            await saveMissionLog(user.id, newMissionEntry);

            if (updatedProgressHistoryItem) {
              await saveProgressHistoryItem(user.id, {
                date: updatedProgressHistoryItem.date,
                xp: Math.round(updatedProgressHistoryItem.xp),
                accuracy: Math.round(Number(updatedProgressHistoryItem.accuracy) * 100) / 100,
                study_minutes: Math.round(updatedProgressHistoryItem.studyMinutes)
              });
            }

            if (updatedAwardedBadges.length > (prev.awardedBadges || []).length) {
              const newBadges = updatedAwardedBadges.slice((prev.awardedBadges || []).length);
              for (const b of newBadges) {
                await saveAwardedBadge(user.id, b);
              }
            }
          } catch (e) {
            console.error("Error saving newly added mission result explicitly:", e);
          }
        })();
      }

      return nextStats;
    });
  }, [user]);

  const redeemReward = React.useCallback((logId: string) => {
    // Synchronously check validity against current state
    const currentTarget = (stats.missionLogs || []).find((m: any) => m.id === logId);
    if (!currentTarget || currentTarget.redeemed) {
      console.warn(`[StatsContext:XP] redeemReward: Log ${logId} not eligible for redemption (already redeemed or not found).`);
      return false;
    }

    let success = false;
    setStats((prev: any) => {
      const idx = prev.missionLogs.findIndex((m: any) => m.id === logId);
      if (idx === -1) return prev;
      const log = prev.missionLogs[idx];
      if (log.redeemed) return prev;

      success = true;
      const xpGained = log.xpGained || 0;
      const newTotalXP = Math.max(0, (prev.totalXP || 0) + xpGained);

      console.log(`[StatsContext:XP] redeemReward: Claimed +${xpGained} XP for "${log.title}". Previous XP: ${prev.totalXP} -> New totalXP: ${newTotalXP}`);

      const updatedLogs = [...prev.missionLogs];
      const updatedLog = {
        ...log,
        redeemed: true
      };
      updatedLogs[idx] = updatedLog;

      // Update progress history for the log's date (or today's date if log's date is invalid)
      const targetDate = log.date || new Date().toISOString().split('T')[0];
      const newHistory = [...prev.progressHistory];
      const dateIndex = newHistory.findIndex(item => item.date === targetDate);
      
      let updatedProgressHistoryItem;
      if (dateIndex >= 0) {
        const existing = newHistory[dateIndex];
        updatedProgressHistoryItem = {
          ...existing,
          xp: (existing.xp || 0) + xpGained
        };
        newHistory[dateIndex] = updatedProgressHistoryItem;
      } else {
        updatedProgressHistoryItem = {
          date: targetDate,
          xp: xpGained,
          accuracy: log.accuracy || 100,
          studyMinutes: 0
        };
        newHistory.push(updatedProgressHistoryItem);
        if (newHistory.length > 30) newHistory.shift();
      }

      const nextStats = {
        ...prev,
        totalXP: newTotalXP,
        missionLogs: updatedLogs,
        progressHistory: newHistory
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await saveUserStats(user.id, {
              total_xp: Math.round(nextStats.totalXP),
              total_questions_answered: Math.round(nextStats.totalQuestionsAnswered),
              correct_answers_value: Math.round(nextStats.correctAnswersValue),
              quiz_count: Math.round(nextStats.quizCount),
              exam_count: Math.round(nextStats.examCount || 0),
              total_study_minutes: Math.round(nextStats.totalStudyMinutes),
              subjects: nextStats.subjects,
              performance_metrics: nextStats.performanceMetrics
            });

            await saveMissionLog(user.id, updatedLog);

            if (updatedProgressHistoryItem) {
              await saveProgressHistoryItem(user.id, {
                date: updatedProgressHistoryItem.date,
                xp: Math.round(updatedProgressHistoryItem.xp),
                accuracy: Math.round(Number(updatedProgressHistoryItem.accuracy) * 100) / 100,
                study_minutes: Math.round(updatedProgressHistoryItem.studyMinutes)
              });
            }
          } catch (e) {
            console.error("Error saving redeemed reward explicitly:", e);
          }
        })();
      }

      return nextStats;
    });
    return true;
  }, [user, stats.missionLogs]);

  const awardXP = React.useCallback((amount: number, reason?: string) => {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      console.warn(`[StatsContext:XP] awardXP: Invalid XP amount (${amount}) rejected.`);
      return;
    }

    setStats((prev: any) => {
      const currentXP = prev.totalXP || 0;
      const newTotalXP = Math.max(0, currentXP + amount);
      console.log(`[StatsContext:XP] awardXP: Crediting +${amount} XP (${reason || 'Activity'}). Previous XP: ${currentXP} -> New totalXP: ${newTotalXP}`);

      const today = new Date().toISOString().split('T')[0];
      const newHistory = [...(prev.progressHistory || [])];
      const dateIndex = newHistory.findIndex(item => item.date === today);

      let updatedProgressHistoryItem;
      if (dateIndex >= 0) {
        const existing = newHistory[dateIndex];
        updatedProgressHistoryItem = {
          ...existing,
          xp: (existing.xp || 0) + amount
        };
        newHistory[dateIndex] = updatedProgressHistoryItem;
      } else {
        updatedProgressHistoryItem = {
          date: today,
          xp: amount,
          accuracy: 100,
          studyMinutes: 0
        };
        newHistory.push(updatedProgressHistoryItem);
        if (newHistory.length > 30) newHistory.shift();
      }

      const nextStats = {
        ...prev,
        totalXP: newTotalXP,
        progressHistory: newHistory
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await saveUserStats(user.id, {
              total_xp: Math.round(nextStats.totalXP),
              total_questions_answered: Math.round(nextStats.totalQuestionsAnswered),
              correct_answers_value: Math.round(nextStats.correctAnswersValue),
              quiz_count: Math.round(nextStats.quizCount),
              exam_count: Math.round(nextStats.examCount || 0),
              total_study_minutes: Math.round(nextStats.totalStudyMinutes),
              subjects: nextStats.subjects,
              performance_metrics: nextStats.performanceMetrics
            });

            if (updatedProgressHistoryItem) {
              await saveProgressHistoryItem(user.id, {
                date: updatedProgressHistoryItem.date,
                xp: Math.round(updatedProgressHistoryItem.xp),
                accuracy: Math.round(Number(updatedProgressHistoryItem.accuracy) * 100) / 100,
                study_minutes: Math.round(updatedProgressHistoryItem.studyMinutes)
              });
            }
          } catch (e) {
            console.error("[StatsContext:XP] Error saving awarded XP to Supabase:", e);
          }
        })();
      }

      return nextStats;
    });
  }, [user]);

  const pushLearningEventLocal = React.useCallback((event: LearningEvent) => {
    const badgeSet = new Set<string>((stats.awardedBadges || []).map((b: any) => b.badgeId));
    const tempMetrics = stats.performanceMetrics || createEmptyMetrics();
    const result = processLearningEvent(event.user_id, event, tempMetrics, badgeSet);

    setStats((prev: any) => {
      const updatedAwarded = [...(prev.awardedBadges || [])];
      result.newlyAwardedBadges.forEach(aw => {
        updatedAwarded.push(aw);
      });
      const nextStats = {
        ...prev,
        performanceMetrics: result.updatedMetrics,
        awardedBadges: updatedAwarded
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await saveUserStats(user.id, {
              total_xp: Math.round(nextStats.totalXP),
              total_questions_answered: Math.round(nextStats.totalQuestionsAnswered),
              correct_answers_value: Math.round(nextStats.correctAnswersValue),
              quiz_count: Math.round(nextStats.quizCount),
              exam_count: Math.round(nextStats.examCount || 0),
              total_study_minutes: Math.round(nextStats.totalStudyMinutes),
              subjects: nextStats.subjects,
              performance_metrics: nextStats.performanceMetrics
            });
            if (result.newlyAwardedBadges.length > 0) {
              for (const aw of result.newlyAwardedBadges) {
                await saveAwardedBadge(user.id, aw);
              }
            }
          } catch (e) {
            console.error("Error saving learning event explicitly in Supabase:", e);
          }
        })();
      }

      return nextStats;
    });

    return result;
  }, [stats.awardedBadges, stats.performanceMetrics, user]);

  const resetBadgeSystem = React.useCallback(() => {
    setStats((prev: any) => {
      const seedResult = generateSeededMetricsAndBadges('alex_simmons');
      const nextStats = {
        ...prev,
        performanceMetrics: seedResult.metrics,
        awardedBadges: seedResult.awardedBadges
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await clearAwardedBadges(user.id);
            for (const badge of seedResult.awardedBadges) {
              await saveAwardedBadge(user.id, badge);
            }
            await saveUserStats(user.id, {
              total_xp: Math.round(nextStats.totalXP),
              total_questions_answered: Math.round(nextStats.totalQuestionsAnswered),
              correct_answers_value: Math.round(nextStats.correctAnswersValue),
              quiz_count: Math.round(nextStats.quizCount),
              exam_count: Math.round(nextStats.examCount || 0),
              total_study_minutes: Math.round(nextStats.totalStudyMinutes),
              subjects: nextStats.subjects,
              performance_metrics: nextStats.performanceMetrics
            });
          } catch (e) {
            console.error("Error resetting badge system explicitly in Supabase:", e);
          }
        })();
      }

      return nextStats;
    });
  }, [user]);

  const clearBadges = React.useCallback(() => {
    setStats((prev: any) => {
      const nextStats = {
        ...prev,
        awardedBadges: []
      };

      const isReal = user && isRealUserSession(user.id);
      if (isReal) {
        (async () => {
          try {
            await clearAwardedBadges(user.id);
          } catch (e) {
            console.error("Error clearing badges explicitly in Supabase:", e);
          }
        })();
      }

      return nextStats;
    });
  }, [user]);

  const overallAccuracy = stats.totalQuestionsAnswered > 0 
    ? (stats.correctAnswersValue / stats.totalQuestionsAnswered) * 100 
    : 0;

  const studyVelocity = stats.totalStudyMinutes / (stats.progressHistory.length || 1) / 60;
  
  const rankInfo = calculateLevelFromXP(stats.totalXP);

  // Runtime State Verification for live XP synchronization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__STUDIBL_XP_STATE__ = {
        totalXP: stats.totalXP,
        level: rankInfo.level,
        rankTitle: rankInfo.rankTitle,
        missionLogsCount: (stats.missionLogs || []).length,
        timestamp: Date.now()
      };
    }
  }, [stats.totalXP, stats.missionLogs, rankInfo.level, rankInfo.rankTitle]);

  return (
    <StatsContext.Provider value={{
      totalXP: stats.totalXP,
      level: rankInfo.level,
      rankTitle: rankInfo.rankTitle,
      overallAccuracy,
      studyVelocity,
      subjects: stats.subjects,
      progressHistory: stats.progressHistory,
      missionLogs: stats.missionLogs,
      totalQuestionsAnswered: stats.totalQuestionsAnswered,
      correctAnswersValue: stats.correctAnswersValue,
      quizCount: stats.quizCount,
      examCount: stats.examCount,
      totalStudyMinutes: stats.totalStudyMinutes,
      loading: user && isRealUserSession(user.id) ? !hasLoadedFromDb : false,
      addResult,
      redeemReward,
      awardXP,
      performanceMetrics: stats.performanceMetrics || createEmptyMetrics(),
      awardedBadges: stats.awardedBadges || [],
      pushLearningEvent: pushLearningEventLocal,
      resetBadgeSystem,
      clearBadges,
    }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (context === undefined) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
}
