import React, { useState, useEffect } from "react";
import { 
  Brain, LayoutDashboard, Grid, Calendar as CalendarIcon, Sparkles, Mic, 
  User as UserIcon, Lock, CheckCircle2, ShieldAlert, LogOut, Clock, Code, AlertCircle, RefreshCw,
  Sun, Moon
} from "lucide-react";
import FlowArcIcon from "./components/FlowArcIcon";
import { useAppState } from "./hooks/useAppState";
import Dashboard from "./components/Dashboard";
import PrioritizationMatrix from "./components/PrioritizationMatrix";
import CalendarView from "./components/CalendarView";
import AutonomousAgent from "./components/AutonomousAgent";
import VoiceAssistant from "./components/VoiceAssistant";
import TaskDetailDrawer from "./components/TaskDetailDrawer";
import DeadlineReminder from "./components/DeadlineReminder";
import { initAuth, googleSignIn, logout as googleLogout } from "./lib/auth";
import { syncTaskToGoogleCalendar } from "./lib/calendar";
import { User as FirebaseUser } from "firebase/auth";

export default function App() {
  const [activeView, setActiveView] = useState<string>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("flowmate_theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("flowmate_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("lastminute_auth") === "true";
  });
  const [authError, setAuthError] = useState("");
  const [authTab, setAuthTab] = useState<"google" | "local">("google");

  const [demoUsername, setDemoUsername] = useState<string>(() => {
    return localStorage.getItem("flowmate_demo_username") || "";
  });

  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [showQuotaWarning, setShowQuotaWarning] = useState(true);

  const state = useAppState();

  const checkQuotaStatus = async () => {
    try {
      const res = await fetch("/api/quota-status");
      const data = await res.json();
      setQuotaExceeded(data.quotaExceeded);
    } catch (err) {
      console.error("Failed to check quota status:", err);
    }
  };

  // Check quota status periodically
  useEffect(() => {
    checkQuotaStatus();
    const interval = setInterval(checkQuotaStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load Firebase Auth on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthenticated(true);
        localStorage.setItem("lastminute_auth", "true");
        setIsLoadingAuth(false);
      },
      () => {
        setIsLoadingAuth(false);
      }
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleLocalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = demoUsername.trim();
    if (finalName.length >= 2) {
      setDemoUsername(finalName);
      localStorage.setItem("flowmate_demo_username", finalName);
      setIsAuthenticated(true);
      localStorage.setItem("lastminute_auth", "true");
      setAuthError("");
    } else {
      setAuthError("Please enter your name (minimum 2 characters) to proceed.");
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setIsAuthenticated(true);
        localStorage.setItem("lastminute_auth", "true");
      }
    } catch (err: any) {
      console.error("Google Sign-In failed:", err);
      setAuthError(err.message || "Google Authentication failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await googleLogout();
    } catch (err) {
      console.error("Google logout error:", err);
    }
    setGoogleUser(null);
    setGoogleToken(null);
    setIsAuthenticated(false);
    setDemoUsername("");
    localStorage.removeItem("flowmate_demo_username");
    localStorage.removeItem("lastminute_auth");
  };

  // Google Calendar integration task sync
  const handleSyncToCalendar = async (task: any) => {
    if (!googleToken) {
      alert("Please connect your Google Account first to sync tasks to Google Calendar.");
      return;
    }
    try {
      await syncTaskToGoogleCalendar(task, googleToken);
      state.editTask(task.id, { googleCalendarSynced: true });
    } catch (err: any) {
      console.error(err);
      alert(`Google Calendar Sync failed: ${err.message || err}`);
      throw err;
    }
  };

  if (!isAuthenticated && !isLoadingAuth) {
    return (
      <div id="auth-portal" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Visual background decorations */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/10 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FlowArcIcon size="lg" />
            </div>
            <h1 className="font-sans font-bold text-2xl text-slate-100 tracking-tight">FlowMate</h1>
            <p className="text-xs text-slate-400 font-sans max-w-xs mx-auto leading-relaxed">
              AI-powered tactical priority analyzer & Google Calendar sync to clear your agenda before deadlines slide.
            </p>
          </div>

          {/* Clean Dual Tabs Selector */}
          <div className="flex border-b border-slate-800 mb-6" id="auth-tabs">
            <button
              id="tab-google-btn"
              type="button"
              onClick={() => {
                setAuthTab("google");
                setAuthError("");
              }}
              className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider text-center border-b-2 transition-all duration-200 cursor-pointer ${
                authTab === "google"
                  ? "border-indigo-500 text-indigo-400 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Google Account
            </button>
            <button
              id="tab-local-btn"
              type="button"
              onClick={() => {
                setAuthTab("local");
                setAuthError("");
              }}
              className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider text-center border-b-2 transition-all duration-200 cursor-pointer ${
                authTab === "local"
                  ? "border-indigo-500 text-indigo-400 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              Local Space
            </button>
          </div>

          <div className="space-y-4">
            {authTab === "google" ? (
              /* Google Sign-In Tab View */
              <div className="space-y-4 py-2 animate-fade-in">
                <p className="text-xs text-slate-400 leading-relaxed text-center">
                  Sign in with your Google or Gmail account to enable real-time automatic calendar updates and prioritize meetings.
                </p>
                <button
                  id="google-signin-btn"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 py-3 px-4 rounded-xl font-sans font-medium text-xs shadow-sm transition-all duration-300 active:scale-98 cursor-pointer"
                >
                  <div className="w-4 h-4 shrink-0">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span>Sign in with Google / Gmail</span>
                </button>
              </div>
            ) : (
              /* Local Workspace Tab View */
              <form id="auth-local-form" onSubmit={handleLocalLogin} className="space-y-4 py-2 animate-fade-in">
                <p className="text-xs text-slate-400 leading-relaxed text-center mb-2">
                  Launch a localized workspace instantly on your browser. Perfect for offline-first usage without any cloud syncing.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">Your Name</label>
                  <div className="relative">
                    <input
                      id="demo-username-input"
                      type="text"
                      placeholder="Enter your name to access"
                      value={demoUsername}
                      onChange={(e) => setDemoUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                      required
                      autoFocus
                    />
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  id="auth-submit-btn"
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-sans font-medium text-xs shadow-md transition-all duration-300 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Go to Workspace →</span>
                </button>
              </form>
            )}

            {authError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-950/20 border border-red-900/40 p-3 rounded-lg mt-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <p className="text-[10px] font-sans leading-snug">{authError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Dynamic Header */}
      <header id="app-header" className="bg-slate-900/60 border-b border-slate-850 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shadow-md">
              <FlowArcIcon size="sm" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-sm tracking-tight text-slate-100">FlowMate</h1>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 border border-slate-850 p-1.5 rounded-xl shrink-0">
            <button
              id="nav-dash-btn"
              onClick={() => setActiveView("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ${
                activeView === "dashboard" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </button>
            
            <button
              id="nav-matrix-btn"
              onClick={() => setActiveView("prioritizer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ${
                activeView === "prioritizer" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Eisenhower Matrix
            </button>

            <button
              id="nav-cal-btn"
              onClick={() => setActiveView("calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ${
                activeView === "calendar" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Calendar Plan
            </button>

            <button
              id="nav-agent-btn"
              onClick={() => setActiveView("agent")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ${
                activeView === "agent" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Agent Planner
            </button>

            <button
              id="nav-voice-btn"
              onClick={() => setActiveView("voice")}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ${
                activeView === "voice" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> AI Navigator (NAVI)
            </button>
          </nav>

          {/* User Profile dropdown or status */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Color Mode Switch Button */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 rounded-xl transition cursor-pointer flex items-center justify-center shadow-sm shrink-0"
              title={theme === "dark" ? "Switch to Teal + Coral Light Mode" : "Switch to Navy + Amber Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
            </button>

            {googleUser ? (
              <div className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-900 border border-slate-800 rounded-xl max-w-[140px] sm:max-w-none shrink-0">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <div className="hidden sm:flex flex-col text-left truncate">
                  <span className="text-[10px] font-mono text-slate-200 leading-none truncate max-w-[80px] md:max-w-[120px]">{googleUser.email}</span>
                  <span className="text-[8px] font-mono text-emerald-400 mt-0.5 leading-none">Connected</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl shrink-0">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-mono text-slate-400">{demoUsername || "rajput.anurag124@gmail.com"}</span>
                  <span className="text-[8px] font-mono text-amber-400 leading-none ml-1">
                    {demoUsername ? "Demo Workspace" : "Local Sandbox"}
                  </span>
                </div>
                <button
                  id="connect-google-header-btn"
                  onClick={handleGoogleLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-900 rounded-xl text-[10px] font-medium transition cursor-pointer shadow-sm shrink-0"
                  title="Connect Google Account to sync Google Calendar & Gmail"
                >
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span className="font-sans shrink-0">
                    <span className="inline md:hidden">Connect</span>
                    <span className="hidden md:inline">Connect Google</span>
                  </span>
                </button>
              </div>
            )}

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-red-400 transition cursor-pointer shrink-0 flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>

        </div>
      </header>

      {/* Tablet & Mobile Navigation Sub-bar */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-850 p-2 sm:p-3 flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto select-none shrink-0">
        <button 
          id="mob-dash-btn" 
          onClick={() => setActiveView("dashboard")} 
          className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-xl font-medium transition shrink-0 ${
            activeView === "dashboard" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="inline sm:hidden">Dash</span>
          <span className="hidden sm:inline">Dashboard</span>
        </button>
        <button 
          id="mob-matrix-btn" 
          onClick={() => setActiveView("prioritizer")} 
          className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-xl font-medium transition shrink-0 ${
            activeView === "prioritizer" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="inline sm:hidden">Matrix</span>
          <span className="hidden sm:inline">Eisenhower Matrix</span>
        </button>
        <button 
          id="mob-cal-btn" 
          onClick={() => setActiveView("calendar")} 
          className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-xl font-medium transition shrink-0 ${
            activeView === "calendar" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="inline sm:hidden">Calendar</span>
          <span className="hidden sm:inline">Calendar Plan</span>
        </button>
        <button 
          id="mob-agent-btn" 
          onClick={() => setActiveView("agent")} 
          className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-xl font-medium transition shrink-0 ${
            activeView === "agent" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="inline sm:hidden">Agent</span>
          <span className="hidden sm:inline">AI Agent Planner</span>
        </button>
        <button 
          id="mob-voice-btn" 
          onClick={() => setActiveView("voice")} 
          className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-xl font-medium transition shrink-0 ${
            activeView === "voice" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="inline sm:hidden">NAVI</span>
          <span className="hidden sm:inline">AI Navigator</span>
        </button>
      </div>

      {/* Main Content Workspace */}
      <main id="app-workspace" className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 md:py-8">
        
        {quotaExceeded && showQuotaWarning && (
          <div className="mb-6 p-4 bg-amber-950/40 border border-amber-900/60 rounded-2xl flex items-start gap-3.5 shadow-sm text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="font-sans font-semibold text-xs text-slate-100 tracking-tight">Gemini API Quota Fully Exhausted (429 Fallback Active)</h4>
              <p className="text-[11px] text-amber-300/90 leading-relaxed font-sans">
                We've automatically enabled <strong>NAVI's Smart Offline Engine</strong> because your Gemini Free Tier API Key has reached its daily quota limit (20 requests/day). 
                All features—including task matrix placements, subtask breakdown, voice processing, and coaching advisors—will continue to operate completely offline using local timeline calculators.
              </p>
              <div className="pt-1.5 flex items-center gap-3">
                <a 
                  href="https://ai.google.dev/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] bg-amber-900/40 hover:bg-amber-900/60 text-white font-mono px-2 py-0.5 rounded border border-amber-800 transition"
                >
                  Configure Custom Key
                </a>
                <button 
                  onClick={() => setShowQuotaWarning(false)} 
                  className="text-[10px] text-amber-400/70 hover:text-amber-400 font-sans underline cursor-pointer"
                >
                  Dismiss notice
                </button>
              </div>
            </div>
          </div>
        )}

        {activeView === "dashboard" && (
          <Dashboard
            tasks={state.tasks}
            habits={state.habits}
            recommendations={state.recommendations}
            metrics={state.metrics}
            onAddTask={state.addTask}
            onToggleStatus={state.toggleStatus}
            onToggleHabit={state.toggleHabit}
            onCreateHabit={state.createHabit}
            onSelectTask={state.setSelectedTask}
            onTriggerAIRecommendations={() => state.triggerAIRecommendations()}
            isRecommendationLoading={state.isRecommendationLoading}
          />
        )}

        {activeView === "prioritizer" && (
          <PrioritizationMatrix
            tasks={state.tasks}
            onAddTask={(title, category, deadline, priority) => {
              state.addTask(title, category, deadline, priority);
            }}
            onToggleStatus={state.toggleStatus}
            onDeleteTask={state.deleteTask}
            onSelectTask={state.setSelectedTask}
            onEditTask={state.editTask}
          />
        )}

        {activeView === "calendar" && (
          <CalendarView
            tasks={state.tasks}
            onScheduleTask={state.scheduleTask}
            onSelectTask={state.setSelectedTask}
            onAddTaskAtDate={(dateStr) => {
              const title = prompt(`Enter task title for ${dateStr}:`);
              if (!title) return;
              state.addTask(title, "Work", `${dateStr}T09:30`);
            }}
          />
        )}

        {activeView === "agent" && (
          <AutonomousAgent
            onAdoptTasks={state.adoptTasks}
          />
        )}

        {activeView === "voice" && (
          <VoiceAssistant
            tasks={state.tasks}
            onAddTask={state.addPreParsedTask}
            onCompleteTask={state.completeTaskByKeyword}
            onNavigate={(view) => setActiveView(view)}
            onEditTask={state.editTask}
            onToggleStatus={state.toggleStatus}
            onSyncToCalendar={handleSyncToCalendar}
            googleToken={googleToken}
          />
        )}

      </main>

      {/* Slide-out Drawer Panel */}
      {state.selectedTask && (
        <TaskDetailDrawer
          task={state.selectedTask}
          onClose={() => state.setSelectedTask(null)}
          onToggleStatus={state.toggleStatus}
          onUpdateSubtask={state.updateSubtask}
          onEditTask={state.editTask}
          onDeleteTask={state.deleteTask}
          onLogFocusSession={state.logFocusSession}
          googleToken={googleToken}
          onSyncToCalendar={handleSyncToCalendar}
          onConnectGoogle={handleGoogleLogin}
        />
      )}

      <DeadlineReminder 
        tasks={state.tasks} 
        onToggleStatus={state.toggleStatus} 
      />

      {/* Visual Footer */}
      <footer id="app-footer" className="bg-slate-900/30 border-t border-slate-850 py-6 text-center">
        <p className="text-[11px] font-mono text-slate-500">
          FlowMate Co-Pilot • Container Running on Port 3000 • Local Sandbox Sync Active
        </p>
      </footer>

    </div>
  );
}
