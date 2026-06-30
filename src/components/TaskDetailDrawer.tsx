import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, AlertTriangle, Clock, Play, Pause, RotateCcw, CheckSquare, Brain, Lightbulb, Edit2, Save, Calendar, Trash2, CheckCircle2 } from "lucide-react";
import { Task } from "../types";
 
interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  onToggleStatus: (id: string) => void;
  onUpdateSubtask: (taskId: string, subtaskIndex: number, completed: boolean) => void;
  onEditTask?: (taskId: string, updatedFields: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onLogFocusSession?: (minutes: number) => void;
  googleToken?: string | null;
  onSyncToCalendar?: (task: Task) => Promise<void>;
  onConnectGoogle?: () => Promise<void>;
}
 
export default function TaskDetailDrawer({
  task,
  onClose,
  onToggleStatus,
  onUpdateSubtask,
  onEditTask,
  onDeleteTask,
  onLogFocusSession,
  googleToken,
  onSyncToCalendar,
  onConnectGoogle
}: TaskDetailDrawerProps) {
  if (!task) return null;

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [editedCategory, setEditedCategory] = useState(task.category);
  const [editedDeadline, setEditedDeadline] = useState(task.deadline);
  
  // Custom non-blocking visual timer notification state
  const [timerNotification, setTimerNotification] = useState<string | null>(null);

  // Calendar synchronization state
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendarAlert, setCalendarAlert] = useState<string | null>(null);

  const handleCalendarSync = async () => {
    if (task.googleCalendarSynced || isSyncing) return;
    setIsSyncing(true);
    setCalendarAlert(null);
    try {
      if (onSyncToCalendar) {
        await onSyncToCalendar(task);
        setCalendarAlert(`"${task.title}" has been successfully verified and added to your Google Calendar!`);
      }
    } catch (err: any) {
      console.error("Calendar sync handler failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete confirmation state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Audio synthesizer chime for completed Pomodoro blocks
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      // Beautiful synthesized major arpeggio chime (C5 -> E5 -> G5)
      playNote(523.25, now, 0.35);
      playNote(659.25, now + 0.12, 0.35);
      playNote(783.99, now + 0.24, 0.55);
    } catch (e) {
      console.error("Synthesizer failed:", e);
    }
  };

  // Sync edits state when active task shifts
  useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
      setEditedDescription(task.description);
      setEditedCategory(task.category);
      setEditedDeadline(task.deadline);
      setIsEditing(false);
      setTimerNotification(null);
      setCalendarAlert(null);
      setShowConfirmDelete(false);
    }
  }, [task]);

  // Pomodoro Focus Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset timer when task changes
    setTimeLeft((task.aiAnalysis?.recommendedDuration || 25) * 60);
    setIsRunning(false);
    setIsBreak(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [task]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            
            // Play procedural audio arpeggio chime!
            playChime();

            const message = isBreak 
              ? "Break is over! Time to focus on your task." 
              : "Focus session completed! Logged to history. Take a 5-minute breather.";

            setTimerNotification(message);

            // Log focus session to state if it was a deep focus block (not break)
            if (!isBreak && onLogFocusSession) {
              onLogFocusSession(task.aiAnalysis?.recommendedDuration || 25);
            }

            setIsBreak(!isBreak);
            return isBreak ? (task.aiAnalysis?.recommendedDuration || 25) * 60 : 5 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isBreak, task, onLogFocusSession]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft((isBreak ? 5 : (task.aiAnalysis?.recommendedDuration || 25)) * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Subtask completed calculation
  const totalSub = task.aiAnalysis?.subtasks?.length || 0;

  // Looming deadline calculation (due under 2 hours)
  const getHoursToDeadline = () => {
    if (!task.deadline || task.status === 'completed') return null;
    const diffMs = new Date(task.deadline).getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
  };
  const hoursLeft = getHoursToDeadline();
  const isLoomingSoon = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 2;

  return (
    <div id="detail-drawer-overlay" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end transition-all duration-300 animate-fade-in">
      <div id="detail-drawer-body" className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl relative">
        
        {/* Main Content */}
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                {task.category}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                task.status === 'completed' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
              }`}>
                {task.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onEditTask && (
                <button
                  id="edit-task-btn"
                  onClick={() => {
                    if (isEditing) {
                      onEditTask(task.id, {
                        title: editedTitle,
                        description: editedDescription,
                        category: editedCategory as any,
                        deadline: editedDeadline
                      });
                      setIsEditing(false);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-850 rounded-lg text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-xs font-sans"
                  title={isEditing ? "Save changes" : "Edit task details"}
                >
                  {isEditing ? (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
              )}
              {onDeleteTask && !isEditing && (
                <button
                  id="delete-task-btn"
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-1.5 hover:bg-red-950/45 rounded-lg text-red-400 hover:text-red-300 transition flex items-center gap-1 text-xs font-sans cursor-pointer"
                  title="Delete task commitment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
              {isEditing && (
                <button
                  id="cancel-edit-btn"
                  onClick={() => {
                    setEditedTitle(task.title);
                    setEditedDescription(task.description);
                    setEditedCategory(task.category);
                    setEditedDeadline(task.deadline);
                    setIsEditing(false);
                  }}
                  className="p-1.5 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition text-xs font-sans"
                >
                  Cancel
                </button>
              )}
              <button
                id="close-drawer-btn"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Near Deadline Alert Banner */}
          {isLoomingSoon && (
            <div className="bg-amber-950/40 border border-amber-900/50 text-amber-300 p-3.5 rounded-xl flex items-start gap-2.5 animate-pulse shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="text-xs font-semibold font-sans">Looming Deadline Risk!</p>
                <p className="text-[11px] text-amber-400/95 leading-normal mt-0.5 font-sans">
                  This task's deadline is in only {Math.round((hoursLeft || 0) * 60)} minutes. Clear your schedule and start deep work immediately!
                </p>
              </div>
            </div>
          )}

          {/* Title / Description */}
          {isEditing ? (
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Title</label>
                <input
                  id="edit-task-title"
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  id="edit-task-desc"
                  value={editedDescription}
                  rows={3}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-855 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    id="edit-task-category"
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-850 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Bill">Bill</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Deadline</label>
                  <input
                    id="edit-task-deadline"
                    type="datetime-local"
                    value={editedDeadline}
                    onChange={(e) => setEditedDeadline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <h2 className="font-sans font-bold text-slate-100 text-xl tracking-tight leading-snug">
                {task.title}
              </h2>
              {task.deadline && (
                <p className="text-[10px] font-mono text-slate-500 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Due: {new Date(task.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
              <p className="text-xs text-slate-400 font-sans mt-3 whitespace-pre-line leading-relaxed">
                {task.description || "No description provided."}
              </p>
            </div>
          )}

          {/* AI Analysis section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-xs font-bold font-mono text-slate-200 tracking-wider uppercase">AI Priority Verdict</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-sans">Missing Risk:</span>
                <span className={`text-[10px] font-mono font-bold uppercase ${
                  task.aiAnalysis?.riskOfMissing === 'high' ? 'text-red-400' : task.aiAnalysis?.riskOfMissing === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {task.aiAnalysis?.riskOfMissing || 'Low'}
                </span>
              </div>
            </div>

            {/* Matrix scores */}
            <div className="grid grid-cols-2 gap-4 border-y border-slate-850 py-3">
              <div>
                <span className="text-[10px] text-slate-500 font-sans">Urgency score (deadline proximity)</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full" style={{ width: `${task.aiAnalysis?.urgencyScore || 50}%` }}></div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-300">{task.aiAnalysis?.urgencyScore || 50}/100</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-sans">Impact score (strategic consequence)</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: `${task.aiAnalysis?.impactScore || 50}%` }}></div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-300">{task.aiAnalysis?.impactScore || 50}/100</span>
                </div>
              </div>
            </div>

            {/* Rationale & strategy */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Brain className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-300 font-sans">Deconstructed Consequences</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                    {task.aiAnalysis?.reasoning || "Analyzing remaining hours..."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-300 font-sans">Strategic Execution Strategy</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                    {task.aiAnalysis?.suggestedStrategy || "Plan out steps in Eisenhower prioritizer."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist Sub-steps */}
          {task.aiAnalysis?.subtasks && task.aiAnalysis.subtasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-xs font-bold font-mono text-slate-200 tracking-wider uppercase">Atomic Execution Steps</h3>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-2">
                {task.aiAnalysis.subtasks.map((sub, idx) => {
                  const isChecked = task.completedSubtasks?.includes(idx) || false;
                  return (
                    <div key={idx} id={`subtask-item-${idx}`} className="flex items-start gap-3 py-1.5 border-b border-slate-900 last:border-0">
                      <input
                        id={`checkbox-sub-${idx}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onUpdateSubtask(task.id, idx, e.target.checked)}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <p className={`text-xs font-sans leading-normal transition ${
                        isChecked ? 'line-through text-slate-500' : 'text-slate-300'
                      }`}>
                        {sub}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pomodoro Focus Block Timer */}
          <div id="pomodoro-timer-card" className="bg-slate-950 border border-slate-850 p-5 rounded-2xl flex flex-col items-center text-center space-y-4">
            {timerNotification && (
              <div className="w-full bg-indigo-950/40 border border-indigo-900/60 text-indigo-300 p-3 rounded-xl flex items-center justify-between text-left text-[11px] font-sans animate-fade-in mb-2">
                <span className="flex-1 pr-2">{timerNotification}</span>
                <button 
                  onClick={() => setTimerNotification(null)}
                  className="px-2 py-0.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded text-[10px] font-mono transition"
                >
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                {isBreak ? "Breathing Break Interval" : "Intense Deep Focus block"}
              </span>
            </div>

            <h4 id="pomodoro-countdown" className="text-4xl font-mono font-bold text-slate-100 tracking-tight">
              {formatTime(timeLeft)}
            </h4>

            {/* Timer Controls */}
            <div className="flex gap-2">
              <button
                id="toggle-timer-btn"
                onClick={toggleTimer}
                className={`px-4 py-2 text-xs font-sans font-medium rounded-xl flex items-center gap-1.5 shadow transition ${
                  isRunning ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause Block
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Start Focus
                  </>
                )}
              </button>
              <button
                id="reset-timer-btn"
                onClick={resetTimer}
                className="p-2 bg-slate-900 border border-slate-800 hover:text-white rounded-xl text-slate-400 transition"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer Quick Action */}
        <div className="pt-6 border-t border-slate-800 flex flex-col gap-3">
          {calendarAlert && (
            <div id="calendar-sync-success-alert" className="bg-emerald-950/30 border border-emerald-900/50 text-emerald-300 p-3 rounded-xl flex items-start gap-2.5 animate-fade-in shadow-sm relative">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 pr-4">
                <p className="text-[11px] font-semibold font-sans">Synced Successfully!</p>
                <p className="text-[10px] text-emerald-400/90 leading-normal mt-0.5 font-sans">
                  {calendarAlert}
                </p>
              </div>
              <button 
                onClick={() => setCalendarAlert(null)}
                className="absolute top-2.5 right-2.5 text-emerald-500/60 hover:text-emerald-400 transition cursor-pointer"
                title="Dismiss alert"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {onSyncToCalendar && (
            googleToken ? (
              <button
                id="sync-google-calendar-btn"
                onClick={handleCalendarSync}
                disabled={task.googleCalendarSynced || isSyncing}
                className={`w-full py-2.5 font-sans font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition ${
                  task.googleCalendarSynced
                    ? "bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 cursor-not-allowed"
                    : isSyncing
                      ? "bg-slate-900 border border-slate-850 text-indigo-300/60 cursor-wait"
                      : "bg-slate-905 border border-slate-850 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                }`}
              >
                {task.googleCalendarSynced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Task added</span>
                  </>
                ) : isSyncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span>Adding to Calendar...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Sync to Google Calendar</span>
                  </>
                )}
              </button>
            ) : (
              onConnectGoogle && (
                <button
                  id="connect-calendar-drawer-btn"
                  onClick={onConnectGoogle}
                  className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-sans font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Connect Google Calendar to Sync</span>
                </button>
              )
            )
          )}
          <button
            id="toggle-task-complete-btn"
            onClick={() => {
              onToggleStatus(task.id);
              onClose();
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-medium text-xs rounded-xl shadow transition cursor-pointer"
          >
            {task.status === 'pending' ? 'Mark Task Completed' : 'Re-open Task'}
          </button>
        </div>

       </div>

      {showConfirmDelete && (
        <div id="delete-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-xl text-red-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-sans font-semibold text-slate-100">Delete Task Commitment</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Are you sure you want to delete <strong className="text-slate-200">"{task.title}"</strong>? This action cannot be undone and will remove all associated focus analytics and subtasks.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="modal-cancel-delete"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-750 text-slate-300 text-xs font-medium font-sans rounded-xl transition cursor-pointer"
              >
                Keep Task
              </button>
              <button
                id="modal-confirm-delete"
                onClick={() => {
                  if (onDeleteTask) {
                    onDeleteTask(task.id);
                  }
                  onClose();
                  setShowConfirmDelete(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold font-sans rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
