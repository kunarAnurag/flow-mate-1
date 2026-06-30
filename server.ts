import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      console.log("Successfully initialized Gemini AI client with telemetry.");
    } else {
      console.warn("GEMINI_API_KEY is not defined or is placeholder. Using smart offline logic.");
    }
  }
  return aiClient;
}

// -------------------------------------------------------------
// Helper to call Gemini and get JSON
// -------------------------------------------------------------
let geminiQuotaExceeded = false;

async function generateJSON(prompt: string, systemInstruction?: string): Promise<any> {
  const ai = getAI();
  if (!ai) {
    throw new Error("No API key configured");
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      geminiQuotaExceeded = false;
      return JSON.parse(text);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || String(error);
      console.warn(`Gemini API attempt ${attempt} failed with: ${errorMsg}`);

      // Check if the error is a transient error (503 Service Unavailable or 429 Rate Limit)
      const isQuotaExceeded = errorMsg.includes("exceeded your current quota") ||
                              errorMsg.includes("Quota exceeded") ||
                              errorMsg.includes("billing details") ||
                              errorMsg.includes("GenerateRequestsPerDayPerProjectPerModel") ||
                              errorMsg.includes("free_tier_requests");

      const isTransient = !isQuotaExceeded && (
                          errorMsg.includes("503") ||
                          errorMsg.includes("UNAVAILABLE") ||
                          errorMsg.includes("429") ||
                          errorMsg.includes("ResourceExhausted") ||
                          errorMsg.includes("overloaded") ||
                          errorMsg.includes("high demand") ||
                          error.status === 503 ||
                          error.status === 429
      );

      if (isQuotaExceeded) {
        geminiQuotaExceeded = true;
        console.warn("Gemini API Quota is fully exhausted. Aborting retries and falling back immediately.");
        break;
      }

      if (isTransient && attempt < maxRetries) {
        // Backoff with a bit of jitter
        const delay = attempt * 1200 + Math.random() * 400;
        console.log(`Transient Gemini API error detected. Retrying attempt ${attempt + 1}/${maxRetries} in ${delay.toFixed(0)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Break out of the loop for non-transient errors or if we hit the retry limit
        break;
      }
    }
  }

  throw lastError || new Error("Failed to generate content after retries");
}

// -------------------------------------------------------------
// Validation & Sanitization Helpers
// -------------------------------------------------------------
function validateString(val: any, maxLen: number, defaultVal = ""): string {
  if (typeof val !== "string") return defaultVal;
  const trimmed = val.trim();
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen);
  }
  return trimmed;
}

function isValidDate(dateStr: any): boolean {
  if (typeof dateStr !== "string") return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

const VALID_CATEGORIES = ["Assignment", "Meeting", "Bill", "Work", "Personal", "Other"];
function validateCategory(cat: any): string {
  if (typeof cat !== "string") return "Other";
  const matched = VALID_CATEGORIES.find(c => c.toLowerCase() === cat.trim().toLowerCase());
  return matched || "Other";
}

// -------------------------------------------------------------
// Gemini Quota Status check for frontend notification
// -------------------------------------------------------------
app.get("/api/quota-status", (req, res) => {
  res.json({ quotaExceeded: geminiQuotaExceeded });
});

// -------------------------------------------------------------
// 1. Task Urgency and Priority Analysis
// -------------------------------------------------------------
app.post("/api/analyze-task", async (req, res) => {
  let { title, description, category, deadline, currentDate } = req.body;

  title = validateString(title, 150);
  if (!title) {
    res.status(400).json({ error: "Task title is required, and must be a valid string under 150 characters." });
    return;
  }

  description = validateString(description, 1000);
  category = validateCategory(category);

  if (deadline && !isValidDate(deadline)) {
    res.status(400).json({ error: "Task deadline must be a valid ISO Date string." });
    return;
  }

  if (currentDate && !isValidDate(currentDate)) {
    currentDate = new Date().toISOString();
  } else {
    currentDate = currentDate || new Date().toISOString();
  }

  const prompt = `
  Analyze this task to prioritize it using the Eisenhower Matrix (Urgent/Important scale).
  Task Details:
  - Title: "${title}"
  - Description: "${description || "No description provided."}"
  - Category: "${category}"
  - Deadline: "${deadline || "None specified"}"
  - Current Local Time: "${currentDate}"

  Determine:
  1. Urgency score (0-100) based on remaining time.
  2. Impact/Importance score (0-100) based on category and consequence.
  3. Eisenhower Priority Bucket:
     - 'urgent-important': High consequences, due very soon.
     - 'urgent-not-important': Due soon, but administrative/routine.
     - 'not-urgent-important': Long term goal, high consequence, but has ample time.
     - 'not-urgent-not-important': Low impact, no immediate rush.
  4. Risk of missing ('high', 'medium', 'low') based on deadline proximity and estimated effort.
  5. Short rationale/reasoning explaining the placement.
  6. Actionable productivity strategy (e.g. "Delegate", "Schedule first thing", "Break into micro-tasks").
  7. Recommended Duration (in minutes) for deep focus.
  8. A sequential breakdown of 3 to 5 micro-subtasks to get started.

  Respond in strict JSON with keys:
  {
    "urgencyScore": number,
    "impactScore": number,
    "priority": "urgent-important" | "urgent-not-important" | "not-urgent-important" | "not-urgent-not-important",
    "riskOfMissing": "high" | "medium" | "low",
    "reasoning": "string",
    "suggestedStrategy": "string",
    "recommendedDuration": number,
    "subtasks": ["string"]
  }
  `;

  try {
    const result = await generateJSON(prompt, "You are an elite productivity executive assistant specialized in time blocking and anxiety-free deadline completion.");
    res.json(result);
  } catch (error: any) {
    console.warn("Gemini analyze-task handled gracefully via fallback. Notice:", error.message);
    
    // Intelligent fallback calculation
    const dueTime = deadline ? new Date(deadline).getTime() : Date.now() + 86400000 * 2;
    const nowTime = currentDate ? new Date(currentDate).getTime() : Date.now();
    const hoursLeft = Math.max(0, (dueTime - nowTime) / (1000 * 60 * 60));
    
    let urgencyScore = 50;
    let impactScore = 50;
    let priority: any = "not-urgent-important";
    let risk = "medium";
    let reasoning = "Calculated using smart offline timeline analysis.";
    let subtasks = ["Review task constraints", "Outline immediate next steps", "Complete initial action block"];

    if (hoursLeft <= 4) {
      urgencyScore = 95;
      risk = "high";
      priority = "urgent-important";
      reasoning = `CRITICAL: Extremely close deadline (${hoursLeft.toFixed(1)} hours remaining). Immediate focus required.`;
      subtasks = ["Mute notifications", "Set 25min focus timer", "Submit draft immediately"];
    } else if (hoursLeft <= 24) {
      urgencyScore = 80;
      risk = "high";
      priority = "urgent-important";
      reasoning = `URGENT: Task is due in less than 24 hours. Start working today to avoid last-minute panic.`;
      subtasks = ["Gather all required resources", "Perform 1 hour of deep work", "Complete final edit check"];
    } else if (hoursLeft <= 72) {
      urgencyScore = 60;
      priority = "not-urgent-important";
      reasoning = `Task is due in ${Math.round(hoursLeft / 24)} days. Perfect window for scheduled time-blocking.`;
    } else {
      urgencyScore = 30;
      priority = "not-urgent-important";
      risk = "low";
      reasoning = "Task deadline is ample. Keep on radar but prioritize more immediate work.";
    }

    if (category === "Meeting" || category === "Work") {
      impactScore = 80;
    } else if (category === "Assignment" || category === "Bill") {
      impactScore = 90;
      priority = urgencyScore > 70 ? "urgent-important" : "not-urgent-important";
    }

    res.json({
      urgencyScore,
      impactScore,
      priority,
      riskOfMissing: risk,
      reasoning,
      suggestedStrategy: urgencyScore > 75 ? "Deep Work Block & Notification Block" : "Schedule 45-minute focus session in calendar",
      recommendedDuration: Math.min(120, Math.max(25, Math.ceil(hoursLeft < 12 ? 30 : 60))),
      subtasks
    });
  }
});

// -------------------------------------------------------------
// 2. Proactive Recommendations & Load Advisor
// -------------------------------------------------------------
app.post("/api/generate-recommendations", async (req, res) => {
  let { tasks, habits, currentDate } = req.body;

  if (currentDate && !isValidDate(currentDate)) {
    currentDate = new Date().toISOString();
  } else {
    currentDate = currentDate || new Date().toISOString();
  }

  // Validate and sanitize tasks array
  if (!Array.isArray(tasks)) {
    tasks = [];
  } else {
    tasks = tasks.map(t => {
      if (!t || typeof t !== "object") return null;
      return {
        id: validateString(t.id, 50, "task-" + Math.random().toString(36).slice(2, 9)),
        title: validateString(t.title, 150, "Unnamed Task"),
        description: validateString(t.description, 1000),
        category: validateCategory(t.category),
        deadline: isValidDate(t.deadline) ? t.deadline : new Date(Date.now() + 86400000).toISOString(),
        status: t.status === "completed" ? "completed" : "pending",
        priority: ["urgent-important", "urgent-not-important", "not-urgent-important", "not-urgent-not-important"].includes(t.priority) ? t.priority : "not-urgent-important",
        estimatedMinutes: typeof t.estimatedMinutes === "number" ? t.estimatedMinutes : 45,
        aiAnalysis: t.aiAnalysis && typeof t.aiAnalysis === "object" ? {
          urgencyScore: typeof t.aiAnalysis.urgencyScore === "number" ? t.aiAnalysis.urgencyScore : 50,
          impactScore: typeof t.aiAnalysis.impactScore === "number" ? t.aiAnalysis.impactScore : 50,
          riskOfMissing: ["high", "medium", "low"].includes(t.aiAnalysis.riskOfMissing) ? t.aiAnalysis.riskOfMissing : "medium",
          reasoning: validateString(t.aiAnalysis.reasoning, 1000),
          suggestedStrategy: validateString(t.aiAnalysis.suggestedStrategy, 1000),
          recommendedDuration: typeof t.aiAnalysis.recommendedDuration === "number" ? t.aiAnalysis.recommendedDuration : 45,
          subtasks: Array.isArray(t.aiAnalysis.subtasks) ? t.aiAnalysis.subtasks.map((s: any) => validateString(s, 150)) : []
        } : undefined
      };
    }).filter(Boolean);
  }

  // Validate and sanitize habits array
  if (!Array.isArray(habits)) {
    habits = [];
  } else {
    habits = habits.map(h => {
      if (!h || typeof h !== "object") return null;
      return {
        id: validateString(h.id, 50, "habit-" + Math.random().toString(36).slice(2, 9)),
        title: validateString(h.title, 150, "Unnamed Habit"),
        frequency: h.frequency === "daily" || h.frequency === "weekly" ? h.frequency : "daily",
        category: validateString(h.category, 50, "Other"),
        streak: typeof h.streak === "number" ? h.streak : 0,
        lastCompleted: isValidDate(h.lastCompleted) || h.lastCompleted === null ? h.lastCompleted : null,
        history: Array.isArray(h.history) ? h.history.filter(isValidDate) : []
      };
    }).filter(Boolean);
  }

  const prompt = `
  Given the current state of a user's task manager, analyze their risk profile, potential bottlenecks, and workload load.
  Current Time: ${currentDate}
  
  Active Tasks:
  ${JSON.stringify(tasks)}
 
  Habits:
  ${JSON.stringify(habits)}

  Analyze:
  - Are there looming deadlines (within 24-48 hrs) with pending status?
  - Is the user suffering from cognitive overload?
  - Are habits being neglected (streak maintenance)?
  
  Generate up to 3 highly actionable, personalized recommendations with titles, texts, and urgency levels.
  
  Respond in strict JSON with keys:
  {
    "recommendations": [
      {
        "id": "string (unique)",
        "title": "string (bold, action-oriented, e.g. 'Defuse Bill Deadline')",
        "text": "string (highly specific advice referencing the specific tasks/habits)",
        "severity": "high" | "medium" | "info",
        "taskId": "string (optional matching taskId if relevant)",
        "actionType": "schedule" | "breakdown" | "delegate" | "focus"
      }
    ]
  }
  `;

  try {
    const result = await generateJSON(prompt, "You are a warm, direct, highly strategic performance coach focused on anxiety reduction and high-output priority targeting.");
    res.json(result);
  } catch (error: any) {
    console.warn("Gemini generate-recommendations handled gracefully via fallback. Notice:", error.message);

    // Smart Local Recommendations Engine
    const recommendations: any[] = [];
    const pendingTasks = (tasks || []).filter((t: any) => t.status === "pending");
    
    // Sort tasks by urgency
    const sortedTasks = [...pendingTasks].sort((a: any, b: any) => {
      const aTime = new Date(a.deadline).getTime();
      const bTime = new Date(b.deadline).getTime();
      return aTime - bTime;
    });

    const now = currentDate ? new Date(currentDate).getTime() : Date.now();

    if (sortedTasks.length > 0) {
      const nextTask = sortedTasks[0];
      const hoursLeft = (new Date(nextTask.deadline).getTime() - now) / (1000 * 60 * 60);

      if (hoursLeft < 24 && hoursLeft >= 0) {
        recommendations.push({
          id: "rec-urgent-task",
          title: `Emergency Protocol: ${nextTask.title}`,
          text: `Your ${nextTask.category.toLowerCase()} task is due in ${hoursLeft.toFixed(1)} hours! Mute digital alerts and plan a ${nextTask.aiAnalysis?.recommendedDuration || 45} minute focused timebox.`,
          severity: "high",
          taskId: nextTask.id,
          actionType: "focus"
        });
      } else {
        recommendations.push({
          id: "rec-schedule-task",
          title: `Lock in: ${nextTask.title}`,
          text: `With ample time left, secure this task in your schedule today before other commitments fill your day.`,
          severity: "medium",
          taskId: nextTask.id,
          actionType: "schedule"
        });
      }
    }

    if (pendingTasks.length > 5) {
      const complexTask = sortedTasks[0];
      recommendations.push({
        id: "rec-overload",
        title: "Cognitive Overload Warning",
        text: `You have ${pendingTasks.length} pending items. Let's break down the most complex task into bite-sized subtasks so you can build visual progress.`,
        severity: "medium",
        taskId: complexTask ? complexTask.id : undefined,
        actionType: "breakdown"
      });
    }

    // Default info recommendation
    if (recommendations.length < 2) {
      recommendations.push({
        id: "rec-habits",
        title: "Micro-Habit Checkup",
        text: "Completing just one small habit early in the morning creates mental momentum that carries into your highest stakes work.",
        severity: "info",
        actionType: "focus"
      });
    }

    res.json({ recommendations });
  }
});

