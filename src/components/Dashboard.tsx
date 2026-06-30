import React, { useState, useEffect } from "react";
import { 
  Sparkles, AlertTriangle, CheckCircle2, TrendingUp, Circle, Play, Check, 
  Plus, Calendar, Brain, Award, Zap, ArrowRight, ShieldCheck, Clock, ChevronRight, ChevronLeft
} from "lucide-react";
import { Task, Habit, Recommendation, ProductivityMetrics } from "../types";

interface DashboardProps {
  tasks: Task[];
  habits: Habit[];
  recommendations: Recommendation[];
  metrics: ProductivityMetrics;
  onAddTask: (title: string, category: string, deadline: string) => void;
  onToggleStatus: (id: string) => void;
  onToggleHabit: (id: string) => void;
  onCreateHabit: (title: string, frequency: 'daily' | 'weekly', category: string) => void;
  onSelectTask: (task: Task) => void;
  onTriggerAIRecommendations: () => void;
  isRecommendationLoading: boolean;
}

export default function Dashboard({
  tasks,
  habits,
  recommendations,
  metrics,
  onAddTask,
  onToggleStatus,
  onToggleHabit,
  onCreateHabit,
  onSelectTask,
  onTriggerAIRecommendations,
  isRecommendationLoading
}: DashboardProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState<any>("Assignment");
  const [quickDeadline, setQuickDeadline] = useState("");

  // Custom interactive calendar picker states inside quick capture
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (pickerMonth === 0) {
      setPickerMonth(11);
      setPickerYear(prev => prev - 1);
    } else {
      setPickerMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (pickerMonth === 11) {
      setPickerMonth(0);
      setPickerYear(prev => prev + 1);
    } else {
      setPickerMonth(prev => prev + 1);
    }
  };

  const handleSelectDate = (day: number) => {
    const selectedDate = new Date(pickerYear, pickerMonth, day);
    let timePart = "09:30";
    if (quickDeadline) {
      const parts = quickDeadline.split("T");
      if (parts.length > 1) {
        timePart = parts[1];
      }
    }
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    setQuickDeadline(`${yyyy}-${mm}-${dd}T${timePart}`);
  };

  const handleSelectTime = (timeStr: string) => {
    let datePart = "";
    if (quickDeadline) {
      datePart = quickDeadline.split("T")[0];
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      datePart = `${yyyy}-${mm}-${dd}`;
    }
    setQuickDeadline(`${datePart}T${timeStr}`);
  };

  const handlePresetDate = (daysAhead: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    let timePart = "09:30";
    if (quickDeadline) {
      const parts = quickDeadline.split("T");
      if (parts.length > 1) {
        timePart = parts[1];
      }
    }
    
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    
    setQuickDeadline(`${yyyy}-${mm}-${dd}T${timePart}`);
    setPickerMonth(targetDate.getMonth());
    setPickerYear(targetDate.getFullYear());
  };

  const [habitTitle, setHabitTitle] = useState("");
  const [habitFreq, setHabitFreq] = useState<'daily' | 'weekly'>('daily');
  const [habitCategory, setHabitCategory] = useState("Focus");

  const pendingTasks = tasks.filter(t => t.status === "pending");
  const imminentTasks = tasks.filter(t => {
    if (t.status === 'completed') return false;
    const hrs = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    return hrs > 0 && hrs <= 24;
  });

  const getFormattedDeadline = () => {
    if (!quickDeadline) return "Set Deadline";
    try {
      const d = new Date(quickDeadline);
      if (isNaN(d.getTime())) return "Set Deadline";
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "Set Deadline";
    }
  };

  // Generate date array for the month grid
  const pickerFirstDay = new Date(pickerYear, pickerMonth, 1).getDay();
  const pickerDaysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

  const pickerDaysArray = [];
  for (let i = 0; i < pickerFirstDay; i++) {
    pickerDaysArray.push(null);
  }
  for (let i = 1; i <= pickerDaysInMonth; i++) {
    pickerDaysArray.push(i);
  }

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    // Default to tomorrow 5pm if no deadline
    let finalDeadline = quickDeadline;
    if (!finalDeadline) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      finalDeadline = tomorrow.toISOString().slice(0, 16);
    }

    onAddTask(quickTitle, quickCategory, finalDeadline);
    setQuickTitle("");
    setQuickDeadline("");
    setShowCalendar(false);
  };

  const handleHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;
    onCreateHabit(habitTitle, habitFreq, habitCategory);
    setHabitTitle("");
  };

  const getCognitiveLoadColor = (load: string) => {
    switch (load) {
      case 'Critical': return 'text-red-400 bg-red-950/20 border-red-900';
      case 'Manageable': return 'text-amber-400 bg-amber-950/20 border-amber-900';
      default: return 'text-emerald-400 bg-emerald-950/20 border-emerald-900';
    }
  };

  return (
    <div id="dashboard-container" className="space-y-6">
      
      {/* Metrics Row / Load Analyzer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cognitive Load */}
        <div id="cognitive-load-card" className={`border p-5 rounded-2xl flex items-center justify-between shadow-sm ${getCognitiveLoadColor(metrics.cognitiveLoad)}`}>
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">Cognitive Load Meter</span>
            <h4 className="text-2xl font-bold font-sans tracking-tight">{metrics.cognitiveLoad}</h4>
            <p className="text-[10px] opacity-70 font-sans">
              {metrics.cognitiveLoad === 'Critical' 
                ? 'High deadline collision risk. Avoid scheduling new projects.' 
                : metrics.cognitiveLoad === 'Manageable' 
                  ? 'Decent balance. Focus on core execution steps.' 
                  : 'Ample mental bandwidth available.'}
            </p>
          </div>
          <Brain className="w-10 h-10 opacity-40 shrink-0" />
        </div>

        {/* Task Completion Rate */}
        <div id="completion-card" className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Completion Rate</span>
            <h4 className="text-2xl font-bold font-sans text-slate-100 tracking-tight">{metrics.onTimeRate}%</h4>
            <p className="text-[10px] text-slate-400 font-sans">
              {metrics.completedTasks} of {metrics.totalTasks} cleared on time
            </p>
          </div>
          <ShieldCheck className="w-10 h-10 text-indigo-400 opacity-40 shrink-0" />
        </div>

        {/* Habit Streaks */}
        <div id="streaks-card" className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Current Active Streak</span>
            <h4 className="text-2xl font-bold font-sans text-slate-100 tracking-tight">{metrics.currentStreak} Days</h4>
            <p className="text-[10px] text-slate-400 font-sans">
              Building consistent daily focus habits
            </p>
          </div>
          <Zap className="w-10 h-10 text-amber-400 opacity-40 shrink-0" />
        </div>

        {/* Active Looming Deadlines */}
        <div id="looming-deadlines-card" className={`border p-5 rounded-2xl flex items-center justify-between shadow-sm ${imminentTasks.length > 0 ? "bg-red-950/20 border-red-900/50 text-red-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}>
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Looming Crisis Count</span>
            <h4 className="text-2xl font-bold font-sans text-slate-100 tracking-tight">{imminentTasks.length} Due</h4>
            <p className="text-[10px] font-sans">
              {imminentTasks.length > 0 ? 'Urgent attention required. Deadline is <24h.' : 'Zero critical deadlines under 24h.'}
            </p>
          </div>
          <AlertTriangle className="w-10 h-10 opacity-40 shrink-0" />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Quick Capture, Looming alerts, Active Tasks queue */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Capture Form */}
          <form id="quick-capture-form" onSubmit={handleQuickSubmit} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
            <h3 className="font-sans font-semibold text-slate-200 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Intelligent Quick Capture</span>
            </h3>
            
            <div className="flex flex-col md:flex-row gap-2">
              <input
                id="quick-title-input"
                type="text"
                placeholder="What assignment, meeting, or commitment needs clearing?"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                required
              />
              <div className="flex gap-2">
                <select
                  id="quick-category-select"
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-sans"
                >
                  <option value="Assignment">Assignment</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Bill">Bill</option>
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                </select>
                <button
                  id="quick-deadline-toggle-btn"
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className={`bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none font-sans flex items-center gap-1.5 cursor-pointer transition select-none shrink-0 ${
                    showCalendar 
                      ? "border-indigo-500/80 text-indigo-400 bg-indigo-950/20" 
                      : quickDeadline 
                        ? "border-emerald-900/60 text-emerald-400 bg-emerald-950/10" 
                        : ""
                  }`}
                  title="Choose deadline using interactive calendar picker"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{getFormattedDeadline()}</span>
                </button>
                <button
                  id="quick-capture-submit-btn"
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-sans font-medium shadow-md transition"
                >
                  Capture
                </button>
              </div>
            </div>

            {showCalendar && (
              <div id="quick-calendar-picker" className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-4 animate-fade-in">
                {/* Month/Year Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200">
                      {monthNames[pickerMonth]} {pickerYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetDate(0)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 font-sans cursor-pointer transition"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetDate(1)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 font-sans cursor-pointer transition"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetDate(3)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 font-sans cursor-pointer transition"
                  >
                    In 3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetDate(7)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] text-slate-300 font-sans cursor-pointer transition"
                  >
                    Next Week
                  </button>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                    <span key={day} className="text-[10px] font-mono font-medium text-slate-500 uppercase py-1">
                      {day}
                    </span>
                  ))}

                  {pickerDaysArray.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} />;
                    }

                    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    // Check if selected
                    const isSelected = quickDeadline && quickDeadline.startsWith(dateStr);
                    
                    // Check if today
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isToday = dateStr === todayStr;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleSelectDate(day)}
                        className={`py-1 text-[11px] font-sans rounded transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold shadow-sm'
                            : isToday
                              ? 'bg-slate-900 text-indigo-400 border border-indigo-900/40 font-semibold'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Time Picker Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-900">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 font-sans">Set Deadline Time:</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="time"
                      value={quickDeadline ? quickDeadline.split("T")[1] || "09:30" : "09:30"}
                      onChange={(e) => handleSelectTime(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                    />
                    <div className="flex gap-1">
                      {["09:30", "13:00", "17:00", "21:00"].map(t => {
                        const isSel = quickDeadline && (quickDeadline.split("T")[1] === t || (!quickDeadline.split("T")[1] && t === "09:30"));
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleSelectTime(t)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition cursor-pointer ${
                              isSel ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/60' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-sans">
              AI automatically parses this capture, evaluates urgency, and generates focus-timeboxes in your database.
            </p>
          </form>

          {/* Agenda & Habits Side-by-Side Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Active Tasks Queue */}
            <div id="active-tasks-queue-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                  <h3 className="font-sans font-semibold text-slate-200 text-sm">Focus Items</h3>
                  <span className="text-[10px] font-mono text-slate-500">Showing top priority</span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {pendingTasks.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      All clear! Add a task above to begin planning.
                    </div>
                  ) : (
                    pendingTasks.map(task => (
                      <div
                        key={task.id}
                        id={`agenda-item-${task.id}`}
                        onClick={() => onSelectTask(task)}
                        className="p-4 bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl flex items-center justify-between gap-4 cursor-pointer transition shadow-sm group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            id={`complete-quick-btn-${task.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStatus(task.id);
                            }}
                            className="p-1 text-slate-600 hover:text-indigo-400 hover:bg-indigo-950/20 rounded transition shrink-0"
                          >
                            <Circle className="w-5 h-5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-sans font-semibold text-slate-100 group-hover:text-indigo-400 transition truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                                {task.category}
                              </span>
                              <span className="text-[9px] text-slate-500 font-sans flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Due {new Date(task.deadline).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} at {new Date(task.deadline).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              {task.aiAnalysis?.riskOfMissing === 'high' && (
                                <span className="text-[9px] font-mono bg-red-950/40 border border-red-900 text-red-400 px-1.5 py-0.5 rounded">
                                  HIGH RISK
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Micro Habit Streaks */}
            <div id="habits-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
              <div>
                <h3 className="font-sans font-semibold text-slate-200 text-sm flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Habit Streak</span>
                </h3>

                {/* Habit Form */}
                <form id="habit-form" onSubmit={handleHabitSubmit} className="flex gap-2 mb-4">
                  <input
                    id="habit-title-input"
                    type="text"
                    placeholder="Add daily habit..."
                    value={habitTitle}
                    onChange={(e) => setHabitTitle(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                    required
                  />
                  <button
                    id="add-habit-btn"
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 text-xs font-sans font-medium transition cursor-pointer"
                  >
                    Add
                  </button>
                </form>

                <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
                  {habits.length === 0 ? (
                    <p className="text-center text-slate-500 text-xs py-4 font-sans">No habits tracked yet.</p>
                  ) : (
                    habits.map(habit => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const isCompletedToday = habit.lastCompleted === todayStr;

                      // Render 7-day weekly grid
                      const renderWeeklyGrid = () => {
                        const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                        const today = new Date();
                        const currentDay = today.getDay(); // 0 is Sun, 1 is Mon, etc.
                        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
                        
                        const monday = new Date();
                        monday.setDate(today.getDate() + mondayOffset);

                        const dates = Array(7).fill(0).map((_, idx) => {
                          const d = new Date(monday);
                          d.setDate(monday.getDate() + idx);
                          return d.toISOString().slice(0, 10);
                        });

                        return (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-900 flex justify-between items-center gap-1">
                            {daysOfWeek.map((day, idx) => {
                              const dateStr = dates[idx];
                              const isCompleted = habit.history?.includes(dateStr) || habit.lastCompleted === dateStr;
                              const isFuture = dateStr > today.toISOString().slice(0, 10);
                              return (
                                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                                  <span className="text-[8px] font-mono text-slate-600 font-medium uppercase">{day[0]}</span>
                                  <div 
                                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                                      isCompleted 
                                        ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' 
                                        : isFuture 
                                          ? 'border border-dashed border-slate-800' 
                                          : 'border border-slate-800 bg-slate-950/40'
                                    }`}
                                    title={isCompleted ? `Completed on ${dateStr}` : `Missed or Not Yet Logged`}
                                  >
                                    {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      };

                      return (
                        <div
                          key={habit.id}
                          id={`habit-item-${habit.id}`}
                          className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                id={`toggle-habit-${habit.id}`}
                                type="button"
                                onClick={() => onToggleHabit(habit.id)}
                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 cursor-pointer ${
                                  isCompletedToday 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-950/20'
                                }`}
                              >
                                {isCompletedToday && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <div className="min-w-0">
                                <p className={`text-xs font-sans font-medium ${isCompletedToday ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                  {habit.title}
                                </p>
                                <span className="text-[9px] text-slate-500 font-mono capitalize">
                                  {habit.frequency} • {habit.category}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 bg-amber-950/20 border border-amber-900/30 px-2.5 py-0.5 rounded-full text-amber-400 shrink-0">
                              <Zap className="w-3 h-3 fill-amber-400" />
                              <span className="text-[10px] font-mono font-bold">{habit.streak}</span>
                            </div>
                          </div>

                          {renderWeeklyGrid()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right column: Habits & AI Recommendations */}
        <div className="space-y-6">
          
          {/* AI Coach Recommendations */}
          <div id="ai-coach-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/5 blur-2xl rounded-full"></div>
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-sans font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>AI Productivity Coach</span>
              </h3>
              <button
                id="refresh-ai-recs-btn"
                onClick={onTriggerAIRecommendations}
                disabled={isRecommendationLoading}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition font-mono disabled:opacity-50"
              >
                {isRecommendationLoading ? "Re-Analyzing..." : "Refresh Advice"}
              </button>
            </div>

            <div className="space-y-3.5">
              {recommendations.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No active coaching alerts. Keep capturing your agenda!
                </div>
              ) : (
                recommendations.map(rec => {
                  const matchedTask = rec.taskId ? tasks.find(t => t.id === rec.taskId) : null;
                  return (
                    <div
                      key={rec.id}
                      id={`rec-item-${rec.id}`}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                        rec.severity === 'high' 
                          ? 'bg-red-950/10 border-red-900/50 text-red-200' 
                          : rec.severity === 'medium'
                            ? 'bg-amber-950/10 border-amber-900/50 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {rec.severity === 'high' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <h4 className="text-xs font-semibold font-sans">{rec.title}</h4>
                          <p className="text-[11px] opacity-80 leading-relaxed font-sans mt-1">
                            {rec.text}
                          </p>
                          
                          {matchedTask && (
                            <div className="mt-3 flex justify-start">
                              <button
                                id={`rec-btn-${rec.id}`}
                                onClick={() => onSelectTask(matchedTask)}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase transition shadow-sm flex items-center gap-1 cursor-pointer ${
                                  rec.severity === 'high'
                                    ? 'bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white'
                                    : rec.severity === 'medium'
                                      ? 'bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 hover:text-white'
                                      : 'bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 hover:text-white'
                                }`}
                              >
                                <span>{rec.actionType === 'breakdown' ? 'Atomic Breakdown & Steps' : 'Deconstruct & Focus'}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Deep Focus Analytics Card */}
          <div id="focus-analytics-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-cyan-500/5 blur-2xl rounded-full"></div>
            <h3 className="font-sans font-semibold text-slate-200 text-sm flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Deep Focus Analytics</span>
            </h3>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Focus Time</span>
                <p className="text-xl font-bold font-sans text-cyan-400 mt-1">
                  {Math.round((metrics.totalFocusMinutes || 0) / 60 * 10) / 10} hrs
                </p>
                <p className="text-[9px] text-slate-500 font-sans mt-1">
                  {metrics.totalFocusMinutes || 0} cumulative minutes
                </p>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Pomodoros Done</span>
                <p className="text-xl font-bold font-sans text-indigo-400 mt-1">
                  {metrics.completedPomodoros || 0} blocks
                </p>
                <p className="text-[9px] text-slate-500 font-sans mt-1">
                  25-minute milestones
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
