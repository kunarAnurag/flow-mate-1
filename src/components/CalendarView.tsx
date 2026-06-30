import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Sparkles, AlertCircle, Plus, Info } from "lucide-react";
import { Task } from "../types";

interface CalendarViewProps {
  tasks: Task[];
  onScheduleTask: (taskId: string, date: string, startTime: string, duration: number) => void;
  onSelectTask: (task: Task) => void;
  onAddTaskAtDate: (date: string) => void;
}

export default function CalendarView({
  tasks,
  onScheduleTask,
  onSelectTask,
  onAddTaskAtDate
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'month' | 'schedule'>('month');
  
  // Create state for selecting unscheduled tasks to schedule
  const [selectedUnscheduledId, setSelectedUnscheduledId] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleDuration, setScheduleDuration] = useState(60);

  const unscheduledTasks = tasks.filter(t => !t.timeSlot && t.status === 'pending');

  // Month rendering math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Get tasks that fall on a specific date (YYYY-MM-DD)
  const getTasksForDate = (dateStr: string) => {
    return tasks.filter(t => {
      if (t.timeSlot) {
        return t.timeSlot.date === dateStr;
      }
      // Fallback: check if the deadline date matches
      if (t.deadline) {
        return t.deadline.startsWith(dateStr);
      }
      return false;
    });
  };

  const handleQuickSchedule = (dateStr: string) => {
    if (!selectedUnscheduledId) return;
    onScheduleTask(selectedUnscheduledId, dateStr, scheduleTime, scheduleDuration);
    setSelectedUnscheduledId("");
  };

  // Generate date array for the month grid
  const daysArray = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  // Get category specific styling
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Assignment': return 'bg-amber-950/40 text-amber-400 border-amber-900/40';
      case 'Meeting': return 'bg-sky-950/40 text-sky-400 border-sky-900/40';
      case 'Bill': return 'bg-red-950/40 text-red-400 border-red-900/40';
      case 'Work': return 'bg-indigo-950/40 text-indigo-400 border-indigo-900/40';
      default: return 'bg-slate-950/40 text-slate-200 border-slate-850/60';
    }
  };

  // Export scheduled timeblocks to iCal / ICS file format
  const exportCalendarToICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Academic Focus Co-Pilot//NONSGML v1.0//EN\nCALSCALE:GREGORIAN\n";
    const scheduledTasks = tasks.filter(t => t.timeSlot);

    if (scheduledTasks.length === 0) {
      alert("No scheduled focus blocks found. Please schedule some tasks using the Planning Assistant tab first!");
      return;
    }

    scheduledTasks.forEach(task => {
      const slot = task.timeSlot!;
      const dateParts = slot.date.split("-"); // YYYY, MM, DD
      const startParts = slot.startTime.split(":"); // HH, MM
      const endParts = slot.endTime.split(":"); // HH, MM

      const yearStr = dateParts[0];
      const monthStr = dateParts[1];
      const dayStr = dateParts[2];
      const startH = startParts[0];
      const startM = startParts[1];
      const endH = endParts[0];
      const endM = endParts[1];

      // Format as local timezone-neutral ICS datetime: YYYYMMDDTHHMMSS
      const dtStart = `${yearStr}${monthStr}${dayStr}T${startH}${startM}00`;
      const dtEnd = `${yearStr}${monthStr}${dayStr}T${endH}${endM}00`;
      const uid = `task-block-${task.id}@academic-copilot.ai`;
      const summary = `[Focus Block] ${task.title}`;
      const description = task.description 
        ? `${task.description} - Category: ${task.category}` 
        : `Deep focus block structured for academic task: ${task.title}`;

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${uid}\n`;
      icsContent += `DTSTART:${dtStart}\n`;
      icsContent += `DTEND:${dtEnd}\n`;
      icsContent += `SUMMARY:${summary}\n`;
      icsContent += `DESCRIPTION:${description}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "academic-focus-schedule.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="calendar-view-section" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="font-sans font-bold text-xl text-slate-100 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            <span>AI Time-Blocking Calendar</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Proactively block study hours and deep work slots to guarantee deadline completion.
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-auto flex-wrap justify-end">
          <button
            id="export-ics-btn"
            onClick={exportCalendarToICS}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-indigo-400 hover:text-indigo-300 text-xs font-sans font-medium rounded-lg transition flex items-center gap-1.5 active:scale-95 shadow"
            title="Download scheduled calendar blocks as .ics file"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Export Calendar (.ics)</span>
          </button>

          <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
            <button
              id="tab-month-btn"
              onClick={() => setActiveTab('month')}
              className={`px-3 py-1.5 text-xs font-sans rounded-md transition ${activeTab === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Month Grid
            </button>
            <button
              id="tab-sched-btn"
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 text-xs font-sans rounded-md transition ${activeTab === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Planning Assistant
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar Space */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          {activeTab === 'month' ? (
            <div className="space-y-4">
              {/* Month Selector Controls */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-sans font-bold text-slate-100 text-base">
                  {monthNames[month]} {year}
                </h3>
                <div className="flex gap-1">
                  <button
                    id="prev-month-btn"
                    onClick={handlePrevMonth}
                    className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    id="next-month-btn"
                    onClick={handleNextMonth}
                    className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Header */}
              <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-800 pb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <span key={day} className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    {day}
                  </span>
                ))}
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 gap-1">
                {daysArray.map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="bg-slate-950/20 aspect-square rounded-xl opacity-30 border border-slate-950"></div>;
                  }

                  const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayTasks = getTasksForDate(formattedDate);
                  const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                  return (
                    <div
                      key={`day-${day}`}
                      id={`day-cell-${formattedDate}`}
                      onClick={() => {
                        if (selectedUnscheduledId) {
                          handleQuickSchedule(formattedDate);
                        } else {
                          onAddTaskAtDate(formattedDate);
                        }
                      }}
                      className={`group bg-slate-950/60 border ${
                        isToday ? 'border-indigo-500 bg-indigo-950/10' : selectedUnscheduledId ? 'border-cyan-500/40 hover:border-cyan-500 bg-cyan-950/5' : 'border-slate-800 hover:border-slate-700'
                      } aspect-square rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer relative`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] font-mono font-medium ${isToday ? 'text-indigo-400 font-bold' : 'text-slate-300'}`}>
                          {day}
                        </span>
                        {selectedUnscheduledId && (
                          <span className="text-[8px] text-cyan-400 font-bold tracking-wider group-hover:scale-105 transition">
                            + PLACE
                          </span>
                        )}
                      </div>

                      {/* Day Tasks indicators */}
                      <div className="flex-1 overflow-y-auto space-y-0.5 mt-1 scrollbar-none max-h-[50px]">
                        {dayTasks.map(t => (
                          <div
                            key={t.id}
                            id={`day-task-${t.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(t);
                            }}
                            className={`px-1.5 py-0.5 rounded border text-[9px] truncate font-sans font-medium transition-all hover:translate-x-0.5 ${getCategoryColor(t.category)} ${
                              t.status === 'completed' ? 'line-through opacity-45' : ''
                            }`}
                            title={t.title}
                          >
                            {t.timeSlot ? `⏰ ${t.timeSlot.startTime} ` : ''}
                            {t.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-950/10 border border-indigo-900/30 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-200">How AI Time-Blocking Works</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Rather than traditional "to-do lists", high achievers use time-blocking. Choose any unscheduled task from the right-hand panel, select your preferred work duration, and click on any date on the Month Grid to lock in an active deep work focus block.
                  </p>
                </div>
              </div>

              {/* Time scheduler setup */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">Configure Focus Block</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-sans">Focus Start Time</label>
                    <input
                      id="schedule-time-input"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-sans">Focus Block Duration</label>
                    <select
                      id="schedule-duration-select"
                      value={scheduleDuration}
                      onChange={(e) => setScheduleDuration(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={25}>25 min (Single Pomodoro)</option>
                      <option value={50}>50 min (Standard block)</option>
                      <option value={90}>90 min (Deep Work standard)</option>
                      <option value={120}>120 min (Extended focus)</option>
                    </select>
                  </div>
                </div>
                {selectedUnscheduledId ? (
                  <div className="bg-cyan-950/20 border border-cyan-900/40 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <p className="text-xs text-cyan-300">
                        Ready! Click on any date cell in the <strong>Month Grid</strong> above to place this block.
                      </p>
                    </div>
                    <button
                      id="cancel-placement-btn"
                      onClick={() => setSelectedUnscheduledId("")}
                      className="text-xs text-slate-500 hover:text-slate-300 font-sans underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 text-center">
                    Select a task from the side panel to start visual allocation.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Unscheduled Task Queue Side Panel */}
        <div id="unscheduled-queue-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-sans font-semibold text-slate-200 text-sm">Unscheduled Queue</h3>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/50 border border-indigo-900 px-1.5 py-0.5 rounded">
                {unscheduledTasks.length} pending
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1">
              {unscheduledTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-sans">
                  <Info className="w-8 h-8 mx-auto opacity-30 text-slate-500 mb-1" />
                  All tasks scheduled!
                </div>
              ) : (
                unscheduledTasks.map(t => (
                  <div
                    key={t.id}
                    id={`unscheduled-item-${t.id}`}
                    onClick={() => {
                      setSelectedUnscheduledId(t.id);
                      if (activeTab === 'month') {
                        // Show tooltip advice
                      }
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                      selectedUnscheduledId === t.id
                        ? 'bg-cyan-950/30 border-cyan-500 shadow-md ring-1 ring-cyan-500/30'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-sans font-medium text-slate-200 truncate pr-1">
                        {t.title}
                      </p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 shrink-0">
                        {t.category}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      {t.description || "No description."}
                    </p>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900">
                      <span className="text-[9px] text-red-400 font-mono">
                        Due: {new Date(t.deadline).toLocaleDateString()}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {t.aiAnalysis?.recommendedDuration || 45}m
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedUnscheduledId && (
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl mt-4 space-y-2">
              <p className="text-[10px] text-slate-400 font-sans leading-snug">
                Click a date cell on the <strong>Month Grid</strong> to time-block this task.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
