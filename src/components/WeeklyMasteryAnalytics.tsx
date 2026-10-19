import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Info, Calendar, AlertCircle, Loader2, Sparkles, Trophy 
} from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Data structure representing aggregated daily study performance metrics. This is 100% decoupling
 * compilation calculations from presentation charts to stay aligned with separation of concerns.
 */
export interface MasteryDayData {
  /** Short day of week abbreviation (e.g. "Mon") or MM-DD for longer intervals */
  dayName: string;
  /** Complete iso calendar date (YYYY-MM-DD) */
  dateStr: string;
  /** Calculated general cognitive mastery score (0-100) */
  masteryScore: number;
  /** Count of questions completed inside matched study sessions */
  questionsAttempted: number;
  /** Count of premium questions answered accurately on this day */
  correctAnswers: number;
  /** Exact mathematical base accuracy percentage (0-100) */
  accuracy: number;
}

/**
 * Data output format for historical trends and performance highlights, used in the footer insights.
 */
export interface AnalyticsInsights {
  /** Numeric difference between second half and first half of the selected period */
  changePercent: number;
  /** Narrative describing mastery velocity pattern (e.g., "Mastery improved by 5%") */
  trendString: string;
  /** Full day name string showing highest overall mastery performance */
  strongestDay: string;
  /** Full day name string showing lowest overall mastery performance */
  weakestDay: string;
  /** Weighted or raw average mastery score for the overall tracked interval */
  averageMastery: number;
}

/**
 * Takes raw mission journals / performance logs and aggregates them into clean daily intervals
 * over a specified number of historical days. Ensures empty slots are gracefully handled with zero values.
 */
