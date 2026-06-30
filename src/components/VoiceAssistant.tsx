import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Volume2, Sparkles, MessageSquare } from "lucide-react";
import { motion } from "motion/react";
import { Task } from "../types";

interface VoiceAssistantProps {
  tasks: Task[];
  onAddTask: (task: Partial<Task>) => void;
  onCompleteTask: (keyword: string) => void;
  onNavigate: (view: string) => void;
  onEditTask?: (taskId: string, updatedFields: Partial<Task>) => void;
  onToggleStatus?: (taskId: string) => void;
  onSyncToCalendar?: (task: Task) => Promise<void>;
  googleToken?: string | null;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export default function VoiceAssistant({
  tasks,
  onAddTask,
  onCompleteTask,
  onNavigate,
  onEditTask,
  onToggleStatus,
  onSyncToCalendar,
  googleToken
}: VoiceAssistantProps) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [lastSpeech, setLastSpeech] = useState("Hi! I'm NAVI, your AI Navigator. Type or say a command to manage your schedule.");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [soundWaveBars, setSoundWaveBars] = useState<number[]>(Array(15).fill(4));
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [countdownSecs, setCountdownSecs] = useState<number>(0);
  
  // Chat timeline state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      sender: "assistant",
      text: "Hi! I'm NAVI, your AI Navigator. Type or say a command to manage your schedule.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const reengageTimeoutRef = useRef<any>(null);
  const reengageIntervalRef = useRef<any>(null);
  const sendDebounceTimeoutRef = useRef<any>(null);
  const accumulatedTextRef = useRef("");
  const shouldSubmitOnStopRef = useRef(false);

  // Keep accumulated text in sync
  useEffect(() => {
    accumulatedTextRef.current = inputText;
  }, [inputText]);

