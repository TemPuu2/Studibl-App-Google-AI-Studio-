import React from 'react';
import { Play, ClipboardCheck, MessageCircle, ChevronRight, Zap, Trophy, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLectureLibrary } from '../lib/LectureLibraryContext';
import { useStats } from '../lib/StatsContext';
import { useDocumentProgress } from '../lib/DocumentProgressContext';
import { useVideoProgress } from '../lib/VideoProgressContext';
import { useMissions } from '../lib/MissionsContext';
import { useAuth } from '../lib/AuthContext';
import { isRealUserSession } from '../lib/supabaseService';
import { supabase } from '../supabaseClient';
import StudyGoals from './StudyGoals';
import { WeeklyMasteryAnalytics, generateMasteryData } from './WeeklyMasteryAnalytics';

const extractCourseCode = (text: string): string => {
  if (!text) return "COURSE";
  const match = text.match(/([a-z]{2,4})\s*[-_]?\s*(\d{3})/i);
  if (match) {
    return `${match[1].toUpperCase()} ${match[2]}`;
  }
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2 && /^\d/.test(parts[1])) {
    return `${parts[0].toUpperCase()} ${parts[1]}`;
  }
  return parts[0].toUpperCase();
};

export default function Dashboard({ onNavigate, onResume }: { onNavigate: (tab: any) => void, onResume: (mission: any) => void }) {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholarly Student';
  const isRealUser = user && isRealUserSession(user.id);

  const { recentCourses, unifiedLectures } = useLectureLibrary();
  const { getProgress: getDocProgress } = useDocumentProgress();
  const { getVideoProgress } = useVideoProgress();
  const { overallAccuracy = 0, progressHistory = [], missionLogs = [] } = useStats() || {};
  const { currentMission } = useMissions();

  // Selected tracking period for analytics visualization, defaults to last 7 days
  const [period, setPeriod] = React.useState<'7days' | '30days'>('7days');

  // Separated compilation processing: aggregate daily study performance metrics dynamically
  const parsedAnalyticsData = React.useMemo(() => {
    return generateMasteryData(missionLogs, period === '7days' ? 7 : 30);
  }, [missionLogs, period]);

  const handleResumeClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentMission) {
      onResume(currentMission);
    } else {
      onNavigate('lectures');
    }
  };

  const { missions } = useMissions();

  const handleResumeCourse = (courseCode: string) => {
    // 1. Find the latest UNFINISHED mission associated with this course
    const courseMissions = missions.filter(m => {
      const mCode = extractCourseCode(m.topic || m.courseId || "");
      return mCode === courseCode && m.status !== 'completed';
    });
    
    if (courseMissions.length > 0) {
      // Sort by updatedAt desc to get the truly latest interaction
      const latest = [...courseMissions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      onResume(latest);
      return;
    }

    // 2. Fallback: If all are completed, find any mission for this course to at least show the last material
    const allCourseMissions = missions.filter(m => {
      const mCode = extractCourseCode(m.topic || m.courseId || "");
      return mCode === courseCode;
    });
    if (allCourseMissions.length > 0) {
      const latest = [...allCourseMissions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      onResume(latest);
      return;
    }

    // 3. Last Fallback: Find the first lecture in this course and start it
    const courseLectures = unifiedLectures.filter(l => extractCourseCode(l.course) === courseCode);
    if (courseLectures.length > 0) {
      onNavigate('lectures');
    } else {
      onNavigate('lectures');
    }
  };

  const getCourseProgress = (courseCode: string) => {
    const courseLectures = unifiedLectures.filter(l => extractCourseCode(l.course) === courseCode);
    if (courseLectures.length === 0) return 0;
    
    const totalProgress = courseLectures.reduce((acc, l) => {
      let progress = 0;
      if (l.type === 'video' || l.type === 'voice') {
        progress = getVideoProgress(l.id)?.progress || 0;
      } else {
        progress = getDocProgress(l.id) || 0;
      }
      return acc + progress;
    }, 0);
    
    return Math.round(totalProgress / courseLectures.length);
  };

  const getCourseLevel = (progress: number) => {
    if (progress === 0) return "Not Started";
    if (progress < 25) return "Initiated";
    if (progress < 50) return "Developing";
    if (progress < 75) return "Advanced";
    if (progress < 95) return "Mastering";
    return "Completed";
  };

  const [activeCourses, setActiveCourses] = React.useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = React.useState(true);

  React.useEffect(() => {
    // Dynamically query enrolled courses upon mounting and session updates from Supabase for all authenticated sessions.
    // This gathers references from profiles, recent activity logs, and grades to present a unified real-time dashboard.
    if (user) {
      const loadCourses = async () => {
        setCoursesLoading(true);
        try {
          const courseNamesSet = new Set<string>();
          const courseObjects: any[] = [];

          // Helper utility to safely validate and normalize dynamic course titles/identifiers 
          // to prevent duplicates and filter out generic system keywords.
          const addCourseEntry = (nameOrObj: any) => {
            if (!nameOrObj) return;
            let name = "";
            let code = "";
            let id = "";

            if (typeof nameOrObj === "string") {
              name = nameOrObj.trim();
              code = extractCourseCode(name);
              id = code;
            } else if (typeof nameOrObj === "object") {
              name = (nameOrObj.name || nameOrObj.courseName || nameOrObj.course_name || "").trim();
              const candidateCode = (nameOrObj.code || nameOrObj.course_code || name || "").trim();
              code = extractCourseCode(candidateCode);
              id = code;
            }

            if (!code || code === "MY UPLOADS" || code === "MY" || name === "My Uploads") return;
            const normalizedCode = code.toUpperCase();
            
            // Strictly exclude pre-populated system mock and legacy placeholder courses (MECH 402, CIVL 301, GEN 100, PHYS 101)
            // as requested by the user, so only real, synchronized user academic entries are displayed.
            const isMockOrPlaceholder = ["MECH 402", "CIVL 301", "GEN 100", "PHYS 101"].includes(normalizedCode);
            if (isMockOrPlaceholder) return;

            if (!courseNamesSet.has(normalizedCode)) {
              courseNamesSet.add(normalizedCode);
              courseObjects.push({
                id: normalizedCode,
                code: normalizedCode,
                name: name || normalizedCode
              });
            }
          };

          // 1. Extract courses saved in the authenticated student profile's user metadata
          try {
            const { data: { user: freshestUser }, error: userErr } = await supabase.auth.getUser();
            const selected = freshestUser?.user_metadata?.selected_courses || user?.user_metadata?.selected_courses;
            if (Array.isArray(selected)) {
              selected.forEach(addCourseEntry);
            }
          } catch (e) {
            console.warn("Could not retrieve user metadata selected_courses:", e);
          }

          // 2. Fetch the student's dynamic courses from recent_courses table
          try {
            const { data: dbRecent, error: recentErr } = await supabase
              .from('recent_courses')
              .select('course_name')
              .eq('user_id', user.id);
            if (!recentErr && dbRecent) {
              dbRecent.forEach(c => addCourseEntry(c.course_name));
            }
          } catch (e) {
            console.warn("Could not retrieve recent_courses:", e);
          }

          // 3. Fetch from performance metrics tracking table
          try {
            const { data: dbPerf, error: perfErr } = await supabase
              .from('course_performance')
              .select('course_code')
              .eq('user_id', user.id);
            if (!perfErr && dbPerf) {
              dbPerf.forEach(c => addCourseEntry(c.course_code));
            }
          } catch (e) {
            console.warn("Could not retrieve course_performance:", e);
          }

          // 4. Fetch matching records from standard academic records
          try {
            const { data: dbRecords, error: recordsErr } = await supabase
              .from('academic_records')
              .select('course_code, course_name')
              .eq('user_id', user.id);
            if (!recordsErr && dbRecords) {
              dbRecords.forEach(c => addCourseEntry(c.course_name || c.course_code));
            }
          } catch (e) {
            console.warn("Could not retrieve academic_records:", e);
          }

          // 5. Fetch enrolled course codes and titles from current semester results table
          try {
            const { data: dbResults, error: resultsErr } = await supabase
              .from('semester_results')
              .select('course_code, course_name')
              .eq('user_id', user.id);
            if (!resultsErr && dbResults) {
              dbResults.forEach(c => addCourseEntry(c.course_name || c.course_code));
            }
          } catch (e) {
            console.warn("Could not retrieve semester_results:", e);
          }

          setActiveCourses(courseObjects);
        } catch (err) {
          console.error("Critical error fetching courses from Supabase tables:", err);
        } finally {
          setCoursesLoading(false);
        }
      };
      loadCourses();
    } else {
      setActiveCourses([]);
      setCoursesLoading(false);
    }
  }, [user]);

  // Normalize list to render the courses mapped directly to real user records in Supabase
  const normalizedCourses = React.useMemo(() => {
    return activeCourses;
  }, [activeCourses]);

  return (
    <div className="h-full px-6 pt-3 pb-12 overflow-y-auto scrollbar-hide">
      {/* Daily Mission Card */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (currentMission) {
            onResume(currentMission);
          } else {
            onNavigate('lectures');
          }
        }}
        className="relative overflow-hidden group cursor-pointer mb-8 rounded-[32px] bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-dark-bg"
      >
        <div className="absolute top-0 right-0 p-4 opacity-20">
          {currentMission?.type === 'quiz' ? <ClipboardCheck size={120} strokeWidth={1} /> : <Zap size={120} strokeWidth={1} />}
        </div>
        <div className="relative z-10">
          <div className="pill-tag !bg-black !text-brand-primary mb-4 w-fit flex items-center gap-2 shadow-lg ring-1 ring-white/10">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
            Current Mission
          </div>
          <h3 className="text-2xl font-bold mb-2 truncate">
            {currentMission ? currentMission.title : 'Ready to Start?'}
          </h3>
          <p className="text-dark-bg/70 text-sm mb-6 max-w-[200px]">
            {currentMission ? `${currentMission.duration} estimated • ${currentMission.type?.replace('-', ' ')}` : 'Select an activity to begin your journey'}
          </p>
          
          <div className="flex gap-2 mb-6 h-1 w-full max-w-[200px] bg-dark-bg/10 rounded overflow-hidden">
             <div className="flex-1 bg-dark-bg" />
             <div className="flex-1 bg-dark-bg/20" />
             <div className="flex-1 bg-dark-bg/20" />
          </div>
          
          <button 
            onClick={handleResumeClick}
            className="flex items-center gap-2 font-bold px-4 py-3 bg-white text-dark-bg rounded-xl text-xs group-hover:scale-105 transition-all w-full justify-center shadow-lg shadow-black/5"
          >
            {currentMission ? 'Resume Study' : 'Browse Library'} <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* Quick Access */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <ActionButton icon={<Play size={18} />} label="Resume" color="bg-brand-secondary/10 text-brand-secondary" onClick={handleResumeClick} />
        <ActionButton icon={<ClipboardCheck size={18} />} label="Arena" color="bg-brand-primary/10 text-brand-primary" onClick={() => onNavigate('quizzes')} />
        <ActionButton icon={<MessageCircle size={18} />} label="Mentor" color="bg-brand-secondary/10 text-brand-secondary" onClick={() => onNavigate('ai')} />
      </div>

      {/* Study Goals Section */}
      <div className="mb-8">
        <StudyGoals compact={true} />
      </div>

      {/* Weekly Mastery Analytics Chart block */}
      <div className="mb-8">
        <WeeklyMasteryAnalytics
          data={parsedAnalyticsData}
          period={period}
          onPeriodChange={(newPeriod) => setPeriod(newPeriod as '7days' | '30days')}
          periodLabel={period === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
        />
      </div>

      {/* Course Progress - Active Courses display fetched directly from database */}
      <div className="space-y-4">
        <h4 className="font-bold flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-brand-secondary" />
          Active Courses
        </h4>
        {coursesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="glass-card flex items-center gap-4 border border-white/5 p-4 rounded-3xl bg-white/[0.01]">
                {/* Micro-Interaction Skeleton Shimmer Component mapping the authentic layout */}
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-8 bg-white/5 rounded animate-pulse" />
                  </div>
                  <div className="h-2.5 w-40 bg-white/5 rounded animate-pulse mt-1" />
                  <div className="h-2 w-16 bg-white/5 rounded animate-pulse mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        ) : normalizedCourses.length > 0 ? (
          normalizedCourses.map((course, idx) => {
            const progress = getCourseProgress(course.code);
            return (
              <CourseItem 
                key={`dash-course-${course.id || course.code || idx}-${idx}`}
                title={course.code} 
                subtitle={course.name !== course.code ? course.name : undefined}
                progress={progress} 
                level={getCourseLevel(progress)} 
                onClick={() => handleResumeCourse(course.code)}
              />
            );
          })
        ) : (
          <div className="p-8 glass-card border-dashed border-white/10 rounded-3xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 mx-auto">
              <BookOpen size={24} />
            </div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">No enrolled courses found</p>
            <p className="text-[10px] text-white/20">Enroll or add courses inside your student profile to track dynamic intelligence metrics</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all hover:scale-105 active:scale-95 ${color}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function CourseItem({ title, subtitle, progress, level, onClick }: { title: string, subtitle?: string, progress: number, level: string, onClick: () => void }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="glass-card flex items-center gap-4 cursor-pointer hover:border-brand-primary/20 transition-all border border-white/5"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        <Trophy size={16} className={progress > 80 ? "text-brand-primary" : "text-white/40"} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <div className="flex flex-col overflow-hidden">
            <h5 className="text-xs font-bold text-zinc-100">{title}</h5>
            {subtitle && (
              <span className="text-[9px] text-white/40 font-semibold tracking-tight truncate max-w-[180px] mt-0.5">{subtitle}</span>
            )}
            <span className="text-[8px] font-black uppercase text-brand-primary/70 tracking-widest mt-1">{level}</span>
          </div>
          <span className="text-[9px] text-white/40 font-semibold">{progress}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-brand-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </motion.div>
  );
}
