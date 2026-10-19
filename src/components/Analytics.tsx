import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import { 
  TrendingUp, Award, Brain, AlertTriangle, Zap, 
  ArrowRight, Target, Flame, Star, Activity, 
  Calendar, Shield, Rocket, Sparkles, ChevronRight,
  TrendingDown, Info, Clock, CheckCircle2, RotateCcw,
  Trophy, XCircle, ChevronLeft, Medal, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStats, SubjectCategory, MissionLogItem } from '../lib/StatsContext';
import { useStreak, computeStreakStats } from '../lib/StreakContext';
import { supabase } from '../supabaseClient';
import { cn } from '../lib/utils';
import { calculateLevelFromXP } from '../lib/levelSystem';
import { WeeklyMasteryAnalytics, generateMasteryData } from './WeeklyMasteryAnalytics';
import MissionLogsList from './MissionLogsList';
import { useAuth } from '../lib/AuthContext';
import { isRealUserSession } from '../lib/supabaseService';
import { aiService } from '../services/aiService';

// --- Helper UI Components ---

/**
 * High contrast radial circle rendering academic overall answers accuracy rating with dynamic offset paths.
 */
const HeroProgressRing = ({ percentage, size = 120, strokeWidth = 8, color = "#CCFF00" }: { percentage: number, size?: number, strokeWidth?: number, color?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: isNaN(offset) ? circumference : offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tracking-tighter text-white">{Math.round(percentage)}%</span>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Accuracy</span>
      </div>
    </div>
  );
};

/**
 * Course interactive grid heat distribution block displaying comparative learning efficiencies.
 */