  // Auto scroll voice conversation feed to bottom
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, inputText, isLoading, isListening]);

  // Robustly retrieve an Indian accent voice, prioritizing Google Hindi
  const getIndianVoice = () => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    
    // 1. High Priority: Look specifically for Google Hindi ("Google हिन्दी" or "Google Hindi" / hi-IN)
    let googleHindiVoice = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase().replace("_", "-");
      return (
        (name.includes("google") && (name.includes("hindi") || name.includes("हिन्दी") || lang.startsWith("hi"))) ||
        (lang === "hi-in" && name.includes("google"))
      );
    });
    if (googleHindiVoice) return googleHindiVoice;

    // 2. Second Priority: Any Hindi voice (hi-IN)
    let generalHindiVoice = voices.find(v => {
      const lang = v.lang.toLowerCase().replace("_", "-");
      return lang === "hi-in" || lang.startsWith("hi");
    });
    if (generalHindiVoice) return generalHindiVoice;

    // 3. Third Priority: Google English India (en-IN)
    let googleEnIndVoice = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase().replace("_", "-");
      return lang === "en-in" && name.includes("google");
    });
    if (googleEnIndVoice) return googleEnIndVoice;

    // 4. Fourth Priority: Standard Indian English voice
    let voice = voices.find(v => {
      const lang = v.lang.toLowerCase().replace("_", "-");
      return lang === "en-in";
    });
    
    if (!voice) {
      voice = voices.find(v => {
        const name = v.name.toLowerCase();
        return name.includes("india") || name.includes("indian") || name.includes("en-in");
      });
    }

    if (!voice) {
      const indianNames = ["rishi", "veena", "heera", "ravi", "priya", "neerja", "dilip", "sangeeta"];
      voice = voices.find(v => {
        const name = v.name.toLowerCase();
        return indianNames.some(indianName => name.includes(indianName));
      });
    }

    return voice;
  };

  // Pre-load and register voice synthesis
  useEffect(() => {
    if ("speechSynthesis" in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        
        // Filter English and Hindi voices
        const filtered = voices.filter(v => {
          const l = v.lang.toLowerCase();
          return l.startsWith("en") || l.startsWith("hi");
        });

        // Sort: Place Google Hindi first, then any Hindi, then Google Indian English, then rest
        filtered.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aLang = a.lang.toLowerCase();
          const bLang = b.lang.toLowerCase();
          
          const aIsGoogleHindi = aLang.startsWith("hi") && aName.includes("google");
          const bIsGoogleHindi = bLang.startsWith("hi") && bName.includes("google");
          if (aIsGoogleHindi && !bIsGoogleHindi) return -1;
          if (!aIsGoogleHindi && bIsGoogleHindi) return 1;

          const aIsHindi = aLang.startsWith("hi");
          const bIsHindi = bLang.startsWith("hi");
          if (aIsHindi && !bIsHindi) return -1;
          if (!aIsHindi && bIsHindi) return 1;

          const aIsGoogleEn = aLang.startsWith("en-in") && aName.includes("google");
          const bIsGoogleEn = bLang.startsWith("en-in") && bName.includes("google");
          if (aIsGoogleEn && !bIsGoogleEn) return -1;
          if (!aIsGoogleEn && bIsGoogleEn) return 1;

          return 0;
        });

        setAvailableVoices(filtered);

        const defaultInd = getIndianVoice();
        if (defaultInd) {
          setSelectedVoice(defaultInd);
          setSelectedVoiceName(defaultInd.name);
        } else if (voices.length > 0) {
          const firstEng = voices.find(v => v.lang.toLowerCase().startsWith("en"));
          if (firstEng) {
            setSelectedVoice(firstEng);
            setSelectedVoiceName(firstEng.name);
          } else {
            setSelectedVoice(voices[0]);
            setSelectedVoiceName(voices[0].name);
          }
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
        if (reengageTimeoutRef.current) clearTimeout(reengageTimeoutRef.current);
        if (reengageIntervalRef.current) clearInterval(reengageIntervalRef.current);
        if (sendDebounceTimeoutRef.current) clearTimeout(sendDebounceTimeoutRef.current);
      };
    }
  }, []);

  // Initialize Web Speech API with continuous listening
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true; // MUST be true so user can see voice being captured live!
      rec.lang = "en-IN"; // Prefer Indian English for capturing spoken accents!

      rec.onstart = () => {
        setIsListening(true);
        startSoundWaveAnimation();
      };

      rec.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        // Build continuous transcript from the beginning of the results array to avoid duplicates
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        finalTranscript = finalTranscript.trim();
        interimTranscript = interimTranscript.trim();

        if (finalTranscript) {
          setInputText(finalTranscript + (interimTranscript ? `... ${interimTranscript}` : ""));
        } else if (interimTranscript) {
          setInputText(interimTranscript);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error", err);
        setIsListening(false);
        stopSoundWaveAnimation();

        let errorExplanation = "There was an issue starting speech recognition. Please check your microphone connection.";
        if (err.error === "not-allowed") {
          errorExplanation = "Microphone access is blocked. Please check your browser's address bar to grant permission, or try opening this app in a new tab for direct permission prompts.";
        } else if (err.error === "no-speech") {
          errorExplanation = "No speech was detected. Please try speaking again, or type your command directly into the input box below.";
        }

        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "assistant",
            text: `⚠️ [Voice Input Error]: ${errorExplanation}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      };

      rec.onend = () => {
        setIsListening(false);
        stopSoundWaveAnimation();
        
        // When user stops the mic, immediately process the accumulated voice command
        if (shouldSubmitOnStopRef.current) {
          shouldSubmitOnStopRef.current = false;
          const textToSubmit = accumulatedTextRef.current;
          if (textToSubmit.trim()) {
            handleSendCommand(textToSubmit);
          }
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (sendDebounceTimeoutRef.current) {
        clearTimeout(sendDebounceTimeoutRef.current);
      }
    };
  }, []);

  // Voice wave visualizer bars animation
  const startSoundWaveAnimation = () => {
    const animate = () => {
      setSoundWaveBars(Array(15).fill(0).map(() => Math.floor(Math.random() * 24) + 4));
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const stopSoundWaveAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setSoundWaveBars(Array(15).fill(4));
  };

  const triggerReengagement = () => {
    if (reengageTimeoutRef.current) clearTimeout(reengageTimeoutRef.current);
    if (reengageIntervalRef.current) clearInterval(reengageIntervalRef.current);
    
    let secondsLeft = 5;
    setCountdownSecs(secondsLeft);
    
    reengageIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      setCountdownSecs(Math.max(0, secondsLeft));
      if (secondsLeft <= 0) {
        if (reengageIntervalRef.current) {
          clearInterval(reengageIntervalRef.current);
          reengageIntervalRef.current = null;
        }
      }
    }, 1000);

    reengageTimeoutRef.current = setTimeout(() => {
      if (reengageIntervalRef.current) {
        clearInterval(reengageIntervalRef.current);
        reengageIntervalRef.current = null;
      }
      setCountdownSecs(0);
      
      if (recognitionRef.current) {
        try {
          setInputText("");
          recognitionRef.current.start();
        } catch (err) {
          console.log("Speech recognition was already active or couldn't start", err);
        }
      }
    }, 5000);
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        const indianVoice = getIndianVoice();
        if (indianVoice) {
          utterance.voice = indianVoice;
        }
      }
      
      // Optimize rate and pitch for a natural, clear delivery.
      // Slower rate is extremely effective for en-IN accents, making them sound professional and less robotic.
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        if (reengageTimeoutRef.current) {
          clearTimeout(reengageTimeoutRef.current);
          reengageTimeoutRef.current = null;
        }
        if (reengageIntervalRef.current) {
          clearInterval(reengageIntervalRef.current);
          reengageIntervalRef.current = null;
        }
        setCountdownSecs(0);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        // Removed auto-reengagement loop so microphone is never turned on automatically
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (reengageTimeoutRef.current) {
      clearTimeout(reengageTimeoutRef.current);
      reengageTimeoutRef.current = null;
    }
    if (reengageIntervalRef.current) {
      clearInterval(reengageIntervalRef.current);
      reengageIntervalRef.current = null;
    }
    setCountdownSecs(0);

    if (!recognitionRef.current) {
      alert("Speech recognition is not fully supported in this browser. Try entering commands manually below!");
      return;
    }

    if (isListening) {
      // User pressed the mic icon back to stop listening -> set submission flag and stop
      shouldSubmitOnStopRef.current = true;
      recognitionRef.current.stop();
    } else {
      setInputText("");
      shouldSubmitOnStopRef.current = false;
      recognitionRef.current.start();
    }
  };

  const handleSendCommand = async (textToSend?: string) => {
    if (sendDebounceTimeoutRef.current) {
      clearTimeout(sendDebounceTimeoutRef.current);
      sendDebounceTimeoutRef.current = null;
    }

    const command = textToSend || inputText;
    if (!command.trim()) return;

    if (reengageTimeoutRef.current) {
      clearTimeout(reengageTimeoutRef.current);
      reengageTimeoutRef.current = null;
    }
    if (reengageIntervalRef.current) {
      clearInterval(reengageIntervalRef.current);
      reengageIntervalRef.current = null;
    }
    setCountdownSecs(0);

    setIsLoading(true);
    setInputText("");

    // Add user spoken/typed command to the timeline instantly
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: command,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandText: command,
          currentDate: new Date().toISOString()
        })
      });

      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setLastSpeech(data.speechResponse);
        speakText(data.speechResponse);

        // Append AI response to timeline
        const assistantMsg: Message = {
          id: Math.random().toString(),
          sender: "assistant",
          text: data.speechResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Process parsed tasks or actions
        if (data.parsedAction) {
        const { type, payload } = data.parsedAction;
        
        // Helper to find task by search keyword
        const findTask = (keyword: string) => {
          if (!keyword) return null;
          const cleanKeyword = keyword.toLowerCase().trim();
          const pendingMatch = tasks.find(t => t.status === "pending" && t.title.toLowerCase().includes(cleanKeyword));
          if (pendingMatch) return pendingMatch;
          return tasks.find(t => t.title.toLowerCase().includes(cleanKeyword));
        };

        if (type === "ADD_TASK") {
          onAddTask(payload);
        } else if (type === "COMPLETE_TASK") {
          onCompleteTask(payload.searchKeyword);
        } else if (type === "UPDATE_TASK_STATUS") {
          const match = findTask(payload.searchKeyword);
          if (match && payload.status) {
            if (onEditTask) {
              onEditTask(match.id, { status: payload.status });
            } else if (onToggleStatus && match.status !== payload.status) {
              onToggleStatus(match.id);
            }
          } else if (!match && payload.searchKeyword) {
            const notFoundMsg = `I couldn't find any task matching "${payload.searchKeyword}" to update status.`;
            setMessages(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                sender: "assistant",
                text: notFoundMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
            ]);
            speakText(notFoundMsg);
          }
        } else if (type === "UPDATE_TASK") {
          const match = findTask(payload.searchKeyword);
          if (match && onEditTask && payload.updates) {
            onEditTask(match.id, payload.updates);
          } else if (!match && payload.searchKeyword) {
            const notFoundMsg = `I couldn't find any task matching "${payload.searchKeyword}" to edit.`;
            setMessages(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                sender: "assistant",
                text: notFoundMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
            ]);
            speakText(notFoundMsg);
          }
        } else if (type === "SYNC_CALENDAR") {
          const match = findTask(payload.searchKeyword);
          if (match) {
            if (!googleToken) {
              const connectMsg = "Please connect your Google Account first using the button at the bottom of the task detail panel to sync tasks to Google Calendar.";
              setMessages(prev => [
                ...prev,
                {
                  id: Math.random().toString(),
                  sender: "assistant",
                  text: `⚠️ [Google Calendar Sync]: ${connectMsg}`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
              ]);
              speakText("Please connect your Google Account first.");
            } else if (onSyncToCalendar) {
              try {
                await onSyncToCalendar(match);
                const successMsg = `Successfully synced "${match.title}" to your Google Calendar!`;
                setMessages(prev => [
                  ...prev,
                  {
                    id: Math.random().toString(),
                    sender: "assistant",
                    text: `📅 ${successMsg}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                ]);
                speakText(successMsg);
              } catch (err: any) {
                const errMsg = `Google Calendar Sync failed: ${err.message || err}`;
                setMessages(prev => [
                  ...prev,
                  {
                    id: Math.random().toString(),
                    sender: "assistant",
                    text: `⚠️ ${errMsg}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                ]);
                speakText("Google Calendar sync failed. Please try again.");
              }
            }
          } else if (payload.searchKeyword) {
            const notFoundMsg = `I couldn't find any task matching "${payload.searchKeyword}" to sync.`;
            setMessages(prev => [
              ...prev,
              {
                id: Math.random().toString(),
                sender: "assistant",
                text: notFoundMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
            ]);
            speakText(notFoundMsg);
          }
        } else if (type === "SHOW_VIEW") {
          onNavigate(payload.view);
        }
      }
    } else {
      const fallbackMsg = "The voice engine is temporarily warming up. Let's manage your timeline locally instead! Try typing or adding tasks directly.";
      setLastSpeech(fallbackMsg);
      speakText(fallbackMsg);
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "assistant",
          text: fallbackMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }
  } catch (e) {
      console.error(e);
      const errorMsg = "I ran into an issue connecting with my brain. Please try again.";
      setLastSpeech(errorMsg);
      speakText(errorMsg);

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "assistant",
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="voice-assistant-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full"></div>

      {/* Header section with status indicators */}
      <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-sm text-slate-100 tracking-tight">AI Navigator (NAVI)</h3>
            <p className="text-[10px] text-slate-500 font-mono">Hands-Free Path Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSpeaking && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
          )}
          {isListening && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-950/40 border border-red-900/30 text-red-400 rounded-lg text-[9px] font-mono tracking-wider uppercase">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
              Mic Active
            </span>
          )}
        </div>
      </div>

      {/* Indian accent voice status card */}
      <div className="flex items-center justify-between bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-2.5 mb-4 text-xs font-sans text-indigo-200">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
          <span className="text-lg shrink-0">🇮🇳</span>
          <div className="min-w-0 flex-1">
            <span className="font-medium text-slate-200 block truncate">NAVI-AI Navigator</span>
            <p className="mt-0.5 text-[10px] text-indigo-400 font-mono tracking-tight leading-tight truncate">
              Voice: NAVI-AI Navigator
            </p>
          </div>
        </div>
        <button
          onClick={() => speakText("Namaste! I am NAVI, your AI Navigator. Ready to navigate your productivity!")}
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-medium tracking-tight transition active:scale-95 whitespace-nowrap shrink-0"
        >
          Test Voice Accent
        </button>
      </div>

      {/* Visual Scrolling Conversation Feed (Shows captured voice and answers clearly) */}
      <div 
        id="voice-chat-feed" 
        className="bg-slate-950/80 border border-slate-850 rounded-xl p-4 mb-4 h-64 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.sender === "user" ? "self-end items-end animate-fade-in" : "self-start items-start animate-fade-in"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[9px] font-mono text-slate-500">{msg.timestamp}</span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                {msg.sender === "user" ? "You" : "NAVI"}
              </span>
            </div>
            <div
              className={`rounded-2xl px-3.5 py-2 text-xs font-sans leading-relaxed ${
                msg.sender === "user"
                  ? "bg-indigo-600/25 border border-indigo-500/30 text-indigo-100 rounded-tr-none"
                  : "bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Live captured voice text feedback inside the chat timeline itself! */}
        {isListening && inputText && (
          <div className="flex flex-col max-w-[85%] self-end items-end">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[9px] font-mono text-emerald-400 animate-pulse uppercase tracking-wider">Capturing voice...</span>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-100 rounded-2xl px-3.5 py-2 text-xs font-sans rounded-tr-none flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping shrink-0"></span>
              <span className="italic">{inputText}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col max-w-[85%] self-start items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">Thinking...</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl px-4 py-2.5 text-xs font-sans rounded-tl-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-150"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-225"></span>
            </div>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      {countdownSecs > 0 && (
        <div className="text-center text-[11px] text-amber-300 font-sans animate-pulse mb-3 bg-indigo-950/20 py-2 px-3 rounded-lg border border-indigo-900/40 flex items-center justify-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping shrink-0"></span>
          <span>NAVI is waiting for follow-up inputs... Listening in <strong>{countdownSecs}s</strong> (Or type/click microphone to speak now)</span>
        </div>
      )}

      {/* Visual dynamic sound waves */}
      <div className="flex justify-center items-center gap-[4px] h-10 mb-4 bg-slate-950/40 rounded-xl px-4">
        {soundWaveBars.map((height, i) => (
          <motion.div
            key={i}
            id={`sound-bar-${i}`}
            className={`w-1 rounded-full ${isListening ? "bg-red-400" : isSpeaking ? "bg-indigo-400" : "bg-slate-700"}`}
            animate={{ height: height }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ minHeight: "4px" }}
          />
        ))}
      </div>

      {/* Premium input control bar */}
      <div className="flex items-center gap-3">
        {/* Animated concentric pulsing ripples for microphone activity */}
        <div className="relative flex items-center justify-center shrink-0">
          {isListening && (
            <>
              <span className="absolute inline-flex h-20 w-20 rounded-full bg-red-500/30 animate-ping"></span>
              <span className="absolute inline-flex h-24 w-24 rounded-full bg-red-500/15 animate-pulse"></span>
              <div className="absolute inset-0 bg-red-500/10 blur-xl rounded-full scale-150 animate-pulse"></div>
            </>
          )}
          <button
            id="toggle-listening-btn"
            onClick={toggleListening}
            className={`relative z-10 p-4 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
              isListening 
                ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-red-500/40" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30 hover:scale-105"
            }`}
            title={isListening ? "Stop listening" : "Start speaking"}
          >
            {isListening ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <MicOff className="w-5 h-5" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Text backup input */}
        <div className="flex-1 flex gap-2 relative">
          <input
            id="voice-command-input"
            type="text"
            placeholder={isListening ? "Listening... Speak now!" : "Type a command e.g., 'Do Chemistry at 6pm'"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCommand()}
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 pr-12 transition font-sans"
            disabled={isLoading}
          />
          <button
            id="send-voice-command-btn"
            onClick={() => handleSendCommand()}
            disabled={isLoading || !inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-400 hover:text-indigo-300 disabled:text-slate-700 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Suggested prompts helper buttons */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider self-center mr-1">Quick prompts:</span>
        <button 
          onClick={() => {
            setInputText("Add grocery shopping due tomorrow at 5pm");
          }}
          className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 px-2 py-1 rounded transition"
        >
          "Add grocery shopping..."
        </button>
        <button 
          onClick={() => {
            setInputText("Go to priority board");
          }}
          className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 px-2 py-1 rounded transition"
        >
          "Go to priority board"
        </button>
      </div>
    </div>
  );
}