// -------------------------------------------------------------
// 3. Smart Task Breakdown & Subtasks
// -------------------------------------------------------------
function extractTopicName(title: string): { category: string; specific: string } {
  const clean = title.toLowerCase();
  
  // 1. Music / Instrument
  if (clean.includes("guitar")) return { category: "music", specific: "Guitar" };
  if (clean.includes("piano")) return { category: "music", specific: "Piano" };
  if (clean.includes("ukulele")) return { category: "music", specific: "Ukulele" };
  if (clean.includes("violin")) return { category: "music", specific: "Violin" };
  if (clean.includes("drums")) return { category: "music", specific: "Drums" };
  if (clean.includes("singing") || clean.includes("sing ") || clean.includes("vocal") || clean.includes("voice")) return { category: "music", specific: "Vocal Art/Singing" };
  if (clean.includes("music") || clean.includes("instrument")) return { category: "music", specific: "Musical Instrument" };

  // 2. Language
  if (clean.includes("spanish")) return { category: "language", specific: "Spanish" };
  if (clean.includes("french")) return { category: "language", specific: "French" };
  if (clean.includes("japanese")) return { category: "language", specific: "Japanese" };
  if (clean.includes("german")) return { category: "language", specific: "German" };
  if (clean.includes("chinese") || clean.includes("mandarin")) return { category: "language", specific: "Chinese" };
  if (clean.includes("korean")) return { category: "language", specific: "Korean" };
  if (clean.includes("arabic")) return { category: "language", specific: "Arabic" };
  if (clean.includes("italian")) return { category: "language", specific: "Italian" };
  if (clean.includes("russian")) return { category: "language", specific: "Russian" };
  if (clean.includes("portuguese")) return { category: "language", specific: "Portuguese" };
  if (clean.includes("language") || clean.includes("speak") || clean.includes("translation")) return { category: "language", specific: "a new language" };

  // 3. Coding / Software / Tech
  if (clean.includes("python")) return { category: "coding", specific: "Python" };
  if (clean.includes("react")) return { category: "coding", specific: "React" };
  if (clean.includes("javascript") || clean.includes(" js")) return { category: "coding", specific: "JavaScript" };
  if (clean.includes("typescript") || clean.includes(" ts")) return { category: "coding", specific: "TypeScript" };
  if (clean.includes("rust")) return { category: "coding", specific: "Rust" };
  if (clean.includes("java") && !clean.includes("javascript")) return { category: "coding", specific: "Java" };
  if (clean.includes("c++") || clean.includes("cpp")) return { category: "coding", specific: "C++" };
  if (clean.includes("swift")) return { category: "coding", specific: "Swift" };
  if (clean.includes(" go ") || clean.includes("golang")) return { category: "coding", specific: "Go" };
  if (clean.includes("html") || clean.includes("css")) return { category: "coding", specific: "HTML/CSS Web Design" };
  if (clean.includes("sql") || clean.includes("database") || clean.includes("postgresql")) return { category: "coding", specific: "Databases & SQL" };
  if (clean.includes("machine learning") || clean.includes(" ml ") || clean.includes("deep learning") || clean.includes("neural network")) return { category: "coding", specific: "Machine Learning / AI" };
  if (clean.includes("code") || clean.includes("program") || clean.includes("develop") || clean.includes("software") || clean.includes("web dev") || clean.includes("app")) return { category: "coding", specific: "Software Development" };

  // 4. Academic Research / Science / Economics
  if (clean.includes("macro economics") || clean.includes("macroeconomics") || clean.includes("macro-economics")) return { category: "academic", specific: "Macroeconomics" };
  if (clean.includes("micro economics") || clean.includes("microeconomics") || clean.includes("micro-economics")) return { category: "academic", specific: "Microeconomics" };
  if (clean.includes("economics")) return { category: "academic", specific: "Economics" };
  if (clean.includes("finance") || clean.includes("investing") || clean.includes("market")) return { category: "academic", specific: "Finance" };
  if (clean.includes("history") || clean.includes("historical")) return { category: "academic", specific: "History" };
  if (clean.includes("psychology")) return { category: "academic", specific: "Psychology" };
  if (clean.includes("physics")) return { category: "academic", specific: "Physics" };
  if (clean.includes("chemistry")) return { category: "academic", specific: "Chemistry" };
  if (clean.includes("biology") || clean.includes("genetics")) return { category: "academic", specific: "Biology" };
  if (clean.includes("philosophy")) return { category: "academic", specific: "Philosophy" };
  if (clean.includes("math") || clean.includes("calculus") || clean.includes("algebra") || clean.includes("geometry") || clean.includes("statistics")) return { category: "academic", specific: "Mathematics" };
  if (clean.includes("sociology") || clean.includes("anthropology")) return { category: "academic", specific: "Sociology" };
  if (clean.includes("science") || clean.includes("research") || clean.includes("academic") || clean.includes("topic") || clean.includes("article") || clean.includes("paper")) return { category: "academic", specific: "Academic Research" };

  // 5. Fitness / Health
  if (clean.includes("run") || clean.includes("marathon") || clean.includes("jog")) return { category: "fitness", specific: "Running" };
  if (clean.includes("workout") || clean.includes("gym") || clean.includes("exercise") || clean.includes("lift") || clean.includes("weight")) return { category: "fitness", specific: "Strength Training & Fitness" };
  if (clean.includes("diet") || clean.includes("nutrition") || clean.includes("meal")) return { category: "fitness", specific: "Diet & Nutrition" };
  if (clean.includes("yoga") || clean.includes("pilates") || clean.includes("stretch")) return { category: "fitness", specific: "Yoga & Flexibility" };
  if (clean.includes("swim")) return { category: "fitness", specific: "Swimming" };
  if (clean.includes("cycling") || clean.includes("bike")) return { category: "fitness", specific: "Cycling" };
  if (clean.includes("fitness") || clean.includes("health") || clean.includes("sport") || clean.includes("athletic")) return { category: "fitness", specific: "Fitness & Athletics" };

  // 6. Creative / Life Skills
  if (clean.includes("cook") || clean.includes("baking") || clean.includes("bake") || clean.includes("recipe") || clean.includes("culinary")) return { category: "creative", specific: "Culinary Arts & Cooking" };
  if (clean.includes("paint") || clean.includes("watercolor") || clean.includes("acrylic")) return { category: "creative", specific: "Painting" };
  if (clean.includes("draw") || clean.includes("sketch") || clean.includes("illustration")) return { category: "creative", specific: "Drawing & Sketching" };
  if (clean.includes("photograph") || clean.includes("camera") || clean.includes("photo")) return { category: "creative", specific: "Photography" };
  if (clean.includes("video") || clean.includes("filming") || clean.includes("editing")) return { category: "creative", specific: "Videography & Editing" };
  if (clean.includes("write") || clean.includes("novel") || clean.includes("creative writing") || clean.includes("book")) return { category: "creative", specific: "Creative Writing" };
  if (clean.includes("garden") || clean.includes("plant") || clean.includes("agriculture")) return { category: "creative", specific: "Gardening & Plant Care" };
  if (clean.includes("speak") || clean.includes("public speaking") || clean.includes("presentation") || clean.includes("speech")) return { category: "creative", specific: "Public Speaking" };
  if (clean.includes("leadership") || clean.includes("management") || clean.includes("business") || clean.includes("startup") || clean.includes("marketing")) return { category: "creative", specific: "Business & Leadership" };

  return { category: "generic", specific: title };
}

