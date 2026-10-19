import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useStreak } from './StreakContext';
import { useStats } from './StatsContext';
import { supabase } from '../supabaseClient';
import { isRealUserSession } from './supabaseService';

// ==========================================
// 1. TYPES & INTERFACES DEFINITIONS
// ==========================================

export interface CourseSummary {
  code: string;
  name: string;
}

export interface SemesterResult {
  id: string;
  semester_name: string;
  gpa: number;
  total_credit_units: number;
  courses_grades: Array<{
    course_code: string;
    course_name?: string;
    grade: string;
    credit_units: number;
  }>;
}

export interface CoursePerformance {
  course_code: string;
  course_name: string;
  mastery_percentage: number;
  concept_retention_percentage: number;
  exam_readiness_percentage: number;
  knowledge_gap_percentage: number;
  course_completion_percentage: number;
  study_minutes: number;
  quizzes_taken: number;
}

export interface CoursePrediction {
  course_code: string;
  expected_score: number;
  expected_grade: string;
  pass_probability: number;
  failure_probability: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  risk_score: number;
}

export interface AcademicHealth {
  score: number;
  status: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';
  trend: 'Improving' | 'Stable' | 'Declining';
}

export interface WeakTopic {
  course_code: string;
  weak_topics: string[];
  mastery: number;
}

export interface KnowledgeNode {
  name: string;
  subtopics: string[];
  difficulty: number; // 1-10
  importance: number; // 1-10
  formulas: string[];
  concepts: string[];
}

export interface CourseKnowledgeGraph {
  course_code: string;
  nodes: KnowledgeNode[];
}

export interface AcademicRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'study' | 'quiz' | 'revision' | 'generic';
}

export interface AcademicIntelligenceContextType {
  historicalSemesters: SemesterResult[];
  coursePerformances: CoursePerformance[];
  coursePredictions: CoursePrediction[];
  weakTopicsList: WeakTopic[];
  academicHealth: AcademicHealth;
  recommendations: AcademicRecommendation[];
  knowledgeGraphs: Record<string, CourseKnowledgeGraph>;
  simulatedGrades: Record<string, string>; // e.g. { "MTH201": "A" }
  loading: boolean;
  isAiRecommendationsLoading: boolean;
  isKnowledgeExtracting: Record<string, boolean>;
  
  // Dynamic Calculated Forecasts
  currentGPA: number;
  currentCGPA: number;
  predictedGPA: number;
  predictedCGPA: number;
  bestCaseGPA: number;
  bestCaseCGPA: number;
  worstCaseGPA: number;
  worstCaseCGPA: number;
  modelConfidence: number;
  currentClassification: string;
  projectedClassification: string;
  graduationClassification: string;

  // Actions
  addHistoricalSemester: (semester: Omit<SemesterResult, 'id'>) => Promise<void>;
  deleteHistoricalSemester: (id: string) => Promise<void>;
  updateSimulatedGrade: (courseCode: string, grade: string) => void;
  resetSimulation: () => void;
  extractCourseSyllabusIntelligence: (courseCode: string, courseName: string, textContext: string) => Promise<void>;
  triggerAiRecommendations: () => Promise<void>;
}

const AcademicIntelligenceContext = createContext<AcademicIntelligenceContextType | undefined>(undefined);

// ==========================================
// 2. NIGERIAN 5.00 GRADING SYSTEM MAPPINGS
// ==========================================

export const NIGERIAN_GRADES_MAP: Record<string, number> = {
  'A': 5,
  'B': 4,
  'C': 3,
  'D': 2,
  'E': 1,
  'F': 0
};

/**
 * Returns letter grade based on quantitative percentage score
 */
