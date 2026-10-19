import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Zap, Clock, Medal, History } from 'lucide-react';
import { useStats, MissionLogItem } from '../lib/StatsContext';
import { cn } from '../lib/utils';
import MissionDetailBottomSheet from './MissionDetailBottomSheet';

const ITEMS_PER_PAGE = 5;

interface MissionLogsListProps {
  title?: string;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

/**
 * MissionLogsList Component
 * 
 * A reusable, fully synchronized mission history log tracker that displays completed
 * user assessments, quiz results, and exam statistics from StatsContext. Shows a paginated list
 * of historical learning outcomes and enables drilling down into individual logs via bottom sheet detail views.
 */
export default function MissionLogsList({
  title = "Combat Records",
  icon = <History size={16} className="text-brand-primary" />,
  description,
  className
}: MissionLogsListProps) {
  const { missionLogs = [] } = useStats();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MissionLogItem | null>(null);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);

  return (
    <div className={cn("glass-card mb-8", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h3 className="text-sm font-bold flex items-center gap-2">
            {icon} <span className="text-white">{title}</span>
          </h3>
          {description ? (
            <p className="text-[10px] text-white/40 leading-none">{description}</p>
          ) : title === "Combat Records" ? (
            <p className="text-[10px] text-white/40 leading-none">Your historic RETRIEVAL outcomes archived in real-time</p>
          ) : null}
        </div>
        {showAllHistory && missionLogs.length > ITEMS_PER_PAGE && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
              disabled={historyPage === 1}
              className="p-1.5 glass rounded-lg text-white/40 disabled:opacity-20 transition-all hover:text-brand-secondary"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-mono font-bold text-white/40">
              {historyPage} / {Math.ceil(missionLogs.length / ITEMS_PER_PAGE)}
            </span>
            <button 
              onClick={() => setHistoryPage(prev => Math.min(Math.ceil(missionLogs.length / ITEMS_PER_PAGE), prev + 1))}
              disabled={historyPage === Math.ceil(missionLogs.length / ITEMS_PER_PAGE)}
              className="p-1.5 glass rounded-lg text-white/40 disabled:opacity-20 transition-all hover:text-brand-secondary"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      
      {missionLogs.length > 0 ? (
        <div className="flex flex-col">
          <AnimatePresence mode="popLayout">
            {missionLogs
              .slice(
                showAllHistory ? (historyPage - 1) * ITEMS_PER_PAGE : 0, 
                showAllHistory ? (historyPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE : 5
              )
              .map((item, idx, currentSlice) => {
                const isExam = item.isExam || item.type === 'Exam';
                const isLast = idx === currentSlice.length - 1;
                const accuracy = item.accuracy ?? ((item.total > 0 ? (item.score / item.total) : 0) * 100);
                const displayXP = item.xpGained !== undefined ? item.xpGained : (item.score * 5 + 20);
                const displayTime = item.timeSpentSeconds ? Math.round(item.timeSpentSeconds / 60) : 1;

                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={`mission-log-list-${item.id || idx}-${idx}`} 
                    onClick={() => {
                      setSelectedHistoryItem(item);
                      setIsHistorySheetOpen(true);
                    }}
                    className="group relative pl-8 pb-6 last:pb-0 font-sans cursor-pointer active:scale-[0.99] transition-all"
                  >
                    {/* Timeline Line */}
                    {!isLast && (
                      <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/5" />
                    )}
                    
                    {/* Timeline Dot */}
                    <div className={cn(
                      "absolute left-0 top-1.5 w-6 h-6 rounded-lg border-4 border-dark-bg z-10 flex items-center justify-center shadow-lg",
                      isExam ? "bg-brand-secondary/90" : "bg-brand-primary"
                    )}>
                      {isExam ? <Medal size={10} className="text-white" /> : <Zap size={10} className="text-dark-bg" />}
                    </div>

                    <div className="glass-card p-4 hover:border-white/10 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">{item.date}</span>
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                          accuracy >= 80 ? "bg-emerald-500/10 text-emerald-400" :
                          accuracy >= 50 ? "bg-orange-500/10 text-orange-400" :
                          "bg-red-500/10 text-red-400"
                        )}>
                          {Math.round(accuracy)}% Match
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1 group-hover:text-brand-primary transition-colors">{item.title}</h4>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1">
                            <Zap size={10} className="text-brand-primary" />
                            <span className="text-[9px] font-bold text-white/40">+{displayXP} XP</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <Clock size={10} className="text-white/20" />
                            <span className="text-[9px] font-bold text-white/40">{displayTime}m</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-white/20">{item.score}/{item.total}</span>
                         </div>
                         <span className="text-[9px] font-black text-brand-secondary uppercase ml-auto">{item.type}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>

          {(missionLogs.length > 5 || showAllHistory) && (
            <button 
              onClick={() => {
                setShowAllHistory(!showAllHistory);
                setHistoryPage(1);
              }}
              className="w-full mt-4 py-4 border border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-brand-secondary hover:border-brand-secondary/30 transition-all group active:scale-95 shadow-inner"
            >
              <span>{showAllHistory ? 'Show Less' : `See ${missionLogs.length - 5} More Missions`}</span>
              <motion.div
                animate={{ rotate: showAllHistory ? 180 : 0 }}
              >
                <ChevronRight size={14} className="rotate-90 group-hover:text-brand-secondary" />
              </motion.div>
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-white/10 ring-1 ring-white/5 shadow-inner">
            <History size={28} />
          </div>
          <p className="text-[11px] text-white/20 font-black uppercase tracking-[0.2em]">No Combat Records Synced</p>
        </div>
      )}

      <MissionDetailBottomSheet 
        item={selectedHistoryItem}
        isOpen={isHistorySheetOpen}
        onClose={() => setIsHistorySheetOpen(false)}
      />
    </div>
  );
}
