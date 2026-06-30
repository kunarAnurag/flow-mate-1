import React, { useState } from "react";
import { AlertTriangle, Clock, Plus, CheckSquare, ChevronRight, HelpCircle, User, Trash2, Calendar } from "lucide-react";
import { Task, PriorityType } from "../types";

interface PrioritizationMatrixProps {
  tasks: Task[];
  onAddTask: (title: string, category: string, deadline: string, priority: PriorityType) => void;
  onToggleStatus: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onSelectTask: (task: Task) => void;
  onEditTask?: (taskId: string, updatedFields: Partial<Task>) => void;
}

export default function PrioritizationMatrix({
  tasks,
  onAddTask,
  onToggleStatus,
  onDeleteTask,
  onSelectTask,
  onEditTask
}: PrioritizationMatrixProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'list'>('matrix');

  // New state variables for direct task adding without prompt()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<PriorityType>("urgent-important");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Work");
  const [deadline, setDeadline] = useState("");

  const handleOpenAddModal = (priority: PriorityType) => {
    setSelectedPriority(priority);
    setTitle("");
    setCategory("Work");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    setDeadline(tomorrow.toISOString().slice(0, 16));
    setIsAddModalOpen(true);
  };

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask(title, category, deadline, selectedPriority);
    setIsAddModalOpen(false);
  };

  const getQuadrantTasks = (priority: PriorityType) => {
    return tasks.filter(t => t.priority === priority && t.status === 'pending');
  };

  const getCompletedCount = (priority: PriorityType) => {
    return tasks.filter(t => t.priority === priority && t.status === 'completed').length;
  };

  const quadrants: { id: PriorityType; title: string; subtitle: string; color: string; bg: string; border: string; action: string }[] = [
    {
      id: "urgent-important",
      title: "DO FIRST",
      subtitle: "Urgent & Important",
      color: "text-red-400",
      bg: "bg-red-950/20",
      border: "border-red-900/40",
      action: "Do immediately to avoid critical consequences."
    },
    {
      id: "not-urgent-important",
      title: "SCHEDULE",
      subtitle: "Important, Not Urgent",
      color: "text-indigo-400",
      bg: "bg-indigo-950/20",
      border: "border-indigo-900/40",
      action: "Allocate deep timeblocks in your calendar."
    },
    {
      id: "urgent-not-important",
      title: "DELEGATE / RELEGATE",
      subtitle: "Urgent, Not Important",
      color: "text-amber-400",
      bg: "bg-amber-950/20",
      border: "border-amber-900/40",
      action: "Optimize or automate so it doesn't sap mental energy."
    },
    {
      id: "not-urgent-not-important",
      title: "ELIMINATE / POSTPONE",
      subtitle: "Not Urgent & Not Important",
      color: "text-slate-400",
      bg: "bg-slate-950/30",
      border: "border-slate-800",
      action: "Drop or handle only when energy is fully surplus."
    }
  ];

  return (
    <div id="prioritization-matrix-section" className="space-y-6">
      {/* Visual Header / Controls */}
      <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl">
        <div>
          <h2 className="font-sans font-bold text-xl text-slate-100 tracking-tight flex items-center gap-2">
            <span>Prioritization Matrix</span>
            <span className="text-xs font-mono font-normal bg-indigo-950 border border-indigo-900 text-indigo-400 px-2 py-0.5 rounded-full">
              {tasks.filter(t => t.status === 'pending').length} Action Items
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Eisenhower Matrix sorting your schedule by urgency and consequence.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
          <button
            id="tab-matrix-btn"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 text-xs font-sans rounded-md transition ${activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Matrix Grid
          </button>
          <button
            id="tab-list-btn"
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 text-xs font-sans rounded-md transition ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Categorized List
          </button>
        </div>
      </div>

      {activeTab === 'matrix' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quadrants.map(quad => {
            const quadTasks = getQuadrantTasks(quad.id);
            const compCount = getCompletedCount(quad.id);
            return (
              <div
                key={quad.id}
                id={`quadrant-${quad.id}`}
                className={`flex flex-col border ${quad.border} ${quad.bg} rounded-2xl p-5 min-h-[300px] transition-all hover:shadow-lg relative overflow-hidden`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`text-xs font-mono font-bold tracking-wider ${quad.color}`}>
                      {quad.title}
                    </span>
                    <h3 className="font-sans font-semibold text-slate-200 text-sm mt-0.5">
                      {quad.subtitle}
                    </h3>
                  </div>
                  <button
                    id={`add-task-${quad.id}-btn`}
                    onClick={() => handleOpenAddModal(quad.id)}
                    className="p-1.5 bg-slate-950 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 rounded-lg text-slate-400 hover:text-white transition shadow-sm cursor-pointer"
                    title="Add task directly to this quadrant"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 italic mb-4 font-sans border-b border-slate-800/60 pb-2">
                  {quad.action}
                </p>

                {/* Task Stack */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[190px] pr-1 scrollbar-thin">
                  {quadTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                      <CheckSquare className="w-8 h-8 text-slate-700 mb-1 opacity-40" />
                      <p className="text-xs text-slate-500 font-sans">No pending tasks</p>
                      {compCount > 0 && (
                        <p className="text-[10px] text-indigo-400 font-mono mt-0.5">{compCount} cleared this session</p>
                      )}
                    </div>
                  ) : (
                    quadTasks.map(task => (
                      <div
                        key={task.id}
                        id={`task-item-${task.id}`}
                        onClick={() => onSelectTask(task)}
                        className="group bg-slate-950/90 border border-slate-800/80 hover:border-indigo-500/50 p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition shadow-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            id={`toggle-${task.id}-btn`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStatus(task.id);
                            }}
                            className="w-4 h-4 rounded border border-slate-700 hover:border-indigo-500 flex items-center justify-center text-indigo-400 transition hover:bg-indigo-950/30"
                          >
                            <span className="w-2 h-2 rounded-sm bg-transparent group-hover:bg-indigo-500/20"></span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-sans font-medium text-slate-200 truncate group-hover:text-indigo-300 transition">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                                {task.category}
                              </span>
                              {task.aiAnalysis?.riskOfMissing === 'high' && (
                                <span className="text-[9px] font-mono text-red-400 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> RISK
                                </span>
                              )}
                              {task.deadline && (
                                <span className="text-[9px] font-mono text-slate-500 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {new Date(task.deadline).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                </span>
                              )}
                            </div>
                            {onEditTask && (
                              <select
                                id={`select-priority-grid-${task.id}`}
                                value={task.priority}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  onEditTask(task.id, { priority: e.target.value as any });
                                }}
                                className="mt-1.5 w-full max-w-[130px] block text-[9px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500 transition cursor-pointer font-sans"
                              >
                                <option value="urgent-important">🔴 Do First</option>
                                <option value="not-urgent-important">🔵 Schedule</option>
                                <option value="urgent-not-important">🟡 Delegate</option>
                                <option value="not-urgent-not-important">⚪ Eliminate</option>
                              </select>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            id={`delete-task-${task.id}-btn`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                            className="p-1 text-slate-500 hover:text-red-400 transition"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6">
          <div className="space-y-6">
            {quadrants.map(quad => {
              const quadTasks = tasks.filter(t => t.priority === quad.id);
              return (
                <div key={quad.id} id={`list-section-${quad.id}`} className="space-y-2">
                  <h3 className={`font-mono text-xs font-bold tracking-widest ${quad.color} flex items-center gap-2`}>
                    <span>{quad.title}</span>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-500 font-normal">
                      {quadTasks.length} total
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quadTasks.length === 0 ? (
                      <div className="col-span-2 text-xs text-slate-600 italic py-2">
                        No tasks in this category
                      </div>
                    ) : (
                      quadTasks.map(task => (
                        <div
                          key={task.id}
                          id={`list-task-item-${task.id}`}
                          onClick={() => onSelectTask(task)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            task.status === 'completed'
                              ? 'bg-slate-950/40 border-slate-900/60 opacity-60'
                              : 'bg-slate-950 border-slate-800/80 hover:border-indigo-500/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              id={`checkbox-list-${task.id}`}
                              type="checkbox"
                              checked={task.status === 'completed'}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleStatus(task.id);
                              }}
                              className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                            />
                            <div className="min-w-0">
                              <p className={`text-xs font-sans font-medium text-slate-200 truncate ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                                {task.title}
                              </p>
                              <p className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                                {task.description || "No description."}
                              </p>
                              {onEditTask && task.status === 'pending' && (
                                <select
                                  id={`select-priority-list-${task.id}`}
                                  value={task.priority}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    onEditTask(task.id, { priority: e.target.value as any });
                                  }}
                                  className="mt-1 block text-[9px] bg-slate-900 border border-slate-800 text-slate-300 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer font-sans"
                                >
                                  <option value="urgent-important">🔴 Do First</option>
                                  <option value="not-urgent-important">🔵 Schedule</option>
                                  <option value="urgent-not-important">🟡 Delegate</option>
                                  <option value="not-urgent-not-important">⚪ Eliminate</option>
                                </select>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="text-[10px] font-mono text-slate-500">
                              {task.category}
                            </span>
                            <button
                              id={`delete-list-task-${task.id}-btn`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              className="text-slate-600 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Custom Add Task Modal */}
      {isAddModalOpen && (
        <div id="matrix-add-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in relative overflow-hidden">
            {/* Ambient accent header */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
              <h3 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Add Task to Quadrant</span>
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTaskSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="What assignment, meeting, or commitment needs clearing?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                  >
                    <option value="Work">💼 Work</option>
                    <option value="Personal">🏡 Personal</option>
                    <option value="Assignment">📝 Assignment</option>
                    <option value="Meeting">🤝 Meeting</option>
                    <option value="Errands">🛒 Errands</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Quadrant</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as PriorityType)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                  >
                    <option value="urgent-important">🔴 Do First (Urgent & Imp)</option>
                    <option value="not-urgent-important">🔵 Schedule (Not Urgent, Imp)</option>
                    <option value="urgent-not-important">🟡 Delegate (Urgent, Not Imp)</option>
                    <option value="not-urgent-not-important">⚪ Eliminate (Not Urgent, Not Imp)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Deadline</label>
                <input
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl font-sans font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-sans font-medium text-xs shadow-md transition cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