const Heatmap = ({ logs }: { logs: any[] }) => {
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(null);

  // Dynamic calculations from user performance logs
  const courseList = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const courseMap: Record<string, {
      name: string;
      subject: string;
      totalCorrect: number;
      totalQuestions: number;
      attempts: number;
    }> = {};

    logs.forEach(log => {
      // Clean course topic name
      let titleClean = log.title;
      titleClean = titleClean.replace(/^(Quiz|Flashcards|Exam|Written|FillBlank|Written:\s*|Flashcards:\s*|Quiz:\s*):\s*/i, '');
      titleClean = titleClean.replace(/\s*(Quiz|Exam|Protocol|Deck|Challenge|Practice|Study|Test)$/i, '');
      const courseName = titleClean.trim() || 'General Studies';

      // Subject category detection
      let subjectName = log.subject || 'Theory';
      if (!log.subject) {
        const text = log.title.toLowerCase();
        if (text.includes('security') || text.includes('crypto')) subjectName = 'Security';
        else if (text.includes('compiler') || text.includes('code') || text.includes('architecture') || text.includes('engine')) subjectName = 'Code';
        else if (text.includes('math') || text.includes('physics') || text.includes('calc') || text.includes('opt')) subjectName = 'Math';
        else if (text.includes('logic') || text.includes('inference')) subjectName = 'Logic';
        else if (text.includes('hardware') || text.includes('cpu')) subjectName = 'Hardware';
        else if (text.includes('linguistics') || text.includes('syntax') || text.includes('semantic')) subjectName = 'Linguistics';
      }

      if (!courseMap[courseName]) {
        courseMap[courseName] = {
          name: courseName,
          subject: subjectName,
          totalCorrect: 0,
          totalQuestions: 0,
          attempts: 0
        };
      }

      const entry = courseMap[courseName];
      entry.totalCorrect += log.score || 0;
      entry.totalQuestions += log.total || 0;
      entry.attempts += 1;
    });

    return Object.values(courseMap).map(c => {
      const accuracy = c.totalQuestions > 0 ? Math.round((c.totalCorrect / c.totalQuestions) * 100) : 0;
      const failureRate = 100 - accuracy;
      const masteryScore = accuracy;

      // Mastery: Green >= 80, Yellow 50-79, Red < 50
      let colorClass: 'green' | 'yellow' | 'red' = 'green';
      if (masteryScore >= 80) {
        colorClass = 'green';
      } else if (masteryScore >= 50) {
        colorClass = 'yellow';
      } else {
        colorClass = 'red';
      }

      return {
        name: c.name,
        subject: c.subject,
        totalCorrect: c.totalCorrect,
        totalQuestions: c.totalQuestions,
        attempts: c.attempts,
        accuracy,
        failureRate,
        masteryScore,
        colorClass
      };
    });
  }, [logs]);

  // Set default selected course automatically on load if available
  useEffect(() => {
    if (courseList.length > 0 && !selectedCourseName) {
      setSelectedCourseName(courseList[0].name);
    }
  }, [courseList, selectedCourseName]);

  // Empty state handling
  if (!logs || logs.length === 0 || courseList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01] h-64 w-full">
        <Activity className="text-white/25 mb-3 animate-pulse" size={32} />
        <p className="text-xs font-bold text-white/80 select-none">Not enough data to calculate course mastery insights</p>
        <p className="text-[10px] text-white/40 mt-1 max-w-xs leading-relaxed">
          Complete learning modules, exercises and quiz evaluations to generate course mastery metrics.
        </p>
      </div>
    );
  }

  // Selected course details
  const selectedCourse = courseList.find(c => c.name === selectedCourseName) || courseList[0];

  // Vectors computation
  const strongestCourses = [...courseList].sort((a, b) => b.masteryScore - a.masteryScore);
  const weakestTopics = [...courseList].sort((a, b) => a.masteryScore - b.masteryScore);
  const mostFailedAreas = [...courseList].sort((a, b) => b.failureRate - a.failureRate);
  const mostPracticedCategories = [...courseList].sort((a, b) => b.attempts - a.attempts);

  // Efficiency categorization
  const inefficientLearning = courseList.filter(c => c.attempts >= 2 && c.masteryScore < 70);
  const efficientLearning = courseList.filter(c => c.attempts <= 1 && c.masteryScore >= 80);

  return (
    <div className="w-full space-y-6">
      {/* Interactive Map Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
          <span>Interactive Grid Model ({courseList.length} Courses Tracked)</span>
          <span className="text-brand-primary">Select cells to inspect details</span>
        </div>
        
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {courseList.map((course, i) => {
            const isSelected = selectedCourseName === course.name;
            const bgClass = 
              course.colorClass === 'green' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' :
              course.colorClass === 'yellow' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' :
              'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20';

            const activeClass = isSelected 
              ? 'ring-2 ring-white/40 border-white/60 scale-[1.02] shadow-[0_0_12px_rgba(255,255,255,0.05)]' 
              : 'border-white/5';

            return (
              <motion.button
                key={`analytics-course-${course.name || i}-${i}`}
                id={`course-cell-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                onClick={() => setSelectedCourseName(course.name)}
                className={cn(
                  "p-3 rounded-2xl border text-left flex flex-col justify-between h-20 transition-all focus:outline-none cursor-pointer",
                  bgClass,
                  activeClass
                )}
              >
                <span className="text-[10px] font-extrabold tracking-tight truncate w-full" title={course.name}>
                  {course.name}
                </span>
                <div className="flex items-end justify-between w-full mt-1.5">
                  <span className="text-sm font-black tracking-tighter">{course.masteryScore}%</span>
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-white/5 text-white/60">
                    {course.attempts}x
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Grid Legend */}
      <div className="flex items-center justify-center gap-6 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[9px] font-extrabold tracking-wide uppercase text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Mastered (≥80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Moderate (50-79%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Weak (&lt;50%)
        </span>
      </div>

      {/* Selected Inspector Floating Block */}
      {selectedCourse && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCourse.name}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-5 rounded-[28px] bg-white/[0.02] border border-white/5 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                  {selectedCourse.subject} DOMAIN
                </span>
                <h4 className="text-xs font-bold text-white mt-0.5">{selectedCourse.name}</h4>
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase px-2.5 py-1 rounded-full",
                selectedCourse.colorClass === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                selectedCourse.colorClass === 'yellow' ? 'bg-amber-500/10 text-amber-400' :
                'bg-rose-500/10 text-rose-400'
              )}>
                {selectedCourse.colorClass === 'green' ? '👑 Mastered' : 
                 selectedCourse.colorClass === 'yellow' ? '⚡ Improving' : '⚠️ Refactor Required'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-wider">Accuracy Rate</p>
                <p className="text-sm font-black tracking-tighter text-white mt-1">{selectedCourse.accuracy}%</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-wider">Failure Rate</p>
                <p className="text-sm font-black tracking-tighter text-red-500 mt-1">{selectedCourse.failureRate}%</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-wider">Attempt Ratio</p>
                <p className="text-sm font-black tracking-tighter text-blue-400 mt-1">{selectedCourse.attempts} eval</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Vector Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Strongest & Weakest */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
            <h5 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Star size={12} /> Strongest Course
            </h5>
            {strongestCourses.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-white leading-tight">{strongestCourses[0].name}</p>
                <p className="text-[9px] text-white/40 mt-1 font-medium">
                  Mastery Index of <span className="text-emerald-400 font-bold">{strongestCourses[0].masteryScore}%</span> over {strongestCourses[0].attempts} evaluation{strongestCourses[0].attempts > 1 ? 's' : ''}.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-white/35 font-medium">No records available</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
            <h5 className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
              <AlertTriangle size={12} /> Weakest Topic
            </h5>
            {weakestTopics.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-white leading-tight">{weakestTopics[0].name}</p>
                <p className="text-[9px] text-white/40 mt-1 font-medium">
                  Retraction rate at <span className="text-red-400 font-bold">{weakestTopics[0].masteryScore}%</span>. Dedicated review recommended.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-white/35 font-medium">No records available</p>
            )}
          </div>
        </div>

        {/* Failed & Practiced */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
            <h5 className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingDown size={12} /> Most Failed Area
            </h5>
            {mostFailedAreas.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-white leading-tight">{mostFailedAreas[0].name}</p>
                <p className="text-[9px] text-white/40 mt-1 font-medium">
                  Error rate index reaches <span className="text-rose-400 font-bold">{mostFailedAreas[0].failureRate}%</span>. Focus on stabilization.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-white/35 font-medium">No records available</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
            <h5 className="text-[9px] font-black text-brand-secondary uppercase tracking-widest flex items-center gap-1.5">
              <RotateCcw size={12} /> Most Practiced Category
            </h5>
            {mostPracticedCategories.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-white leading-tight">{mostPracticedCategories[0].name}</p>
                <p className="text-[9px] text-white/40 mt-1 font-medium">
                  Practiced <span className="text-brand-secondary font-bold">{mostPracticedCategories[0].attempts} times</span> with total accuracy of {mostPracticedCategories[0].accuracy}%.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-white/35 font-medium">No records available</p>
            )}
          </div>
        </div>
      </div>

      {/* Learning Efficiency Audit */}
      <div className="p-4 rounded-2xl bg-brand-primary/[0.01] border border-brand-primary/10 space-y-3">
         <h5 className="text-[9px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1.5">
           <Brain size={12} className="text-brand-primary" /> Learning Efficiency Audit
         </h5>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
           {/* Inefficient Practice */}
           <div className="space-y-1.5">
             <p className="text-[8px] font-black uppercase text-white/20">Inefficient Schema (Over-practice but failing)</p>
             {inefficientLearning.length > 0 ? (
               <div className="p-2.5 rounded-xl border border-rose-500/10 bg-rose-500/[0.02]">
                 <p className="text-[10px] font-bold text-white leading-snug">{inefficientLearning[0].name}</p>
                 <p className="text-[8px] text-rose-300/65 mt-0.5">High attempt rate ({inefficientLearning[0].attempts} eval) but low mastery score ({inefficientLearning[0].masteryScore}%).</p>
               </div>
             ) : (
               <p className="text-[9px] text-white/35">No inefficient loops detected. Nice job!</p>
             )}
           </div>

           {/* Efficient Practice */}
           <div className="space-y-1.5">
             <p className="text-[8px] font-black uppercase text-white/20">Efficient Integration (Rapid success)</p>
             {efficientLearning.length > 0 ? (
               <div className="p-2.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02]">
                 <p className="text-[10px] font-bold text-white leading-snug">{efficientLearning[0].name}</p>
                 <p className="text-[8px] text-emerald-300/65 mt-0.5">High conceptual consolidation ({efficientLearning[0].masteryScore}%) after only {efficientLearning[0].attempts} evaluation{efficientLearning[0].attempts > 1 ? 's' : ''}.</p>
               </div>
             ) : (
               <p className="text-[9px] text-white/35 text-left">No high-integration entries yet.</p>
             )}
           </div>
         </div>
      </div>
    </div>
  );
};