function generateSmartFallback(title: string, description: string): string[] {
  const { category, specific } = extractTopicName(title);
  
  if (category === "music") {
    return [
      `Step 1: Learn the anatomy of the ${specific}, correct posture, holding ergonomics, and tuning.`,
      `Step 2: Master the first 4-5 basic beginner chords/patterns to build initial muscle memory for ${specific}.`,
      `Step 3: Practice basic strumming or rhythm subdivisions with a metronome at a very slow pace.`,
      `Step 4: Practice smooth transitions between the primary beginner chords without stopping the rhythm.`,
      `Step 5: Pick a simple, slow, beginner-friendly song in ${specific} and learn to play it through.`,
      `Step 6: Build speed, precision, and clean technique, then move on to basic scales and theory.`
    ];
  }
  
  if (category === "language") {
    return [
      `Step 1: Learn the core pronunciation rules, phonetic alphabet, and basic greetings in ${specific}.`,
      `Step 2: Memorize the first 100 high-frequency words (essential pronouns, daily nouns, and active verbs).`,
      `Step 3: Understand simple present-tense conjugations and basic Subject-Verb-Object structures in ${specific}.`,
      `Step 4: Engage in active listening with kids' audiobooks, bilingual podcasts, or subtitled videos.`,
      `Step 5: Practice basic writing by drafting short paragraphs or keeping a simple daily journal in ${specific}.`,
      `Step 6: Use flashcard tools (Anki) for vocabulary retention and speak simple phrases out loud daily.`
    ];
  }

  if (category === "coding") {
    return [
      `Step 1: Set up your development environment and study fundamental syntax and variables in ${specific}.`,
      `Step 2: Master control structures like loops (for/while) and learn how to write reusable functions.`,
      `Step 3: Dive into key data structures (arrays, dictionaries/objects) and scopes of ${specific}.`,
      `Step 4: Build a small, isolated console utility or static page to put the introductory theories together.`,
      `Step 5: Learn how to read error logs, troubleshoot with debugging tools, and practice basic Git commands.`,
      `Step 6: Build a mini independent project using ${specific}, keeping code modular and well-documented.`
    ];
  }

  if (category === "academic") {
    return [
      `Step 1: Define key terminology, fundamental concepts, and primary branches of ${specific}.`,
      `Step 2: Study foundational textbooks, core introductory models, or high-quality educational videos.`,
      `Step 3: Gather relevant qualitative data, quantitative evidence, or case studies regarding ${specific}.`,
      `Step 4: Analyze how the main theoretical variables or historical events interact with one another.`,
      `Step 5: Write short summaries or solve classic problem sets to test your command of complex sub-theories.`,
      `Step 6: Formulate an evidence-based perspective or summary report synthesizing your research in ${specific}.`
    ];
  }

  if (category === "fitness") {
    return [
      `Step 1: Establish clear baseline metrics and safe, trackable short-term objectives for ${specific}.`,
      `Step 2: Learn and perfect proper physical form, breathing techniques, and joint alignment.`,
      `Step 3: Schedule a low-intensity starting calendar (e.g. 3 sessions per week) to prioritize consistency.`,
      `Step 4: Implement a dynamic, joint-lubricating warm-up and a thorough cooldown for every session.`,
      `Step 5: Use progressive overload, increasing duration or training weight by no more than 10% per week.`,
      `Step 6: Ensure balanced nutrition, deep hydration, and 7-8 hours of sleep for muscle repair and recovery.`
    ];
  }

  if (category === "creative") {
    return [
      `Step 1: Research core creative principles (e.g., lighting, heating, shading) and safety rules for ${specific}.`,
      `Step 2: Select a high-quality, beginner-friendly toolset or high-purity materials, learning how to care for them.`,
      `Step 3: Complete short daily technique exercises (e.g., small sketches, brushwork, simple knife cuts).`,
      `Step 4: Replicate 2-3 step-by-step master tutorials to understand proper timing, layering, or composition.`,
      `Step 5: Produce your first complete independent piece or recipe from scratch, logging areas of difficulty.`,
      `Step 6: Critique your finished work, gather community feedback, and experiment with advanced techniques.`
    ];
  }

  // Generic fallback
  const words = title
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !["want", "learn", "how", "to", "the", "and", "like", "with", "from", "for", "this", "that", "these", "those"].includes(w.toLowerCase()));
  
  const kw1 = words[0] ? words[0] : "key requirements";
  const kw2 = words[1] ? words[1] : "relevant resources";
  const kw3 = words[2] ? words[2] : "practical steps";

  return [
    `Step 1: Clarify primary objectives for "${title}" and identify your current starting level.`,
    `Step 2: Conduct basic research to identify core definitions and essential tools needed for "${kw1}".`,
    `Step 3: Set aside dedicated time blocks in your daily schedule to focus on "${kw2}".`,
    `Step 4: Start practicing with simple, low-stakes micro-tasks, avoiding premature optimization.`,
    `Step 5: Build a very small, reference-free prototype or exercise centered around "${kw3}".`,
    "Step 6: Evaluate your initial progress, list sticking points, and refine your study or execution plan."
  ];
}

