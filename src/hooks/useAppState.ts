import { useState, useEffect } from "react";
import { Task, Habit, Recommendation, ProductivityMetrics, PriorityType } from "../types";

export function useAppState() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState<number>(0);
  const [completedPomodoros, setCompletedPomodoros] = useState<number>(0);

  // Load initial sample data if local storage is empty, to provide a breathtaking out-of-the-box user experience
  useEffect(() => {
    const cachedTasks = localStorage.getItem("lastminute_tasks");
    const cachedHabits = localStorage.getItem("lastminute_habits");
    const cachedRecs = localStorage.getItem("lastminute_recs");
    const cachedFocus = localStorage.getItem("lastminute_focus_mins");
    const cachedPomos = localStorage.getItem("lastminute_pomos");

    if (cachedFocus) setTotalFocusMinutes(Number(cachedFocus));
    if (cachedPomos) setCompletedPomodoros(Number(cachedPomos));

    if (cachedTasks) {
      setTasks(JSON.parse(cachedTasks));
    } else {
      // Breathtaking initial tasks
      const sampleTasks: Task[] = [
        {
          id: "task-1",
          title: "Chemistry Lab Final Draft",
          description: "Complete final titration calculations and compile graphs for submission.",
          category: "Assignment",
          deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString().slice(0, 16), // Due in 18 hours!
          status: "pending",
          priority: "urgent-important",
          estimatedMinutes: 60,
          createdAt: new Date().toISOString(),
          aiAnalysis: {
            urgencyScore: 92,
            impactScore: 95,
            riskOfMissing: "high",
            reasoning: "Highly critical final grade assignment due in less than 24 hours. Immediate focus required.",
            suggestedStrategy: "Mute mobile notifications. Establish 60-minute deep focus block now.",
            recommendedDuration: 60,
            subtasks: [
              "Verify titration equations & coefficients",
              "Insert digital charts into draft",
              "Execute visual formatting check",
              "Submit PDF to online portal"
            ]
          }
        },
        {
          id: "task-2",
          title: "Schedule Dentist Appointment",
          description: "Routine checkup and teeth clean scheduling.",
          category: "Personal",
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
          status: "pending",
          priority: "not-urgent-not-important",
          estimatedMinutes: 15,
          createdAt: new Date().toISOString(),
          aiAnalysis: {
            urgencyScore: 15,
            impactScore: 20,
            riskOfMissing: "low",
            reasoning: "Routine task with ample timeline. Zero immediate consequence.",
            suggestedStrategy: "Postpone or automate. Handle during surplus energy blocks.",
            recommendedDuration: 15,
            subtasks: ["Call clinic", "Sync calendar date"]
          }
        }
      ];
      setTasks(sampleTasks);
      localStorage.setItem("lastminute_tasks", JSON.stringify(sampleTasks));
    }

    if (cachedHabits) {
      setHabits(JSON.parse(cachedHabits));
    } else {
      const sampleHabits: Habit[] = [
        {
          id: "habit-1",
          title: "No Social Media During Focus",
          frequency: "daily",
          streak: 4,
          category: "Focus",
          createdAt: new Date().toISOString()
        },
        {
          id: "habit-2",
          title: "Read 1 Actionable Recommendation",
          frequency: "daily",
          streak: 2,
          category: "Reflection",
          createdAt: new Date().toISOString()
        }
      ];
      setHabits(sampleHabits);
      localStorage.setItem("lastminute_habits", JSON.stringify(sampleHabits));
    }

    if (cachedRecs) {
      setRecommendations(JSON.parse(cachedRecs));
    } else {
      const sampleRecs: Recommendation[] = [
        {
          id: "rec-1",
          title: "Critical Priority: Chemistry Lab",
          text: "Your Chemistry Lab Final Draft is due in 18 hours. This has been highlighted as a high-risk assignment. Mute alerts and block focus time right now.",
          severity: "high",
          taskId: "task-1",
          actionType: "focus"
        }
      ];
      setRecommendations(sampleRecs);
      localStorage.setItem("lastminute_recs", JSON.stringify(sampleRecs));
    }
  }, []);

  // Save updates to localStorage
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("lastminute_tasks", JSON.stringify(newTasks));
  };

  const saveHabits = (newHabits: Habit[]) => {
    setHabits(newHabits);
    localStorage.setItem("lastminute_habits", JSON.stringify(newHabits));
  };

  const saveRecommendations = (newRecs: Recommendation[]) => {
    setRecommendations(newRecs);
    localStorage.setItem("lastminute_recs", JSON.stringify(newRecs));
  };

  // -------------------------------------------------------------
  // Calculate On-the-fly Metrics and Cognitive Load
  // -------------------------------------------------------------
  const calculateMetrics = (): ProductivityMetrics => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const pending = tasks.filter(t => t.status === "pending");
    
    const onTimeRate = total > 0 ? Math.round((completed / total) * 100) : 100;
    
    // Cognitive load logic based on number of high-risk / urgent items due soon
    const highRiskPending = pending.filter(t => {
      const hrs = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return hrs > 0 && hrs <= 36 && t.priority === "urgent-important";
    });

    let cognitiveLoad: 'Optimal' | 'Manageable' | 'Critical' = 'Optimal';
    if (highRiskPending.length >= 2 || pending.length >= 6) {
      cognitiveLoad = 'Critical';
    } else if (highRiskPending.length === 1 || pending.length >= 3) {
      cognitiveLoad = 'Manageable';
    }

    // Streaks calculation based on habit streak
    const maxHabitStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;

    return {
      totalTasks: total,
      completedTasks: completed,
      onTimeRate,
      currentStreak: maxHabitStreak,
      cognitiveLoad,
      totalFocusMinutes,
      completedPomodoros
    };
  };

  // -------------------------------------------------------------
  // AI recommendations triggers
  // -------------------------------------------------------------
  const triggerAIRecommendations = async (currentTasks = tasks, currentHabits = habits) => {
    setIsRecommendationLoading(true);
    try {
      const res = await fetch("/api/generate-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: currentTasks,
          habits: currentHabits,
          currentDate: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data.recommendations) {
        saveRecommendations(data.recommendations);
      }
    } catch (e) {
      console.error("AI recommendations generation failed:", e);
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Add Task with AI prioritization
  // -------------------------------------------------------------
  const addTask = async (title: string, category: string, deadline: string, initialPriority?: PriorityType) => {
    const newTask: Task = {
      id: "task-" + Math.random().toString(36).slice(2, 9),
      title,
      description: "",
      category: category as any,
      deadline,
      status: "pending",
      priority: initialPriority || "not-urgent-important", // Temporarily assigned until AI analysis resolves
      estimatedMinutes: 45,
      createdAt: new Date().toISOString()
    };

    const updated = [newTask, ...tasks];
    saveTasks(updated);

    // Run Server-side AI priority analysis
    try {
      const res = await fetch("/api/analyze-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          category,
          deadline,
          currentDate: new Date().toISOString()
        })
      });
      const analysis = await res.json();
      
      const analyzedTask: Task = {
        ...newTask,
        priority: initialPriority || analysis.priority,
        estimatedMinutes: analysis.recommendedDuration || 45,
        aiAnalysis: {
          urgencyScore: analysis.urgencyScore,
          impactScore: analysis.impactScore,
          riskOfMissing: analysis.riskOfMissing,
          reasoning: analysis.reasoning,
          suggestedStrategy: analysis.suggestedStrategy,
          recommendedDuration: analysis.recommendedDuration || 45,
          subtasks: analysis.subtasks || []
        }
      };

      const finalTasks = updated.map(t => t.id === newTask.id ? analyzedTask : t);
      saveTasks(finalTasks);
      
      // Auto refresh recommendations with new state
      triggerAIRecommendations(finalTasks, habits);
    } catch (e) {
      console.error("AI analysis for task failed:", e);
    }
  };

  // Helper to find the first available non-overlapping time slot after 09:30 AM
  const findFirstAvailableSlot = (allTasks: Task[], duration: number): { date: string; startTime: string; endTime: string } => {
    let daysChecked = 0;
    let currentDateObj = new Date();
    
    while (daysChecked < 30) {
      const yyyy = currentDateObj.getFullYear();
      const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDateObj.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      // Get existing busy time slots for this date
      const busySlots = allTasks
        .filter(t => t.timeSlot && t.timeSlot.date === dateStr)
        .map(t => {
          const startStr = t.timeSlot!.startTime;
          const endStr = t.timeSlot!.endTime || startStr;
          
          const [sh, sm] = startStr.split(":").map(Number);
          const [eh, em] = endStr.split(":").map(Number);
          
          return {
            start: sh * 60 + sm,
            end: eh * 60 + em
          };
        })
        .sort((a, b) => a.start - b.start);
      
      let candidateStart = 9 * 60 + 30; // 09:30 AM (570 minutes)
      const dayEnd = 21 * 60 + 30; // 09:30 PM (1290 minutes)
      
      while (candidateStart + duration <= dayEnd) {
        const candidateEnd = candidateStart + duration;
        const hasOverlap = busySlots.some(slot => {
          return candidateStart < slot.end && candidateEnd > slot.start;
        });
        
        if (!hasOverlap) {
          const startH = Math.floor(candidateStart / 60);
          const startM = candidateStart % 60;
          const endH = Math.floor(candidateEnd / 60);
          const endM = candidateEnd % 60;
          
          return {
            date: dateStr,
            startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
            endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
          };
        }
        
        const overlappingSlot = busySlots.find(slot => candidateStart < slot.end && candidateEnd > slot.start);
        if (overlappingSlot) {
          candidateStart = overlappingSlot.end;
        } else {
          candidateStart += 15;
        }
      }
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
      daysChecked++;
    }
    
    // Fallback to today at 9:30 AM
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fallbackDate = `${yyyy}-${mm}-${dd}`;
    const fallbackEndH = Math.floor((9 * 60 + 30 + duration) / 60);
    const fallbackEndM = (9 * 60 + 30 + duration) % 60;
    return {
      date: fallbackDate,
      startTime: "09:30",
      endTime: `${String(fallbackEndH).padStart(2, '0')}:${String(fallbackEndM).padStart(2, '0')}`
    };
  };

  // Add customized voice/agent task
  const addPreParsedTask = async (taskData: Partial<Task>) => {
    const duration = taskData.estimatedMinutes || 45;
    const slot = findFirstAvailableSlot(tasks, duration);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const defaultDeadline = `${todayStr}T09:30`;

    const newTask: Task = {
      id: "task-" + Math.random().toString(36).slice(2, 9),
      title: taskData.title || "Voice Captured Commitment",
      description: taskData.description || "",
      category: taskData.category || "Personal",
      deadline: taskData.deadline || defaultDeadline,
      status: "pending",
      priority: taskData.priority || "not-urgent-important",
      estimatedMinutes: duration,
      timeSlot: {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime
      },
      createdAt: new Date().toISOString()
    };

    const updated = [newTask, ...tasks];
    saveTasks(updated);

    // Fetch details
    try {
      const res = await fetch("/api/analyze-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          category: newTask.category,
          deadline: newTask.deadline,
          currentDate: new Date().toISOString()
        })
      });
      const analysis = await res.json();
      
      let finalTimeSlot = newTask.timeSlot;
      if (analysis.recommendedDuration && analysis.recommendedDuration !== newTask.estimatedMinutes && finalTimeSlot) {
        // Adjust endTime based on new duration
        const [h, m] = finalTimeSlot.startTime.split(":").map(Number);
        const totalMin = h * 60 + m + analysis.recommendedDuration;
        const endH = Math.floor(totalMin / 60) % 24;
        const endM = totalMin % 60;
        finalTimeSlot = {
          ...finalTimeSlot,
          endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        };
      }

      const analyzedTask: Task = {
        ...newTask,
        priority: analysis.priority,
        estimatedMinutes: analysis.recommendedDuration || 45,
        timeSlot: finalTimeSlot,
        aiAnalysis: {
          urgencyScore: analysis.urgencyScore,
          impactScore: analysis.impactScore,
          riskOfMissing: analysis.riskOfMissing,
          reasoning: analysis.reasoning,
          suggestedStrategy: analysis.suggestedStrategy,
          recommendedDuration: analysis.recommendedDuration || 45,
          subtasks: analysis.subtasks || []
        }
      };

      const finalTasks = updated.map(t => t.id === newTask.id ? analyzedTask : t);
      saveTasks(finalTasks);
      triggerAIRecommendations(finalTasks, habits);
    } catch (e) {
      console.error("AI voice-task analysis error", e);
    }
  };

  // -------------------------------------------------------------
  // Adopt AI deconstructed subtasks
  // -------------------------------------------------------------
  const adoptTasks = async (goalTitle: string, subtaskTitles: string[]) => {
    const createdTasks: Task[] = subtaskTitles.map((title, i) => {
      // Sequence deadline by placing spacing: Stage 1 = tomorrow, Stage 2 = day after tomorrow, etc.
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1 + i);
      targetDate.setHours(17, 0, 0, 0);

      const tId = "task-agent-" + Math.random().toString(36).slice(2, 9);
      return {
        id: tId,
        title: `[${goalTitle}] ${title}`,
        description: `Deconstructed stage of high level goal: "${goalTitle}"`,
        category: "Work" as any,
        deadline: targetDate.toISOString().slice(0, 16),
        status: "pending",
        priority: i === 0 ? "urgent-important" : "not-urgent-important",
        estimatedMinutes: 50,
        createdAt: new Date().toISOString(),
        aiAnalysis: {
          urgencyScore: i === 0 ? 80 : 40,
          impactScore: 85,
          riskOfMissing: i === 0 ? "medium" : "low",
          reasoning: `Deconstructed Stage ${i + 1} for: ${goalTitle}. Perfect for progressive scheduled execution.`,
          suggestedStrategy: `Pomodoro time-blocking on ${targetDate.toLocaleDateString()}`,
          recommendedDuration: 50,
          subtasks: ["Review guidelines", "Draft focus output", "Complete visual audit"]
        }
      };
    });

    const final = [...createdTasks, ...tasks];
    saveTasks(final);
    triggerAIRecommendations(final, habits);
  };

  // -------------------------------------------------------------
  // Toggle Status (Complete / Reopen)
  // -------------------------------------------------------------
  const toggleStatus = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' as const : 'pending' as const } : t);
    saveTasks(updated);
    
    // Auto sync selection state
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status: prev.status === 'pending' ? 'completed' : 'pending' } : null);
    }

    triggerAIRecommendations(updated, habits);
  };

  // -------------------------------------------------------------
  // Delete Task
  // -------------------------------------------------------------
  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
    if (selectedTask?.id === id) {
      setSelectedTask(null);
    }
    triggerAIRecommendations(updated, habits);
  };

  // -------------------------------------------------------------
  // Calendar scheduling
  // -------------------------------------------------------------
  const scheduleTask = (taskId: string, date: string, startTime: string, duration: number) => {
    // calculate endTime
    const [h, m] = startTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + duration;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          timeSlot: { date, startTime, endTime }
        };
      }
      return t;
    });

    saveTasks(updated);
    triggerAIRecommendations(updated, habits);
  };

  // -------------------------------------------------------------
  // Toggle Habit
  // -------------------------------------------------------------
  const toggleHabit = (id: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = habits.map(h => {
      if (h.id === id) {
        const isCompletedToday = h.lastCompleted === todayStr;
        const currentHistory = h.history || [];
        const updatedHistory = isCompletedToday 
          ? currentHistory.filter(d => d !== todayStr) 
          : [...currentHistory.filter(d => d !== todayStr), todayStr];

        return {
          ...h,
          streak: isCompletedToday ? Math.max(0, h.streak - 1) : h.streak + 1,
          lastCompleted: isCompletedToday ? undefined : todayStr,
          history: updatedHistory
        };
      }
      return h;
    });
    saveHabits(updated);
    triggerAIRecommendations(tasks, updated);
  };

  // -------------------------------------------------------------
  // Log Focus Session
  // -------------------------------------------------------------
  const logFocusSession = (minutes: number) => {
    const updatedMins = totalFocusMinutes + minutes;
    const updatedPomos = completedPomodoros + 1;
    setTotalFocusMinutes(updatedMins);
    setCompletedPomodoros(updatedPomos);
    localStorage.setItem("lastminute_focus_mins", String(updatedMins));
    localStorage.setItem("lastminute_pomos", String(updatedPomos));
  };

  // -------------------------------------------------------------
  // Create Habit
  // -------------------------------------------------------------
  const createHabit = (title: string, frequency: 'daily' | 'weekly', category: string) => {
    const newHabit: Habit = {
      id: "habit-" + Math.random().toString(36).slice(2, 9),
      title,
      frequency,
      streak: 0,
      category,
      createdAt: new Date().toISOString()
    };
    const updated = [newHabit, ...habits];
    saveHabits(updated);
    triggerAIRecommendations(tasks, updated);
  };

  // Voice completion helper
  const completeTaskByKeyword = (keyword: string) => {
    const cleanKeyword = keyword.toLowerCase().trim();
    const match = tasks.find(t => t.status === 'pending' && t.title.toLowerCase().includes(cleanKeyword));
    if (match) {
      toggleStatus(match.id);
    }
  };

  // Subtask checking persistence
  const updateSubtask = (taskId: string, subtaskIndex: number, completed: boolean) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const completedSubtasks = t.completedSubtasks ? [...t.completedSubtasks] : [];
        if (completed) {
          if (!completedSubtasks.includes(subtaskIndex)) {
            completedSubtasks.push(subtaskIndex);
          }
        } else {
          const idx = completedSubtasks.indexOf(subtaskIndex);
          if (idx > -1) {
            completedSubtasks.splice(idx, 1);
          }
        }
        return { ...t, completedSubtasks };
      }
      return t;
    });
    saveTasks(updated);

    // Auto sync selection state
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? {
        ...prev,
        completedSubtasks: completed
          ? [...(prev.completedSubtasks || []), subtaskIndex]
          : (prev.completedSubtasks || []).filter(idx => idx !== subtaskIndex)
      } : null);
    }
  };

  // Edit core task fields
  const editTask = (taskId: string, updatedFields: Partial<Task>) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, ...updatedFields };
      }
      return t;
    });
    saveTasks(updated);

    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updatedFields } : null);
    }
  };

  return {
    tasks,
    habits,
    recommendations,
    isRecommendationLoading,
    selectedTask,
    setSelectedTask,
    metrics: calculateMetrics(),
    addTask,
    addPreParsedTask,
    adoptTasks,
    toggleStatus,
    deleteTask,
    scheduleTask,
    toggleHabit,
    createHabit,
    completeTaskByKeyword,
    triggerAIRecommendations,
    updateSubtask,
    editTask,
    logFocusSession
  };
}
