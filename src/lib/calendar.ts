import { Task } from "../types";

export interface GoogleCalendarEventResponse {
  id: string;
  htmlLink?: string;
  summary: string;
}

/**
 * Helper to construct an ISO string with timezone offset from a local datetime input (YYYY-MM-DDTHH:MM)
 */
function getISODateTime(localDateTimeStr: string, offsetMins: number = new Date().getTimezoneOffset()): string {
  try {
    const date = new Date(localDateTimeStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Syncs a task to Google Calendar
 */
export async function syncTaskToGoogleCalendar(
  task: Task,
  accessToken: string
): Promise<GoogleCalendarEventResponse> {
  if (!accessToken) {
    throw new Error("Missing authentication token for Google Calendar sync.");
  }

  // Determine start and end times
  let startISO = "";
  let endISO = "";

  if (task.timeSlot) {
    const startLocal = `${task.timeSlot.date}T${task.timeSlot.startTime}`;
    const endLocal = `${task.timeSlot.date}T${task.timeSlot.endTime}`;
    startISO = getISODateTime(startLocal);
    endISO = getISODateTime(endLocal);
  } else if (task.deadline) {
    const endLocal = task.deadline;
    // Calculate start as deadline minus estimated duration
    const durationMins = task.aiAnalysis?.recommendedDuration || task.estimatedMinutes || 60;
    const endDate = new Date(endLocal);
    const startDate = new Date(endDate.getTime() - durationMins * 60 * 1000);
    
    startISO = startDate.toISOString();
    endISO = endDate.toISOString();
  } else {
    // Fallback if no deadline
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    startISO = now.toISOString();
    endISO = oneHourLater.toISOString();
  }

  // Build a nice detailed description
  let description = `Task Category: ${task.category}\n`;
  description += `Priority: ${task.priority.toUpperCase()}\n`;
  description += `Status: ${task.status === "completed" ? "✅ Completed" : "⏳ Pending"}\n\n`;

  if (task.description) {
    description += `Description:\n${task.description}\n\n`;
  }

  if (task.aiAnalysis) {
    description += `🧠 AI Urgency Score: ${task.aiAnalysis.urgencyScore}/100\n`;
    description += `🧠 AI Impact Score: ${task.aiAnalysis.impactScore}/100\n`;
    description += `🧠 Tactical Recommendation:\n${task.aiAnalysis.suggestedStrategy}\n\n`;
    
    if (task.aiAnalysis.subtasks && task.aiAnalysis.subtasks.length > 0) {
      description += `📋 Execution Steps:\n`;
      task.aiAnalysis.subtasks.forEach((sub, idx) => {
        const done = task.completedSubtasks?.includes(idx) ? " [x] " : " [ ] ";
        description += `${done}${sub}\n`;
      });
    }
  }

  const eventPayload = {
    summary: `⚠️ [Last-Minute] ${task.title}`,
    description: description,
    start: {
      dateTime: startISO,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    end: {
      dateTime: endISO,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 120 }
      ]
    }
  };

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventPayload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Google Calendar event creation error:", errorData);
    throw new Error(errorData.error?.message || "Failed to create Google Calendar event.");
  }

  const data = await response.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
    summary: data.summary
  };
}