export function generateMasteryData(logs: any[], daysCount: number = 7): MasteryDayData[] {
  const result: MasteryDayData[] = [];
  const today = new Date();
  
  // Set time to end of today to include all today's entries
  today.setHours(23, 59, 59, 999);
  
  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Convert day to short standard text label
    const daysAbbrev = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const label = daysCount <= 7 
      ? daysAbbrev[targetDate.getDay()] 
      : `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
      
    // Filter out correct logs matching the calendar date
    const dailyLogs = logs.filter(log => {
      if (!log || !log.date) return false;
      
      // Clean up log date to compare YYYY-MM-DD
      const logDateClean = log.date.substring(0, 10);
      if (logDateClean !== dateStr) return false;
      
      // Ignore sessions that don't have attempted questions
      if (log.total <= 0) return false;
      
      return true;
    });
    
    if (dailyLogs.length === 0) {
      result.push({
        dayName: label,
        dateStr,
        masteryScore: 0,
        questionsAttempted: 0,
        correctAnswers: 0,
        accuracy: 0
      });
    } else {
      let dailyTotalQuestions = 0;
      let dailyCorrectAnswers = 0;
      
      dailyLogs.forEach(entry => {
        dailyTotalQuestions += entry.total || 0;
        dailyCorrectAnswers += entry.score || 0;
      });
      
      const accuracy = dailyTotalQuestions > 0 
        ? Math.round((dailyCorrectAnswers / dailyTotalQuestions) * 100) 
        : 0;
        
      // Primary bar metric: Mastery Score is set based on average accuracy of questions answered.
      const masteryScore = accuracy;
      
      result.push({
        dayName: label,
        dateStr,
        masteryScore,
        questionsAttempted: dailyTotalQuestions,
        correctAnswers: dailyCorrectAnswers,
        accuracy
      });
    }
  }
  
  return result;
}

/**
 * Props layout for the reusable WeeklyMasteryAnalytics component.
 */
interface WeeklyMasteryAnalyticsProps {
  /** Pre-calculated mastery data matching the MasteryDayData standard schema */
  data: MasteryDayData[];
  /** Label detailing the current analytics window (e.g. "Last 7 Days") */
  periodLabel: string;
  /** Optional loading trigger to control standard skeletal overlay states */
  loading?: boolean;
  /** Optional transmission of processing errors to keep UI safe and responsive */
  error?: string | null;
  /** Optional active subject filter to feed current screen state */
  subjectFilter?: string;
  /** Future support hook allowing subject state bubble changes */
  onSubjectFilterChange?: (subject: string) => void;
  /** Selected window period label */
  period?: string;
  /** Future support hook allowing period adjustments from selection buttons */
  onPeriodChange?: (period: string) => void;
}

/**
 * Custom modern dark-theme recharts dialogue tooltip overlay.
 * Outputs key detailed metrics like Mastery, accuracy, questions attempted, and correct answers.
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as MasteryDayData;
    return (
      <div className="bg-zinc-950/95 border border-white/10 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md min-w-[200px] space-y-2 text-xs">
        {/* Render Day Identification Header */}
        <p className="font-extrabold text-white/40 uppercase tracking-widest text-[9px] border-b border-white/5 pb-1.5 mb-1">
          {label || data.dayName} performance
        </p>
        <div className="space-y-1.5 font-semibold">
          {/* Display Mastery level */}
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-white/40">Mastery Score:</span>
            <span className="text-[#CCFF00] font-black">{data.masteryScore}%</span>
          </div>
          {/* Display Accuracy percentage */}
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-white/40">Accuracy:</span>
            <span className="text-white/80">{data.accuracy}%</span>
          </div>
          {/* Display questions attempted count */}
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-white/40">Questions:</span>
            <span className="text-white/80">{data.questionsAttempted}</span>
          </div>
          {/* Display correct questions answered count */}
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-white/40">Correct:</span>
            <span className="text-white/80">{data.correctAnswers}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Calculate intelligence study trends and identify the strongest/weakest study periods.
 * This is isolated from the react cycle to improve rendering speed and make testing simple.
 */
export function calculateStudyInsights(data: MasteryDayData[]): AnalyticsInsights {
  const activeDays = data.filter(d => d.questionsAttempted > 0);
  
  if (data.length === 0 || activeDays.length === 0) {
    return {
      changePercent: 0,
      trendString: "No study activity recorded in this period.",
      strongestDay: "None",
      weakestDay: "None",
      averageMastery: 0
    };
  }
  
  // Calculate average mastery score across all days in the period
  const totalMastery = data.reduce((sum, d) => sum + d.masteryScore, 0);
  const averageMastery = Math.round(totalMastery / data.length);
  
  // Calculate performance trend: compare average of second half against first half
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);
  
  const avgFirstHalf = firstHalf.length > 0 
    ? firstHalf.reduce((sum, d) => sum + d.masteryScore, 0) / firstHalf.length 
    : 0;
  const avgSecondHalf = secondHalf.length > 0 
    ? secondHalf.reduce((sum, d) => sum + d.masteryScore, 0) / secondHalf.length 
    : 0;
  
  const changePercent = Math.round(avgSecondHalf - avgFirstHalf);
  
  let trendString = "";
  if (changePercent > 0) {
    trendString = `Mastery improved by ${changePercent}% this week.`;
  } else if (changePercent < 0) {
    trendString = `Mastery declined by ${Math.abs(changePercent)}% this week.`;
  } else {
    trendString = "Mastery remained completely stable this week.";
  }
  
  // Resolve strongest and weakest days among active sessions
  const activeSorted = [...activeDays].sort((a, b) => b.masteryScore - a.masteryScore);
  const strongestActive = activeSorted[0];
  const weakestActive = activeSorted[activeSorted.length - 1];
  
  const dayNameMapping: Record<string, string> = {
    'Sun': 'Sunday',
    'Mon': 'Monday',
    'Tue': 'Tuesday',
    'Wed': 'Wednesday',
    'Thu': 'Thursday',
    'Fri': 'Friday',
    'Sat': 'Saturday'
  };
  
  const strongestDay = strongestActive 
    ? (dayNameMapping[strongestActive.dayName] || strongestActive.dayName) 
    : "None";
    
  const weakestDay = weakestActive 
    ? (dayNameMapping[weakestActive.dayName] || weakestActive.dayName) 
    : "None";
    
  return {
    changePercent,
    trendString,
    strongestDay,
    weakestDay,
    averageMastery
  };
}

/**
 * A highly production-ready, custom styled WeeklyMasteryAnalytics chart component that displays
 * daily learning progression scores in an accessible barchart widget fitted for academic tracking.
 * Implements states for loading, empty datasets, errors and supports granular insights, customizable periods.
 */
export function WeeklyMasteryAnalytics({
  data,
  periodLabel,
  loading = false,
  error = null,
  subjectFilter = "All",
  onSubjectFilterChange,
  period = "7days",
  onPeriodChange
}: WeeklyMasteryAnalyticsProps) {
  
  // Calculate dynamic footer intelligence insights on change
  const insights = React.useMemo(() => calculateStudyInsights(data), [data]);
  
  // Test if we have real study session statistics to show
  const hasData = React.useMemo(() => {
    return data.some(day => day.questionsAttempted > 0);
  }, [data]);

  // Loading indicator template
  if (loading) {
    return (
      <div 
        id="weekly-mastery-loading-state" 
        className="glass-card bg-zinc-950/40 border border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center min-h-[350px] space-y-4 text-center animate-pulse"
      >
        <Loader2 className="animate-spin text-[#CCFF00]" size={36} />
        <div className="space-y-1">
          <p className="text-xs font-black text-white/80 uppercase tracking-widest">Analyzing Study Journals</p>
          <p className="text-[10px] text-white/30 font-semibold">Consolidating active academic metrics into real-time mastery layers...</p>
        </div>
      </div>
    );
  }

  // Error boundary indicator template
  if (error) {
    return (
      <div 
        id="weekly-mastery-error-state" 
        className="glass-card bg-red-500/5 border border-red-500/10 rounded-[32px] p-8 flex flex-col items-center justify-center min-h-[350px] space-y-4 text-center"
      >
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-xs font-black text-white/90 uppercase tracking-widest">Failed to Aggregate Metrics</p>
          <p className="text-[10px] text-red-400/70 font-semibold leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="weekly-mastery-analytics-component"
      className="glass-card bg-zinc-950/40 border border-white/5 rounded-[32px] p-6 space-y-6 flex flex-col justify-between"
    >
      {/* Chart Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="space-y-0.5">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#CCFF00] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-pulse shrink-0" />
            Weekly Mastery Analytics
          </h3>
          <p className="text-[10px] text-white/40 font-semibold">
            Study performance data compiled for <span className="text-[#CCFF00] font-black">{periodLabel}</span>
          </p>
        </div>
        
        {/* Dynamic Period Selectors */}
        <div className="flex items-center gap-1.5 bg-black/30 border border-white/5 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onPeriodChange?.("7days")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
              period === "7days" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/80"
            )}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => onPeriodChange?.("30days")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
              period === "30days" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/80"
            )}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Main Chart Stage or Empty State */}
      <div className="h-44 w-full relative">
        {!hasData ? (
          /* Empty State Display template explicitly required in guidelines */
          <div 
            id="weekly-mastery-empty-state" 
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/20 rounded-2xl z-10 p-6 text-center space-y-3.5 border-dashed border border-white/5"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/30 animate-bounce">
              <Trophy size={18} />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-xs font-bold text-white/80 select-none">No study activity recorded</p>
              <p className="text-[10px] text-white/40 leading-relaxed font-semibold">
                No mastery data available yet. Complete study sessions to begin tracking your progress.
              </p>
            </div>
          </div>
        ) : null}

        {/* Responsive Recharts Bar Chart Visualizer */}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            accessibilityLayer 
            data={data}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="dayName"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 'bold' }}
            />
            <YAxis
              domain={[0, 100]}
              tickCount={6}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8, fontWeight: 'bold' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 6 }}
              content={<CustomTooltip />}
            />
            <Bar 
              dataKey="masteryScore" 
              fill="#CCFF00" 
              radius={[6, 6, 0, 0]} 
              maxBarSize={32}
              opacity={hasData ? 1 : 0.05}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Intelligence Insights Section */}
      {hasData && (
        <div 
          id="weekly-mastery-insights-footer"
          className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-white/5 pt-4 text-xs font-semibold"
        >
          {/* Trend and change indicator */}
          <div className="flex items-center gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              insights.changePercent >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            )}>
              {insights.changePercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-black uppercase text-white/30 tracking-widest block">Compounding Trend</span>
              <p className="text-[10px] text-white/80 leading-tight">{insights.trendString}</p>
            </div>
          </div>

          {/* Strongest versus weakest summary */}
          <div className="flex items-center gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-black uppercase text-white/30 tracking-widest block">Peak & Valley Days</span>
              <p className="text-[10px] text-white/80 leading-tight">
                Peak: <span className="text-[#CCFF00] font-black">{insights.strongestDay}</span> • 
                Valley: <span className="text-white/50">{insights.weakestDay}</span>
              </p>
            </div>
          </div>

          {/* Average Mastery indicator */}
          <div className="flex items-center gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-3">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Info size={14} />
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-black uppercase text-white/30 tracking-widest block">Average Velocity</span>
              <p className="text-[10px] text-white/80 leading-tight">
                Maintaining an average mastery of <span className="text-[#CCFF00] font-black">{insights.averageMastery}%</span> in this range.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