app.post("/api/breakdown-task", async (req, res) => {
  let { title, description } = req.body;

  title = validateString(title, 150);
  if (!title) {
    res.status(400).json({ error: "Task title is required, and must be under 150 characters." });
    return;
  }

  description = validateString(description, 1000);

  try {
    const ai = getAI();
    if (!ai) {
      throw new Error("No API key configured");
    }

    const prompt = `
    Deconstruct the following task or learning goal into a highly strategic, structured, and logical sequence of 5 to 10 concrete, actionable steps:
    - Task/Goal: "${title}"
    - Extra Context: "${description || "None provided."}"

    Instructions:
    1. Search the internet to find the absolute best recommended path, topics, resources, and curriculum or steps for this specific objective.
    2. The plan MUST consist of between 5 and 10 steps (inclusive).
    3. Respond strictly in JSON format with the following schema:
    {
      "subtasks": [
        "Step 1: Description of first actionable step...",
        "Step 2: Description of second actionable step..."
      ]
    }
    `;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert curriculum, project, and skill deconstructor. You search the internet to find the best guidelines, topics, and structures to form a 5 to 10 step sequence to master any task or skill.",
          responseMimeType: "application/json",
          temperature: 0.3,
          tools: [{ googleSearch: {} }],
        },
      });
    } catch (searchError: any) {
      console.warn("Gemini breakdown-task search grounding failed, retrying without search grounding tool. Reason:", searchError.message || searchError);
      
      // Fallback request to normal Gemini model without googleSearch tool to bypass Search Grounding limits
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert curriculum, project, and skill deconstructor. You formulate a 5 to 10 step sequence to master any task or skill.",
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });
    }

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const parsedResult = JSON.parse(text);

    let subtasks = parsedResult.subtasks;
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      subtasks = generateSmartFallback(title, description);
    }

    // Extract grounding chunks
    const sources: { title: string; url: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && Array.isArray(chunks)) {
      chunks.forEach((chunk: any) => {
        if (chunk?.web?.uri) {
          sources.push({
            title: chunk.web.title || "Reference Link",
            url: chunk.web.uri
          });
        }
      });
    }

    // De-duplicate sources
    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values()).slice(0, 5);

    res.json({
      subtasks,
      sources: uniqueSources,
      quotaExceeded: false
    });
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.warn("Gemini breakdown-task handled gracefully via fallback. Notice:", errorMsg);

    const isQuota = errorMsg.includes("429") || 
                    errorMsg.includes("RESOURCE_EXHAUSTED") || 
                    errorMsg.includes("quota") ||
                    errorMsg.includes("ResourceExhausted") ||
                    errorMsg.includes("exhausted");

    res.json({
      subtasks: generateSmartFallback(title, description),
      sources: [],
      quotaExceeded: isQuota,
      error: isQuota ? "QUOTA_EXCEEDED" : errorMsg
    });
  }
});

