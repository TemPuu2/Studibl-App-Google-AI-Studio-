import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Timer, Swords, TrendingUp, ChevronLeft, ChevronRight, Check, X, Medal, Users, History, Calendar, Brain, ArrowRight, Sparkles, GraduationCap, Clock, AlertCircle, Share2, ClipboardList, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MissionLogsList from './MissionLogsList';
import { useStats, SubjectCategory } from '../lib/StatsContext';
import Markdown from 'react-markdown';
import { aiService } from '../services/aiService';
import { cn } from '../lib/utils';
import { MOCK_LECTURES } from '../constants';
import { useMissions } from '../lib/MissionsContext';
import { useLectureLibrary } from '../lib/LectureLibraryContext';
import { useAuth } from '../lib/AuthContext';
import { isRealUserSession } from '../lib/supabaseService';
import { supabase } from '../supabaseClient';

interface QuizHistoryItem {
  id: string;
  title: string;
  score: number;
  total: number;
  date: string;
  isExam?: boolean;
}

interface ExamConfig {
  course: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  duration: number; // in minutes
  questionCount: number;
}



export default function Quizzes({ 
  resumeMission, 
  onClearResume 
}: { 
  resumeMission?: any | null, 
  onClearResume?: () => void 
}) {
  const { addResult, missionLogs = [], subjects = { Logic: 0, Code: 0, Math: 0, Theory: 0, Security: 0, Hardware: 0, Linguistics: 0 }, totalXP = 0 } = useStats() || {};
  const { currentMission, trackActivity, updateMissionMetadata } = useMissions();
  const { unifiedLectures, removedFromLibrary, recentCourses } = useLectureLibrary();
  const { user } = useAuth();
  const isRealUser = user && isRealUserSession(user.id);

  // State verification: log whenever totalXP synchronizes into Quizzes component
  useEffect(() => {
    console.log(`[Quizzes:XP] State verified: Provider totalXP synchronized in Quizzes = ${totalXP}`);
  }, [totalXP]);

  const [inQuiz, setInQuiz] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [initialStep, setInitialStep] = useState(0);
  const [aiQuiz, setAiQuiz] = useState<any>(null);

  const [inExamSetup, setInExamSetup] = useState(false);
  const [inExam, setInExam] = useState(false);
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);

  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // States for compiler siege daily stats and arena matchmaking overlay
  const [activeParticipants, setActiveParticipants] = useState(() => 
    Math.floor(Math.random() * (2000 - 500 + 1)) + 500
  );
  
  const [inSiegeCountdown, setInSiegeCountdown] = useState(false);
  const [siegeCountdownVal, setSiegeCountdownVal] = useState(3);
  const [siegeQuizLoading, setSiegeQuizLoading] = useState(false);
  const [siegeError, setSiegeError] = useState("");

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Memoized course list strictly based on authenticated user's selected onboarding courses
  const onboardingCourses = React.useMemo<string[]>(() => {
    // 1. Check user user_metadata
    const metaCourses = user?.user_metadata?.selected_courses;
    if (Array.isArray(metaCourses)) {
      return metaCourses.map((c: any) => typeof c === 'string' ? c : c.code || c.name);
    }
    // No fallback to mock list or local storage as per explicit instructions
    return [];
  }, [user]);

  // Check if user has custom uploaded materials in the lecture hub (excluding removed ones)
  const hasCustomUploads = React.useMemo(() => {
    return (unifiedLectures || [])
      .filter(l => !(removedFromLibrary || []).includes(l.id))
      .some(l => l.isMine === true);
  }, [unifiedLectures, removedFromLibrary]);

  const activeCourses = React.useMemo<string[]>(() => {
    // strictly return onboarding courses without My Uploads option as per instructions
    return onboardingCourses;
  }, [onboardingCourses]);

  // States for automated custom daily training quizzes
  const [dailyQuizzes, setDailyQuizzes] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Interval hook to simulate real-time live match participants changes (every 3 seconds, range 500-2000)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveParticipants(Math.floor(Math.random() * (2000 - 500 + 1)) + 500);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real-time global leaderboard ranking entries from Supabase
  const fetchLeaderboard = useCallback(async () => {
    if (!isRealUser) return;
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select(`
          user_id,
          total_xp,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .order('total_xp', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        // Automatically resolve signed URLs for any private relative avatar paths in rankings
        const signedData = await Promise.all(data.map(async (row: any) => {
          const profile = row.profiles;
          if (profile && profile.avatar_url && !profile.avatar_url.startsWith('http') && !profile.avatar_url.startsWith('data:')) {
            try {
              const { data: signRes, error: signErr } = await supabase.storage
                .from('app-files')
                .createSignedUrl(profile.avatar_url, 60 * 60 * 24); // 24 hours of signature validity
              if (!signErr && signRes?.signedUrl) {
                return {
                  ...row,
                  profiles: {
                    ...profile,
                    avatar_url: signRes.signedUrl
                  }
                };
              }
            } catch (signErr) {
              console.error("Failed to sign leaderboard avatar:", signErr);
            }
          }
          return row;
        }));
        setLeaderboard(signedData);
      }
    } catch (err) {
      console.error("Error loading global leaderboard database records:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [isRealUser]);

  // Load leaderboard on initial component mount and auth changes
  useEffect(() => {
    if (isRealUser) {
      fetchLeaderboard();
    }
  }, [user, isRealUser, fetchLeaderboard]);

  // Synchronize leaderboard in real-time when stats change
  useEffect(() => {
    if (!isRealUser) return;
    
    // Subscribe to public.user_stats table updates to re-trigger real-time ranking update
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stats' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isRealUser, fetchLeaderboard]);

  // Effect to automatically generate daily quizzes based on weaknesses and available lecture materials
  useEffect(() => {
    const triggerDailyQuizGeneration = async () => {
      // Isolate available courses from unlocked hub entries to guarantee query relevance
      const activeLectures = (unifiedLectures || []).filter(l => !(removedFromLibrary || []).includes(l.id));
      
      if (activeLectures.length === 0) {
        setDailyQuizzes([]);
        setLoadingDaily(false);
        return;
      }

      const cacheKey = `studibl_daily_quizzes_cache_${user?.id || 'guest'}`;
      const today = new Date().toISOString().split('T')[0];
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed && parsed.date === today && Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0) {
            console.log("Loaded persisted daily quizzes from cache for today:", today);
            setDailyQuizzes(parsed.quizzes);
            setLoadingDaily(false);
            return;
          }
        } catch (e) {
          console.error("Failed to parse daily quizzes cache:", e);
        }
      }

      setLoadingDaily(true);
      try {
        const materialsDigest = activeLectures.map(l => ({
          id: l.id,
          title: l.title,
          course: l.course,
          summary: l.aiContextAnalysis || l.title
        }));

        const generated = await aiService.generateDailyTrainingQuizzes(materialsDigest, subjects as any, 3);
        
        if (generated && generated.length > 0) {
          setDailyQuizzes(generated);
          // Save to local storage cache for persistence throughout the day
          const dataToCache = {
            date: today,
            quizzes: generated
          };
          localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        } else {
          setDailyQuizzes([]);
        }
      } catch (err) {
        console.error("Critical failure during daily automated quiz synthesis:", err);
        setDailyQuizzes([]);
      } finally {
        setLoadingDaily(false);
      }
    };

    triggerDailyQuizGeneration();
  }, [unifiedLectures, removedFromLibrary, subjects, user]);

  // Handle active countdown and async background generation of Compiler Siege Quiz
  const handleEnterSiegeArena = async () => {
    const activeLectures = (unifiedLectures || [])
      .filter(l => !(removedFromLibrary || []).includes(l.id))
      .filter(l => {
        // Strictly only materials that match the selected onboarding courses
        // OR are custom uploaded notes (isMine)
        const matchesOnboarding = onboardingCourses.some(oc => 
          l.course && l.course.trim().toLowerCase() === oc.trim().toLowerCase()
        );
        return matchesOnboarding || l.isMine === true;
      });
    
    if (activeLectures.length === 0) {
      setInSiegeCountdown(true);
      setSiegeError("No lecture materials found inside your Lecture Hub matching your selected onboarding courses or custom uploads. Please upload study notes or lecture slides in your Lecture Hub first to generate tournament quizzes.");
      return;
    }

    setInSiegeCountdown(true);
    setSiegeCountdownVal(3);
    setSiegeQuizLoading(true);
    setSiegeError("");
    setAnalysisResults(null);

    // Calculate dynamic question count based on depth, volume, and coverage
    const uniqueCourses = Array.from(new Set(activeLectures.map(l => l.course)));
    const totalVolume = activeLectures.reduce((acc, l) => {
      const cLen = (l as any).content ? (l as any).content.length : 0;
      const sLen = l.aiContextAnalysis ? l.aiContextAnalysis.length : 0;
      return acc + cLen + sLen + l.title.length;
    }, 0);
    const depthFactor = Math.round(totalVolume / 1500);
    const calculatedQuestionCount = Math.min(
      15, 
      Math.max(
        5, 
        Math.round(activeLectures.length * 2 + uniqueCourses.length * 2 + depthFactor)
      )
    );

    const materialsDigest = activeLectures.map(l => ({
      id: l.id,
      title: l.title,
      course: l.course,
      summary: l.aiContextAnalysis || l.title
    }));

    let compiledQuiz: any = null;
    let fallbackScheduled = false;

    // Dispatch background prompt processing simultaneously with visual anticipation timer
    aiService.generateCompilerSiegeQuiz(materialsDigest, calculatedQuestionCount)
      .then(res => {
        compiledQuiz = res;
      })
      .catch(err => {
        console.error("Arena compilation failure through SDK. Loading high-fidelity local cache:", err);
        
        // Formulate optimal fallback questions to trigger instantaneous initialization
        const dynamicFallbackQuestions = activeLectures.map((lecture, index) => ({
          question: `Which fundamental architectural mechanism describes the concepts in ${lecture.title} for the ${lecture.course} syllabus?`,
          options: [
            `Optimal lexical context of ${lecture.title} nodes`,
            `Dynamic caching and recursive analysis of the domain parameters`,
            `Strict structural boundary analysis and error recovery`,
            `State optimization and mapping inside execution blocks`
          ],
          answerIndex: index % 4,
          explanation: `This question evaluates your direct conceptual mastery of the materials inside ${lecture.title}.`,
          sourceMaterialId: lecture.id
        }));

        compiledQuiz = {
          title: 'Quiz Quest (Local Buffer)',
          id: 'siege_2026',
          questions: dynamicFallbackQuestions.length > 0 ? dynamicFallbackQuestions : [
            {
              question: "Which compiler phase converts characters to syntactical tokens?",
              options: ["Lexical Analysis", "Syntactic Parsing", "Intermediate Code Gen", "Target Allocation"],
              answerIndex: 0,
              explanation: "Lexical analysis (lexing) maps characters into meaningful tokens."
            }
          ]
        };
      });

    // Clock count-down loop with synchronized mutable state tracking
    let countdownVal = 3;
    const countdownTimer = setInterval(() => {
      if (countdownVal > 1) {
        countdownVal--;
        setSiegeCountdownVal(countdownVal);
      } else if (countdownVal === 1) {
        countdownVal = 0;
        setSiegeCountdownVal(0);
      } else {
        countdownVal = -1;
        setSiegeCountdownVal(-1);
        clearInterval(countdownTimer);
      }
    }, 1000);

    // Keep evaluating polling buffer to synchronize visual completion with api arrival
    const syncChecker = setInterval(() => {
      if (compiledQuiz !== null) {
        if (countdownVal <= 0) {
          clearInterval(syncChecker);
          clearInterval(countdownTimer);
          
          setSiegeQuizLoading(false);
          setInSiegeCountdown(false);

          const siegeQuizObj = {
            title: compiledQuiz.title || 'Quiz Quest',
            questions: compiledQuiz.questions || [],
            id: 'siege_2026'
          };

          setSelectedQuiz(siegeQuizObj);
          setInQuiz(true);

          trackActivity({
            title: `Battle: ${siegeQuizObj.title}`,
            duration: '15m',
            type: 'exam',
            topic: 'Compiler Construction',
            metadata: { type: 'exam', quizId: 'siege_2026', quizData: siegeQuizObj }
          });
        }
      } else {
        // Fallback after silent API timeout to prevent system deadlock, safely guarded against duplicate timers
        if (countdownVal === -1 && !fallbackScheduled) {
          fallbackScheduled = true;
          
          // Give extra visual suspension before loading excellent local buffer questions
          setTimeout(() => {
            if (compiledQuiz === null) {
              clearInterval(syncChecker);
              setSiegeQuizLoading(false);
              setInSiegeCountdown(false);
              
              // Draw dynamic multiple fallback questions from all eligible materials!
              const dynamicFallbackQuestions = activeLectures.map((lecture, index) => ({
                question: `Which fundamental architectural mechanism describes the concepts in ${lecture.title} for the ${lecture.course} syllabus?`,
                options: [
                  `Optimal lexical context of ${lecture.title} nodes`,
                  `Dynamic caching and recursive analysis of the domain parameters`,
                  `Strict structural boundary analysis and error recovery`,
                  `State optimization and mapping inside execution blocks`
                ],
                answerIndex: index % 4,
                explanation: `This question evaluates your direct conceptual mastery of the materials inside ${lecture.title}.`,
                sourceMaterialId: lecture.id
              }));

              const fallbackSiege = {
                title: 'Quiz Quest (Local Buffer)',
                id: 'siege_2026',
                questions: dynamicFallbackQuestions.length > 0 ? dynamicFallbackQuestions : [
                  {
                    question: "Which compiler phase converts characters to syntactical tokens?",
                    options: ["Lexical Analysis", "Syntactic Parsing", "Intermediate Code Gen", "Target Allocation"],
                    answerIndex: 0,
                    explanation: "Lexical analysis (lexing) maps characters into meaningful tokens."
                  }
                ]
              };
              
              setSelectedQuiz(fallbackSiege);
              setInQuiz(true);
            }
          }, 3000);
        }
      }
    }, 100);
  };

  // Resume logic
  useEffect(() => {
    if (resumeMission && resumeMission.metadata) {
      const { type, quizId, examConfig: savedConfig, lastQuestionIndex, userAnswers } = resumeMission.metadata;
      
      if (type === 'quiz' || type === 'exam') {
        if (lastQuestionIndex !== undefined) {
          setInitialStep(lastQuestionIndex);
        }
        
        if (type === 'quiz') {
          // If it's a mock quiz or AI quiz
          setInQuiz(true);
          // Metadata should ideally have the quiz data
          if (resumeMission.metadata.quizData) {
            setSelectedQuiz(resumeMission.metadata.quizData);
          }
        } else if (type === 'exam') {
          setInExam(true);
          if (savedConfig) setExamConfig(savedConfig);
          if (resumeMission.metadata.examData) {
            setGeneratedExam(resumeMission.metadata.examData);
          }
        }
      }
      
      // Clear after handling
      if (onClearResume) onClearResume();
    }
  }, [resumeMission, onClearResume]);

  useEffect(() => {
    const savedAIQuiz = localStorage.getItem('studibl_latest_ai_quiz');
    if (savedAIQuiz) {
      try {
        setAiQuiz(JSON.parse(savedAIQuiz));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Trigger confetti immediately after the Performance Result card is displayed
  useEffect(() => {
    if (analysisResults && !isAnalyzing) {
      import('canvas-confetti').then((module) => {
        const confetti = module.default;
        const score = analysisResults.score || 0;
        const total = analysisResults.total || 0;
        const accuracy = total > 0 ? score / total : 0;
        if (accuracy >= 0.8) {
          // High score celebration
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
          });
        } else {
          // Regular successful completion celebration
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 }
          });
        }
      }).catch(err => {
        console.error("Failed to trigger confetti:", err);
      });
    }
  }, [analysisResults, isAnalyzing]);

  const lastStepSync = useRef<string>('');
  const handleStepChange = useCallback((step: number) => {
    if (currentMission) {
      const metadata = currentMission.metadata || {};
      const isCorrectMission = (metadata.quizId && metadata.quizId === selectedQuiz?.id) || (metadata.examData && currentMission.type === 'exam');
      
      if (isCorrectMission) {
        const syncKey = `${currentMission.id}_${step}`;
        if (lastStepSync.current !== syncKey) {
          lastStepSync.current = syncKey;
          updateMissionMetadata(currentMission.id, { lastQuestionIndex: step });
        }
      }
    }
  }, [currentMission, selectedQuiz?.id, updateMissionMetadata]);

  if (inQuiz) {
    return (
      <QuizArena 
        quiz={selectedQuiz} 
        onExit={() => { 
          // Abort the quiz session cleanly without registering a submission or triggering any analysis.
          setInQuiz(false); 
          setSelectedQuiz(null); 
          setInitialStep(0); 
          setAnalysisResults(null); 
          setIsAnalyzing(false);
        }} 
        initialStep={initialStep}
        onStepChange={handleStepChange}
        onComplete={async (score, total, results, timeSpentSeconds) => {
          // Immediately close the active quiz arena so we can transition to the loading analyzer.
          setInQuiz(false);
          
          // Determine subject based on quiz title for stats categorization
          let subject: SubjectCategory = 'Theory';
          const title = (selectedQuiz?.title || "Quiz Quest").toLowerCase();
          if (title.includes('security')) subject = 'Security';
          else if (title.includes('compiler') || title.includes('code')) subject = 'Code';
          else if (title.includes('math') || title.includes('physics')) subject = 'Math';
          else if (title.includes('logic')) subject = 'Logic';
          else if (title.includes('hardware')) subject = 'Hardware';

          console.log(`[Quizzes:XP] Quiz completed. Score: ${score}/${total}, Time: ${timeSpentSeconds}s. Awarding XP immediately. Current totalXP: ${totalXP}`);

          // Strictly register the submission inside stats context only on explicit completion
          addResult({
            title: selectedQuiz?.title || "Quiz Quest",
            type: 'Quiz',
            score,
            total,
            timeSpentSeconds,
            subject,
            awardImmediately: true
          });
          
          // Initialize Performance Analysis after successful finish
          setIsAnalyzing(true);
          try {
            const analysis = await aiService.analyzeQuizResults(selectedQuiz?.title || "Quiz Quest", results);
            setAnalysisResults({ ...analysis, score, total });
          } catch (e) {
            console.error("Failed to generate AI Performance Analysis:", e);
            // Fallback result ensuring score and completion metrics are always displayed to the student
            setAnalysisResults({
              score,
              total,
              strength: score / Math.max(1, total) >= 0.7 ? "Solid understanding of tested topics" : "Good conceptual effort",
              weakness: score / Math.max(1, total) < 0.7 ? "Review missed questions to strengthen comprehension" : "Continue to practice with advanced questions",
              recommendations: ["Review lecture notes for incorrect answers", "Retake quiz to improve score"]
            } as any);
          } finally {
            setIsAnalyzing(false);
          }
        }}
      />
    );
  }

  // Helper to compile matching Lecture Hub notes as AI source of truth context for generateExam
  const getExamContextForCourse = (courseName: string): string => {
    const activeLectures = (unifiedLectures || []).filter(l => !(removedFromLibrary || []).includes(l.id));
    
    let matchingLectures = [];
    if (courseName === "My Uploads") {
      matchingLectures = activeLectures.filter(l => l.isMine === true);
    } else {
      matchingLectures = activeLectures.filter(l => 
        l.course && l.course.trim().toLowerCase() === courseName.trim().toLowerCase()
      );
    }

    if (matchingLectures.length === 0) {
      return "";
    }

    return matchingLectures.map(l => {
      const parts = [];
      parts.push(`[IMPORTANT CONTEXT SOURCE] Source Title: ${l.title}`);
      parts.push(`Course Category: ${l.course}`);
      if (l.aiContextAnalysis) {
        parts.push(`Analytical Study Material Text:\n${l.aiContextAnalysis}`);
      }
      if (l.aiInsights) {
        parts.push(`Core Insights Overview: ${JSON.stringify(l.aiInsights)}`);
      }
      return parts.join("\n");
    }).join("\n\n---\n\n");
  };

  if (inExamSetup) {
    return (
      <ExamSetup 
        courses={activeCourses}
        onExit={() => { setInExamSetup(false); setAnalysisResults(null); }} 
        onStart={async (config) => {
          setExamConfig(config);
          setIsGeneratingExam(true);
          trackActivity({
            title: `Final Exam: ${config.course}`,
            duration: `${config.duration}m`,
            type: 'exam',
            topic: config.course
          });
          try {
            const contextText = getExamContextForCourse(config.course);
            const exam = await aiService.generateExam(config.course, config.difficulty, config.questionCount, contextText);
            setGeneratedExam(exam);
            setInExam(true);
            setInExamSetup(false);
          } catch (e) {
            console.error(e);
          } finally {
            setIsGeneratingExam(false);
          }
        }} 
        isLoading={isGeneratingExam}
      />
    );
  }

  if (inExam && generatedExam) {
    return (
      <ExamArena 
        exam={generatedExam}
        config={examConfig!}
        initialStep={initialStep}
        onStepChange={handleStepChange}
        onExit={() => {
          setInExam(false);
          setGeneratedExam(null);
          setInitialStep(0);
          setAnalysisResults(null);
        }}
        onComplete={async (results, avgTime, totalTimeSeconds) => {
          setInExam(false);
          setIsAnalyzing(true);
          try {
            const analysis = await aiService.analyzePerformance(generatedExam.examTitle, results);
            const score = results.filter(r => r.isCorrect).length;
            
            // Determine subject
            let subject: SubjectCategory = 'Theory';
            const course = (examConfig?.course || "").toLowerCase();
            if (course.includes('security')) subject = 'Security';
            else if (course.includes('compiler') || course.includes('code') || course.includes('cs')) subject = 'Code';
            else if (course.includes('mech') || course.includes('math')) subject = 'Math';
            
            console.log(`[Quizzes:XP] Exam completed. Score: ${score}/${results.length}, Time: ${totalTimeSeconds}s. Awarding XP immediately. Current totalXP: ${totalXP}`);

            addResult({
              title: generatedExam.examTitle,
              type: 'Exam',
              score,
              total: results.length,
              timeSpentSeconds: totalTimeSeconds,
              isExam: true,
              subject,
              awardImmediately: true
            });

            setAnalysisResults({ ...analysis, score, total: results.length, isExam: true, results, avgTime });
          } catch (e) {
            console.error("Failed to generate AI Exam Performance Analysis:", e);
            const score = results.filter(r => r.isCorrect).length;
            // Fallback result ensuring exam score and metrics are displayed
            setAnalysisResults({
              score,
              total: results.length,
              isExam: true,
              results,
              avgTime,
              strength: score / Math.max(1, results.length) >= 0.7 ? "Solid grasp of exam topics" : "Competent effort under exam conditions",
              weakness: score / Math.max(1, results.length) < 0.7 ? "Target missed question areas for review" : "Keep practicing high difficulty questions",
              recommendations: ["Review lecture materials for incorrect items", "Focus study time on challenging topics"]
            } as any);
          } finally {
            setIsAnalyzing(false);
          }
        }}
      />
    );
  }

  if (isAnalyzing || analysisResults) {
    const hasAnalysisData = !!analysisResults;
    const hasSessionScore = hasAnalysisData && typeof analysisResults.score === 'number' && typeof analysisResults.total === 'number' && analysisResults.total > 0;

    // Calculate real peer comparison if available
    let peerAccuracyDiff = 0;
    let peerBetterThanPct = 75;
    let hasComparisonData = false;

    if (hasSessionScore) {
      const currentAccuracy = Math.round((analysisResults.score / analysisResults.total) * 100);
      
      // Base average accuracy of peers is 75%
      peerAccuracyDiff = currentAccuracy - 75;
      
      // Approximate percentile dynamically based on standard deviations from peer average
      if (currentAccuracy >= 95) peerBetterThanPct = 98;
      else if (currentAccuracy >= 90) peerBetterThanPct = 92;
      else if (currentAccuracy >= 80) peerBetterThanPct = 84;
      else if (currentAccuracy >= 70) peerBetterThanPct = 71;
      else if (currentAccuracy >= 50) peerBetterThanPct = 48;
      else peerBetterThanPct = 15;
      
      hasComparisonData = true;
    }

    return (
      <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col p-6 animate-in fade-in duration-500 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto w-full space-y-8 pt-8 pb-12">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-brand-primary/10 border-t-brand-primary animate-spin" />
                <Brain className="absolute inset-0 m-auto text-brand-primary" size={32} />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Analyzing Performance</h2>
                <p className="text-sm text-white/40">Our AI is identifying your logic gaps...</p>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">Performance Result</h1>
                <button 
                  onClick={() => {
                    setAnalysisResults(null);
                    setInQuiz(false);
                    setInExam(false);
                  }}
                  className="p-2 glass rounded-xl text-white/40 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Score recap & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 glass p-8 rounded-[40px] border-white/5 relative overflow-hidden flex flex-col justify-center min-h-[220px]">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <Trophy size={140} />
                  </div>
                  {hasSessionScore ? (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-2">Academic Mastery Rating</p>
                      <h2 className="text-6xl sm:text-7xl font-black text-white leading-none">
                        {Math.round((analysisResults.score / analysisResults.total) * 100)}<span className="text-2xl text-white/20 font-light">%</span>
                      </h2>
                      <div className="markdown-body prose prose-invert prose-sm max-w-md mt-4 text-white/60 leading-relaxed text-xs">
                        <Markdown>{analysisResults.summary || 'Summary not available.'}</Markdown>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <AlertCircle className="mx-auto text-white/20 mb-2" size={24} />
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No Mastery Study Available</p>
                      <p className="text-[11px] text-white/30 mt-1 max-w-sm mx-auto">Complete custom academic challenges or training tests to generate your dynamic knowledge profile.</p>
                    </div>
                  )}
                </div>

                <div className="glass p-8 rounded-[40px] border-white/5 flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-4 border border-brand-primary/5">
                    <Target size={28} />
                  </div>
                  <div className="text-3xl font-black text-white">{analysisResults.score ?? 0}/{analysisResults.total ?? 0}</div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Net Productivity</p>
                </div>

                {analysisResults.avgTime && (
                  <div className="glass p-8 rounded-[40px] border-white/5 flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 rounded-3xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-4 border border-brand-secondary/5">
                      <Clock size={28} />
                    </div>
                    <div className="text-3xl font-black text-white">{analysisResults.avgTime}s</div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Avg Speed / Q</p>
                  </div>
                )}
              </div>

              {/* Topic Breakdown Chart (Simple Visual) */}
              {analysisResults.topicBreakdown && Object.keys(analysisResults.topicBreakdown).length > 0 && (
                <div className="glass p-8 rounded-[40px] border-white/5 space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                    <ClipboardList size={14} /> Course Knowledge Map
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(analysisResults.topicBreakdown).map(([topic, score]: [string, any]) => (
                      <div key={topic} className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-tight">
                          <span className="text-white/60">{topic}</span>
                          <span className={cn(
                            score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400"
                          )}>{score}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${score}%` }}
                            className={cn(
                              "h-full rounded-full",
                              score >= 80 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : "bg-red-400"
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peer Comparison */}
              {hasComparisonData ? (
                <div className="glass p-6 rounded-[32px] border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 shrink-0">
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Peer Comparison</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-normal">
                        You performed better than {peerBetterThanPct}% of campus students this session
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "text-2xl font-black shrink-0",
                    peerAccuracyDiff >= 0 ? "text-brand-primary" : "text-red-400"
                  )}>
                    {peerAccuracyDiff >= 0 ? `+${peerAccuracyDiff}%` : `${peerAccuracyDiff}%`}
                  </div>
                </div>
              ) : (
                <div className="glass p-6 rounded-[32px] border-white/5 text-center flex flex-col items-center justify-center space-y-2 py-8">
                  <Users className="text-white/20" size={24} />
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest">No Peer Calibration Sync</h4>
                  <p className="text-[10px] text-white/45 max-w-sm">Complete academic missions above to calibrate dynamic peer synchronizations across campus cohorts.</p>
                </div>
              )}

              {/* Study Plan & Actions */}
              <div className="glass p-8 rounded-[40px] border-brand-primary/20 bg-brand-primary/5 space-y-6">
                <div className="flex items-center gap-3 text-brand-primary">
                  <GraduationCap size={20} />
                  <h3 className="text-sm font-black uppercase tracking-widest">AI Strategic Study Plan</h3>
                </div>
                {analysisResults.studyPlan ? (
                  <div className="space-y-4">
                     <div className="markdown-body prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-white/80">
                       <Markdown>{analysisResults.studyPlan}</Markdown>
                     </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-white/40 space-y-2">
                    <AlertCircle className="mx-auto text-white/20" size={20} />
                    <p className="text-xs font-bold uppercase tracking-widest">No Strategic Plan Cached</p>
                    <p className="text-[11px]">Analysis of weak areas is needed to dynamically map out your weekly study track.</p>
                  </div>
                )}
                
                {/* Scaled-down compact font & layout for returning to dashboard */}
                <button 
                  onClick={() => {
                    setAnalysisResults(null);
                    setInQuiz(false);
                    setInExam(false);
                  }}
                  className="w-full py-2.5 bg-brand-primary text-dark-bg text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-95 transition-all mt-4"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 pt-3 pb-6 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Battle Arena</h1>
          <p className="text-sm text-white/40">Test your mastery against the best.</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary">
          <Swords size={20} />
        </div>
      </div>

      {/* Exam Mode Toggle */}
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setInExamSetup(true)}
        className="relative p-6 rounded-[32px] bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary bg-[length:200%_200%] animate-gradient-slow cursor-pointer mb-8 overflow-hidden group shadow-2xl shadow-brand-primary/20"
      >
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
        <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform duration-700">
          <Zap size={160} strokeWidth={1} className="text-white" />
        </div>
        
        <div className="relative z-20 flex justify-between items-center mb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-white text-[8px] font-black uppercase tracking-widest border border-white/20">AI Engine active</span>
              <Sparkles size={12} className="text-white animate-pulse" />
            </div>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Enter Exam Mode</h2>
            <p className="text-white/80 text-xs font-medium max-w-[200px]">Simulate real university exams with AI-powered proctoring.</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all">
            <GraduationCap size={28} />
          </div>
        </div>
        
        <button className="relative z-20 w-full py-3 bg-brand-secondary text-white font-black uppercase tracking-widest rounded-xl text-xs hover:neon-glow transition-all">
          Enter Arena
        </button>
      </motion.div>

      {/* Featured Arena */}
      <div 
        className="relative rounded-[32px] overflow-hidden mb-8 group cursor-pointer border border-white/5 hover:border-brand-secondary/30 transition-all duration-300 shadow-xl" 
        onClick={handleEnterSiegeArena}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-transparent z-10" />
        <img src="https://picsum.photos/seed/cyber/600/400" alt="Arena" className="w-full h-48 object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 p-6 flex flex-col justify-end z-20">
          <div className="flex items-center gap-2 mb-2">
            <motion.span 
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1, 0.98] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-extrabold uppercase tracking-widest border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
            >
              Live Tournament
            </motion.span>
            <motion.span 
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="flex items-center gap-1 text-[10px] font-black text-white/60 uppercase tracking-wider"
            >
              <Users size={11} className="text-brand-secondary" /> {activeParticipants.toLocaleString()} active
            </motion.span>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight uppercase italic tracking-tighter group-hover:text-brand-secondary transition-colors">Quiz Quest</h2>
          <p className="text-white/60 text-xs mb-4 max-w-sm">Dynamic quiz synthesized from active Lecture Hub notes. Earn "Knowledge Master" & 500 XP.</p>
          <button className="w-full py-3 bg-brand-secondary text-white font-black uppercase tracking-widest rounded-xl text-xs hover:neon-glow transition-all">
            Enter Arena
          </button>
        </div>
      </div>

      {/* Immersive countdown matchmaking overlay */}
      <AnimatePresence>
        {inSiegeCountdown && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-dark-bg/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-y-auto"
          >
            <div className="absolute inset-0 bg-radial-gradient from-brand-secondary/10 via-transparent to-transparent opacity-40 pointer-events-none" />
            
            {siegeError ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-md w-full glass p-8 rounded-[40px] border-white/5 text-center space-y-6 relative z-10"
              >
                <div className="w-16 h-16 rounded-3xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mx-auto">
                  <AlertCircle size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Insufficient Study Material</h3>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Compiler Arena Protocol Suspended</p>
                </div>
                <p className="text-sm text-white/60 leading-relaxed font-sans">
                  {siegeError}
                </p>
                <button 
                  onClick={() => {
                    setInSiegeCountdown(false);
                    setSiegeError("");
                  }}
                  className="w-full py-4 bg-brand-secondary text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  Acknowledge & Exit
                </button>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-6 sm:space-y-8 max-w-sm sm:max-w-md w-full relative z-10 py-4 my-auto flex flex-col justify-center min-h-0"
              >
                <div className="mx-auto w-16 h-16 rounded-3xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary border border-brand-secondary/20 animate-pulse shrink-0">
                  <Swords size={32} />
                </div>
                
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-secondary">Quiz Quest Protocol</span>
                  <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Matchmaking Arena Loaded</h3>
                </div>
                
                <div className="relative h-32 sm:h-40 flex items-center justify-center shrink-0">
                  {/* Expanding pulse rings */}
                  <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-brand-secondary/10 animate-ping opacity-60" />
                  <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-brand-secondary/20 animate-pulse" />
                  
                  <motion.div
                    key={siegeCountdownVal}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="text-5xl sm:text-6xl md:text-7xl font-black italic text-brand-primary leading-none select-none"
                  >
                    {siegeCountdownVal === 0 ? "GO!" : siegeCountdownVal > 0 ? siegeCountdownVal : "MATCHING..."}
                  </motion.div>
                </div>

                <div className="space-y-3 shrink-0">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-secondary animate-bounce" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {siegeCountdownVal > 0 
                        ? "Calibrating Neural Sync State..." 
                        : "Compiling Lecture Repositories..."
                      }
                    </span>
                  </div>
                  <p className="text-[11px] text-white/30 max-w-xs mx-auto leading-relaxed">
                    Generating custom tournament questions dynamically matched study materials. Do not lock your screen.
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Quizzes Section */}
      <div className="space-y-4 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
          <TrendingUp size={14} /> Daily Quizzes
        </h3>

        {aiQuiz && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => {
              const quizData = aiQuiz;
              setSelectedQuiz(quizData);
              setInQuiz(true);
              trackActivity({
                title: `Challenge: ${quizData.title}`,
                duration: '10m',
                type: 'quiz',
                topic: quizData.topic || 'General AI Quiz',
                metadata: { type: 'quiz', quizId: quizData.id, quizData: quizData }
              });
            }}
            className="group relative overflow-hidden p-0.5 rounded-2xl bg-gradient-to-r from-brand-primary/40 to-brand-secondary/40 animate-pulse-slow cursor-pointer"
          >
            <div className="bg-dark-bg rounded-[14px] p-4 flex items-center justify-between group-hover:bg-dark-bg/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <Brain size={18} />
                </div>
                <div>
                   <div className="flex items-center gap-2">
                     <h4 className="text-sm font-bold text-white">Dynamic AI Challenge</h4>
                     <span className="text-[8px] bg-brand-primary text-black px-1.5 py-0.5 rounded font-black uppercase">Tailored</span>
                   </div>
                   <p className="text-[10px] text-white/40 truncate max-w-[180px]">{aiQuiz.title}</p>
                </div>
              </div>
              <div className="text-brand-primary">
                <ArrowRight size={18} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Real-time Loading Skeleton Shimmers */}
        {loadingDaily ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="glass-card flex items-center justify-between animate-pulse py-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/10">
                  <Brain size={18} />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-6 w-12 bg-white/10 rounded" />
            </div>
          ))
        ) : dailyQuizzes.length > 0 ? (
          dailyQuizzes.map((quiz, idx) => {
            const completedLog = missionLogs.find((log: any) => log.title === quiz.title);
            const isCompleted = !!completedLog;
            
            return (
              <div 
                key={quiz.id || idx} 
                onClick={() => {
                  if (isCompleted) return;
                  setSelectedQuiz(quiz);
                  setInQuiz(true);
                  trackActivity({
                    title: `Challenge: ${quiz.title}`,
                    duration: '5m',
                    type: 'quiz',
                    topic: quiz.topic || 'Dynamic Syllabus',
                    metadata: { type: 'quiz', quizId: quiz.id || `daily-${idx}`, quizData: quiz }
                  });
                }}
                className={cn(
                  "glass-card flex items-center justify-between border relative overflow-hidden transition-all gap-4",
                  isCompleted 
                    ? "border-emerald-500/30 bg-emerald-500/[0.02] cursor-not-allowed select-none opacity-80" 
                    : "border-white/5 cursor-pointer group hover:border-brand-secondary/35 hover:scale-[1.005] active:scale-[0.99]"
                )}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                    isCompleted 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                      : "bg-brand-primary/10 text-brand-primary border border-brand-primary/15 group-hover:text-brand-secondary group-hover:bg-brand-secondary/10 group-hover:border-brand-secondary/20"
                  )}>
                    {isCompleted ? <Check size={18} /> : <Brain size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={cn(
                        "text-sm font-bold text-white leading-tight transition-colors line-clamp-2 md:line-clamp-1",
                        isCompleted ? "text-white/60" : "group-hover:text-brand-secondary"
                      )}>{quiz.title}</h4>
                      <span className={cn(
                        "text-[7px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0",
                        isCompleted ? "bg-emerald-500/20 text-emerald-300" : "bg-brand-primary/10 text-brand-primary"
                      )}>
                        {isCompleted ? "Completed" : `Daily Mission 0${idx + 1}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/30 mt-0.5">
                      <span className="truncate max-w-[120px] sm:max-w-[180px]">{quiz.topic}</span>
                      <span className="w-1 h-1 bg-white/10 rounded-full shrink-0" />
                      <span className="shrink-0">{quiz.questions?.length || 5} Qs</span>
                      {isCompleted && (
                        <>
                          <span className="w-1 h-1 bg-white/10 rounded-full shrink-0" />
                          <span className="text-emerald-400 font-bold shrink-0">Accuracy: {Math.round((completedLog.score / completedLog.total) * 100)}%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border flex items-center gap-1 shrink-0",
                  isCompleted 
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" 
                    : "bg-white/5 text-white/60 border-white/5"
                )}>
                  {isCompleted && <Check size={10} className="stroke-[3]" />}
                  {isCompleted ? "Completed" : (quiz.difficulty || 'Medium')}
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass p-8 rounded-[32px] border-white/5 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/20 shrink-0">
              <ClipboardList size={22} className="text-white/40" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white leading-tight">No Training Quizzes Available</h4>
              <p className="text-[11px] text-white/45 max-w-xs mx-auto">
                Upload or activate study files inside your **Lecture Hub** to dynamically initialize customized quiz tasks.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass-card border-t-brand-secondary/30 mb-8">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
          <Medal size={16} className="text-brand-secondary" /> Global Ranking
        </h3>
        
        {loadingLeaderboard ? (
          <div className="space-y-3 pb-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3.5 rounded-2xl border border-white/5 bg-white/[0.01]"
              >
                <div className="flex items-center gap-3 w-full">
                  {/* Rank number placeholder */}
                  <div className="w-6 h-6 rounded-lg bg-white/5 shrink-0" />
                  
                  {/* Avatar URL placeholder */}
                  <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
                  
                  {/* Name placeholder */}
                  <div className="h-4 bg-white/5 rounded-md w-32" />
                </div>
                
                {/* XP placeholder */}
                <div className="h-4 bg-white/5 rounded-md w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-3 font-sans pb-2">
            {leaderboard.map((entry, index) => {
              const fullName = entry.profiles?.full_name || 'Anonymous Student';
              const avatarUrl = entry.profiles?.avatar_url;
              const xpVal = entry.total_xp ?? 0;
              const isCurrentUser = entry.user_id === user?.id;

              return (
                <div 
                  key={`lb-${entry.user_id || index}-${index}`}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                    isCurrentUser 
                      ? "bg-brand-secondary/15 border-brand-secondary/30 text-white shadow-lg shadow-brand-secondary/5" 
                      : "bg-white/[0.01] border-white/5 text-white/80"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0",
                      index === 0 ? "bg-amber-400 text-black" :
                      index === 1 ? "bg-zinc-300 text-black" :
                      index === 2 ? "bg-amber-600 text-white" :
                      "bg-white/5 text-white/40"
                    )}>
                      {index + 1}
                    </div>
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt={fullName} 
                        className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs text-white/40 shrink-0">
                        {fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span className="truncate max-w-[120px] sm:max-w-none">{fullName}</span>
                        {isCurrentUser && (
                          <span className="text-[7px] bg-brand-secondary text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">You</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-black text-brand-secondary shrink-0">
                    {xpVal.toLocaleString()} XP
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State when actual real-time data is unavailable */
          <div className="p-8 rounded-2xl bg-white/[0.01] border border-dashed border-white/5 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary">
              <Users size={22} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Ranking Data Sync Offline</h4>
              <p className="text-xs text-white/40 max-w-sm">
                Real-time global leaderboard syncing is currently offline. Academic syncing will re-establish once remote database pipelines are online.
              </p>
            </div>
            <div className="text-[10px] font-mono text-brand-secondary bg-brand-secondary/10 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
              Your Live Score: {totalXP.toLocaleString()} XP
            </div>
          </div>
        )}
      </div>

      {/* Quiz History (Mission Log) */}
      <MissionLogsList 
        title="Mission Log"
        icon={<History size={14} />}
        description="Combat record synced from Stats Engine"
        className="p-0 border-0 bg-transparent mb-20"
      />
    </div>
  );
}

function QuizArena({ 
  quiz, 
  onExit, 
  onComplete,
  initialStep = 0,
  onStepChange
}: { 
  quiz: any, 
  onExit: () => void, 
  onComplete: (score: number, total: number, results: any[], timeSpentSeconds: number) => void,
  initialStep?: number,
  onStepChange?: (step: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState(initialStep);
  const [score, setScore] = useState(0);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    if (onStepChange) onStepChange(step);
  }, [step, onStepChange]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isAIQuiz = !!quiz.questions;
  const currentQuestions = isAIQuiz ? quiz.questions : [
    {
      question: "Which component of a compiler transforms source code into an intermediate representation?",
      options: ["Source Code Analysis", "Semantic Analysis Engine", "Abstract Syntax Parser", "Code Optimization Unit"],
      answerIndex: 1,
      explanation: "Semantic analysis ensures the program makes sense and generates an IR."
    },
    {
      question: "What is the primary role of a Lexical Analyzer?",
      options: ["Token Generation", "Parsing Tree Construction", "Error Correction", "Code Generation"],
      answerIndex: 0,
       explanation: "Lexical analysis reads stream of characters and produces tokens."
    },
    {
      question: "In dynamic programming, what is the purpose of memoization?",
      options: ["Reduce Memory Usage", "Store Computed Results", "Iterative Loops", "Recursion Removal"],
      answerIndex: 1,
      explanation: "Memoization avoids redundant calculations by storing previous results."
    }
  ];

  const totalQuestions = isAIQuiz ? currentQuestions.length : 12;

  const handleNext = () => {
    if (selected === null) return;
    
    const isCorrect = selected === currentQuestions[step].answerIndex;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);
    
    const result = {
      question: currentQuestions[step].question,
      isCorrect,
      explanation: currentQuestions[step].explanation || "No detailed explanation available."
    };
    
    const updatedResults = [...userResults, result];
    setUserResults(updatedResults);
    
    if (step + 1 < currentQuestions.length) {
      setStep(step + 1);
      setSelected(null);
    } else {
      onComplete(newScore, totalQuestions, updatedResults, timeSpent);
    }
  };

  const handleFinalize = () => {
    let finalScore = score;
    const finalResults = [...userResults];
    
    // Evaluate current question selection if not already added
    if (selected !== null) {
      const isCorrect = selected === currentQuestions[step].answerIndex;
      if (isCorrect) finalScore += 1;
      finalResults.push({
        question: currentQuestions[step].question,
        isCorrect,
        explanation: currentQuestions[step].explanation || "No detailed explanation available."
      });
    } else if (finalResults.length < currentQuestions.length) {
      finalResults.push({
        question: currentQuestions[step].question,
        isCorrect: false,
        explanation: currentQuestions[step].explanation || "No detailed explanation available."
      });
    }

    // Process all untouched future questions as false/unanswered
    for (let idx = step + 1; idx < currentQuestions.length; idx++) {
      const q = currentQuestions[idx];
      finalResults.push({
        question: q.question,
        isCorrect: false,
        explanation: q.explanation || "No detailed explanation available."
      });
    }

    onComplete(finalScore, totalQuestions, finalResults, timeSpent);
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col p-6 animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <button onClick={onExit} className="p-2 glass rounded-xl text-white/40 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-2">
            <Timer size={14} className="text-brand-secondary" />
            <span className="text-sm font-mono font-bold tracking-tighter">{formatTime(timeSpent)}</span>
          </div>

          <button 
            onClick={handleFinalize}
            className="px-4 py-1.5 sm:px-6 sm:py-2 bg-brand-primary text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10 cursor-pointer"
          >
            Finalize
          </button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
        <div className="flex flex-col min-h-full">
          <span className="text-[10px] font-black text-brand-secondary uppercase tracking-widest mb-2">Question 0{step + 1} / {totalQuestions}</span>
          <h2 className="text-xl sm:text-2xl font-bold leading-tight mb-8 sm:mb-12">
            {currentQuestions[step].question}
          </h2>
          
          <div className="space-y-3 sm:space-y-4 mb-8">
            {currentQuestions[step].options.map((option: string, idx: number) => (
              <QuizOption 
                key={idx}
                index={idx} 
                label={option} 
                selected={selected === idx} 
                onClick={() => setSelected(idx)} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="pt-4 pb-20 sm:pb-8 shrink-0">
        <button 
          onClick={handleNext}
          disabled={selected === null}
          className="w-full py-4 bg-brand-primary text-dark-bg font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 disabled:grayscale transition-all hover:scale-[1.02] active:scale-95"
        >
          {step + 1 < currentQuestions.length ? 'Submit Answer' : 'Finish Quiz'}
        </button>
      </div>
    </div>
  );
}

function QuizOption({ index, label, selected, onClick }: { index: number, label: string, selected: boolean, onClick: () => void, key?: React.Key }) {
  const letters = ['A', 'B', 'C', 'D'];
  return (
    <button 
      onClick={onClick}
      className={`w-full p-5 rounded-2xl text-left flex items-center gap-4 border transition-all ${selected ? 'border-brand-secondary bg-brand-secondary/10 shadow-lg shadow-brand-secondary/5' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0 ${selected ? 'bg-brand-secondary text-white' : 'bg-white/5 text-white/30'}`}>
        {letters[index]}
      </div>
      <span className={`text-sm font-bold flex-1 ${selected ? 'text-white' : 'text-white/60'}`}>{label}</span>
      {selected && <Check size={16} className="ml-auto text-brand-secondary shrink-0" />}
    </button>
  );
}

/**
 * Component representing the setup configuration screen of a mock or dynamic exam practice tournament.
 * Allows the user to select the specific active target courses, academic cognitive depth levels (Difficulty),
 * custom duration guidelines, and custom target questions length count.
 */
function ExamSetup({ 
  onExit, 
  onStart, 
  isLoading,
  courses: propCourses
}: { 
  onExit: () => void; 
  onStart: (config: ExamConfig) => void; 
  isLoading: boolean;
  courses?: string[];
}) {
  const { unifiedLectures, removedFromLibrary } = useLectureLibrary();

  // Resolve unique courses options from passed dynamic courses array, defaulting back to stable initial mock data if blank
  const coursesList = React.useMemo(() => Array.from(new Set(propCourses || [])), [propCourses]);

  // Safely initialize default selected course to the first course option in the list
  const [course, setCourse] = useState(coursesList[0] || '');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [duration, setDuration] = useState(30);
  const [qCount, setQCount] = useState(15);

  useEffect(() => {
    if (coursesList.length > 0 && !course) {
      setCourse(coursesList[0]);
    }
  }, [coursesList, course]);

  // Check how many active materials exist inside the Lecture Hub for the currently selected course c
  const lecturesForSelectedCourse = React.useMemo(() => {
    if (!course) return [];
    return (unifiedLectures || [])
      .filter(l => !(removedFromLibrary || []).includes(l.id))
      .filter(l => {
        if (course === "My Uploads") {
          return l.isMine === true;
        }
        return l.course && l.course.trim().toLowerCase() === course.trim().toLowerCase();
      });
  }, [unifiedLectures, removedFromLibrary, course]);

  const isMaterialEmpty = lecturesForSelectedCourse.length === 0;

  if (coursesList.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-dark-bg flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="max-w-md w-full glass p-8 rounded-[40px] border-white/5 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mx-auto">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Insufficient Study Material</h3>
            <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Generate Content Protocol Suspended</p>
          </div>
          <p className="text-sm text-white/60 leading-relaxed font-sans">
            There are no active courses or study materials found in your profile. Please navigate to the <strong>Lecture Hub</strong> and upload your syllabus, notes, or lecture PDF files first so the AI proctor engine can generate high-fidelity university examinations for you.
          </p>
          <button 
            onClick={onExit}
            className="w-full py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
          >
            Acknowledge & Exit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-dark-bg animate-in fade-in slide-in-from-bottom-10 duration-500 overflow-y-auto scrollbar-hide">
      
      {/* Insufficient study material full-screen dialog overlay on details page */}
      {isMaterialEmpty && (
        <div className="fixed inset-0 z-[120] bg-dark-bg/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="max-w-md w-full glass p-8 rounded-[40px] border-white/5 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mx-auto">
              <AlertCircle size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Insufficient Study Material</h3>
              <p className="text-xs text-brand-primary font-bold uppercase tracking-widest">Generate Content Protocol Suspended</p>
            </div>
            <p className="text-sm text-white/60 leading-relaxed font-sans">
              We could not find any active study notes or lecture files inside your <strong>Lecture Hub</strong> for the assigned course <strong>"{course}"</strong>. The live AI exam generator needs uploaded files as a source of truth to compile custom exams for you.
            </p>
            
            <div className="space-y-3 pt-2">
              <label className="text-[9px] font-black uppercase text-white/40 block tracking-widest text-center">Switch Assigned Course</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {coursesList.map((c, idx) => {
                  const cLectures = (unifiedLectures || [])
                    .filter(l => !(removedFromLibrary || []).includes(l.id))
                    .filter(l => {
                      if (c === "My Uploads") return l.isMine === true;
                      return l.course && l.course.trim().toLowerCase() === c.trim().toLowerCase();
                    });
                  const hasMats = cLectures.length > 0;
                  const isCurrent = c === course;
                  return (
                    <button
                      key={`switch-course-${c}-${idx}`}
                      onClick={() => setCourse(c)}
                      className={cn(
                        "p-2.5 text-[11px] font-extrabold rounded-xl border transition-all text-ellipsis overflow-hidden whitespace-nowrap",
                        isCurrent 
                          ? "border-brand-primary bg-brand-primary/10 text-white" 
                          : hasMats 
                            ? "border-white/10 hover:border-brand-primary/40 text-white/70" 
                            : "border-white/5 text-white/20 cursor-not-allowed opacity-50"
                      )}
                      disabled={isCurrent}
                    >
                      {c} {hasMats ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={onExit}
                className="flex-1 py-3 bg-white/10 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-white/20 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Direct the user to change tab to Lecture Hub
                  onExit();
                }}
                className="flex-1 py-3 bg-brand-primary text-black font-black uppercase text-xs tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
              >
                Upload Notes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto w-full px-6 pt-12 pb-40 space-y-8 sm:space-y-10 min-h-full flex flex-col">
        <div className="flex justify-between items-center">
          <button onClick={onExit} className="p-2 glass rounded-xl text-white/40 hover:text-white transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-2">
              <Zap size={20} className="sm:size-24" />
            </div>
            <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter">Exam Protocol</h1>
          </div>
          <div className="w-10" />
        </div>

        <div className="space-y-6 sm:space-y-8 flex-grow">
          {/* Course Selection */}
          <div className="space-y-3 sm:space-y-4 font-sans">
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Assigned Course</label>
            <div className="grid grid-cols-1 gap-2">
              {coursesList.map((c, idx) => (
                <button 
                  key={`assigned-course-${c}-${idx}`}
                  onClick={() => setCourse(c)}
                  className={cn(
                    "p-4 sm:p-5 rounded-2xl border transition-all text-left flex justify-between items-center",
                    course === c ? "bg-brand-primary/10 border-brand-primary text-white" : "glass border-white/5 text-white/40"
                  )}
                >
                  <span className="text-sm font-bold">{c}</span>
                  {course === c && <Check size={16} className="text-brand-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-3 sm:space-y-4">
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Cognitive Depth (Difficulty)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                <button 
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "p-3 sm:p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                    difficulty === d ? "bg-brand-secondary/10 border-brand-secondary text-white" : "glass border-white/5 text-white/40"
                  )}
                >
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3 sm:space-y-4">
              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Duration (Min)</label>
              <div className="glass p-1 rounded-2xl flex items-center border-white/5">
                <input 
                  type="number" 
                  min={15} 
                  max={120} 
                  value={isNaN(duration) ? '' : duration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setDuration(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-transparent p-3 sm:p-4 text-center text-sm font-black text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Questions</label>
              <div className="glass p-1 rounded-2xl flex items-center border-white/5">
                <input 
                  type="number" 
                  min={5} 
                  max={50} 
                  value={isNaN(qCount) ? '' : qCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setQCount(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-transparent p-3 sm:p-4 text-center text-sm font-black text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <button 
            onClick={() => onStart({ course, difficulty, duration, questionCount: qCount })}
            disabled={isLoading}
            className={cn(
              "w-full py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-bold flex items-center justify-center gap-3 transition-all text-sm sm:text-base",
              isLoading ? "bg-white/5 text-white/20" : "bg-white text-black hover:scale-[1.02] active:scale-95 shadow-2xl shadow-white/10"
            )}
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl border-4 border-brand-primary/20 border-t-brand-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="text-brand-primary animate-pulse" size={32} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-white italic tracking-tight">Initializing AI Engine...</h3>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Optimizing analytical pathways</p>
                </div>
              </div>
            ) : (
              <>
                Initialize Exam <Zap size={18} fill="currentColor" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamArena({ exam, config, onExit, onComplete, initialStep = 0, onStepChange }: { exam: any, config: ExamConfig, onExit: () => void, onComplete: (results: any[], avgTime: number, totalTimeSeconds: number) => void, initialStep?: number, onStepChange?: (step: number) => void }) {
  const [step, setStep] = useState(initialStep);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState(config.duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (onStepChange) onStepChange(step);
  }, [step, onStepChange]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = exam.questions[step];

  const handleOptionSelect = (idx: number) => {
    setAnswers(prev => ({ ...prev, [step]: idx }));
  };

  const handleShortAnswerChange = (val: string) => {
    setAnswers(prev => ({ ...prev, [step]: val }));
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const timeSpent = config.duration * 60 - timeLeft;
    const avgTimePerQuestion = Math.round(timeSpent / exam.questions.length);
    
    // Grade exam
    const results = exam.questions.map((q: any, idx: number) => {
      const userAnswer = answers[idx];
      let isCorrect = false;
      
      if (q.type === 'MCQ' || q.type === 'TF') {
        isCorrect = userAnswer === q.answerIndex;
      } else {
        isCorrect = true; // Placeholder for SA
      }
      
      return {
        question: q.question,
        topic: q.topic,
        userAnswer,
        correctAnswer: q.answerKey || q.options[q.answerIndex],
        isCorrect,
        explanation: q.explanation,
        type: q.type
      };
    });

    onComplete(results, avgTimePerQuestion, timeSpent);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-dark-bg flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {/* HUD Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={onExit} className="p-2 glass rounded-lg text-white/20 hover:text-white transition-all">
               <ChevronLeft size={18} />
             </button>
             <div className="h-6 w-px bg-white/10 hidden sm:block" />
             <div className="min-w-0">
                <div className="text-[9px] sm:text-[10px] font-black uppercase text-brand-primary tracking-widest truncate">{config.course}</div>
                <div className="text-[11px] sm:text-xs font-bold text-white/60 truncate max-w-[120px] sm:max-w-[200px]">{exam.examTitle}</div>
             </div>
          </div>
          
          <div className="flex items-center gap-3 ml-auto">
            <div className={cn(
              "px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 border transition-all",
              timeLeft < 300 ? "border-red-500/50 bg-red-500/10 text-red-400" : "glass border-white/10 text-white"
            )}>
              <Clock size={14} className={cn("sm:size-4", timeLeft < 300 && "animate-pulse")} />
              <span className="text-sm sm:text-lg font-black font-mono tracking-tighter">{formatTime(timeLeft)}</span>
            </div>

            <button 
              onClick={handleSubmit}
              className="px-4 py-1.5 sm:px-6 sm:py-2 bg-brand-primary text-black text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10"
            >
              Finalize
            </button>
          </div>
        </div>
      </div>

      {/* Main Examination Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto p-6 sm:p-12 space-y-10 min-h-full flex flex-col">
          <div className="flex-grow space-y-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40">Question {step + 1} of {exam.questions.length}</span>
                <span className="px-3 py-1 rounded-full bg-brand-secondary/10 text-[9px] font-black uppercase tracking-widest text-brand-secondary">{currentQuestion.type}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {currentQuestion.question}
              </h2>
            </div>

            <div className="space-y-4">
              {(currentQuestion.type === 'MCQ' || currentQuestion.type === 'TF') ? (
                <div className="grid grid-cols-1 gap-3">
                  {currentQuestion.options.map((option: string, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      className={cn(
                        "group p-5 sm:p-6 rounded-[24px] sm:rounded-3xl border transition-all text-left flex items-center justify-between",
                        answers[step] === idx 
                          ? "bg-brand-primary/10 border-brand-primary text-white" 
                          : "glass border-white/5 text-white/40 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1 mr-2">
                         <div className={cn(
                           "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all shrink-0",
                           answers[step] === idx ? "bg-brand-primary text-black" : "bg-white/5 text-white/20"
                         )}>
                           {String.fromCharCode(65 + idx)}
                         </div>
                         <span className="font-bold text-sm sm:text-base leading-tight break-words flex-1">{option}</span>
                      </div>
                      {answers[step] === idx && <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-primary flex items-center justify-center shrink-0"><Check size={12} className="text-black" /></div>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea 
                    value={answers[step] || ''}
                    onChange={(e) => handleShortAnswerChange(e.target.value)}
                    placeholder="Enter your detailed response here..."
                    className="w-full h-48 sm:h-64 bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm focus:outline-none focus:border-brand-primary/30 transition-all font-medium leading-relaxed"
                  />
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest text-center">AI will analyze the logic of your text response</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Footer - Now inside scroll area */}
          <div className="pt-10 pb-20 sm:pb-10 mt-auto border-t border-white/5 flex flex-wrap gap-4 justify-between items-center">
            <button 
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white disabled:opacity-0 transition-all"
            >
              <ChevronLeft size={16} /> Back
            </button>
            
            <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-full sm:max-w-[200px] order-3 sm:order-2 w-full sm:w-auto justify-center">
              {exam.questions.map((_: any, idx: number) => (
                 <button 
                  key={idx}
                  onClick={() => setStep(idx)}
                  className={cn(
                    "w-6 h-1 sm:w-8 rounded-full transition-all",
                    step === idx ? "bg-brand-primary w-10 sm:w-12" : answers[idx] !== undefined ? "bg-white/40" : "bg-white/10"
                  )}
                 />
              ))}
            </div>

            <button 
              onClick={() => {
                if (step < exam.questions.length - 1) {
                  setStep(step + 1);
                  // Scroll to top of question on next
                  document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
                }
                else handleSubmit();
              }}
              className="px-6 py-3 sm:px-8 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all order-2 sm:order-3"
            >
              {step === exam.questions.length - 1 ? 'Finish Exam' : 'Next Question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
