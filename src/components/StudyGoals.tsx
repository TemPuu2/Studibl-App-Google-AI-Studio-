import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, Calendar, Trash2, CheckCircle2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudyGoal } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { getUserMissions, saveUserMission, isRealUserSession } from '../lib/supabaseService';
import { supabase } from '../supabaseClient';

const getDeadlineStatus = (targetDateStr: string) => {
  const targetDate = new Date(targetDateStr);
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayDate = new Date();
  const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      text: "Deadline Reached",
      colorClass: "bg-red-500/10 text-red-400 border border-red-500/15"
    };
  } else if (diffDays === 0) {
    return {
      text: "Due Today",
      colorClass: "bg-amber-500/10 text-amber-400 border border-amber-500/15"
    };
  } else {
    return {
      text: `${diffDays} Day${diffDays > 1 ? 's' : ''} Left`,
      colorClass: "bg-brand-primary/10 text-brand-primary border border-brand-primary/15"
    };
  }
};

export default function StudyGoals({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth() || {};
  const isRealUser = user && isRealUserSession(user.id);

  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const saveGoalToSupabase = async (goal: StudyGoal) => {
    if (user && isRealUser) {
      await saveUserMission(user.id, {
        id: goal.id,
        title: goal.title,
        duration: `${goal.progress}%`,
        status: goal.completed ? 'completed' : 'pending',
        type: 'goal',
        courseId: goal.targetDate,
        topic: null,
        updatedAt: Date.now(),
        metadata: {
          targetDate: goal.targetDate,
          progress: goal.progress,
          completed: goal.completed
        }
      });
    }
  };

  useEffect(() => {
    if (isRealUser) {
      const loadUserGoals = async () => {
        try {
          const dbMissions = await getUserMissions(user.id);
          const goalMissions = dbMissions.filter((m: any) => m.type === 'goal');
          if (goalMissions.length > 0) {
            setGoals(goalMissions.map((g: any) => ({
              id: g.id,
              title: g.title,
              targetDate: g.metadata?.targetDate || g.course_id || '',
              progress: typeof g.metadata?.progress === 'number' ? g.metadata.progress : (parseInt(g.duration) || 0),
              completed: g.status === 'completed'
            })));
          } else {
            setGoals([]);
          }
        } catch (err) {
          console.error("Error loading goals from db:", err);
          setGoals([]);
        }
      };
      loadUserGoals();
    } else {
      const saved = localStorage.getItem('studibl_study_goals');
      if (saved) {
        setGoals(JSON.parse(saved));
      } else {
        // Default goals
        const today = new Date();
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - 5);
        const pastStr = pastDate.toISOString().split('T')[0];
        
        const initialGoals: StudyGoal[] = [
          { id: '1', title: 'Finish OS Project', targetDate: pastStr, progress: 65, completed: false },
          { id: '2', title: 'Master Laplace', targetDate: pastStr, progress: 100, completed: true }
        ];
        setGoals(initialGoals);
        localStorage.setItem('studibl_study_goals', JSON.stringify(initialGoals));
      }
    }
  }, [user]);

  const saveGoals = (updated: StudyGoal[]) => {
    setGoals(updated);
    if (!isRealUser) {
      localStorage.setItem('studibl_study_goals', JSON.stringify(updated));
    }
  };

  const addGoal = async () => {
    if (!newTitle || !newDate) return;
    const goal: StudyGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newTitle,
      targetDate: newDate,
      progress: 0,
      completed: false
    };
    saveGoals([goal, ...goals]);
    if (isRealUser) {
      await saveGoalToSupabase(goal);
    }
    setNewTitle('');
    setNewDate('');
    setIsAdding(false);
  };

  const deleteGoal = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    saveGoals(goals.filter(g => g.id !== id));
    if (user && isRealUser) {
      await supabase
        .from('user_missions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    }
  };

  const deleteSelectedGoals = async () => {
    const updatedGoals = goals.filter(g => !selectedIds.has(g.id));
    saveGoals(updatedGoals);
    if (user && isRealUser) {
      const idsToDelete = Array.from(selectedIds);
      await supabase
        .from('user_missions')
        .delete()
        .in('id', idsToDelete)
        .eq('user_id', user.id);
    }
    cancelSelection();
  };

  const toggleGoal = async (id: string) => {
    if (isSelectionMode) {
      toggleSelection(id);
      return;
    }
    const updated = goals.map(g => g.id === id ? { ...g, completed: !g.completed, progress: !g.completed ? 100 : g.progress === 100 ? 0 : g.progress } : g);
    saveGoals(updated);
    
    // Find modified entry to upsert to db
    const toggled = updated.find(g => g.id === id);
    if (toggled && isRealUser) {
      await saveGoalToSupabase(toggled);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    
    if (next.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleTouchStart = (id: string) => {
    if (isSelectionMode) return;
    longPressTimer.current = setTimeout(() => {
      setIsSelectionMode(true);
      const next = new Set<string>();
      next.add(id);
      setSelectedIds(next);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
            <Target size={12} className="text-brand-primary" /> Active Objectives
          </h4>
          {!isAdding && !isSelectionMode && (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-brand-primary hover:bg-white/10 transition-colors"
            >
              <Plus size={14} />
            </button>
          )}
          {isSelectionMode && (
             <div className="flex items-center gap-2">
                <button onClick={deleteSelectedGoals} className="text-red-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
                <button onClick={cancelSelection} className="text-white/40 hover:text-white transition-colors">
                  <X size={14} />
                </button>
             </div>
          )}
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-card p-4 border-l-2 border-l-brand-primary space-y-3 mb-1">
                <input 
                  autoFocus
                  placeholder="Course name (e.g. Thermodynamics)..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-primary/50 transition-all font-medium"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowCalendarModal(true)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[9px] flex items-center gap-2 text-white/40 hover:bg-white/10 transition-all text-left"
                  >
                    <Calendar size={10} />
                    {newDate ? new Date(newDate).toLocaleDateString() : "Select due date..."}
                  </button>
                  <button 
                    onClick={addGoal}
                    className="px-4 bg-brand-primary text-dark-bg font-black uppercase text-[9px] tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 text-white/20 hover:text-white/40"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-3">
          {goals.filter(g => !g.completed).slice(0, 2).map((goal, gIdx) => (
            <div 
              key={`goal-pending-${goal.id || gIdx}-${gIdx}`} 
              onMouseDown={() => handleTouchStart(goal.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              onTouchStart={() => handleTouchStart(goal.id)}
              onTouchEnd={handleTouchEnd}
              onClick={(e) => {
                if (isSelectionMode) toggleSelection(goal.id);
              }}
              className={cn(
                "glass-card p-4 border-l-2 flex items-center justify-between transition-all relative overflow-hidden",
                goal.completed ? "border-l-brand-primary/20" : "border-l-brand-primary",
                isSelectionMode && selectedIds.has(goal.id) && "bg-brand-primary/10 border-brand-primary shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              )}
            >
              {isSelectionMode && (
                <div className="absolute top-2 right-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                    selectedIds.has(goal.id) ? "bg-brand-primary border-brand-primary text-dark-bg scale-110" : "border-white/20"
                  )}>
                    {selectedIds.has(goal.id) && <Check size={10} strokeWidth={4} />}
                  </div>
                </div>
              )}
              <div>
                <h5 className="text-xs font-bold mb-1">{goal.title}</h5>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Due {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  <span className={cn("text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap", getDeadlineStatus(goal.targetDate).colorClass)}>
                    {getDeadlineStatus(goal.targetDate).text}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white/5 flex items-center justify-center relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="16" cy="16" r="14"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-white/5"
                  />
                  <circle
                    cx="16" cy="16" r="14"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={88}
                    strokeDashoffset={88 - (88 * goal.progress) / 100}
                    className="text-brand-primary"
                  />
                </svg>
                <span className="absolute text-[8px] font-bold">{goal.progress}%</span>
              </div>
            </div>
          ))}
          {goals.filter(g => !g.completed).length === 0 && !isAdding && (
            <div className="py-8 text-center glass rounded-3xl border-dashed border-white/5">
              <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No active goals</p>
            </div>
          )}
        </div>

        {/* Custom Calendar Modal */}
        <AnimatePresence>
          {showCalendarModal && (
            <CalendarPickerModal 
              currentDate={newDate ? new Date(newDate) : new Date()}
              onSelect={(date) => {
                setNewDate(date.toISOString().split('T')[0]);
                setShowCalendarModal(false);
              }}
              onClose={() => setShowCalendarModal(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center h-8">
        {!isSelectionMode ? (
          <>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
              <Target size={14} className="text-brand-primary" /> Strategic Study Goals
            </h3>
            <button 
              onClick={() => setIsAdding(true)}
              className="text-[10px] font-black uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:brightness-125 transition-all"
            >
              <Plus size={14} /> New Goal
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Selection Mode</span>
            <div className="flex items-center gap-4">
              <button 
                onClick={deleteSelectedGoals}
                className="text-red-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
                title="Delete Selected"
              >
                <Trash2 size={16} />
              </button>
              <button 
                onClick={cancelSelection}
                className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
                title="Cancel Selection"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card border-brand-primary/30 p-5 space-y-4"
          >
            <input 
              autoFocus
              placeholder="Course name (e.g., Fundamentals of Linux System 2)..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary/50 transition-all font-medium placeholder:text-white/10"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCalendarModal(true)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs flex items-center gap-3 text-white/40 hover:bg-white/10 transition-all text-left"
              >
                <Calendar size={16} className="text-brand-primary/50" />
                {newDate ? new Date(newDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "Set Target Date..."}
              </button>
              <button 
                onClick={addGoal}
                className="px-4 bg-brand-primary text-dark-bg font-black uppercase text-[10px] tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all"
              >
                Launch
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-3 glass rounded-xl text-white/20 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {goals.slice(0, showAllGoals ? undefined : 3).map((goal, gIdx) => (
        <div 
          key={`goal-item-${goal.id || gIdx}-${gIdx}`} 
            onMouseDown={() => handleTouchStart(goal.id)}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={() => handleTouchStart(goal.id)}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              if (isSelectionMode) toggleSelection(goal.id);
            }}
            className={cn(
              "glass-card p-5 cursor-pointer group transition-all border-l-4 relative overflow-hidden",
              goal.completed ? "border-l-brand-primary/20 opacity-50" : "border-l-brand-primary hover:border-brand-primary/50",
              isSelectionMode && selectedIds.has(goal.id) && "bg-brand-primary/5 border-brand-primary/40 shadow-[0_0_20px_rgba(204,255,0,0.05)] ring-1 ring-brand-primary/20"
            )}
          >
            {isSelectionMode && (
              <div className="absolute top-4 right-4 z-10">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                  selectedIds.has(goal.id) ? "bg-brand-primary border-brand-primary text-dark-bg scale-110 shadow-lg shadow-brand-primary/20" : "border-white/10"
                )}>
                  {selectedIds.has(goal.id) && <Check size={12} strokeWidth={4} />}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGoal(goal.id);
                  }}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer",
                    goal.completed ? "bg-brand-primary border-brand-primary text-dark-bg" : "border-white/10 text-transparent group-hover:border-brand-primary/50"
                  )}
                >
                  <CheckCircle2 size={12} />
                </div>
                 <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={cn("text-sm font-bold", goal.completed && "line-through text-white/30 transition-all")}>{goal.title}</h4>
                    {!goal.completed && (
                      <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md leading-none whitespace-nowrap", getDeadlineStatus(goal.targetDate).colorClass)}>
                        {getDeadlineStatus(goal.targetDate).text}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">Deadline: {new Date(goal.targetDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                </div>
              </div>
{/* Removed direct delete button per user request */}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-white/30 uppercase tracking-tighter">Mission Progress</span>
                <span className="text-brand-primary">{goal.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progress}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  className="h-full bg-brand-primary shadow-[0_0_10px_rgba(204,255,0,0.3)]" 
                />
              </div>
            </div>
          </div>
        ))}

        {goals.length > 3 && (
          <button 
            onClick={() => setShowAllGoals(!showAllGoals)}
            className="w-full mt-4 py-4 border border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-brand-primary hover:border-brand-primary/30 transition-all group"
          >
            <span>{showAllGoals ? 'Show Less' : `See ${goals.length - 3} More Goals`}</span>
            <motion.div
              animate={{ rotate: showAllGoals ? 180 : 0 }}
            >
              <ChevronRight size={14} className="rotate-90 group-hover:text-brand-primary" />
            </motion.div>
          </button>
        )}

        {goals.length === 0 && !isAdding && (
          <div className="py-12 text-center glass rounded-[32px] border-dashed border-white/5">
            <Target className="mx-auto text-white/5 mb-4" size={32} />
            <p className="text-xs text-white/20 font-bold uppercase tracking-widest">No strategic goals set</p>
          </div>
        )}
      </div>

      {/* Custom Calendar Modal */}
      <AnimatePresence>
        {showCalendarModal && (
          <CalendarPickerModal 
            currentDate={newDate ? new Date(newDate) : new Date()}
            onSelect={(date) => {
              setNewDate(date.toISOString().split('T')[0]);
              setShowCalendarModal(false);
            }}
            onClose={() => setShowCalendarModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CalendarPickerModal({ currentDate, onSelect, onClose }: { currentDate: Date, onSelect: (date: Date) => void, onClose: () => void }) {
  const [viewDate, setViewDate] = useState(new Date(currentDate));
  const today = new Date();
  today.setHours(0,0,0,0);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: (firstDayOfMonth + 6) % 7 }, (_, i) => i); // Start from Monday

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative glass-card border-white/20 w-full max-w-[340px] overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/50 flex items-center gap-2">
              <Calendar size={14} className="text-brand-primary" /> Target Deadline
            </h4>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/20 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="flex justify-between items-center mb-6 px-1">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-brand-primary/10 rounded-xl transition-all text-brand-primary"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-xs font-black uppercase tracking-wider text-white">{months[viewDate.getMonth()]}</div>
              <div className="text-[10px] font-black tracking-widest text-brand-primary">{viewDate.getFullYear()}</div>
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-brand-primary/10 rounded-xl transition-all text-brand-primary"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-[8px] font-black text-white/20 text-center py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {padding.map(i => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const isToday = d.getTime() === today.getTime();
              const isSelected = d.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0];
              const isPast = d < today;

              return (
                <button
                  key={`day-${day}`}
                  disabled={isPast && !isToday}
                  onClick={() => onSelect(d)}
                  className={cn(
                    "aspect-square rounded-xl text-[10px] font-bold flex items-center justify-center transition-all",
                    isSelected 
                      ? "bg-brand-primary text-dark-bg shadow-lg shadow-brand-primary/25" 
                      : isToday 
                        ? "border border-brand-primary text-brand-primary"
                        : "text-white/60 hover:bg-white/5",
                    isPast && !isToday && "opacity-20 pointer-events-none"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <button 
              onClick={onClose}
              className="w-full py-4 glass border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-all hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CalendarPickerModalWrapper({ currentDate, onSelect, onClose }: { currentDate: Date, onSelect: (date: Date) => void, onClose: () => void }) {
    return (
        <AnimatePresence>
            <CalendarPickerModal currentDate={currentDate} onSelect={onSelect} onClose={onClose} />
        </AnimatePresence>
    )
}
