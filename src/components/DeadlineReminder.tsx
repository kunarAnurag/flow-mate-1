import React, { useState, useEffect } from "react";
import { Task } from "../types";
import { AlertTriangle, Clock, CheckCircle2, XCircle, BellRing, Play } from "lucide-react";

interface DeadlineReminderProps {
  tasks: Task[];
  onToggleStatus: (taskId: string) => void;
}

export default function DeadlineReminder({ tasks, onToggleStatus }: DeadlineReminderProps) {
  const [activeAlert, setActiveAlert] = useState<{
    task: Task;
    minutesLeft: number;
    notificationKey: string;
  } | null>(null);

  const [notified, setNotified] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("lastminute_notified_deadlines") || "{}");
    } catch {
      return {};
    }
  });

  // Keep notified localStorage in sync
  const updateNotified = (key: string) => {
    const updated = { ...notified, [key]: true };
    setNotified(updated);
    localStorage.setItem("lastminute_notified_deadlines", JSON.stringify(updated));
  };

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.log("Audio feedback skipped or blocked by gesture restrictions.");
    }
  };

  const triggerAlert = (task: Task, minutesLeft: number, key: string) => {
    setActiveAlert({ task, minutesLeft, notificationKey: key });
  };

  // Sound loop for active alerts
  useEffect(() => {
    if (!activeAlert) return;

    // Play immediately
    playAlertSound();

    // Repeat every 10 seconds
    const interval = setInterval(() => {
      playAlertSound();
    }, 10000);

    return () => clearInterval(interval);
  }, [activeAlert]);

  // Run periodic monitoring of deadlines
  useEffect(() => {
    const checkDeadlines = () => {
      const now = Date.now();
      tasks.forEach((task) => {
        if (task.status !== "pending") return;
        const deadlineTime = new Date(task.deadline).getTime();
        if (isNaN(deadlineTime)) return;

        const diffMs = deadlineTime - now;
        const diffMins = diffMs / (60 * 1000);

        // 5 Minutes Prior: Remaining time is 5 minutes or less
        if (diffMins > 0 && diffMins <= 5.0) {
          const key = `${task.id}-5`;
          if (!notified[key]) {
            triggerAlert(task, 5, key);
          }
        }
        // 15 Minutes Prior: Remaining time is between 5 and 15 minutes
        else if (diffMins > 5.0 && diffMins <= 15.0) {
          const key = `${task.id}-15`;
          if (!notified[key]) {
            triggerAlert(task, 15, key);
          }
        }
      });
    };

    // Check on mount and then every 10 seconds
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 10000);
    return () => clearInterval(interval);
  }, [tasks, notified]);

  // Handle Confirm action (Marks task completed)
  const handleConfirm = () => {
    if (!activeAlert) return;
    onToggleStatus(activeAlert.task.id);
    updateNotified(activeAlert.notificationKey);
    setActiveAlert(null);
  };

  // Handle Cancel action (Dismiss/Snooze reminder)
  const handleCancel = () => {
    if (!activeAlert) return;
    updateNotified(activeAlert.notificationKey);
    setActiveAlert(null);
  };

  return (
    <>
      {/* Beautiful Modal Overlay Reminder */}
      {activeAlert && (
        <div 
          id="deadline-alert-overlay" 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div 
            id="deadline-alert-card" 
            className="w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-3xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] relative overflow-hidden text-center space-y-5 animate-scale-in"
          >
            {/* Visual background alarms */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse"></div>

            {/* Icon Header */}
            <div className="relative mx-auto w-16 h-16 bg-red-950/30 border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-8 h-8 text-red-500 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full animate-ping"></div>
            </div>

            {/* Alert Heading */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
                🚨 {activeAlert.minutesLeft === 15 ? "15-Minute Alert" : "CRITICAL 5-Minute Alarm"}
              </span>
              <h2 className="font-sans font-bold text-xl text-slate-100 tracking-tight leading-snug">
                Deadline Approaching!
              </h2>
            </div>

            {/* Task summary */}
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2 text-left">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-sans font-medium text-slate-100 line-clamp-2">
                  {activeAlert.task.title}
                </span>
                <span className="px-2 py-0.5 bg-red-950/40 border border-red-900/40 text-[9px] font-mono text-red-400 rounded-md shrink-0 uppercase">
                  {activeAlert.task.category}
                </span>
              </div>
              {activeAlert.task.description && (
                <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                  {activeAlert.task.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Due at: {new Date(activeAlert.task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Action text */}
            <p className="text-xs text-slate-300 font-sans leading-relaxed px-2">
              Have you finished this commitment, or would you like to dismiss this notification?
            </p>

            {/* Confirm & Cancel Buttons */}
            <div className="flex gap-3">
              <button
                id="deadline-alert-cancel-btn"
                onClick={handleCancel}
                className="flex-1 py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl font-sans font-medium text-xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>Dismiss / Cancel</span>
              </button>
              <button
                id="deadline-alert-confirm-btn"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-sans font-medium text-xs shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm (Complete)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