// -------------------------------------------------------------
// 4. Voice assistant & NLP Parser
// -------------------------------------------------------------
app.post("/api/voice-command", async (req, res) => {
  let { commandText, currentDate } = req.body;

  commandText = validateString(commandText, 500);
  if (!commandText) {
    res.status(400).json({ error: "Command text is required, must be a non-empty string under 500 characters." });
    return;
  }

  if (currentDate && !isValidDate(currentDate)) {
    currentDate = new Date().toISOString();
  } else {
    currentDate = currentDate || new Date().toISOString();
  }

  const prompt = `
  You are 'FlowMate' productivity assistant.
  The user can use natural language voice commands to capture, prioritize, complete tasks, update tasks, sync tasks, or navigate the dashboard.
  Current Date: ${currentDate}
  Command: "${commandText}"

  Determine what action they are trying to perform and parse the necessary fields.
  Possible actions to trigger:
  - "ADD_TASK": User wants to add a task (e.g. "Add a Math homework due tomorrow at 5pm", "I have a meeting with Sarah next Monday at 10 AM", "Need to pay electricity bill by Friday").
    Parse:
    * title: string
    * category: "Assignment" | "Meeting" | "Bill" | "Work" | "Personal" | "Other"
    * deadline: "YYYY-MM-DDTHH:MM" (Infer logically from the currentDate and words like 'tomorrow', 'Friday', 'next Monday', 'next week')
    * description: string
    * priority: "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important" (Infer reasonably based on words or category)
  - "COMPLETE_TASK": User wants to finish a task (e.g. "Done with Math homework", "Check off my bill task").
    Parse:
    * searchKeyword: string (e.g. "Math", "bill")
  - "UPDATE_TASK_STATUS": User wants to update or change the completion status of a task (e.g. "Mark Math homework as pending", "Set my bill to incomplete", "Set meeting with Sarah to completed").
    Parse:
    * searchKeyword: string (to find the task, e.g. "Math", "bill", "Sarah")
    * status: "completed" | "pending"
  - "UPDATE_TASK": User wants to modify or edit details of an existing task (e.g. "Rename Math homework to Algebra", "change deadline of Science project to next Friday at 6pm", "change priority of pay electricity bill to urgent-important", "change category of my focus session to Work").
    Parse:
    * searchKeyword: string (to identify the task to edit, e.g. "Math", "Science", "electricity")
    * updates: object (can contain any of: title, deadline, priority, category, description)
  - "SYNC_CALENDAR": User wants to sync a task to Google Calendar (e.g. "Sync Math task to calendar", "Add my meeting with Sarah to Google Calendar", "push bill to my google calendar").
    Parse:
    * searchKeyword: string (to find the task to sync, e.g. "Math", "meeting", "bill")
  - "SHOW_VIEW": User wants to jump to a specific view (e.g. "Go to priority board", "Show me the calendar", "Open the voice assistant").
    Parse:
    * view: "dashboard" | "prioritizer" | "calendar" | "agent"
  - "GENERAL_RESPONSE": The user is just talking, asking for advice, or greeting.
    Provide an encouraging, direct productivity tip.

  Format your response as strict JSON:
  {
    "speechResponse": "A supportive, conversational verbal confirmation to be spoken back, e.g. 'Got it! I have synced your Math Homework task to your Google Calendar.'",
    "parsedAction": {
      "type": "ADD_TASK" | "COMPLETE_TASK" | "UPDATE_TASK_STATUS" | "UPDATE_TASK" | "SYNC_CALENDAR" | "SHOW_VIEW" | "GENERAL_RESPONSE",
      "payload": object (containing the parsed variables)
    }
  }
  `;

  try {
    const result = await generateJSON(prompt, "You are a smart, rapid-responding productivity interface that converts casual speech inputs into structured database operations.");
    res.json(result);
  } catch (error: any) {
    console.warn("Gemini voice-command handled gracefully via fallback. Notice:", error.message);

    // Natural text parsing fallback
    const lower = commandText.toLowerCase();
    let speechResponse = "I hear you, but I couldn't connect to my brain. Here is my offline analysis: ";
    let type = "GENERAL_RESPONSE";
    let payload: any = {};

    if (lower.includes("add") || lower.includes("due") || lower.includes("need to") || lower.includes("assignment") || lower.includes("meeting") || lower.includes("bill")) {
      type = "ADD_TASK";
      const hasTomorrow = lower.includes("tomorrow");
      const hasMonday = lower.includes("monday");
      const hasFriday = lower.includes("friday");

      let category: any = "Personal";
      if (lower.includes("assignment") || lower.includes("homework") || lower.includes("class")) category = "Assignment";
      else if (lower.includes("meeting") || lower.includes("session") || lower.includes("call")) category = "Meeting";
      else if (lower.includes("bill") || lower.includes("pay")) category = "Bill";
      else if (lower.includes("work") || lower.includes("project")) category = "Work";

      // Calculate simple offset dates
      const baseDate = new Date(currentDate || Date.now());
      if (hasTomorrow) baseDate.setDate(baseDate.getDate() + 1);
      else if (hasFriday) {
        const dist = (5 - baseDate.getDay() + 7) % 7;
        baseDate.setDate(baseDate.getDate() + (dist === 0 ? 7 : dist));
      } else if (hasMonday) {
        const dist = (1 - baseDate.getDay() + 7) % 7;
        baseDate.setDate(baseDate.getDate() + (dist === 0 ? 7 : dist));
      } else {
        baseDate.setDate(baseDate.getDate() + 2); // Default 2 days
      }
      baseDate.setHours(9, 30, 0, 0); // 9:30 AM

      // Title parsing
      let title = "Voice Created Task";
      const cleanText = commandText.replace(/add /i, "").replace(/need to /i, "").replace(/i have an? /i, "");
      title = cleanText.split(" due ")[0].split(" tomorrow")[0].split(" next ")[0];
      title = title.charAt(0).toUpperCase() + title.slice(1);

      payload = {
        title,
        category,
        deadline: baseDate.toISOString().slice(0, 16),
        description: `Created via voice control: "${commandText}"`,
        priority: category === "Assignment" || category === "Bill" ? "urgent-important" : "not-urgent-important"
      };
      speechResponse = `Added task "${title}" categorized as ${category}, due on ${baseDate.toLocaleDateString()} at 9:30 AM.`;
    } else if (lower.includes("sync") && (lower.includes("calendar") || lower.includes("google"))) {
      type = "SYNC_CALENDAR";
      let keyword = "task";
      const matches = lower.match(/(?:sync|add|push) (.*) to (?:google )?calendar/i);
      if (matches && matches[1]) {
        keyword = matches[1].replace(/my /gi, "").trim();
      } else {
        const simpleMatch = lower.replace(/sync /i, "").replace(/ to calendar/i, "").replace(/google/i, "").trim();
        if (simpleMatch) keyword = simpleMatch;
      }
      payload = { searchKeyword: keyword };
      speechResponse = `Requesting Google Calendar sync for task matching "${keyword}".`;
    } else if (lower.includes("status") || lower.includes("mark") || lower.includes("set")) {
      type = "UPDATE_TASK_STATUS";
      let keyword = "task";
      let targetStatus: "completed" | "pending" = "completed";
      if (lower.includes("pending") || lower.includes("incomplete") || lower.includes("active") || lower.includes("undo") || lower.includes("not done")) {
        targetStatus = "pending";
      }
      
      const matches = lower.match(/(?:mark|set) (.*) as (?:pending|incomplete|completed|done|active)/i);
      if (matches && matches[1]) {
        keyword = matches[1].replace(/my /gi, "").trim();
      } else {
        const clean = lower.replace(/mark /i, "").replace(/set /i, "").replace(/ as .*/i, "").trim();
        if (clean) keyword = clean;
      }
      payload = { searchKeyword: keyword, status: targetStatus };
      speechResponse = `Setting status of your task matching "${keyword}" to ${targetStatus}.`;
    } else if (lower.includes("rename") || lower.includes("change") || lower.includes("update") || lower.includes("edit")) {
      type = "UPDATE_TASK";
      let keyword = "task";
      let updates: any = {};
      
      if (lower.includes("rename") || lower.includes("title")) {
        const renameMatch = lower.match(/(?:rename|change title of) (.*) to (.*)/i);
        if (renameMatch && renameMatch[1] && renameMatch[2]) {
          keyword = renameMatch[1].replace(/my /gi, "").trim();
          updates.title = renameMatch[2].charAt(0).toUpperCase() + renameMatch[2].slice(1);
        }
      } else if (lower.includes("deadline") || lower.includes("due")) {
        const dueMatch = lower.match(/(?:change deadline of|change due date of) (.*) to (.*)/i);
        if (dueMatch && dueMatch[1]) {
          keyword = dueMatch[1].replace(/my /gi, "").trim();
        }
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + 1);
        baseDate.setHours(9, 30, 0, 0);
        updates.deadline = baseDate.toISOString().slice(0, 16);
      } else if (lower.includes("priority")) {
        const priorityMatch = lower.match(/(?:change priority of) (.*) to (.*)/i);
        if (priorityMatch && priorityMatch[1]) {
          keyword = priorityMatch[1].replace(/my /gi, "").trim();
        }
        updates.priority = "urgent-important";
      }
      payload = { searchKeyword: keyword, updates };
      speechResponse = `Updating details for task matching "${keyword}".`;
    } else if (lower.includes("done") || lower.includes("complete") || lower.includes("finish") || lower.includes("check off")) {
      type = "COMPLETE_TASK";
      let keyword = "task";
      const matches = lower.match(/(?:done with|complete|finish|check off) (.*)/i);
      if (matches && matches[1]) {
        keyword = matches[1].replace(/my /gi, "").trim();
      }
      payload = { searchKeyword: keyword };
      speechResponse = `Marked your task matching "${keyword}" as complete. Fantastic work finishing it!`;
    } else if (lower.includes("go to") || lower.includes("show") || lower.includes("open") || lower.includes("navigate")) {
      type = "SHOW_VIEW";
      let view = "dashboard";
      if (lower.includes("calendar")) view = "calendar";
      else if (lower.includes("prioritizer") || lower.includes("board") || lower.includes("matrix")) view = "prioritizer";
      else if (lower.includes("agent") || lower.includes("plan") || lower.includes("autonomous")) view = "agent";
      
      payload = { view };
      speechResponse = `Navigating directly to your ${view}.`;
    } else {
      speechResponse = "Hello! I am your FlowMate assistant. Try saying: 'Add Chemistry assignment due tomorrow night', 'Navigate to calendar', or 'Done with my meeting'. How can I assist your focus today?";
    }

    res.json({
      speechResponse,
      parsedAction: { type, payload }
    });
  }
});

// -------------------------------------------------------------
// Vite or Static Assets handling
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
