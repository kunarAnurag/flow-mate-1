export type PriorityType = 'urgent-important' | 'urgent-not-important' | 'not-urgent-important' | 'not-urgent-not-important';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'Assignment' | 'Meeting' | 'Bill' | 'Work' | 'Personal' | 'Other';
  deadline: string; // ISO String or YYYY-MM-DDTHH:MM
  status: 'pending' | 'completed';
  priority: PriorityType;
  estimatedMinutes: number;
  completedSubtasks?: number[]; // Track indexes of checked subtasks
  googleCalendarSynced?: boolean; // Tracks if task is synced to Google Calendar
  timeSlot?: {
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
  };
  aiAnalysis?: {
    urgencyScore: number; // 0 to 100
    impactScore: number; // 0 to 100
    riskOfMissing: 'high' | 'medium' | 'low';
    reasoning: string;
    suggestedStrategy: string;
    recommendedDuration: number; // minutes
    subtasks?: string[]; // auto-planned breakdown
  };
  goalId?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'active' | 'completed';
  tasksCount: { total: number; completed: number };
}

export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  lastCompleted?: string; // YYYY-MM-DD
  history?: string[]; // Array of YYYY-MM-DD completion dates
  category: string;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  title: string;
  text: string;
  severity: 'high' | 'medium' | 'info';
  taskId?: string;
  actionType: 'schedule' | 'breakdown' | 'delegate' | 'focus';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // YYYY-MM-DDTHH:MM
  end: string;
  color: string;
  isTask: boolean;
  taskId?: string;
}

export interface ProductivityMetrics {
  totalTasks: number;
  completedTasks: number;
  onTimeRate: number;
  currentStreak: number;
  cognitiveLoad: 'Optimal' | 'Manageable' | 'Critical';
  totalFocusMinutes?: number;
  completedPomodoros?: number;
}