/**
 * Standardised ISO date string converter.
 */
const getLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// --- Main Analytical Component ---

export default function Analytics({ onNavigateAI }: { onNavigateAI: (topic: string) => void }) {
  const { user, loading: authLoading } = useAuth();
  const { currentStreak, longestStreak, missedDays, consistency, loginDates } = useStreak();
  const {
    totalXP,
    level,
    rankTitle,
    overallAccuracy,
    studyVelocity,
    subjects,
    progressHistory,
    missionLogs,
    loading
  } = useStats();

  // State verification: log whenever totalXP synchronizes into Analytics component
  useEffect(() => {
    console.log(`[Analytics:XP] State verified: Provider totalXP synchronized in Analytics = ${totalXP} (Lvl ${level} ${rankTitle})`);
  }, [totalXP, level, rankTitle]);

  const levelDetails = useMemo(() => calculateLevelFromXP(totalXP), [totalXP]);

  const isRealUser = useMemo(() => !!(user && isRealUserSession(user.id)), [user]);

  // State for AI-powered personalized recommendations
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);

  // Fetch performance feedback from Gemini
  useEffect(() => {
    let isMounted = true;
    if (!isRealUser) {
      setRecommendations([]);
      return;
    }

    const fetchAiRecommendations = async () => {
      setLoadingRecommendations(true);
      try {
        const generated = await aiService.generatePerformanceRecommendations({
          totalXP,
          overallAccuracy,
          subjects,
          missionLogs
        });
        if (isMounted) {
          setRecommendations(generated || []);
        }
      } catch (error) {
        console.error("Error fetching AI recommendation insights:", error);
      } finally {
        if (isMounted) {
          setLoadingRecommendations(false);
        }
      }
    };

    fetchAiRecommendations();

    return () => {
      isMounted = false;
    };
  }, [isRealUser, totalXP, overallAccuracy, subjects, missionLogs]);

  // Selected Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'charts' | 'analytics'>('dashboard');

  // Trend Analytics state
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly'>('weekly');
  
  // Horizontal streak calendar properties
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() => getLocalDateString());
  const selectedDayRef = useRef<HTMLButtonElement | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);

  // Weekly Mastery parameters
  const [weeklyPeriod, setWeeklyPeriod] = useState<'7days' | '30days'>('7days');
  const weeklyMasteryData = useMemo(() => {
    return generateMasteryData(missionLogs || [], weeklyPeriod === '7days' ? 7 : 30);
  }, [missionLogs, weeklyPeriod]);

  // Auto-scroll the horizontal calendar container locally so the selected day remains visible on load
  useEffect(() => {
    const handleScroll = () => {
      const container = calendarContainerRef.current;
      const button = selectedDayRef.current;
      if (container && button) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        
        // Calculate relative coordinates
        const relativeLeft = buttonRect.left - containerRect.left + container.scrollLeft;
        const targetScroll = relativeLeft - containerRect.width / 2 + buttonRect.width / 2;
        
        container.scrollTo({
          left: targetScroll,
          behavior: 'auto'
        });
      }
    };

    handleScroll();
    const timer = setTimeout(handleScroll, 100);
    return () => clearTimeout(timer);
  }, [selectedDayStr, activeTab]); // Include activeTab to trigger scroll when switching back to analytics tab

  // 14-day consistency calendar dates
  const dates = useMemo(() => {
    const list = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      list.push({
        dateString,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    return list;
  }, []);

  // Sets of login activities
  const activeDatesSet = useMemo(() => {
    return new Set<string>(loginDates);
  }, [loginDates]);

  // Combined streak counters
  const streakStats = useMemo(() => {
    return {
      currentStreak,
      longestStreak,
      missedDays,
      consistency,
      isActiveToday: currentStreak > 0
    };
  }, [currentStreak, longestStreak, missedDays, consistency]);

  // Selection metrics matching study calendar items
  const selectedDayProgress = useMemo(() => {
    return progressHistory.find(h => h.date === selectedDayStr);
  }, [progressHistory, selectedDayStr]);

  const selectedDayMissions = useMemo(() => {
    return missionLogs.filter(log => {
      if (!log.date) return false;
      return log.date.split('T')[0] === selectedDayStr;
    });
  }, [missionLogs, selectedDayStr]);

  const selectedDayStats = useMemo(() => {
    const totalXPFromLogs = selectedDayMissions.reduce((sum, log) => sum + (log.xpGained || 0), 0);
    const totalSecondsFromLogs = selectedDayMissions.reduce((sum, log) => sum + (log.timeSpentSeconds || 0), 0);
    
    const xp = selectedDayProgress ? selectedDayProgress.xp : totalXPFromLogs;
    const rawMinutes = selectedDayProgress 
      ? selectedDayProgress.studyMinutes 
      : (totalSecondsFromLogs / 60);
    const minutes = Math.round(rawMinutes);

    return {
      xp,
      minutes,
      hasActivity: xp > 0 || minutes > 0 || selectedDayMissions.length > 0
    };
  }, [selectedDayProgress, selectedDayMissions]);

  const formatInspectorDate = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length !== 3) return dStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const localDate = new Date(year, month, day);
    return localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Level algorithms
  const levelProgress = levelDetails.progressPercentage;

  // Radar metrics aggregator
  const radarData = useMemo(() => {
    if (!missionLogs || missionLogs.length === 0) {
      return [];
    }

    const totalCorrect = missionLogs.reduce((acc, log) => acc + (log.score || 0), 0);
    const totalQuestions = missionLogs.reduce((acc, log) => acc + (log.total || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const totalSeconds = missionLogs.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);
    const avgSecondsPerQ = totalQuestions > 0 ? (totalSeconds / totalQuestions) : 0;
    const speed = totalQuestions > 0
      ? Math.max(15, Math.min(100, Math.round(100 - Math.max(0, avgSecondsPerQ - 10) * (85 / 110))))
      : 0;

    let consistency = 0;
    if (missionLogs.length > 0) {
      const avgAcc = accuracy;
      const sumSquaredDiffs = missionLogs.reduce((acc, log) => {
        const logAcc = log.total > 0 ? (log.score / log.total) * 100 : 0;
        return acc + Math.pow(logAcc - avgAcc, 2);
      }, 0);
      const variance = sumSquaredDiffs / missionLogs.length;
      const stdDev = Math.sqrt(variance);
      consistency = Math.max(15, Math.min(100, Math.round(100 - stdDev * 2)));
    }

    const examLogs = missionLogs.filter(log => log.isExam || log.type === 'Exam');
    const examAcc = examLogs.length > 0
      ? (examLogs.reduce((acc, log) => acc + (log.score || 0), 0) / examLogs.reduce((acc, log) => acc + (log.total || 0), 0)) * 100
      : accuracy;
    const logicSubjectMastery = subjects && subjects.Logic !== undefined ? subjects.Logic : 50;
    const logic = Math.max(0, Math.min(100, Math.round((logicSubjectMastery * 0.6) + (examAcc * 0.4))));

    let improvement = 50;
    if (missionLogs.length >= 2) {
      const midpoint = Math.floor(missionLogs.length / 2);
      const newerLogs = missionLogs.slice(0, midpoint);
      const olderLogs = missionLogs.slice(midpoint);
      
      const newerQuestionsObj = newerLogs.reduce((sum, l) => ({ c: sum.c + (l.score || 0), t: sum.t + (l.total || 0) }), { c: 0, t: 0 });
      const olderQuestionsObj = olderLogs.reduce((sum, l) => ({ c: sum.c + (l.score || 0), t: sum.t + (l.total || 0) }), { c: 0, t: 0 });
      
      const newerAcc = newerQuestionsObj.t > 0 ? (newerQuestionsObj.c / newerQuestionsObj.t) * 100 : 0;
      const olderAcc = olderQuestionsObj.t > 0 ? (olderQuestionsObj.c / olderQuestionsObj.t) * 100 : 0;
      const diff = newerAcc - olderAcc;
      
      improvement = Math.max(10, Math.min(100, Math.round(50 + diff * 3)));
    } else if (missionLogs.length === 1) {
      const firstAcc = missionLogs[0].total > 0 ? (missionLogs[0].score / missionLogs[0].total) * 100 : 0;
      improvement = Math.max(10, Math.min(100, Math.round(50 + (firstAcc - 70) * 1.5)));
    }

    const subjectValues = subjects ? Object.values(subjects) as number[] : [];
    const mastery = subjectValues.length > 0
      ? Math.max(0, Math.min(100, Math.round(subjectValues.reduce((acc: number, val: number) => acc + val, 0) / subjectValues.length)))
      : 0;

    const completedRatio = Math.min(1, missionLogs.length / 10);
    const progression = Math.max(10, Math.min(100, Math.round(completedRatio * 60 + levelProgress * 0.4)));

    return [
      { subject: 'Speed', A: speed, fullMark: 100 },
      { subject: 'Accuracy', A: accuracy, fullMark: 100 },
      { subject: 'Consistency', A: consistency, fullMark: 100 },
      { subject: 'Logic', A: logic, fullMark: 100 },
      { subject: 'Improvement', A: improvement, fullMark: 100 },
      { subject: 'Mastery', A: mastery, fullMark: 100 },
      { subject: 'Progression', A: progression, fullMark: 100 }
    ];
  }, [missionLogs, subjects, levelProgress]);

  // XP progression trends
  const chartData = useMemo(() => progressHistory.slice(-7).map(h => ({
    name: h.date.split('-').slice(1).join('/'),
    accuracy: h.accuracy,
    xp: h.xp
  })), [progressHistory]);

  const totalSessionDurationMin = useMemo(() => {
    const totalSec = missionLogs.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);
    return totalSec / 60;
  }, [missionLogs]);

  const avgTimePerQuestionSec = useMemo(() => {
    const totalQuestions = missionLogs.reduce((acc, log) => acc + (log.total || 0), 0);
    const totalSec = missionLogs.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);
    return totalQuestions > 0 ? (totalSec / totalQuestions) : 0;
  }, [missionLogs]);

  const examData = useMemo(() => {
    const exams = missionLogs.filter(m => m.isExam);
    const avgScore = exams.length > 0 
      ? (exams.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / exams.length) * 100
      : 0;
    
    return [
      { name: 'Stability', value: avgScore || 0 },
      { name: 'Variance', value: 100 - (avgScore || 0) }
    ];
  }, [missionLogs]);

  const COLORS = ['#CCFF00', '#1A1A1A'];

  if (authLoading || (loading && isRealUser)) {
    return (
      <div className="h-full flex flex-col px-6 pt-3 pb-4 overflow-hidden bg-transparent">
        {/* Simplified, text-based navigation tabs placeholder */}
        <div className="flex items-center justify-between border-b border-white/5 pb-0 mb-6 shrink-0">
          <div className="flex gap-6 overflow-x-auto scrollbar-hide w-full sm:w-auto px-1">
            {['Dashboard', 'Charts', 'Analytics'].map((label, idx) => (
              <div
                key={label}
                className={cn(
                  "relative text-[10px] font-black uppercase tracking-[0.2em] px-1 py-3 transition-colors text-center select-none whitespace-nowrap",
                  idx === 0 ? "text-white" : "text-white/20"
                )}
              >
                <span>{label}</span>
                {idx === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CCFF00]" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pulse Skeleton Content Area */}
        <div className="flex-1 min-h-0 relative overflow-y-auto scrollbar-hide space-y-6 pb-8 animate-pulse">
          {/* Synchronizing text indicator built inside the status row */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.01] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping shrink-0" />
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Syncing Stats Pipeline with Cloud Hub...</span>
            </div>
            <div className="w-16 h-1 bg-white/5 rounded-full" />
          </div>

          {/* Hero analytics card skeleton */}
          <div className="h-48 p-6 rounded-3xl bg-white/[0.01] border border-white/5 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-dashed border-white/10 shrink-0" />
            <div className="w-32 h-4 rounded-md bg-white/5" />
            <div className="w-48 h-2 rounded-md bg-white/5" />
          </div>

          {/* Bento grid skeletons */}
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col justify-between">
              <div className="w-1/2 h-3 bg-white/5 rounded-md" />
              <div className="w-3/4 h-6 bg-white/5 rounded-md" />
            </div>
            <div className="h-28 p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col justify-between">
              <div className="w-1/2 h-3 bg-white/5 rounded-md" />
              <div className="w-3/4 h-6 bg-white/5 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isRealUser) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-transparent text-center space-y-6 font-sans">
        <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl relative group">
          <Shield className="text-[#CCFF00] animate-pulse" size={48} />
          <div className="absolute inset-0 bg-[#CCFF00]/10 blur-xl rounded-full opacity-10" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Secure Academic Profile Required</h3>
          <p className="text-xs text-white/40 leading-relaxed font-medium">
            Please log in with an authenticated session to deploy, index, and persist your physical study progress histories, streak consistency indexes, and target learning curves in physical cloud engines.
          </p>
        </div>
        <div className="text-[9px] font-mono font-black text-white/20 uppercase tracking-widest border border-dashed border-white/10 rounded-xl px-4 py-2 bg-white/[0.005]">
          DATABASE SOURCE: postgres_supabase_cloud
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-6 pt-3 pb-4 overflow-hidden bg-transparent">
      
      {/* Simplified, text-based navigation tabs mirroring the PDF details page pattern with an animated underline */}
      <div className="flex items-center justify-between border-b border-white/5 pb-0 mb-6 shrink-0">
        <div className="flex gap-6 overflow-x-auto scrollbar-hide w-full sm:w-auto px-1">
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'charts', label: 'Charts' },
            { id: 'analytics', label: 'Analytics' }
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative text-[10px] font-black uppercase tracking-[0.2em] px-1 py-3 transition-colors cursor-pointer text-center select-none whitespace-nowrap focus:outline-none",
                  isActive ? "text-white font-black" : "text-white/20 hover:text-white/45"
                )}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-analytics-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#CCFF00]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container - Relative flex area allowing fully isolated scroll states */}
      <div className="flex-1 min-h-0 relative">
        
        {/* ==================== DASHBOARD TAB ==================== */}
        <div className={cn(
          "absolute inset-0 overflow-y-auto scrollbar-hide space-y-8 pb-8 pr-1",
          activeTab === 'dashboard' ? 'block' : 'hidden'
        )}>
          {/* Hero Analytics Card */}
          <section className="relative glass-card bg-gradient-to-br from-brand-secondary/5 to-transparent border-brand-secondary/10 overflow-hidden font-sans">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-primary/10 blur-[80px] rounded-full" />
            
            <div className="flex flex-col items-center text-center space-y-6 relative z-10">
              <div className="relative">
                <HeroProgressRing percentage={overallAccuracy} size={160} />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-2 -right-2 bg-dark-bg border border-white/10 p-2 rounded-xl shadow-xl"
                >
                  <Award size={20} className="text-brand-secondary" />
                </motion.div>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  {rankTitle}
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] px-2 py-0.5 bg-brand-primary/10 rounded-full">LEVEL {level}</span>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{totalXP.toLocaleString()} TOTAL XP</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                 <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/30 px-1">
                    <span>XP Progress</span>
                    <span>{levelDetails.xpNeededForNextLevel.toLocaleString()} XP TO Lvl {level + 1}</span>
                 </div>
                 <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${levelProgress}%` }}
                      className="h-full bg-brand-secondary shadow-[0_0_15px_rgba(0,224,255,0.4)]"
                    />
                 </div>
              </div>

              <div className="grid grid-cols-3 w-full gap-4 pt-4 border-t border-white/5">
                 <div className="text-center">
                    <p className="text-sm font-black text-white">{missionLogs.length}</p>
                    <p className="text-[8px] font-black text-white/20 uppercase">Missions</p>
                 </div>
                 <div className="text-center">
                    <p className="text-sm font-black text-orange-400 flex items-center justify-center gap-1">
                      <Flame size={12} className="text-orange-500 shrink-0 inline" /> {streakStats.currentStreak}
                    </p>
                    <p className="text-[8px] font-black text-white/20 uppercase">Streak</p>
                 </div>
                 <div className="text-center">
                    <p className="text-sm font-black text-brand-primary">+{Math.round(studyVelocity * 10)}%</p>
                    <p className="text-[8px] font-black text-white/20 uppercase">Improvement</p>
                 </div>
              </div>
            </div>
          </section>

          {/* Consistency Pipeline metrics */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                <Flame size={14} className="text-orange-500 animate-pulse" /> Consistency Pipeline
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card p-4 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Current Streak</span>
                  <Flame size={12} className="text-orange-500 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-orange-500">{streakStats.currentStreak}</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider">days</span>
                </div>
              </div>
              <div className="glass-card p-4 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Longest Streak</span>
                  <Trophy size={12} className="text-[#CCFF00] shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-[#CCFF00]">{streakStats.longestStreak}</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider">days</span>
                </div>
              </div>
              <div className="glass-card p-4 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Consistency</span>
                  <Activity size={12} className="text-brand-secondary shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-brand-secondary">{streakStats.consistency}%</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider">last 14d</span>
                </div>
              </div>
              <div className="glass-card p-4 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Missed Days</span>
                  <XCircle size={12} className="text-red-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-red-400">{streakStats.missedDays}</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider">days</span>
                </div>
              </div>
            </div>
          </section>

          {/* Cumulative Performance stats screen metrics */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                <Clock size={14} className="text-brand-primary" /> Cumulative Performance
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-5 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Total Session Duration</span>
                  <Clock size={12} className="text-brand-primary shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-brand-primary">{Math.round(totalSessionDurationMin)}</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider tracking-tight">minutes</span>
                </div>
                <p className="text-[8px] text-white/30 mt-1 leading-normal">Sum of elapsed study time across all completed assessments</p>
              </div>
              
              <div className="glass-card p-5 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate">Avg. Time / Question</span>
                  <Zap size={12} className="text-brand-secondary shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-2xl font-black text-brand-secondary">{Math.ceil(avgTimePerQuestionSec)}</span>
                  <span className="text-[9px] font-extrabold text-white/40 uppercase tracking-wider tracking-tight">seconds</span>
                </div>
                <p className="text-[8px] text-white/30 mt-1 leading-normal">Aggregated average response speed per individual question</p>
              </div>
            </div>
          </section>

          {/* Core Historical timeline log inside overview Dashboard tab */}
          {/* Core Historical timeline log inside overview Dashboard tab */}
          <MissionLogsList 
            title="Recent History"
            icon={<Rocket size={14} className="text-brand-primary" />}
            description="Your historic RETRIEVAL outcomes archived in real-time"
            className="p-0 border-0 bg-transparent mb-0"
          />
        </div>


        {/* ==================== CHARTS TAB ==================== */}
        <div className={cn(
          "absolute inset-0 overflow-y-auto scrollbar-hide space-y-8 pb-8 pr-1",
          activeTab === 'charts' ? 'block' : 'hidden'
        )}>
          {/* Trend Analytics Area Graph */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                <Activity size={14} className="text-brand-secondary" /> Trend Analytics
              </h3>
              <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg border border-white/10">
                {(['daily', 'weekly'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                      timeFilter === f ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 h-64 relative overflow-hidden group flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={80} className="text-brand-primary" />
              </div>
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 h-full select-none">
                  <Activity className="text-white/20 mb-3 animate-pulse" size={32} />
                  <p className="text-xs font-bold text-white/80">No XP progression history recorded</p>
                  <p className="text-[10px] text-white/40 mt-1 max-w-xs leading-relaxed">
                    Complete coding sessions, logic quizzes or exams in the Lecture Hub to build your XP progression trend chart.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#CCFF00', fontWeight: 'bold' }}
                    />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 'bold' }} 
                    />
                    <YAxis hide />
                    <Area 
                      type="monotone" 
                      dataKey="xp" 
                      stroke="#CCFF00" 
                      fillOpacity={1} 
                      fill="url(#colorXp)" 
                      strokeWidth={3}
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Weekly Mastery Analytics widget relocated inside Charts Tab */}
          <section className="space-y-4">
            <WeeklyMasteryAnalytics
              data={weeklyMasteryData}
              period={weeklyPeriod}
              onPeriodChange={(newPeriod) => setWeeklyPeriod(newPeriod as '7days' | '30days')}
              periodLabel={weeklyPeriod === '7days' ? 'Last 7 days' : 'Last 30 days'}
            />
          </section>

          {/* Skill Intelligence Radar */}
          <section className="glass-card">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                 <Brain size={14} className="text-brand-primary" /> Intelligence Radar
               </h3>
               <motion.button 
                 whileTap={{ scale: 0.95 }}
                 className="text-[9px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1.5"
               >
                 Optimize <Sparkles size={10} />
               </motion.button>
             </div>
             {radarData.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 h-64 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                  <Activity className="text-white/20 mb-3 animate-pulse" size={32} />
                  <p className="text-xs font-bold text-white/80 select-none">Not enough performance data to generate insights</p>
                  <p className="text-[10px] text-white/40 mt-1 max-w-xs leading-relaxed">Complete coding, math quizzes or exams in the Lecture Hub and return here to unlock your Intelligence Radar.</p>
               </div>
             ) : (
               <>
                  <div className="h-64 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                           <PolarGrid stroke="rgba(255,255,255,0.05)" />
                           <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} />
                           <Radar
                             name="Performance"
                             dataKey="A"
                             stroke="#CCFF00"
                             fill="#CCFF00"
                             fillOpacity={0.3}
                             animationDuration={2000}
                           />
                        </RadarChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                     <div className="p-3 rounded-2xl bg-white/2 border border-white/5">
                        <p className="text-[8px] font-black text-white/20 uppercase mb-1">Strongest Metric</p>
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-tight">
                          {(() => {
                            const sorted = [...radarData].sort((a, b) => b.A - a.A);
                            return `${sorted[0].subject} (${sorted[0].A})`;
                          })()}
                        </p>
                     </div>
                     <div className="p-3 rounded-2xl bg-white/2 border border-white/5">
                        <p className="text-[8px] font-black text-white/20 uppercase mb-1">Growth Opportunity</p>
                        <p className="text-xs font-bold text-red-400 uppercase tracking-tight">
                          {(() => {
                            const sorted = [...radarData].sort((a, b) => a.A - b.A);
                            return `${sorted[0].subject} (${sorted[0].A})`;
                          })()}
                        </p>
                     </div>
                  </div>
               </>
             )}
          </section>

          {/* Stabilization Meta (Exam performance Pie chart Breakdown) */}
          <section className="glass-card flex flex-col items-center">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center justify-start w-full gap-2 mb-6">
               <Shield size={14} className="text-brand-secondary" /> Stabilization Meta
             </h3>
             <div className="h-48 w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={examData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                      animationDuration={1500}
                    >
                      {examData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black">{Math.round(examData[0].value)}%</span>
                  <span className="text-[7px] font-black uppercase tracking-widest text-white/20">Consistency</span>
               </div>
             </div>
             <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary" />
                  <span className="text-[8px] font-black uppercase text-white/40">Success Rate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  <span className="text-[8px] font-black uppercase text-white/40">Error Margin</span>
                </div>
             </div>
          </section>
        </div>


        {/* ==================== ANALYTICS TAB ==================== */}
        <div className={cn(
          "absolute inset-0 overflow-y-auto scrollbar-hide space-y-8 pb-8 pr-1",
          activeTab === 'analytics' ? 'block' : 'hidden'
        )}>
          {/* Streak Horizontal Calendar with Inspector */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                <Calendar size={14} className="text-[#CCFF00] animate-pulse" /> Streak Calendar
              </h3>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#CCFF00] bg-[#CCFF00]/10 px-2.5 py-1 rounded-full">
                Interactive Pipeline
              </span>
            </div>

            <div className="glass-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[9px] font-black uppercase text-white/30 tracking-widest">
                <span>Last 14 learning cycles</span>
                <span className="text-brand-secondary">Select any day to inspect activities</span>
              </div>

              {/* Slider for days */}
              <div 
                ref={calendarContainerRef}
                className="w-full flex items-center gap-2 overflow-x-auto py-2.5 px-1.5 scrollbar-none snap-x touch-pan-x select-none"
              >
                {dates.map((dObj, idx) => {
                  const isActive = activeDatesSet.has(dObj.dateString);
                  const isSelected = selectedDayStr === dObj.dateString;
                  const isToday = dObj.dateString === getLocalDateString();

                  return (
                    <button
                      key={`analytics-day-${dObj.dateString}-${idx}`}
                      ref={isSelected ? selectedDayRef : null}
                      onClick={() => setSelectedDayStr(dObj.dateString)}
                      className={cn(
                        "min-w-[62px] flex-1 flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer snap-start relative",
                        isSelected 
                          ? "bg-[#CCFF00]/10 border-[#CCFF00]/60 ring-2 ring-[#CCFF00]/25 shadow-[0_0_12px_rgba(204,255,0,0.15)]" 
                          : "bg-white/[0.01] hover:bg-white/[0.03] border-white/5 hover:border-white/10",
                        isToday && !isSelected && "border-brand-secondary/40"
                      )}
                    >
                      <span className="text-[8px] font-black uppercase tracking-wider text-white/30">
                        {dObj.dayName}
                      </span>
                      <span className={cn(
                        "text-sm font-black tracking-tighter mt-1 mb-1.5",
                        isActive ? "text-[#CCFF00]" : "text-white/40"
                      )}>
                        {dObj.dayNum}
                      </span>

                      <div className="flex items-center justify-center">
                        {isActive ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] shadow-[0_0_8px_rgba(204,255,0,0.6)]" />
                        ) : (
                          <div className="w-1 h-1 rounded-full bg-white/10" />
                        )}
                      </div>

                      {isToday && (
                        <div className="absolute top-1 right-2 w-1 h-1 rounded-full bg-brand-secondary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Activity Selection Inspector Panel */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedDayStr}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 rounded-[28px] border border-white/5 bg-white/[0.015] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.04] pb-3">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#CCFF00]">
                        Study Verification Payload
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1">
                        {formatInspectorDate(selectedDayStr)}
                      </h4>
                    </div>
                    {selectedDayStats.hasActivity ? (
                      <span className="self-start sm:self-auto text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ● Cycle Complete
                      </span>
                    ) : (
                      <span className="self-start sm:self-auto text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                        ○ Cycle Inactive
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#CCFF00]/5 flex items-center justify-center text-[#CCFF00] border border-[#CCFF00]/10 shrink-0">
                        <Zap size={14} />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest truncate">XP Gained</p>
                        <p className="text-sm font-black text-white truncate">+{selectedDayStats.xp} XP</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-brand-secondary/5 flex items-center justify-center text-brand-secondary border border-brand-secondary/10 shrink-0">
                        <Clock size={14} />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-widest truncate">Study Time</p>
                        <p className="text-sm font-black text-white truncate">{selectedDayStats.minutes} {selectedDayStats.minutes === 1 ? 'min' : 'mins'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Completed Evaluations</p>
                    {selectedDayMissions.length === 0 ? (
                      <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.005] text-center space-y-1.5 pb-6">
                        <p className="text-[10px] font-bold text-white/40">No academic log items registered for this solar date</p>
                        <p className="text-[8px] text-white/20 uppercase tracking-widest leading-relaxed">
                          Lock in streaks by completing quizzes and custom protocols in the Lecture Hub!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayMissions.map((log, lIdx) => (
                          <div 
                            key={`mission-log-${log.id || lIdx}-${lIdx}`} 
                            className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4 animate-fade-in"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "w-6 h-6 rounded-lg opacity-80 flex items-center justify-center text-dark-bg shrink-0",
                                log.isExam ? "bg-[#CCFF00]" : "bg-brand-secondary"
                              )}>
                                <CheckCircle2 size={12} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{log.title}</p>
                                <p className="text-[8px] font-black text-white/30 uppercase mt-0.5 tracking-wider">
                                  {log.type} • {Math.round(log.timeSpentSeconds / 60)} minutes
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-brand-primary">+{log.xpGained} XP</span>
                              <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                                {Math.round((log.score / log.total) * 100)}% accuracy
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* Intelligence Recommendation Feed */}
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
              <Sparkles size={14} className="text-brand-primary" /> Intelligence Feed
            </h3>

            {loadingRecommendations ? (
              <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Synchronizing AI Insight Feed...</p>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <RecommendationItem 
                    key={`rec-item-${rec.title || 'rec'}-${index}`}
                    title={rec.title || "Academic Warning"}
                    topic={rec.topic || "Optimized Mastery Protocol"}
                    impact={rec.impact || "Medium"}
                    detail={rec.detail || "Academic performance trend analysis advises reviewing fundamental concepts."}
                    onAction={() => onNavigateAI(rec.subject ? `${rec.subject} fundamentals` : "General study review")}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2 select-none">
                <Sparkles size={24} className="text-white/20 animate-pulse" />
                <p className="text-xs font-bold text-white/60">No Intelligence reports generated</p>
                <p className="text-[10px] text-white/40 max-w-xs leading-relaxed">
                  {isRealUser 
                    ? "Complete more exams and quizzes in the Lecture Hub. The AI Advisor constantly reviews your results to detect performance variances, strengths, and knowledge gaps." 
                    : "Track study activities on an authenticated account to yield personalized academic recommendations."}
                </p>
              </div>
            )}
          </section>

          {/* Full scale Course Mastery Heatmap */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2 font-sans">
                 <Calendar size={14} className="text-brand-primary" /> Course Mastery Heatmap
               </h3>
               <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none">Performance Driven</span>
            </div>
            <div className="glass-card p-6">
              <Heatmap logs={missionLogs} />
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

/**
 * Standard recommendation panel displaying a cognitive task review gap with actionable feedback triggers.
 */
function RecommendationItem({ title, topic, impact, detail, onAction }: { title: string, topic: string, impact: 'Critical' | 'High' | 'Medium', detail: string, onAction: () => void }) {
    return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          onClick={onAction}
          className="glass-card group hover:border-brand-primary/30 transition-all cursor-pointer relative overflow-hidden font-sans"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {impact === 'Critical' ? <AlertTriangle size={64} className="text-red-500" /> : <Zap size={64} className="text-brand-primary" />}
            </div>

            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      impact === 'Critical' ? 'bg-red-500 animate-pulse' : 'bg-brand-primary'
                    )} />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{title}</span>
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                  impact === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                )}>
                    {impact}
                </span>
            </div>
            <h4 className="font-black text-sm mb-2 text-white group-hover:text-brand-primary transition-colors">{topic}</h4>
            <p className="text-xs text-white/50 leading-relaxed mb-4 max-w-[90%] font-medium">{detail}</p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-primary group-hover:gap-4 transition-all">
                Engage Assessment <ArrowRight size={14} />
            </div>
        </motion.div>
    );
}