export function getNigerianGradeFromScore(score: number): string {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

/**
 * Returns standard grade point based on quantitative score
 */
export function getGradePointFromScore(score: number): number {
  const grade = getNigerianGradeFromScore(score);
  return NIGERIAN_GRADES_MAP[grade] ?? 0;
}

/**
 * Determines classic degree classification of a given CGPA score
 */
export function getClassificationFromCGPA(cgpa: number): string {
  if (cgpa >= 4.50) return 'First Class';
  if (cgpa >= 3.50) return 'Second Class Upper';
  if (cgpa >= 2.40) return 'Second Class Lower';
  if (cgpa >= 1.50) return 'Third Class';
  if (cgpa >= 1.00) return 'Pass';
  return 'Fail';
}

// ==========================================
// 3. CENTRAL REDUX-FREE STATE PROVIDER
// ==========================================

export function AcademicIntelligenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() || {};
  const { consistency } = useStreak() || { consistency: 0 };
  const { totalXP, overallAccuracy, totalStudyMinutes } = useStats() || { totalXP: 0, overallAccuracy: 0, totalStudyMinutes: 0 };

  const isRealUser = useMemo(() => !!(user && isRealUserSession(user.id)), [user]);

  // DB States
  const [historicalSemesters, setHistoricalSemesters] = useState<SemesterResult[]>([]);
  const [dbCoursePerformances, setDbCoursePerformances] = useState<CoursePerformance[]>([]);
  const [dbCoursePredictions, setDbCoursePredictions] = useState<CoursePrediction[]>([]);
  const [dbWeakTopicsList, setDbWeakTopicsList] = useState<WeakTopic[]>([]);
  const [dbAcademicHealth, setDbAcademicHealth] = useState<AcademicHealth | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<AcademicRecommendation[]>([]);
  const [knowledgeGraphs, setKnowledgeGraphs] = useState<Record<string, CourseKnowledgeGraph>>({});

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [isAiRecommendationsLoading, setIsAiRecommendationsLoading] = useState<boolean>(false);
  const [isKnowledgeExtracting, setIsKnowledgeExtracting] = useState<Record<string, boolean>>({});

  // What-If Simulator state (keeps temporary values chosen by user in Dashboard)
  const [simulatedGrades, setSimulatedGrades] = useState<Record<string, string>>({});

  // Map courses enrolled from onboarding
  const onboardingCourses: CourseSummary[] = useMemo(() => {
    const rawCourses = user?.user_metadata?.selected_courses || [];
    return rawCourses
      .filter((c: any) => {
        if (typeof c === 'string') return c !== 'My Uploads';
        if (c && typeof c === 'object') return (c.name !== 'My Uploads' && c.code !== 'My Uploads' && c.id !== 'My Uploads');
        return true;
      })
      .map((c: any) => {
        if (typeof c === 'string') {
          return { code: c.toUpperCase(), name: `${c.toUpperCase()} Lecture Materials` };
        }
        return {
          code: (c.code || c.id || '').toUpperCase(),
          name: c.name || `${(c.code || c.id || '').toUpperCase()} Study course`
        };
      });
  }, [user]);

  // ==========================================
  // 4. MAIN DYNAMIC PREDICTIVE ENGINE
  // ==========================================

  // Query and fetch logs + file progress for user dynamically
  const [missionLogs, setMissionLogs] = useState<any[]>([]);
  const [docProgress, setDocProgress] = useState<any[]>([]);
  const [lecturesList, setLecturesList] = useState<any[]>([]);

  const fetchRealTimeMetrics = React.useCallback(async () => {
    if (!isRealUser) {
      setLoading(false);
      return;
    }
    try {
      const userId = user!.id;
      const safeQuery = async <T,>(builder: any): Promise<{ data: T | null }> => {
        try {
          return await builder;
        } catch {
          return { data: null };
        }
      };

      const [
        semestersRes,
        performancesRes,
        predictionsRes,
        weakRes,
        healthRes,
        logsRes,
        docRes,
        lecturesRes,
        recRes
      ] = await Promise.all([
        safeQuery<SemesterResult[]>(supabase.from('semester_results').select('*').eq('user_id', userId).order('created_at', { ascending: true })),
        safeQuery<CoursePerformance[]>(supabase.from('course_performance').select('*').eq('user_id', userId)),
        safeQuery<CoursePrediction[]>(supabase.from('course_predictions').select('*').eq('user_id', userId)),
        safeQuery<WeakTopic[]>(supabase.from('weak_topics').select('*').eq('user_id', userId)),
        safeQuery<AcademicHealth>(supabase.from('academic_health').select('*').eq('user_id', userId).maybeSingle()),
        safeQuery<any[]>(supabase.from('mission_logs').select('*').eq('user_id', userId)),
        safeQuery<any[]>(supabase.from('document_progress').select('*').eq('user_id', userId)),
        safeQuery<any[]>(supabase.from('lectures').select('*')),
        safeQuery<{ content: string }>(supabase.from('saved_ai_content').select('*').eq('user_id', userId).eq('type', 'academic-recommendations').maybeSingle())
      ]);

      if (semestersRes.data) {
        setHistoricalSemesters(semestersRes.data as SemesterResult[]);
      }
      if (performancesRes.data && performancesRes.data.length > 0) {
        setDbCoursePerformances(performancesRes.data as CoursePerformance[]);
      }
      if (predictionsRes.data && predictionsRes.data.length > 0) {
        setDbCoursePredictions(predictionsRes.data as CoursePrediction[]);
      }
      if (weakRes.data && weakRes.data.length > 0) {
        setDbWeakTopicsList(weakRes.data as WeakTopic[]);
      }
      if (healthRes.data) {
        setDbAcademicHealth(healthRes.data as AcademicHealth);
      }
      if (logsRes.data) {
        setMissionLogs(logsRes.data);
      }
      if (docRes.data) {
        setDocProgress(docRes.data);
      }
      if (lecturesRes.data) {
        setLecturesList(lecturesRes.data);
      }
      if (recRes.data && recRes.data.content) {
        try {
          const parsed = JSON.parse(recRes.data.content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAiRecommendations(parsed);
          }
        } catch (e) {
          console.warn("Could not parse saved recommendations:", e);
        }
      }
      setErrorStatus(null);
    } catch (err) {
      console.warn("Notice: reading academic intelligence tables:", err);
    } finally {
      setLoading(false);
    }
  }, [isRealUser, user]);

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Load and subscribe on mount or user shift
  useEffect(() => {
    fetchRealTimeMetrics();

    if (isRealUser) {
      const userId = user!.id;
      // Realtime subscription mapping
      const channel = supabase
        .channel(`realtime-academic-intel-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'semester_results', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'course_performance', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'course_predictions', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'weak_topics', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_health', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_logs', filter: `user_id=eq.${userId}` }, () => fetchRealTimeMetrics())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isRealUser, user, fetchRealTimeMetrics]);

  // Dynamic calculations combining pre-seeded database metrics & live onboarding courses
  const coursePerformances: CoursePerformance[] = useMemo(() => {
    return onboardingCourses.map(course => {
      // Find matching db metrics
      const matched = dbCoursePerformances.find(p => p.course_code.toUpperCase() === course.code);
      
      // Calculate from live logs
      const courseLogs = missionLogs.filter(l => {
        const sub = (l.subject || '').toUpperCase();
        const title = (l.title || '').toUpperCase();
        return sub === course.code || title.includes(course.code);
      });

      const quizzesTaken = courseLogs.length;
      let calculatedAccuracySum = 0;
      courseLogs.forEach(lg => {
        calculatedAccuracySum += Number(lg.accuracy || (lg.score / lg.total * 100) || 0);
      });
      const rawAvgAccuracy = quizzesTaken > 0 ? calculatedAccuracySum / quizzesTaken : 0;

      // Track completions from document_progress
      const courseLectures = lecturesList.filter(l => (l.course || '').toUpperCase() === course.code);
      let calculatedCompletion = 0;
      if (courseLectures.length > 0) {
        let finishedCount = 0;
        courseLectures.forEach(lec => {
          const finished = docProgress.some(p => p.lecture_id === lec.id && p.progress >= 95);
          if (finished) finishedCount++;
        });
        calculatedCompletion = Math.round((finishedCount / courseLectures.length) * 100);
      } else {
        // Fallback baseline for completion if they studied minutes
        calculatedCompletion = matched ? Number(matched.course_completion_percentage) : 0;
      }

      // Pro-rate central mastery
      const baselineMastery = quizzesTaken > 0 ? rawAvgAccuracy : (matched ? Number(matched.mastery_percentage) : 0);
      const docFactor = calculatedCompletion * 0.25; // 25% of completion contributes to mastery
      const calculatedMastery = Math.min(100, Math.round(baselineMastery * 0.75 + docFactor));

      const conceptRetention = Math.min(100, Math.round(calculatedMastery * 0.9 + (consistency * 0.1)));
      const examReadiness = Math.min(100, Math.round((calculatedMastery + calculatedCompletion + consistency) / 3));

      // Calculate total study minutes for this course
      const sumMinutes = courseLogs.reduce((acc, log) => acc + (log.time_spent_seconds || 0) / 60, 0);

      return {
        course_code: course.code,
        course_name: course.name,
        mastery_percentage: calculatedMastery,
        concept_retention_percentage: conceptRetention,
        exam_readiness_percentage: examReadiness,
        knowledge_gap_percentage: 100 - calculatedMastery,
        course_completion_percentage: calculatedCompletion || (quizzesTaken > 0 ? 100 : 0),
        study_minutes: Math.round(sumMinutes) || (matched ? Number(matched.study_minutes) : 0),
        quizzes_taken: quizzesTaken || (matched ? Number(matched.quizzes_taken) : 0)
      };
    });
  }, [onboardingCourses, dbCoursePerformances, missionLogs, lecturesList, docProgress, consistency]);

  const coursePredictions: CoursePrediction[] = useMemo(() => {
    return coursePerformances.map(perf => {
      const matchPred = dbCoursePredictions.find(p => p.course_code.toUpperCase() === perf.course_code);
      
      // Calculate score expected
      const mastery = perf.mastery_percentage;
      const expectedScore = mastery > 0 ? mastery : (matchPred ? Number(matchPred.expected_score) : 0);
      const expectedGrade = getNigerianGradeFromScore(expectedScore);

      // Pass Probability math
      let passProb = 0;
      if (expectedScore >= 40) {
        passProb = Math.min(99, Math.round(40 + (expectedScore - 40) * 1.0 + consistency * 0.1));
      } else {
        passProb = Math.max(5, Math.round(expectedScore * 1.1 + consistency * 0.1));
      }

      // Risk score: high risk if expected score is low or pass prob is low
      const riskScore = Math.max(0, 100 - passProb);
      let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Critical';
      if (riskScore < 20) riskLevel = 'Low';
      else if (riskScore < 55) riskLevel = 'Medium';
      else if (riskScore < 80) riskLevel = 'High';

      return {
        course_code: perf.course_code,
        expected_score: Math.round(expectedScore),
        expected_grade: expectedGrade,
        pass_probability: passProb,
        failure_probability: 100 - passProb,
        risk_level: riskLevel,
        risk_score: riskScore
      };
    });
  }, [coursePerformances, dbCoursePredictions, consistency]);

  /**
   * MEMOIZED CALCULATION: Active topic gaps and learning weaknesses.
   * Based entirely on authenticated user course mastery and performance analytics.
   * Resolved without any mock placeholders or hardcoded fallback topics.
   */
  const weakTopicsList: WeakTopic[] = useMemo(() => {
    return coursePerformances.map(perf => {
      const matchWeak = dbWeakTopicsList.find(w => w.course_code.toUpperCase() === perf.course_code);
      
      return {
        course_code: perf.course_code,
        weak_topics: (matchWeak && Array.isArray(matchWeak.weak_topics)) ? matchWeak.weak_topics : [],
        mastery: perf.mastery_percentage
      };
    });
  }, [coursePerformances, dbWeakTopicsList]);

  /**
   * MEMOIZED CALCULATION: Evaluates overall academic health score and status trend.
   * This is computed as a weighted aggregate of Course Mastery (40%), daily streak consistency (30%), 
   * and overall exercise accuracy (30%). Falls back strictly to zero if no data is found.
   */
  const academicHealth: AcademicHealth = useMemo(() => {
    // Allocation of model component weights
    const masteryWeight = 0.4;
    const consistencyWeight = 0.3;
    const accuracyWeight = 0.3;

    let averageMastery = 0;
    if (coursePerformances.length > 0) {
      averageMastery = coursePerformances.reduce((acc, p) => acc + p.mastery_percentage, 0) / coursePerformances.length;
    }

    const calculatedScore = Math.min(100, Math.round(
      averageMastery * masteryWeight +
      consistency * consistencyWeight +
      overallAccuracy * accuracyWeight
    )) || (dbAcademicHealth ? dbAcademicHealth.score : 0);

    let status: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical' = 'Needs Improvement';
    if (calculatedScore >= 80) status = 'Excellent';
    else if (calculatedScore >= 60) status = 'Good';
    else if (calculatedScore >= 45) status = 'Needs Improvement';
    else status = 'Critical';

    let trend: 'Improving' | 'Stable' | 'Declining' = 'Stable';
    if (consistency > 70 && overallAccuracy > 70) trend = 'Improving';
    else if (consistency < 40 && consistency > 0) trend = 'Declining';

    return {
      score: calculatedScore,
      status,
      trend
    };
  }, [coursePerformances, consistency, overallAccuracy, dbAcademicHealth]);

  // Synchronise dynamic predictions to database
  useEffect(() => {
    const isReal = user && isRealUserSession(user.id);
    if (isReal && coursePerformances.length > 0) {
      const syncDebounce = setTimeout(async () => {
        try {
          const userId = user!.id;
          
          // Upsert academic health
          await supabase.from('academic_health').upsert({
            user_id: userId,
            score: academicHealth.score,
            status: academicHealth.status,
            trend: academicHealth.trend,
            updated_at: new Date().toISOString()
          });

          // Upsert performances & predictions in background
          for (const perf of coursePerformances) {
            await supabase.from('course_performance').upsert({
              user_id: userId,
              course_code: perf.course_code,
              mastery_percentage: perf.mastery_percentage,
              concept_retention_percentage: perf.concept_retention_percentage,
              exam_readiness_percentage: perf.exam_readiness_percentage,
              knowledge_gap_percentage: perf.knowledge_gap_percentage,
              course_completion_percentage: perf.course_completion_percentage,
              study_minutes: Math.round(Number(perf.study_minutes) || 0),
              quizzes_taken: Math.round(Number(perf.quizzes_taken) || 0),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,course_code' });
          }

          for (const pred of coursePredictions) {
            await supabase.from('course_predictions').upsert({
              user_id: userId,
              course_code: pred.course_code,
              expected_score: pred.expected_score,
              expected_grade: pred.expected_grade,
              pass_probability: pred.pass_probability,
              failure_probability: pred.failure_probability,
              risk_level: pred.risk_level,
              risk_score: pred.risk_score,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,course_code' });
          }
        } catch (e) {
          console.error("Failed to sync background academic parameters:", e);
        }
      }, 5000); // 5 seconds debounce to avoid writing database on rapid updates!

      return () => clearTimeout(syncDebounce);
    }
  }, [user, coursePerformances, coursePredictions, academicHealth]);

  // ==========================================
  // 5. MATH GPA AND FORECAST ENGINES
  // ==========================================

  // GPAs calculated matching credit units pro-rata
  const dynamicActiveSemesterGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    onboardingCourses.forEach(course => {
      // credit units default to 3
      const cu = 3;
      const simulatedGrade = simulatedGrades[course.code];
      let gp = 0;

      if (simulatedGrade) {
        gp = NIGERIAN_GRADES_MAP[simulatedGrade] ?? 0;
      } else {
        const pred = coursePredictions.find(p => p.course_code === course.code);
        gp = pred ? (NIGERIAN_GRADES_MAP[pred.expected_grade] ?? 0) : 0;
      }

      gpSum += (cu * gp);
      cuSum += cu;
    });

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : 0;
  }, [onboardingCourses, coursePredictions, simulatedGrades]);

  // Current GPA without simulator
  const currentGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    onboardingCourses.forEach(course => {
      const cu = 3;
      const pred = coursePredictions.find(p => p.course_code === course.code);
      const gp = pred ? (NIGERIAN_GRADES_MAP[pred.expected_grade] ?? 0) : 0;

      gpSum += (cu * gp);
      cuSum += cu;
    });

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : 0;
  }, [onboardingCourses, coursePredictions]);

  // Combined CGPA including past historical inputs
  const currentCGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    historicalSemesters.forEach(sem => {
      const gpa = Number(sem.gpa);
      const cu = Number(sem.total_credit_units) || 15; // default 15
      gpSum += (gpa * cu);
      cuSum += cu;
    });

    // Add current active semester WITHOUT simulator to find static current standing
    if (onboardingCourses.length > 0) {
      const activeCU = onboardingCourses.length * 3;
      gpSum += (currentGPA * activeCU);
      cuSum += activeCU;
    }

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : currentGPA;
  }, [historicalSemesters, onboardingCourses, currentGPA]);

  // Projected CGPA including simulator grades
  const predictedCGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    historicalSemesters.forEach(sem => {
      const gpa = Number(sem.gpa);
      const cu = Number(sem.total_credit_units) || 15;
      gpSum += (gpa * cu);
      cuSum += cu;
    });

    if (onboardingCourses.length > 0) {
      const activeCU = onboardingCourses.length * 3;
      gpSum += (dynamicActiveSemesterGPA * activeCU);
      cuSum += activeCU;
    }

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : dynamicActiveSemesterGPA;
  }, [historicalSemesters, onboardingCourses, dynamicActiveSemesterGPA]);

  // Best Case GPA
  const bestCaseGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    onboardingCourses.forEach(course => {
      const cu = 3;
      // Assume 'A' (5) for courses currently passing or active simulation, else B
      const pred = coursePredictions.find(p => p.course_code === course.code);
      let gp = 5; // perfection point
      if (pred && pred.expected_grade === 'F') {
        gp = 3; // cap rise limit
      }
      gpSum += (cu * gp);
      cuSum += cu;
    });

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : 5.00;
  }, [onboardingCourses, coursePredictions]);

  const bestCaseCGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    historicalSemesters.forEach(sem => {
      const gpa = Number(sem.gpa);
      const cu = Number(sem.total_credit_units) || 15;
      gpSum += (gpa * cu);
      cuSum += cu;
    });

    if (onboardingCourses.length > 0) {
      const activeCU = onboardingCourses.length * 3;
      gpSum += (bestCaseGPA * activeCU);
      cuSum += activeCU;
    }

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : bestCaseGPA;
  }, [historicalSemesters, onboardingCourses, bestCaseGPA]);

  // Worst Case GPA
  const worstCaseGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    onboardingCourses.forEach(course => {
      const cu = 3;
      const pred = coursePredictions.find(p => p.course_code === course.code);
      let gp = 0;
      if (pred) {
        const standardGP = NIGERIAN_GRADES_MAP[pred.expected_grade] ?? 0;
        gp = Math.max(0, standardGP - 1); // reduce by 1 grade point grade drop
      }
      gpSum += (cu * gp);
      cuSum += cu;
    });

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : 0;
  }, [onboardingCourses, coursePredictions]);

  const worstCaseCGPA = useMemo(() => {
    let gpSum = 0;
    let cuSum = 0;

    historicalSemesters.forEach(sem => {
      const gpa = Number(sem.gpa);
      const cu = Number(sem.total_credit_units) || 15;
      gpSum += (gpa * cu);
      cuSum += cu;
    });

    if (onboardingCourses.length > 0) {
      const activeCU = onboardingCourses.length * 3;
      gpSum += (worstCaseGPA * activeCU);
      cuSum += activeCU;
    }

    return cuSum > 0 ? Number((gpSum / cuSum).toFixed(2)) : worstCaseGPA;
  }, [historicalSemesters, onboardingCourses, worstCaseGPA]);

  // Model confidence percentage based on how much diagnosing data is read
  const modelConfidence = useMemo(() => {
    let base = 30; // default startup prediction confidence
    
    // Add weights for inputs
    if (historicalSemesters.length > 0) {
      base += Math.round(historicalSemesters.length * 15); // up to 45% bonus for historical tracking
    }
    
    let quizSum = 0;
    coursePerformances.forEach(p => {
      quizSum += p.quizzes_taken;
    });
    base += Math.min(25, quizSum * 4); // quiz diagnostic data

    let completeSum = 0;
    coursePerformances.forEach(p => {
      if (p.course_completion_percentage > 50) completeSum++;
    });
    base += Math.min(10, completeSum * 4); // reading logs confidence

    return Math.min(98, base);
  }, [historicalSemesters, coursePerformances]);

  // Standings Degree Classifications
  const currentClassification = useMemo(() => getClassificationFromCGPA(currentCGPA), [currentCGPA]);
  const projectedClassification = useMemo(() => getClassificationFromCGPA(predictedCGPA), [predictedCGPA]);
  const graduationClassification = useMemo(() => getClassificationFromCGPA(predictedCGPA), [predictedCGPA]);

  // ==========================================
  // 6. DB ACTION HANDLERS (Historical Semesters)
  // ==========================================

  const addHistoricalSemester = async (sem: Omit<SemesterResult, 'id'>) => {
    try {
      if (isRealUser) {
        const userId = user!.id;
        const { error } = await supabase
          .from('semester_results')
          .insert({
            user_id: userId,
            semester_name: sem.semester_name,
            gpa: sem.gpa,
            total_credit_units: sem.total_credit_units,
            courses_grades: sem.courses_grades,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        await fetchRealTimeMetrics();
      } else {
        // Fallback transient sandbox state add
        const newObj: SemesterResult = {
          ...sem,
          id: Math.random().toString(36).substring(7)
        };
        setHistoricalSemesters(prev => [...prev, newObj]);
      }
    } catch (e) {
      console.error("Error adding semester result details:", e);
      throw e;
    }
  };

  const deleteHistoricalSemester = async (id: string) => {
    try {
      if (isRealUser) {
        const { error } = await supabase
          .from('semester_results')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchRealTimeMetrics();
      } else {
        // Sandbox update
        setHistoricalSemesters(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error("Error deleting semester result:", e);
      throw e;
    }
  };

  // ==========================================
  // 7. SIMULATOR TRIGGERS
  // ==========================================

  const updateSimulatedGrade = (courseCode: string, grade: string) => {
    setSimulatedGrades(prev => ({
      ...prev,
      [courseCode.toUpperCase()]: grade.toUpperCase()
    }));
  };

  const resetSimulation = () => {
    setSimulatedGrades({});
  };

  // ==========================================
  // 8. AI KNOWLEDGE DISPATCHERS
  // ==========================================

  /**
   * Dispatches course text content extracts to the server to structure a
   * Course Knowledge Graph. Stores the resulting topics in Supabase.
   */
  const extractCourseSyllabusIntelligence = async (courseCode: string, courseName: string, textContext: string) => {
    setIsKnowledgeExtracting(prev => ({ ...prev, [courseCode]: true }));
    try {
      if (!isRealUser) {
        // Fallback offline dynamic mock structure without API call
        const fallbackGraph: CourseKnowledgeGraph = {
          course_code: courseCode,
          nodes: [
            {
              name: "Syllabus Introductory Concepts",
              subtopics: ["Foundations & Terminology", "First principles"],
              difficulty: 3,
              importance: 8,
              formulas: [],
              concepts: ["Primary objective definitions"]
            }
          ]
        };
        setKnowledgeGraphs(prev => ({
          ...prev,
          [courseCode]: fallbackGraph
        }));
        return;
      }

      // Read active JWT token
      let accessToken = '';
      try {
        const session = (await supabase.auth.getSession()).data?.session;
        accessToken = session?.access_token || '';
      } catch {
        // Fallback for offline or local preview
      }

      let resData: any = null;
      try {
        const response = await fetch('/api/academic/extract-knowledge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : 'Bearer sandbox-token'
          },
          body: JSON.stringify({
            course_code: courseCode,
            course_name: courseName,
            content: textContext
          })
        });

        if (response.ok) {
          resData = await response.json();
        }
      } catch (fetchErr) {
        console.warn("Notice: extract-knowledge server endpoint unreachable, utilizing structured syllabus fallback:", fetchErr);
      }

      if (resData?.success && resData?.graph) {
        const extractedNodes: KnowledgeNode[] = resData.graph.topics || [];
        const graph: CourseKnowledgeGraph = {
          course_code: courseCode,
          nodes: extractedNodes
        };
        
        setKnowledgeGraphs(prev => ({
          ...prev,
          [courseCode]: graph
        }));

        // Extract weak topics list and save to weak_topics safely
        const topics = extractedNodes.slice(0, 3).map(n => n.name);
        if (user && isRealUserSession(user.id)) {
          try {
            await supabase.from('weak_topics').upsert({
              user_id: user.id,
              course_code: courseCode,
              weak_topics: topics,
              mastery: coursePerformances.find(p => p.course_code === courseCode)?.mastery_percentage || 50,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,course_code' });
          } catch {
            // Safe ignore on offline database
          }
        }

        await fetchRealTimeMetrics();
      } else {
        // In case of extraction failure or offline, assign baseline course graph
        const fallbackGraph: CourseKnowledgeGraph = {
          course_code: courseCode,
          nodes: [
            {
              name: `${courseCode} Core Competencies`,
              subtopics: ["Foundations & Terminology", "Practical Applications", "Problem Solving"],
              difficulty: 5,
              importance: 9,
              formulas: [],
              concepts: ["Fundamental theorems and formulas"]
            }
          ]
        };
        setKnowledgeGraphs(prev => ({
          ...prev,
          [courseCode]: fallbackGraph
        }));
      }
    } catch (err) {
      console.warn("Notice: knowledge graph extraction pipeline used fallback:", err);
    } finally {
      setIsKnowledgeExtracting(prev => ({ ...prev, [courseCode]: false }));
    }
  };

  /**
   * Generates tailored, pedagogical recommendations based on current student telemetry
   */
  const generateDynamicClientRecommendations = React.useCallback((): AcademicRecommendation[] => {
    const recs: AcademicRecommendation[] = [];

    // 1. Weak Concept Mastery Target
    if (weakTopicsList && weakTopicsList.length > 0) {
      const topWeak = weakTopicsList[0];
      const topicName = topWeak.weak_topics?.[0] || 'Core Principles';
      recs.push({
        id: `rec-weakness-${topWeak.course_code.toLowerCase()}`,
        title: `Bridge ${topicName} in ${topWeak.course_code}`,
        description: `Concept diagnostics flag ${topicName} as a priority focus. Reviewing lecture materials and taking a quick quiz will elevate topic mastery.`,
        priority: 'High',
        type: 'revision'
      });
    }

    // 2. Academic Health Index & Consistency
    if (academicHealth.score < 75) {
      recs.push({
        id: 'rec-health-boost',
        title: 'Elevate Study Consistency & Focus',
        description: `Your Academic Health score is currently at ${academicHealth.score}/100. Maintaining a daily 20-minute active recall streak stabilizes long-term retention.`,
        priority: 'High',
        type: 'study'
      });
    }

    // 3. GPA Target Alignment
    const gpaNum = typeof currentCGPA === 'number' ? currentCGPA : parseFloat(String(currentCGPA)) || 3.5;
    if (gpaNum < 4.5) {
      recs.push({
        id: 'rec-gpa-target',
        title: `Accelerate Toward ${currentClassification || 'First Class'}`,
        description: `Focus revision hours on 3 and 4-credit unit courses to maximize GPA progression toward the 4.50+ First Class threshold.`,
        priority: 'Medium',
        type: 'study'
      });
    }

    // 4. Practice Diagnostics & Quizzes
    const coursesToTarget = onboardingCourses && onboardingCourses.length > 0
      ? (typeof onboardingCourses[0] === 'string' ? onboardingCourses[0] : onboardingCourses[0]?.code || 'Core Courses')
      : 'Core Courses';
    recs.push({
      id: 'rec-quiz-mastery',
      title: `Practice Exam Readiness for ${coursesToTarget}`,
      description: 'Generate an AI mock assessment with timed conditions to evaluate continuous assessment readiness.',
      priority: 'Medium',
      type: 'quiz'
    });

    return recs;
  }, [weakTopicsList, academicHealth.score, currentCGPA, currentClassification, onboardingCourses]);

  // Track in-flight and rate-limiting timestamps for recommendations
  const isFetchingRecommendationsRef = useRef(false);
  const lastFetchTimestampRef = useRef<number>(0);

  /**
   * Calls the server recommendations AI endpoint with student telemetry data,
   * rendering fine-grained advice targeting their class goals.
   */
  const triggerAiRecommendations = async (force = false) => {
    // Prevent duplicate in-flight requests or spamming within a 5-minute cooldown window unless forced
    const now = Date.now();
    if (isFetchingRecommendationsRef.current) return;
    if (!force && aiRecommendations.length > 0 && now - lastFetchTimestampRef.current < 5 * 60 * 1000) {
      return;
    }

    isFetchingRecommendationsRef.current = true;
    lastFetchTimestampRef.current = now;
    setIsAiRecommendationsLoading(true);
    try {
      if (!isRealUser) {
        setAiRecommendations(generateDynamicClientRecommendations());
        return;
      }

      let accessToken = '';
      try {
        const session = (await supabase.auth.getSession()).data?.session;
        accessToken = session?.access_token || '';
      } catch {
        // Continue with sandbox/guest token if offline
      }

      const weakAreasMapped = weakTopicsList.map(w => ({
        course: w.course_code,
        topics: w.weak_topics
      }));

      let serverRecs: AcademicRecommendation[] | null = null;
      try {
        const response = await fetch('/api/academic/personalized-recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : 'Bearer sandbox-token'
          },
          body: JSON.stringify({
            currentCGPA,
            targetClassification: currentClassification,
            onboardingCourses,
            coursePerformance: coursePerformances.map(p => ({
              code: p.course_code,
              mastery: p.mastery_percentage,
              quizzes: p.quizzes_taken
            })),
            weakAreas: weakAreasMapped,
            healthScore: academicHealth.score
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData?.success && Array.isArray(resData?.recommendations) && resData.recommendations.length > 0) {
            serverRecs = resData.recommendations;
          }
        }
      } catch (fetchErr) {
        console.info("Notice: personalized recommendations server offline or rate-limited; utilizing student telemetry advisor.");
      }

      const finalRecs = (serverRecs && serverRecs.length > 0) ? serverRecs : generateDynamicClientRecommendations();
      setAiRecommendations(finalRecs);

      // Save to database as cached AI content safely if user session allows
      if (user && isRealUserSession(user.id)) {
        try {
          await supabase.from('saved_ai_content').upsert({
            user_id: user.id,
            type: 'academic-recommendations',
            content: JSON.stringify(finalRecs),
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id,type' });
        } catch {
          // Gracefully ignore database cache write failures when offline
        }
      }
    } catch (e) {
      console.info("Notice: Academic pedagogical advisor active:", e);
      setAiRecommendations(generateDynamicClientRecommendations());
    } finally {
      isFetchingRecommendationsRef.current = false;
      setIsAiRecommendationsLoading(false);
    }
  };

  // Helper baseline triggering AI recommendations automatically once stats load
  useEffect(() => {
    if (user && isRealUser && !loading && aiRecommendations.length === 0) {
      triggerAiRecommendations();
    }
  }, [user, isRealUser, loading, aiRecommendations.length]);

  return (
    <AcademicIntelligenceContext.Provider
      value={{
        historicalSemesters,
        coursePerformances,
        coursePredictions,
        weakTopicsList,
        academicHealth,
        recommendations: aiRecommendations,
        knowledgeGraphs,
        simulatedGrades,
        loading,
        isAiRecommendationsLoading,
        isKnowledgeExtracting,
        
        currentGPA,
        currentCGPA,
        predictedGPA: dynamicActiveSemesterGPA,
        predictedCGPA,
        bestCaseGPA,
        bestCaseCGPA,
        worstCaseGPA,
        worstCaseCGPA,
        modelConfidence,
        currentClassification,
        projectedClassification,
        graduationClassification,

        addHistoricalSemester,
        deleteHistoricalSemester,
        updateSimulatedGrade,
        resetSimulation,
        extractCourseSyllabusIntelligence,
        triggerAiRecommendations
      }}
    >
      {children}
    </AcademicIntelligenceContext.Provider>
  );
}

/**
 * Access hook for reading raw and predicted academic values throughout components.
 */
export function useAcademicIntelligence() {
  const context = useContext(AcademicIntelligenceContext);
  if (context === undefined) {
    throw new Error('useAcademicIntelligence must be used within an AcademicIntelligenceProvider (StudiBl Predictive Suite)');
  }
  return context;
}
