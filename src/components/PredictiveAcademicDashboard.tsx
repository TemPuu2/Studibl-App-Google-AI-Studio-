import React, { useState, useMemo } from 'react';
import { 
  useAcademicIntelligence, 
  NIGERIAN_GRADES_MAP, 
  getNigerianGradeFromScore, 
  getClassificationFromCGPA 
} from '../lib/AcademicIntelligenceContext';
import { useStats } from '../lib/StatsContext';
import { useStreak } from '../lib/StreakContext';
import { useSubscription } from '../lib/SubscriptionContext';

import { 
  Brain, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  Zap, 
  BookOpen, 
  Volume2, 
  Sparkles, 
  Sliders, 
  History, 
  GraduationCap, 
  ShieldAlert, 
  HelpCircle,
  Activity,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PredictiveAcademicDashboardProps {
  onBack: () => void;
}

/**
 * COMPONENT: PredictiveAcademicDashboard
 * Serves as the primary viewport to visualize real-time predictions, run "what-if" simulator grade adjustments,
 * manage historical semesters, inspect knowledge graphs, and consume personalized AI study advice.
 */
export default function PredictiveAcademicDashboard({ onBack }: PredictiveAcademicDashboardProps) {
  // Pull states from Context API
  const {
    historicalSemesters,
    coursePerformances,
    coursePredictions,
    weakTopicsList,
    academicHealth,
    recommendations,
    knowledgeGraphs,
    simulatedGrades,
    loading,
    isAiRecommendationsLoading,
    isKnowledgeExtracting,
    currentGPA,
    currentCGPA,
    predictedGPA,
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
  } = useAcademicIntelligence();

  const { overallAccuracy, totalStudyMinutes, missionLogs = [] } = useStats();
  const { streak } = useStreak();
  const { canAccessPremium, setPaywallOpen } = useSubscription();

  const handleTriggerRecommendations = async () => {
    if (!canAccessPremium) {
      setPaywallOpen(true);
      return;
    }
    await triggerAiRecommendations();
  };


  /**
   * MEMOIZED CALCULATION: Compiles chronological historical academic performance log points.
   * Derived purely from authenticated session activity to populate the interactive Area Chart.
   */
  const academicHealthTimeline = useMemo(() => {
    const dailyData: Record<string, { totalAccuracy: number; count: number }> = {};

    missionLogs.forEach(log => {
      if (log.date) {
        const accuracy = Number(log.accuracy || 0);
        if (dailyData[log.date]) {
          dailyData[log.date].totalAccuracy += accuracy;
          dailyData[log.date].count += 1;
        } else {
          dailyData[log.date] = { totalAccuracy: accuracy, count: 1 };
        }
      }
    });

    return Object.entries(dailyData)
      .map(([date, stats]) => ({
        date,
        dateStr: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Math.round(stats.totalAccuracy / stats.count)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [missionLogs]);

  // Active Screen Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'simulator' | 'courses' | 'history'>('overview');

  // Input states for Add Semester modal/form
  const [showAddSemester, setShowAddSemester] = useState(false);
  const [isSavingSemester, setIsSavingSemester] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterGPA, setNewSemesterGPA] = useState('');
  const [newSemesterCU, setNewSemesterCU] = useState('');

  // Course syllabus detail viewing
  const [viewingSyllabusCourse, setViewingSyllabusCourse] = useState<string | null>(null);

  // Simple feedback alert banner state
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Toggle feedback
  const triggerAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage({ text, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4000);
  };

  /**
   * Action handler: adds a semester record to persistent database or client fallback
   */
  const handleAddSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterName || !newSemesterGPA || !newSemesterCU) {
      triggerAlert("Please set all semester values", 'error');
      return;
    }

    const gpaVal = parseFloat(newSemesterGPA);
    const cuVal = parseInt(newSemesterCU);

    if (gpaVal < 0 || gpaVal > 5.00 || isNaN(gpaVal)) {
      triggerAlert("GPA must be between 0.00 and 5.00", 'error');
      return;
    }

    if (cuVal <= 0 || isNaN(cuVal)) {
      triggerAlert("Credit units must be a positive integer", 'error');
      return;
    }

    setIsSavingSemester(true);
    try {
      await addHistoricalSemester({
        semester_name: newSemesterName,
        gpa: gpaVal,
        total_credit_units: cuVal,
        courses_grades: []
      });
      triggerAlert(`Added ${newSemesterName} successfully!`);
      setShowAddSemester(false);
      setNewSemesterName('');
      setNewSemesterGPA('');
      setNewSemesterCU('');
    } catch (err: any) {
      triggerAlert(err.message || "Failed to log semester results", "error");
    } finally {
      setIsSavingSemester(false);
    }
  };

  /**
   * Action handler: deletes a historical semester and updates metrics accordingly
   */
  const handleDeleteSemester = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete data for ${name}?`)) {
      try {
        await deleteHistoricalSemester(id);
        triggerAlert(`Deleted data for ${name}.`);
      } catch (err: any) {
        triggerAlert("Error clearing semester record", "error");
      }
    }
  };

  /**
   * Action handler: manual trigger client extractor for course syllabus intelligence
   */
  const handleExtractSyllabus = async (courseCode: string, courseName: string) => {
    if (!canAccessPremium) {
      setPaywallOpen(true);
      return;
    }
    triggerAlert(`Analyzing course syllabus for ${courseCode} via AI...`);
    const mockContext = `Core Syllabus Content for ${courseCode}: ${courseName}. Course teaches foundational components, matrix algebra, Laplace differentials, algorithm complexity loops, and exam criteria metrics. High frequency of quizzes and practice papers is tested.`;
    
    await extractCourseSyllabusIntelligence(courseCode, courseName, mockContext);
    triggerAlert(`Knowledge Graph and topics for ${courseCode} extracted completely!`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="animate-spin text-brand-primary h-8 w-8" />
        <p className="text-xs font-mono tracking-widest text-white/40 uppercase">Assessing Academic Graph...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-300">
      {/* Visual Section Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs font-black uppercase text-brand-primary tracking-widest flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          ← Back to Settings
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full">
          <Brain size={12} className="text-brand-primary animate-pulse" />
          <span className="text-[9px] font-bold text-brand-primary font-mono select-none">AI CORE ENABLED</span>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="text-brand-primary" /> Academic Intelligence
        </h1>
        <p className="text-xs text-white/40 mt-1">
          Predictive performance modeling, What-If forecasts, and AI syllabus diagnostics.
        </p>
      </div>

      {/* Internal Notification Alerts */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl border text-[11px] font-semibold flex items-center gap-2 shadow-lg ${
              alertMessage.type === 'success' 
                ? 'bg-brand-primary/10 border-brand-primary/20 text-[#CCFF00]' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {alertMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{alertMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Academic Navigation Subtabs */}
      <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Dashboard', icon: <Activity size={14} /> },
          { id: 'history', label: 'Semester Results', icon: <History size={14} /> },
          { id: 'simulator', label: 'GPA Simulator', icon: <Sliders size={14} /> },
          { id: 'courses', label: 'Active Courses', icon: <BookOpen size={14} /> }
        ].map(subTab => (
          <button
            key={subTab.id}
            onClick={() => setActiveSubTab(subTab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap uppercase tracking-wider transition-all cursor-pointer ${
              activeSubTab === subTab.id
                ? 'bg-[#CCFF00] text-black shadow-lg shadow-[#CCFF00]/10 scale-[1.02]'
                : 'text-white/40 hover:text-white/80'
            }`}
          >
            {subTab.icon}
            {subTab.label}
          </button>
        ))}
      </div>

      {/* VIEWPORT AREA */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: OVERVIEW & GENERAL PREDICTION FORECASTING */}
        {activeSubTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {coursePerformances.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/5 bg-white/[0.005] rounded-3xl space-y-4">
                <BookOpen size={40} className="text-[#CCFF00] mx-auto animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#CCFF00]">No Selected Course Modules</h3>
                <p className="text-xs text-white/40 max-w-sm mx-auto text-center font-semibold leading-relaxed">
                  Please open your profile under Account Settings and enroll in your current semester courses. Once selected, your AI academic predictive metrics will start updating in real time.
                </p>
              </div>
            ) : (
              <>
                {/* Under-diagnosed alert callout when historicalSemesters are empty */}
                {historicalSemesters.length === 0 && (
                  <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-4">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <h5 className="text-[11px] font-black uppercase text-blue-400 tracking-wide">Enhance Predictive Model Accuracy</h5>
                      <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                        You have not logged any historical semester results yet. Adding your past semester GPA records on the{' '}
                        <span 
                          onClick={() => setActiveSubTab('history')}
                          className="text-[#CCFF00] font-bold underline cursor-pointer hover:text-[#CCFF00]/80 transition-colors"
                        >
                          Semester Results tab
                        </span>{' '}
                        will significantly improve GPA/CGPA forecasts and model prediction accuracy!
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Row: Academic Health Index Circle & Forecast Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Card 1: Academic Health Index Score & Area Chart (2 Columns wide) */}
                  <div className="md:col-span-2 p-6 rounded-3xl bg-white/[0.01] border border-white/5 flex flex-col justify-between min-h-[250px] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start w-full">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Academic Health Progress</h4>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-3xl font-black text-white font-mono">{academicHealth.score}</span>
                          <span className="text-[10px] font-mono font-black text-white/30 uppercase tracking-widest">/ 100</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono font-bold text-brand-primary uppercase tracking-wider block">
                          Trend: {academicHealth.trend}
                        </span>
                        <div className={`mt-1 text-[9px] uppercase font-black tracking-widest inline-block px-2.5 py-0.5 rounded-full ${
                          academicHealth.status === 'Excellent' 
                            ? 'bg-[#CCFF00]/10 text-[#CCFF00]' 
                            : academicHealth.status === 'Good' 
                            ? 'bg-blue-500/10 text-blue-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {academicHealth.status}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Area Chart powered 100% by real user performance progress history */}
                    <div className="w-full h-[140px] mt-4 relative">
                      {academicHealthTimeline.length === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-black/10 px-4 text-center">
                          <TrendingUp className="text-white/20 mb-1 animate-pulse" size={20} />
                          <p className="text-[10px] font-black text-brand-primary uppercase tracking-wide">Tracking timeline empty</p>
                          <p className="text-[9px] text-white/30 max-w-[280px] font-semibold mt-0.5 leading-normal">
                            Complete quizzes, trainings and exams in your enrolled courses to generate your interactive timeline!
                          </p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={academicHealthTimeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#CCFF00" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                              dataKey="dateStr" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: 'bold' }} 
                            />
                            <YAxis 
                              tickLine={false} 
                              axisLine={false} 
                              domain={[0, 100]}
                              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: 'bold' }} 
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-[#121212]/95 border border-white/10 rounded-xl p-2 shadow-xl backdrop-blur-md">
                                      <p className="text-[8px] font-extrabold text-white/40 uppercase tracking-widest">
                                        {payload[0].payload.dateStr}
                                      </p>
                                      <p className="text-xs font-black text-[#CCFF00] mt-0.5">
                                        {payload[0].value}% Performance
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#CCFF00" 
                              strokeWidth={2} 
                              fillOpacity={1} 
                              fill="url(#colorHealth)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Card 2: CGPA Current & Forecasted Standing (1 Column wide) */}
                  <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 flex flex-col justify-between min-h-[250px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-blue-500" />
                    
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Graduation Forecast</h4>
                          <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
                            {predictedCGPA.toFixed(2)} <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">CGPA</span>
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-bold text-white/30 uppercase block leading-none">Confidence</span>
                          <span className="text-[13px] font-black text-[#CCFF00] font-mono">{modelConfidence}%</span>
                        </div>
                      </div>

                      <p className="text-[10px] font-semibold text-brand-primary flex items-center gap-1">
                        <GraduationCap size={12} /> Class: {graduationClassification}
                      </p>
                    </div>

                    {/* Sub-metrics bar comparing GPA outcomes */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 mt-4">
                      <div className="bg-white/[0.005] p-2 rounded-xl border border-white/[0.03]">
                        <span className="text-[8px] font-bold text-white/30 block uppercase tracking-wide">Semester GPA</span>
                        <span className="text-xs font-black text-white mt-0.5 block">{currentGPA.toFixed(2)}</span>
                      </div>
                      <div className="bg-white/[0.005] p-2 rounded-xl border border-white/[0.03]">
                        <span className="text-[8px] font-bold text-white/30 block uppercase tracking-wide">Current CGPA</span>
                        <span className="text-xs font-black text-white mt-0.5 block">{currentCGPA.toFixed(2)}</span>
                      </div>
                      <div className="bg-[#CCFF00]/5 p-2 rounded-xl border border-[#CCFF00]/10 col-span-2 flex justify-between items-center">
                        <div>
                          <span className="text-[8px] font-bold text-[#CCFF00]/60 block uppercase tracking-wide">Target Class</span>
                          <span className="text-[10px] font-black text-[#CCFF00] uppercase mt-0.5 block">{graduationClassification}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-semibold text-white/30 block">Simulated</span>
                          <span className="text-xs font-black text-white block">{predictedCGPA.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Calibration Info Box */}
                {modelConfidence < 60 && (
                  <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 flex items-start gap-3">
                    <AlertCircle className="text-orange-400 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1">
                      <h5 className="text-[11px] font-black uppercase text-orange-400 tracking-wide">Model Under-diagnosed (Low Accuracy Confidence)</h5>
                      <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                        We currently have restricted student performance tracking. Raise forecasting accuracy from {modelConfidence}% to 95% by practicing and taking quizzes on your enrolled courses!
                      </p>
                    </div>
                  </div>
                )}

                {/* Middle Section: Best Case vs Worst Case projections (Actual Statistical Extrapolations) */}
                <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#CCFF00]">Range Extrapolations</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Best Case */}
                    <div className="p-4 rounded-2xl bg-brand-primary/[0.02] border border-brand-primary/10 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Best-Case GPA Scenario</span>
                        <span className="text-xs font-black text-[#CCFF00] font-mono">{bestCaseGPA.toFixed(2)} GPA</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary" style={{ width: `${(bestCaseGPA / 5) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-white/40 leading-relaxed font-semibold pt-1">
                        If you secure 'A's in remaining modules, your final CGPA converges to <span className="text-white/80 font-bold">{bestCaseCGPA.toFixed(2)}</span> ({getClassificationFromCGPA(bestCaseCGPA)}).
                      </p>
                    </div>

                    {/* Worst Case */}
                    <div className="p-4 rounded-2xl bg-red-500/[0.02] border border-red-500/10 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Worst-Case GPA Scenario</span>
                        <span className="text-xs font-black text-red-400 font-mono">{worstCaseGPA.toFixed(2)} GPA</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${(worstCaseGPA / 5) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-white/40 leading-relaxed font-semibold pt-1">
                        If performance falls matching current weaknesses, CGPA drops to <span className="text-white/80 font-bold">{worstCaseCGPA.toFixed(2)}</span> ({getClassificationFromCGPA(worstCaseCGPA)}).
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Personalized Recommendations Section block */}
                <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-brand-primary" size={16} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Gemini Personal Study Guides</h4>
                    </div>
                    <button
                      onClick={handleTriggerRecommendations}
                      disabled={isAiRecommendationsLoading}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-55 flex items-center gap-1.5"
                    >
                      <RefreshCw size={10} className={isAiRecommendationsLoading ? 'animate-spin' : ''} />
                      {isAiRecommendationsLoading ? 'Refining...' : 'Regenerate'}
                    </button>
                  </div>

                  {isAiRecommendationsLoading ? (
                    <div className="space-y-3 py-4">
                      <div className="h-10 bg-white/5 animate-pulse rounded-xl" />
                      <div className="h-10 bg-white/5 animate-pulse rounded-xl" />
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/5 bg-white/[0.005] rounded-2xl">
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">No study recommendations generated. Check your network or course files.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.slice(0, 3).map((rec, i) => (
                        <div 
                          key={`rec-${rec.id || 'item'}-${i}`}
                          className="p-4 rounded-2xl border border-white/5 bg-white/[0.005] flex items-start gap-4 transition-transform hover:translate-x-1 duration-200"
                        >
                          <div className={`p-2 rounded-xl text-black ${
                            rec.priority === 'High' ? 'bg-[#CCFF00]' : rec.priority === 'Medium' ? 'bg-blue-400' : 'bg-zinc-400'
                          }`}>
                            <Sparkles size={14} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{rec.title}</span>
                              <span className={`text-[8px] font-mono font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                rec.priority === 'High' ? 'bg-red-500/10 text-red-400' : 'text-white/40'
                              }`}>
                                {rec.priority} Priority
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                              {rec.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* TAB 2: WHAT-IF GPA SIMULATOR MATRIX */}
        {activeSubTab === 'simulator' && (
          <motion.div
            key="simulator"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#CCFF00]">Interactive What-If Matrix</h4>
                  <p className="text-[11px] text-white/40 mt-1 font-semibold leading-relaxed">
                    Test hypothetical grades for the current active semester. Recalculate projected standing and classifications instantly. Sandbox states do not overwrite academic database records.
                  </p>
                </div>
                <button
                  onClick={resetSimulation}
                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-red-500/20"
                >
                  Clear Sims
                </button>
              </div>

              {/* Dynamic grade slider cards */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                {coursePerformances.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-white/5 bg-white/[0.005] rounded-3xl">
                    <BookOpen size={24} className="text-white/20 mx-auto mb-2 animate-bounce" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-brand-primary">No courses selected</p>
                    <p className="text-[10px] text-white/30 max-w-xs mx-auto text-center font-medium leading-relaxed mt-1">
                      Enrol on courses from the profile screen to simulate academic paths.
                    </p>
                  </div>
                ) : (
                  coursePerformances.map((perf, index) => {
                    const activeSimulated = simulatedGrades[perf.course_code];
                    const activePrediction = coursePredictions.find(p => p.course_code === perf.course_code);
                    const gradeToDisplay = activeSimulated || (activePrediction ? activePrediction.expected_grade : 'N/A');

                    return (
                      <div 
                        key={perf.course_code || index}
                        className="p-4 rounded-2xl border border-white/5 bg-white/[0.005] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-brand-primary font-mono">{perf.course_code}</span>
                            <span className="text-xs font-bold text-white truncate max-w-[200px]">{perf.course_name}</span>
                          </div>
                          <p className="text-[9px] text-white/30 font-bold uppercase">
                            Diagnostic Assessment Grade: {activePrediction ? activePrediction.expected_grade : 'N/A'} (expected index: {activePrediction ? activePrediction.expected_score : 0}%)
                          </p>
                        </div>

                        {/* Grade selection grid */}
                        <div className="flex items-center gap-1.5">
                          {['A', 'B', 'C', 'D', 'E', 'F'].map(grade => {
                            const isSelected = gradeToDisplay === grade;
                            return (
                              <button
                                key={grade}
                                onClick={() => updateSimulatedGrade(perf.course_code, grade)}
                                className={`w-10 h-10 rounded-xl font-bold font-mono text-xs transition-all active:scale-90 border cursor-pointer flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-[#CCFF00] text-black border-[#CCFF00] font-black' 
                                    : 'bg-white/[0.02] text-white/50 border-white/5 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                {grade}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Simulator Live Recalculations Bar */}
            <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.005] border border-white/5 space-y-1">
                <span className="text-[9px] font-black uppercase text-white/30 block tracking-widest">Calculated Active Semester GPA</span>
                <span className="text-2xl font-black text-white font-mono">{predictedGPA.toFixed(2)}</span>
                <span className="text-[9px] font-bold text-brand-primary block lowercase">Weighted range pro-rata</span>
              </div>
              <div className="p-4 rounded-2xl bg-brand-primary/5 border border-brand-primary/10 space-y-1">
                <span className="text-[9px] font-black uppercase text-[#CCFF00] block tracking-widest">Adjusted Projected Cumulative CGPA</span>
                <span className="text-2xl font-black text-[#CCFF00] font-mono">{predictedCGPA.toFixed(2)}</span>
                <span className="text-[9px] font-bold text-white/40 block leading-tight">Standing: {projectedClassification}</span>
              </div>
            </div>

          </motion.div>
        )}

        {/* TAB 3: ACTIVE COURSES DIAGNOSTICS & KNOWLEDGE GRAPH */}
        {activeSubTab === 'courses' && (
          <motion.div
            key="courses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {coursePerformances.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/5 bg-white/[0.005] rounded-3xl">
                <BookOpen size={30} className="text-white/20 mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-black uppercase tracking-widest text-[#CCFF00]">No Active Selected Courses</p>
                <p className="text-[10px] text-white/30 max-w-xs mx-auto text-center font-semibold leading-relaxed mt-1">
                  Connect or select syllabus modules from the enrolment tabs on previous menus.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {coursePerformances.map((perf, idx) => {
                  const pred = coursePredictions.find(p => p.course_code === perf.course_code);
                  const weak = weakTopicsList.find(w => w.course_code === perf.course_code);
                  const kg = knowledgeGraphs[perf.course_code];
                  const isSyllabusExpanded = viewingSyllabusCourse === perf.course_code;

                  return (
                    <div 
                      key={perf.course_code || idx}
                      className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 space-y-4"
                    >
                      {/* Course Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-brand-primary/10 border border-brand-primary/20 text-[#CCFF00] font-mono text-[10px] font-bold rounded">
                              {perf.course_code}
                            </span>
                            <h3 className="text-sm font-black text-white">{perf.course_name}</h3>
                          </div>
                          <p className="text-[10px] text-white/40 leading-none">
                            Diagnostic Quizzes Completed: {perf.quizzes_taken} modules • Total study logs: {perf.study_minutes} minutes
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full ${
                            pred?.risk_level === 'Low' ? 'bg-brand-primary/10 text-brand-primary' :
                            pred?.risk_level === 'Medium' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {pred?.risk_level || 'At Risk'}
                          </span>
                        </div>
                      </div>

                      {/* Course Metrics Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-white/[0.005] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Topic Mastery</span>
                          <span className="text-lg font-black text-white mt-1">{perf.mastery_percentage}%</span>
                        </div>
                        <div className="p-3 bg-white/[0.005] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Retention Index</span>
                          <span className="text-lg font-black text-white mt-1">{perf.concept_retention_percentage}%</span>
                        </div>
                        <div className="p-3 bg-white/[0.005] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Exam Readiness</span>
                          <span className="text-lg font-black text-white mt-1">{perf.exam_readiness_percentage}%</span>
                        </div>
                      </div>

                      {/* Diagnostic weaknesses lists */}
                      {weak && weak.weak_topics.length > 0 && (
                        <div className="p-4 rounded-2xl bg-red-500/[0.01] border border-red-500/5 space-y-1.5">
                          <span className="text-[9px] font-black uppercase text-red-400/80 tracking-widest block">Identified Topic Gaps</span>
                          <div className="flex flex-wrap gap-2">
                            {weak.weak_topics.map((topic, index) => (
                              <span 
                                key={index}
                                className="px-2 py-0.5 bg-red-500/5 border border-red-500/10 text-red-300 text-[9px] font-semibold rounded-lg"
                              >
                                ⚠ {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Knowledge graph extraction pipeline trigger */}
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            if (isSyllabusExpanded) {
                              setViewingSyllabusCourse(null);
                            } else {
                              setViewingSyllabusCourse(perf.course_code);
                              if (!kg) {
                                handleExtractSyllabus(perf.course_code, perf.course_name);
                              }
                            }
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-[#CCFF00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Brain size={12} className="text-brand-primary" />
                          {isSyllabusExpanded ? 'Collapse Course Syllabus' : 'Inspect AI Course Knowledge Graph'}
                          <span className="opacity-40 font-normal">({kg ? 'Graph Extracted' : 'Extract Syllabus'})</span>
                        </button>

                        <AnimatePresence>
                          {isSyllabusExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-4"
                            >
                              <div className="p-4 rounded-2xl bg-white/[0.005] border border-white/5 space-y-4">
                                {isKnowledgeExtracting[perf.course_code] ? (
                                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                                    <RefreshCw className="animate-spin text-brand-primary" size={16} />
                                    <p className="text-[9px] font-mono uppercase tracking-widest text-white/30">Extracting subtopics & formulas via Gemini...</p>
                                  </div>
                                ) : kg && kg.nodes.length > 0 ? (
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-[#CCFF00] tracking-widest">Syllabus Topic Nodes</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                      {kg.nodes.map((node, nIdx) => (
                                        <div 
                                          key={nIdx}
                                          className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5"
                                        >
                                          <div className="flex justify-between items-center text-xs font-bold text-white">
                                            <span>{node.name}</span>
                                            <div className="flex gap-2">
                                              <span className="text-[8px] font-mono text-[#CCFF00] uppercase tracking-wider bg-brand-primary/10 px-1 py-0.5 rounded">
                                                Importance: {node.importance}/10
                                              </span>
                                              <span className="text-[8px] font-mono text-blue-400 uppercase tracking-wider bg-blue-400/10 px-1 py-0.5 rounded">
                                                Difficulty: {node.difficulty}/10
                                              </span>
                                            </div>
                                          </div>
                                          <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                                            Core parameters: {node.concepts.join(', ') || 'Introductory concepts'}
                                          </p>
                                          {node.formulas && node.formulas.length > 0 && (
                                            <div className="bg-black/25 p-2 rounded-lg text-[9px] font-mono text-[#CCFF00] border border-white/5">
                                              Formulas: {node.formulas.join(', ')}
                                            </div>
                                          )}
                                          <div className="flex flex-wrap gap-1.5 pt-1">
                                            {node.subtopics.map((sub, sIdx) => (
                                              <span 
                                                key={sIdx}
                                                className="text-[9px] font-semibold text-white/30 bg-white/[0.02] border border-white/5 rounded px-1.5 py-0.5"
                                              >
                                                {sub}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">No diagnostic syllabus parsed. Check course documents.</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 4: HISTORICAL SEMESTER RESULTS */}
        {activeSubTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header with responsive trigger button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01] p-6 border border-white/5 rounded-3xl">
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#CCFF00]">Semester Grade Tracker</h4>
                <p className="text-[11px] text-white/40 font-semibold leading-relaxed">
                  Log your previous semesters' GPA outcomes. The systems combines these dynamically to secure a true-to-life cumulative CGPA grading.
                </p>
              </div>
              <button
                onClick={() => setShowAddSemester(true)}
                className="w-full sm:w-auto px-4 py-2 bg-[#CCFF00] text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all hover:bg-[#CCFF00]/80 shadow-lg cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus size={14} /> Add Result
              </button>
            </div>

            {/* Render form inside context if active */}
            {showAddSemester && (
              <motion.form
                onSubmit={handleAddSemesterSubmit}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-white/[0.02] border border-brand-primary/20 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">Log Previous Semester Outcome</h4>
                  <button
                    type="button"
                    onClick={() => setShowAddSemester(false)}
                    className="text-xs text-white/40 font-bold uppercase tracking-widest hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-white/40 tracking-widest block">Semester Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Year 1 Semester 1"
                      value={newSemesterName}
                      onChange={e => setNewSemesterName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-white/40 tracking-widest block">Semester GPA (0.00 - 5.00)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      placeholder="e.g. 4.35"
                      value={newSemesterGPA}
                      onChange={e => setNewSemesterGPA(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-white/40 tracking-widest block">Total Semester Credit Units</label>
                    <input 
                      type="number"
                      placeholder="e.g. 15"
                      value={newSemesterCU}
                      onChange={e => setNewSemesterCU(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CCFF00]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSemester}
                    className="px-4 py-2 bg-[#CCFF00] text-black font-extrabold uppercase text-[10px] tracking-wider rounded-xl hover:bg-[#CCFF00]/80 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingSemester ? 'Saving outcome...' : 'Save Semester outcome'}
                  </button>
                </div>
              </motion.form>
            )}

            {/* Semester History Table */}
            <div className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 overflow-hidden">
              {historicalSemesters.length === 0 ? (
                <div className="text-center py-10">
                  <History size={26} className="text-white/20 mx-auto mb-2 animate-pulse" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-brand-primary">No historical semesters logged</p>
                  <p className="text-[10px] text-white/30 max-w-sm mx-auto text-center font-semibold leading-relaxed mt-1">
                    Log past semesters' grades to allow true-to-life cumulative CGPA and Degree Classifications extrapolation.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-[#CCFF00] pb-2 border-b border-white/5 px-2">
                    <div className="col-span-5">Semester Name</div>
                    <div className="col-span-3">GPA Index</div>
                    <div className="col-span-3">Credits</div>
                    <div className="col-span-1 text-right">Delete</div>
                  </div>

                  <div className="space-y-2">
                    {historicalSemesters.map((sem, sIdx) => {
                      const cgpaClass = getClassificationFromCGPA(sem.gpa);
                      return (
                        <div 
                          key={sem.id || sIdx}
                          className="grid grid-cols-12 items-center text-xs font-bold text-white p-3 rounded-2xl bg-white/[0.005] border border-white/5 hover:bg-white/[0.01] px-2"
                        >
                          <div className="col-span-5 space-y-0.5">
                            <span className="block">{sem.semester_name}</span>
                            <span className="text-[8px] font-mono text-white/30 bg-white/5 rounded px-1 whitespace-nowrap uppercase">
                              {cgpaClass}
                            </span>
                          </div>
                          <div className="col-span-3 font-mono text-[#CCFF00]">{Number(sem.gpa).toFixed(2)}</div>
                          <div className="col-span-3 font-mono text-white/50">{sem.total_credit_units || 15} units</div>
                          <div className="col-span-1 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSemester(sem.id, sem.semester_name)}
                              className="p-1 px-2.5 text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-500/10 rounded-lg transition-all active:scale-95 cursor-pointer max-w-[36px]"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
