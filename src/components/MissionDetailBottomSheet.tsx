import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { 
  X, 
  Trophy, 
  Calendar, 
  Target, 
  Zap, 
  Clock, 
  TrendingUp, 
  ShieldCheck,
  Brain,
  Share2,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStats } from '../lib/StatsContext';
import { calculateXP } from '../lib/xpCalculator';

/**
 * Interface representing a completed quiz or exam history outcome.
 */
interface QuizHistoryItem {
  id: string;
  title: string;
  score: number;
  total: number;
  date: string;
  isExam?: boolean;
}

/**
 * Props for the MissionDetailBottomSheet component.
 */
interface MissionDetailBottomSheetProps {
  item: any; // Can be Completed QuizHistoryItem, MissionLogItem, or planned Mission
  isOpen: boolean;
  onClose: () => void;
  onResume?: (mission: any) => void;
}

/**
 * MissionDetailBottomSheet Component
 * 
 * Renders a highly-polished bottom sheet drawer that details active study plans or completed sessions.
 * For completed sessions, it implements dynamic, math-backed calculations comparing the current 
 * session with the user's global learning history (via useStats) to provide real cognitive feedback.
 */
export default function MissionDetailBottomSheet({ 
  item, 
  isOpen, 
  onClose,
  onResume
}: MissionDetailBottomSheetProps) {
  const dragControls = useDragControls();

  // Retrieve global study statistics, active level rank titles, and the redeem action
  const { missionLogs, redeemReward, rankTitle, totalXP = 0 } = useStats();

  // State verification: log whenever totalXP synchronizes into MissionDetailBottomSheet
  React.useEffect(() => {
    if (isOpen) {
      console.log(`[MissionDetailBottomSheet:XP] State verified: Provider totalXP synchronized = ${totalXP}`);
    }
  }, [totalXP, isOpen]);

  // Dynamic portal target: portals into studibl-app-shell (or fallback to body) to avoid stacking context / overflow issues
  const [portalNode, setPortalNode] = React.useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.getElementById('studibl-app-shell') || document.body;
    }
    return null;
  });

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const shell = document.getElementById('studibl-app-shell') || document.body;
      if (shell !== portalNode) {
        setPortalNode(shell);
      }
    }
  }, []);

  // Detect if the displayed item is an active/planned Mission or a completed historic result.
  // Completed logs have a 'score' property, whereas active/planned missions do not.
  const isMission = !item || typeof item !== 'object' || !('score' in item);

  // Look up the latest log item from StatsContext to ensure we reflect real-time updates (e.g. redeemed state) instantly
  const liveItem = (!isMission && item) 
    ? ((missionLogs || []).find((log: any) => log && log.id === (item as any).id) || item)
    : item;
  
  // Safe helper representations to shield layout and metrics against any undefined or zero values
  const liveScore = Number(liveItem?.score) || 0;
  const liveTotal = Number(liveItem?.total) || 0;
  const liveIsExam = Boolean(liveItem?.isExam || liveItem?.type === 'Exam' || liveItem?.title?.toLowerCase().includes('exam'));

  // Synchronically compute accurate, real-time deterministic XP values of the current log
  const calculatedXPBreakdown = React.useMemo(() => {
    if (isMission) {
      return { totalXP: 0, isPerfect: false, isExam: false, correctXP: 0, incorrectXP: 0, completionXP: 0, perfectXP: 0, examXP: 0 };
    }
    return calculateXP(liveScore, liveTotal, liveIsExam);
  }, [isMission, liveScore, liveTotal, liveIsExam]);

  const displayXP = React.useMemo(() => {
    if (isMission) return 0;
    const baseValue = liveItem?.xpGained !== undefined ? Number(liveItem.xpGained) : calculatedXPBreakdown.totalXP;
    return Math.max(0, isNaN(baseValue) ? 0 : baseValue);
  }, [isMission, liveItem?.xpGained, calculatedXPBreakdown.totalXP]);

  // Safe calculation of the target minimum milestone to redeem (e.g., minimum 30 XP or max possible XP of the quiz)
  const targetMinXP = React.useMemo(() => {
    if (isMission) return 0;
    const maxPossible = (liveTotal * 5) + 20 + 15 + (liveIsExam ? 100 : 0);
    return Math.min(30, maxPossible);
  }, [isMission, liveTotal, liveIsExam]);

  const isZeroXP = displayXP === 0;
  const isInsufficientXP = displayXP < targetMinXP;
  const remainingXPNeeded = Math.max(0, targetMinXP - displayXP);

  // Calculate raw mastery percentage for completed sessions
  const mastery = !isMission ? Math.round((liveTotal > 0 ? (liveScore / liveTotal) : 0) * 100) : 0;

  // Local state managers to coordinate dynamic user interactions and feedback
  const [redeemSuccess, setRedeemSuccess] = React.useState(false);
  const [shareSuccess, setShareSuccess] = React.useState(false);
  const [feedbackAlert, setFeedbackAlert] = React.useState('');

  // Synchronize dynamic status variables whenever the item or active display state modifies
  React.useEffect(() => {
    setRedeemSuccess(false);
    setShareSuccess(false);
    setFeedbackAlert('');
  }, [liveItem?.id, isOpen]);

  if (!item) return null;
  
  /**
   * Translates a study activity type to a human-readable instructional breakdown.
   */
  const getMissionDescription = (type?: string) => {
    switch (type) {
      case 'lecture': return "A deep-dive reading comprehension module. Enhances semantic structure and reading retention directly from memory pathways.";
      case 'video': return "An immersive audiovisual simulation containing core definitions, equations, and structures analyzed dynamically.";
      case 'quiz': return "An active retrieval scenario. Challenges core definitions, structures, and schemas under target retrieval constraints.";
      case 'ai-breakdown': return "An advanced conceptual synthesis. Generates breakdown structures for complex systems with semantic linking.";
      case 'review': return "A review session targeting weak connection weights. Essential for stabilizing neural memory decay curves.";
      default: return "A targeted study challenge designed for high neural building and schema integration.";
    }
  };

  // --- DYNAMIC LOG STATISTICS & COMPARISON LOGIC ---
  let cognitiveSpeedValue = "Steady";
  let cognitiveSpeedDescription = "";
  let accuracyStreakValue = "Base";
  let accuracyStreakDescription = "";
  let progressionValue = "Stable";
  let progressionDescription = "";
  let progressionIconColorClass = "text-white/40";
  let progressionValueColorClass = "text-white/60";
  let tacticalBriefingText = "";
  
  // Auxiliary metrics for completing results cards
  let secondsPerQuestion = 0;
  let formattedAvgTime = "0.0s";
  let durationMinStr = "0s";

  if (!isMission) {
    // 1. Locate the position of the current history item in chronological log archives
    // In StatsContext, missionLogs is sorted newest-to-oldest, so currentIdx indicates recent position
    const currentLogId = liveItem?.id;
    const currentIdx = (missionLogs || []).findIndex((logInHistory: any) => logInHistory && logInHistory.id === currentLogId);

    // 2. Cognitive Speed Metrics
    // Extract actual duration. If not recorded, default to 30s safely to protect division bounds
    const timeSpent = Number(liveItem?.timeSpentSeconds) || 30;
    const totalQuestions = liveTotal || 1;
    secondsPerQuestion = timeSpent / totalQuestions;
    
    // Format the average time spent per question to 1 decimal place if small, otherwise round it
    formattedAvgTime = secondsPerQuestion < 10 && secondsPerQuestion % 1 !== 0
      ? `${secondsPerQuestion.toFixed(1)}s` 
      : `${Math.round(secondsPerQuestion)}s`;

    // Dynamic session duration string
    durationMinStr = timeSpent >= 60 
      ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` 
      : `${timeSpent}s`;

    // Filter out the active item to isolate prior comparison samples of the same study vector
    const otherLogs = (missionLogs || []).filter((log: any) => log && log.id !== currentLogId);
    const sameTypeLogs = otherLogs.filter((log: any) => log && log.type === liveItem?.type);

    // Standardize comparison benchmarks dynamically
    const averageOtherSpeed = sameTypeLogs.length > 0
      ? (sameTypeLogs.reduce((accum: number, log: any) => {
          const logTime = Number(log?.timeSpentSeconds) || 30;
          const logTotal = Number(log?.total) || 1;
          return accum + (logTime / logTotal);
        }, 0) / sameTypeLogs.length)
      : (otherLogs.length > 0
        ? (otherLogs.reduce((accum: number, log: any) => {
            const logTime = Number(log?.timeSpentSeconds) || 30;
            const logTotal = Number(log?.total) || 1;
            return accum + (logTime / logTotal);
          }, 0) / otherLogs.length)
        : 30); // Benchmark fall-back default: 30s/question

    // Perform percentage deviation calculation (positive is faster, negative is slower)
    const speedRatio = averageOtherSpeed > 0 ? ((averageOtherSpeed - secondsPerQuestion) / averageOtherSpeed) * 100 : 0;

    // Qualitative Speed Labels: Lightning, Blitz, Rapid, Focused, Deliberate
    if (secondsPerQuestion < 8) {
      cognitiveSpeedValue = "Lightning";
    } else if (secondsPerQuestion < 16) {
      cognitiveSpeedValue = "Blitz";
    } else if (secondsPerQuestion < 28) {
      cognitiveSpeedValue = "Rapid";
    } else if (secondsPerQuestion < 55) {
      cognitiveSpeedValue = "Focused";
    } else {
      cognitiveSpeedValue = "Deliberate";
    }

    if (otherLogs.length === 0) {
      cognitiveSpeedDescription = `${Math.round(secondsPerQuestion)}s spent average per question on your inaugural study log.`;
    } else if (speedRatio >= 5) {
      cognitiveSpeedDescription = `Highly accelerated flow. You answered ${Math.round(speedRatio)}% faster than your typical cognitive pace.`;
    } else if (speedRatio <= -5) {
      cognitiveSpeedDescription = `Deliberate synthesis process. Spent ${Math.round(Math.abs(speedRatio))}% more time on complex junctions.`;
    } else {
      cognitiveSpeedDescription = `Steady retrieval flow. Custom-aligned with your average cognitive timeline.`;
    }

    // 3. Accuracy Streak / Match Combo
    // Traverse chronological backward records from the current item's index to identify high-accuracy streak
    let streak = 0;
    if (currentIdx >= 0 && missionLogs) {
      for (let index = currentIdx; index < missionLogs.length; index++) {
        const historicalLog = missionLogs[index];
        if (!historicalLog) continue;
        const accuracy = Number(historicalLog.accuracy) || 0;
        // An accuracy score of >= 80% represents an excellent study session
        if (accuracy >= 80) {
          streak++;
        } else {
          break; // Streak broken
        }
      }
    } else {
      streak = (mastery >= 80) ? 1 : 0;
    }

    // Qualitative Streak Labels: Exceptional, Sharp, Consistent, Base, Unstable
    if (streak >= 4 || (mastery === 100 && streak >= 2)) {
      accuracyStreakValue = "Exceptional";
      accuracyStreakDescription = `Incredible momentum! ${streak} high-precision modules (80%+) cleared with flawless, error-free recall.`;
    } else if (streak >= 2 || mastery >= 90) {
      accuracyStreakValue = "Sharp";
      accuracyStreakDescription = `Exceptional pattern matching. Streak of ${streak > 0 ? streak : 1} modules at high cognitive precision.`;
    } else if (streak === 1 || (mastery >= 80 && mastery < 90)) {
      accuracyStreakValue = "Consistent";
      accuracyStreakDescription = `Core pathways stabilized. Maintaining a consistent accuracy rating above standard retention threshold.`;
    } else if (mastery >= 70 && mastery < 80) {
      accuracyStreakValue = "Base";
      accuracyStreakDescription = `Foundational alignment. Baseline cognitive pacing with acceptable retrieval precision.`;
    } else {
      accuracyStreakValue = "Unstable";
      accuracyStreakDescription = `High retrieval friction detected. Accuracy of ${mastery}% suggests cognitive schema degradation.`;
    }

    // 4. Progression trend against historical baseline
    // Slice off items that are older than the current session to assess personal growth over time
    let olderLogs = (currentIdx >= 0 && missionLogs) ? missionLogs.slice(currentIdx + 1) : [];
    if (olderLogs.length === 0) {
      olderLogs = otherLogs;
    }

    const baselineAccuracy = olderLogs.length > 0
      ? Math.round(olderLogs.reduce((acc: number, log: any) => acc + (Number(log?.accuracy) || 0), 0) / olderLogs.length)
      : 75; // Pre-existing baseline default placeholder

    const accuracyVariance = mastery - baselineAccuracy;

    // Retrieve immediate previous log for comparison if possible
    const prevLog = (currentIdx >= 0 && missionLogs && currentIdx + 1 < missionLogs.length) ? missionLogs[currentIdx + 1] : null;
    const prevAccuracy = prevLog ? (prevLog.accuracy ?? Math.round(((Number(prevLog.score) || 0) / (Number(prevLog.total) || 1)) * 100)) : null;

    // Qualitative Progression Labels: Improving, Declining, Stable, Accelerating, Recovering
    const isAccelerating = accuracyVariance > 8 && (prevAccuracy === null || mastery > prevAccuracy);
    const isImproving = !isAccelerating && accuracyVariance > 2;
    const isRecovering = (accuracyVariance < 0 || mastery < baselineAccuracy) && prevAccuracy !== null && mastery > prevAccuracy + 3;
    const isDeclining = accuracyVariance < -4 && !isRecovering;

    if (isAccelerating) {
      progressionValue = "Accelerating";
      progressionDescription = `Rapid exponential growth! You are performing ${Math.round(accuracyVariance)}% above baseline with compounding retrieval speed.`;
      progressionIconColorClass = "text-brand-secondary";
      progressionValueColorClass = "text-brand-secondary font-black";
    } else if (isImproving) {
      progressionValue = "Improving";
      progressionDescription = `Solid upward trajectory. Performing ${Math.round(accuracyVariance)}% higher than your historical learning baseline of ${baselineAccuracy}%.`;
      progressionIconColorClass = "text-brand-secondary";
      progressionValueColorClass = "text-brand-secondary";
    } else if (isRecovering) {
      progressionValue = "Recovering";
      progressionDescription = `Positive course correction. Mastery increased by +${Math.round(mastery - (prevAccuracy || 0))}% compared to your immediate previous attempt.`;
      progressionIconColorClass = "text-yellow-400";
      progressionValueColorClass = "text-yellow-400";
    } else if (isDeclining) {
      progressionValue = "Declining";
      progressionDescription = `Performance variance detected. Current mastery is ${Math.round(Math.abs(accuracyVariance))}% below your historical learning baseline of ${baselineAccuracy}%.`;
      progressionIconColorClass = "text-red-400";
      progressionValueColorClass = "text-red-400";
    } else {
      progressionValue = "Stable";
      progressionDescription = `Consistent execution. Anchored perfectly on your historic baseline average of ${baselineAccuracy}%.`;
      progressionIconColorClass = "text-white/30";
      progressionValueColorClass = "text-brand-secondary";
    }

    // 5. Tactical Briefing: Narrative summary derived directly from multi-dimensional state indicators
    if (mastery === 100) {
      tacticalBriefingText = `Cognitive execution is perfect. You achieved 100% precision in '${liveItem?.title || "this study session"}', demonstrating an error-free mastery of its active retrieval cues. Moving forward, try introducing greater delay intervals to challenge your memory decay curve.`;
    } else if (mastery >= 85) {
      tacticalBriefingText = `Outstanding performance! A rating of ${mastery}% tells us key schemas in this subject are highly consolidated. Some minor latency is expected, but you have successfully cleared the threshold of deep conceptual retention.`;
    } else if (mastery >= 70) {
      tacticalBriefingText = `Good foundational precision. Your score of ${liveScore}/${liveTotal} shows solid progress but highlights a few weak nodes. We recommend reviewing key terms in this module once more before proceeding to testing milestones.`;
    } else {
      tacticalBriefingText = `Critical retrieval friction detected. An accuracy score of ${mastery}% means core definitions have decayed or were not properly integrated. Pause immediate testing; instead, use active summaries to rebuild schemas first.`;
    }

    // Add extra color context about speed to briefing narrative
    if (speedRatio >= 15 && mastery >= 80) {
      tacticalBriefingText += " Your rapid integration speeds denote exceptionally fluid, natural recall pathways.";
    } else if (speedRatio <= -15) {
      tacticalBriefingText += " Taking extra time to verify complex variables helped you safeguard precision.";
    }
  }

  /**
   * Executes the reward claiming logic. Credits XP to Total XP instantly, updates
   * localized states, and locks subsequent attempts to avoid duplicate claims.
   */
  const handleRedeem = () => {
    if (isMission || !liveItem || liveItem.redeemed) return;
    if (isZeroXP || isInsufficientXP) return; // Prevent insufficient/zero XP redemptions
    
    console.log(`[MissionDetailBottomSheet:XP] Redeeming reward for item "${liveItem.title}". Gained XP: ${displayXP}. Current totalXP: ${totalXP}`);
    const success = redeemReward(liveItem.id);
    if (success) {
      console.log(`[MissionDetailBottomSheet:XP] Reward redemption confirmed for item "${liveItem.title}".`);
      setRedeemSuccess(true);
      setFeedbackAlert(`Credited +${displayXP} XP! Your Rank and statistics have been updated dynamically.`);
      setTimeout(() => {
        setFeedbackAlert('');
      }, 5000);
    }
  };

  /**
   * Copy-fallback routine when browser environment restricts the native Share API.
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setShareSuccess(true);
        setFeedbackAlert('Recap copied to clipboard! Share the report anywhere.');
        setTimeout(() => {
          setShareSuccess(false);
          setFeedbackAlert('');
        }, 4000);
      })
      .catch((err) => {
        console.error('Failure to write to Clipboard: ', err);
      });
  };

  /**
   * Constructs an organic performance report based on the real dataset and attempts to dispatch
   * the message via standard browser Share Gateway, falling back to Clipboard write.
   */
  const handleShare = async () => {
    if (isMission || !liveItem) return;

    const performanceGrade = mastery >= 90 ? 'A+ Elite' : mastery >= 80 ? 'A Scholar' : mastery >= 70 ? 'B Focused' : 'Recheck Baseline';
    const accuracyChain = accuracyStreakValue;
    const durationMinStr = liveItem.timeSpentSeconds 
      ? `${Math.floor(liveItem.timeSpentSeconds / 60)}m ${liveItem.timeSpentSeconds % 60}s` 
      : '30s';

    // Formulate a beautiful, descriptive study telemetry report
    const shareContent = `🧠 STUDIBL INTEL RECAP 🧠
----------------------------------
COGNITIVE PROBE: [${liveItem.id?.slice(0, 8).toUpperCase() || 'UNALLOCATED'}]
MODULE: ${liveItem.title}
CATEGORY: ${liveItem.type}
PERFORMANCE: ${liveItem.score}/${liveItem.total} (${mastery}% Cognitive Mastery)
GRADE: ${performanceGrade}
SPECTRUM SPEED: ${cognitiveSpeedValue} (${durationMinStr})
PRECISION MOMENTUM: ${accuracyChain}
CURRENT USER TITLE: ${rankTitle}
----------------------------------
Reconfigure your study schema at Studibl. Keep building!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Studibl Mission Results`,
          text: shareContent,
        });
        setShareSuccess(true);
        setFeedbackAlert('Results shared successfully.');
        setTimeout(() => {
          setShareSuccess(false);
          setFeedbackAlert('');
        }, 3000);
      } catch (err) {
        // Fallback natively to clipboard upon user cancellation or permission blocks
        copyToClipboard(shareContent);
      }
    } else {
      copyToClipboard(shareContent);
    }
  };

  const isAppShell = portalNode?.id === 'studibl-app-shell';
  const positionClass = isAppShell ? 'absolute' : 'fixed';

  const sheetContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blur-backdrop overlay covering full shell or viewport */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn(
              positionClass,
              "inset-0 bg-black/85 z-[200] backdrop-blur-md cursor-pointer"
            )}
            id="bottom-sheet-backdrop"
          />
          
          {/* Bottom Sheet Drawer */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 300) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              positionClass,
              "bottom-0 left-0 right-0 z-[210] bg-[#0c0c0e] rounded-t-[36px] border-t border-white/10 max-h-[88%] max-w-lg mx-auto flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.85)] overflow-hidden"
            )}
            id="bottom-sheet-container"
          >
            {/* Handle Bar for dragging feedback */}
            <div 
              className="pt-3.5 pb-2 shrink-0 cursor-ns-resize touch-none flex justify-center"
              onPointerDown={(e) => dragControls.start(e)}
              id="bottom-sheet-drag-handle"
            >
              <div className="w-12 h-1.5 bg-white/20 hover:bg-white/40 transition-colors rounded-full" />
            </div>

            {/* Content View */}
            <div className="px-6 py-2 flex-1 overflow-y-auto overscroll-contain scrollbar-hide pb-16 space-y-6" id="bottom-sheet-content">
              {/* Header Details */}
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      isMission
                        ? item?.status === 'completed'
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                        : liveIsExam 
                          ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20" 
                          : "bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20"
                    )}>
                      {isMission 
                        ? item?.status === 'completed' ? 'Mission Cleared' : 'Active Mission'
                        : liveIsExam ? 'Final Protocol' : 'Mission Success'
                      }
                    </span>
                    <span className="text-[10px] text-white/30 font-bold flex items-center gap-1 uppercase tracking-widest">
                      <Calendar size={10} /> {isMission ? 'Scheduled Today' : (liveItem?.date || 'N/A')}
                    </span>
                  </div>
                  <h2 className="text-xl font-black uppercase text-white tracking-tight leading-tight pt-1">
                    {liveItem?.title || item?.title || 'Study Mission'}
                  </h2>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
                  id="bottom-sheet-close-btn"
                >
                  <X size={20} />
                </button>
              </div>

              {isMission ? (
                /* Ongoing / Planned Active Mission Outlook */
                <div className="space-y-6">
                  {/* Performance Indicators */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card p-5 rounded-[28px] border-white/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 mb-2">
                        <Clock size={18} />
                      </div>
                      <div className="text-sm font-black text-white">{item.duration}</div>
                      <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Est. Duration</p>
                    </div>

                    <div className="glass-card p-5 rounded-[28px] border-white/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 mb-2">
                        <Target size={18} />
                      </div>
                      <div className="text-xs font-black text-white capitalize">{item.type?.replace('-', ' ') || 'Self Study'}</div>
                      <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Mission Focus</p>
                    </div>
                  </div>

                  {/* Summary Briefing */}
                  <div className="glass-card p-6 rounded-[32px] border-white/5 bg-white/[0.01]">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">Tactical Briefing</h4>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">
                       {getMissionDescription(item.type)}
                    </p>
                  </div>

                  {/* Operational Controls */}
                  <div className="space-y-3 pt-2">
                    <button 
                      onClick={() => {
                        onClose();
                        if (onResume) {
                          onResume(item);
                        }
                      }}
                      className="w-full py-4 bg-brand-primary text-dark-bg font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 text-[10px] shadow-[0_10px_30px_rgba(204,255,0,0.15)] hover:bg-brand-primary/95 hover:scale-[1.01] active:scale-[0.99] transition-all"
                      id="bottom-sheet-start-btn"
                    >
                      <span>{item.status === 'completed' ? 'Restart Mission' : 'Resume Mission'}</span>
                      <ChevronRight size={14} />
                    </button>
                    <button 
                      onClick={onClose}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-black uppercase tracking-[0.2em] rounded-2xl text-[9px] transition-all"
                      id="bottom-sheet-keep-btn"
                    >
                      Keep for later
                    </button>
                  </div>
                </div>
              ) : (
                /* Dynamic Post-Mission Metrics & Insight Views for Completed History */
                <>
                  {/* Results Indicators */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="glass-card p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-2">
                        <Target size={20} />
                      </div>
                      <div className="text-xl font-black text-white">{liveScore}/{liveTotal}</div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Raw Score</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl border-brand-secondary/20 bg-brand-secondary/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary mb-2">
                        <Trophy size={20} />
                      </div>
                      <div className="text-xl font-black text-white">{mastery}%</div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Neural Mastery</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 mb-2">
                        <Clock size={20} />
                      </div>
                      <div className="text-xl font-black text-white">{formattedAvgTime}</div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Avg. Time / Question</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl border-white/5 flex flex-col justify-center items-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 mb-2">
                        <Zap size={20} />
                      </div>
                      <div className="text-xl font-black text-white">{durationMinStr}</div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Session Duration</p>
                    </div>
                  </div>

                  {/* Deterministic XP Breakdown Card */}
                  <div className="space-y-4 mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 px-2 flex items-center gap-2">
                      <Trophy size={11} className="text-brand-primary" /> XP Reward Breakdown
                    </h3>
                    <div className="glass-card p-5 rounded-[28px] border-white/5 space-y-3 bg-brand-primary/[0.01]">
                      <div className="flex justify-between items-center text-xs text-white/60">
                        <span className="font-medium">Correct Answers ({liveScore} × 5 XP)</span>
                        <span className="font-mono text-xs text-white">+{calculatedXPBreakdown.correctXP} XP</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-white/60">
                        <span className="font-medium">Incorrect Answers ({Math.max(0, liveTotal - liveScore)} × 1 XP)</span>
                        <span className="font-mono text-xs text-white">+{calculatedXPBreakdown.incorrectXP} XP</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-white/60">
                        <span className="font-medium">Base Completion Bonus</span>
                        <span className="font-mono text-xs text-white">+{calculatedXPBreakdown.completionXP} XP</span>
                      </div>
                      {calculatedXPBreakdown.isPerfect && (
                        <div className="flex justify-between items-center text-xs text-emerald-400">
                          <span className="font-semibold flex items-center gap-1">★ Perfect Score Bonus (100%)</span>
                          <span className="font-mono text-xs font-bold">+{calculatedXPBreakdown.perfectXP} XP</span>
                        </div>
                      )}
                      {calculatedXPBreakdown.isExam && (
                        <div className="flex justify-between items-center text-xs text-brand-secondary">
                          <span className="font-semibold flex items-center gap-1">⚡ Exam Completion Bonus</span>
                          <span className="font-mono text-xs font-bold">+{calculatedXPBreakdown.examXP} XP</span>
                        </div>
                      )}
                      <div className="h-px bg-white/5 my-1" />
                      <div className="flex justify-between items-center text-sm font-black text-white">
                        <span className="uppercase tracking-wider">Total XP Earned</span>
                        <span className="text-brand-primary font-mono text-base">+{calculatedXPBreakdown.totalXP} XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Real, Data-Driven Insights Column */}
                  <div className="space-y-4 mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 px-2 flex items-center gap-2">
                      <Brain size={12} /> Post-Mission Insights
                    </h3>
                    
                    <div className="glass-card p-5 rounded-[28px] border-white/5 space-y-4">
                      {/* Dynamic Speed Insight */}
                      <InsightItem 
                        icon={<Zap size={14} className="text-brand-primary" />}
                        title="Cognitive Speed"
                        value={cognitiveSpeedValue}
                        description={cognitiveSpeedDescription}
                      />
                      <div className="h-px bg-white/5 mx-2" />
                      
                      {/* Dynamic Accuracy Streak Insight */}
                      <InsightItem 
                        icon={<ShieldCheck size={14} className="text-brand-secondary" />}
                        title="Accuracy Streak"
                        value={accuracyStreakValue}
                        description={accuracyStreakDescription}
                      />
                      <div className="h-px bg-white/5 mx-2" />
                      
                      {/* Dynamic Progression Insight */}
                      <InsightItem 
                        icon={<TrendingUp size={14} className={progressionIconColorClass} />}
                        title="Progression"
                        value={progressionValue}
                        description={progressionDescription}
                        valueClassName={progressionValueColorClass}
                      />
                    </div>
                  </div>

                  {/* Dynamic Tactical Briefing summary */}
                  <div className="glass-card p-6 rounded-[32px] border-white/5 mb-6 bg-white/[0.01]">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">Tactical Briefing</h4>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">
                       {tacticalBriefingText}
                    </p>
                  </div>

                  {/* Glowing user notification and confirmation banner */}
                  {feedbackAlert && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-brand-primary/20 text-center flex items-center justify-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping shrink-0" />
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest leading-normal">
                        {feedbackAlert}
                      </span>
                    </motion.div>
                  )}

                  {/* Action Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleShare}
                      className={cn(
                        "flex items-center justify-center gap-2 py-4 glass text-white font-black uppercase tracking-widest rounded-2xl text-[9px] hover:bg-white/5 transition-all active:scale-95 group",
                        shareSuccess ? "border-brand-secondary/30 text-brand-secondary" : "border-white/10"
                      )}
                      id="bottom-sheet-share-btn"
                    >
                      <Share2 size={14} className={cn("transition-transform", shareSuccess ? "scale-110 text-brand-secondary animate-bounce" : "group-hover:scale-110 text-white")} /> 
                      {shareSuccess ? "Results Copied!" : "Share Results"}
                    </button>
                    
                    {liveItem?.redeemed ? (
                      <button 
                        disabled
                        className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-widest rounded-2xl text-[9px] opacity-90 cursor-default"
                        id="bottom-sheet-redeem-btn"
                      >
                        XP Redeemed ✓
                      </button>
                    ) : isZeroXP ? (
                      <button 
                        disabled
                        className="flex items-center justify-center gap-2 py-4 bg-white/5 text-white/20 border border-white/5 font-black uppercase tracking-widest rounded-2xl text-[9px] cursor-not-allowed"
                        id="bottom-sheet-redeem-btn"
                      >
                        0 XP (Insufficient)
                      </button>
                    ) : isInsufficientXP ? (
                      <button 
                        disabled
                        className="flex flex-col items-center justify-center gap-0.5 py-3 bg-white/5 text-white/40 border border-red-500/20 font-black uppercase rounded-2xl text-[8px] tracking-widest cursor-not-allowed"
                        id="bottom-sheet-redeem-btn"
                      >
                        <span>Insufficient XP</span>
                        <span className="text-[7px] text-red-500/80 font-bold font-mono">Need {remainingXPNeeded} More XP to Redeem</span>
                      </button>
                    ) : (
                      <button 
                        onClick={handleRedeem}
                        className="flex items-center justify-center gap-2 py-4 bg-brand-primary text-black font-black uppercase tracking-widest rounded-2xl text-[9px] hover:shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.3)] transition-all active:scale-95 group"
                        id="bottom-sheet-redeem-btn"
                      >
                        Redeem Rewards (+{displayXP} XP) <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Portal into studibl-app-shell or document.body to break free from nested scroll/clipping contexts
  if (!portalNode) {
    return sheetContent;
  }

  return createPortal(sheetContent, portalNode);
}

/**
 * InsightItem Subcomponent
 * Displays an individual metric with status tags and qualitative/quantitative descriptions.
 */
function InsightItem({ 
  icon, 
  title, 
  value, 
  description, 
  valueClassName,
  titleClassName
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  description: string; 
  valueClassName?: string;
  titleClassName?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("text-xs font-bold", titleClassName || "text-white/80")}>{title}</span>
          <span className={cn("text-[10px] font-black uppercase", valueClassName || "text-brand-secondary")}>{value}</span>
        </div>
        <p className="text-[10px] text-white/30 leading-tight">{description}</p>
      </div>
    </div>
  );
}

