"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  FolderPlus, GitPullRequest, FileArchive, Trash2, CheckCircle2, 
  AlertCircle, RefreshCw, BarChart2, PieChart as RePieChart, FileText, Database, ShieldAlert, Cpu, Bot, GitCompare
} from "lucide-react";
import { api, Repository } from "../lib/api";
import RepositoryExplorer from "./RepositoryExplorer";
import Heatmap from "./Heatmap";
import KnowledgeGraph from "./KnowledgeGraph";
import HealthMetrics from "./HealthMetrics";
import GitAnalytics from "./GitAnalytics";
import SecurityPanel from "./SecurityPanel";
import CICDPanel from "./CICDPanel";
import AIChat from "./AIChat";
import BenchmarkView from "./BenchmarkView";

// Recharts components
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip,
  Legend,
  CartesianGrid
} from "recharts";

const CHART_COLORS = ["#6366f1", "#10b981", "#f43f5e", "#eab308", "#8b5cf6", "#3b82f6", "#ec4899", "#f97316", "#14b8a6", "#f59e0b"];

export default function Dashboard() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  
  // Modals / Ingestion Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [ingestName, setIngestName] = useState("");
  const [ingestPath, setIngestPath] = useState("");
  const [ingestGitUrl, setIngestGitUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [ingestType, setIngestType] = useState<"local" | "git" | "zip">("local");
  
  const [loading, setLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [error, setError] = useState("");

  // Target Repository Analysis Data
  const [activeRepoData, setActiveRepoData] = useState<any>({
    topology: null,
    metrics: null,
    git: null,
    security: [],
    cicd: []
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // 1. Fetch repositories on load
  const loadRepos = async (selectLatest = false) => {
    setLoading(true);
    try {
      const data = await api.getRepositories();
      setRepositories(data);
      if (data.length > 0 && (!activeRepoId || selectLatest)) {
        // Select first completed repo by default
        const completed = data.find(r => r.status === "completed") || data[0];
        setActiveRepoId(completed.id);
      }
    } catch (err: any) {
      setError("Failed to fetch repository registry: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  // 2. Poll active repository status if pending/indexing
  useEffect(() => {
    if (!activeRepoId) return;
    const current = repositories.find((r) => r.id === activeRepoId);
    if (!current || (current.status !== "pending" && current.status !== "indexing")) return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.getRepository(activeRepoId);
        // Update list
        setRepositories((prev) => prev.map((r) => (r.id === activeRepoId ? updated : r)));
        
        if (updated.status === "completed" || updated.status === "failed") {
          clearInterval(interval);
          loadAnalysisDetails(activeRepoId);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRepoId, repositories]);

  // 3. Load analysis data for active completed repository
  const loadAnalysisDetails = async (id: number) => {
    setAnalysisLoading(true);
    try {
      const current = repositories.find((r) => r.id === id);
      if (!current || current.status !== "completed") {
        setActiveRepoData({ topology: null, metrics: null, git: null, security: [], cicd: [] });
        return;
      }
      
      const [topology, metrics, git, security, cicd] = await Promise.all([
        api.getTopology(id),
        api.getMetrics(id),
        api.getGitAnalytics(id),
        api.getSecurity(id),
        api.getCICD(id)
      ]);

      setActiveRepoData({ topology, metrics, git, security, cicd });
    } catch (err: any) {
      console.error(err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (activeRepoId) {
      loadAnalysisDetails(activeRepoId);
    }
  }, [activeRepoId]);

  // 4. Handle Ingestion Submission
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestLoading(true);
    setError("");
    try {
      let newRepo: Repository;
      if (ingestType === "zip") {
        if (!uploadFile) throw new Error("Please select a ZIP file to upload.");
        newRepo = await api.uploadZipRepository(uploadFile, ingestName || undefined);
      } else {
        newRepo = await api.ingestRepository(
          ingestType === "local" ? ingestPath : undefined,
          ingestType === "git" ? ingestGitUrl : undefined,
          ingestName || undefined
        );
      }
      
      setRepositories((prev) => [...prev, newRepo]);
      setActiveRepoId(newRepo.id);
      setShowAddModal(false);
      setIngestName("");
      setIngestPath("");
      setIngestGitUrl("");
      setUploadFile(null);
    } catch (err: any) {
      setError(err.message || "Failed to trigger ingestion pipeline.");
    } finally {
      setIngestLoading(false);
    }
  };

  // 5. Handle Delete
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this repository and all its index data?")) return;
    try {
      await api.deleteRepository(id);
      setRepositories((prev) => prev.filter((r) => r.id !== id));
      if (activeRepoId === id) {
        setActiveRepoId(repositories.length > 1 ? repositories.find((r) => r.id !== id)?.id || null : null);
      }
    } catch (err: any) {
      alert("Failed to delete repository: " + err.message);
    }
  };

  // Formatting helpers
  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const activeRepo = repositories.find((r) => r.id === activeRepoId);

  // Overview Charts Data
  const languageChartData = useMemo(() => {
    if (!activeRepoData.metrics || !activeRepoData.metrics.languages) return [];
    return Object.entries(activeRepoData.metrics.languages).map(([name, value]) => ({
      name,
      value
    }));
  }, [activeRepoData.metrics]);

  const largestFilesChartData = useMemo(() => {
    if (!activeRepoData.topology) return [];
    
    const flat: any[] = [];
    const collect = (node: any) => {
      if (node.type === "file") flat.push(node);
      else if (node.children) node.children.forEach(collect);
    };
    
    collect(activeRepoData.topology.tree);
    
    return flat
      .sort((a, b) => (b.loc || 0) - (a.loc || 0))
      .slice(0, 8)
      .map((f) => ({
        name: f.name,
        loc: f.loc || 0
      }));
  }, [activeRepoData.topology]);

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      {/* 3D Holographic Perspective Background Grid */}
      <div className="perspective-container">
        <div className="grid-3d"></div>
      </div>

      {/* Top Navigation Bar */}
      <header className="h-16 shrink-0 bg-card/40 backdrop-blur-md border-b border-card-border px-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-lg select-none">
            R
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider">RepoScope</h1>
            <p className="text-[10px] text-slate-500 font-semibold">Repository Structure Analysis & Visualization System</p>
          </div>
        </div>

        {/* Repository selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase">Workspace:</span>
            <select
              value={activeRepoId || ""}
              onChange={(e) => setActiveRepoId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:border-indigo-500 min-w-[200px]"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.status})
                </option>
              ))}
              {repositories.length === 0 && <option value="">No Repositories Ingested</option>}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <FolderPlus size={14} />
            <span>Ingest Repo</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side menu */}
        <aside className="w-60 bg-card border-r border-card-border flex flex-col shrink-0">
          <div className="p-4 border-b border-card-border">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Scope Views</span>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                  activeTab === "overview" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BarChart2 size={14} />
                <span>Repository Overview</span>
              </button>
              <button
                onClick={() => setActiveTab("explorer")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "explorer" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Database size={14} />
                <span>Tree Explorer</span>
              </button>
              <button
                onClick={() => setActiveTab("heatmap")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "heatmap" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <RePieChart size={14} />
                <span>Architecture Heatmap</span>
              </button>
              <button
                onClick={() => setActiveTab("graph")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "graph" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <RefreshCw size={14} />
                <span>Knowledge Graph</span>
              </button>
              <button
                onClick={() => setActiveTab("health")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "health" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldAlert size={14} />
                <span>Health & Smells</span>
              </button>
              <button
                onClick={() => setActiveTab("git")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "git" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText size={14} />
                <span>Git Evolution</span>
              </button>
              <button
                onClick={() => setActiveTab("security")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "security" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldAlert size={14} />
                <span>Security Audits</span>
              </button>
              <button
                onClick={() => setActiveTab("cicd")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "cicd" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu size={14} />
                <span>CI/CD Workflows</span>
              </button>
            </nav>
          </div>

          <div className="p-4 border-b border-card-border">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Interactive AI</span>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("chat")}
                disabled={!activeRepo || activeRepo.status !== "completed"}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "chat" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bot size={14} />
                <span>AI Code Copilot</span>
              </button>
              <button
                onClick={() => setActiveTab("compare")}
                disabled={repositories.filter(r => r.status === "completed").length < 2}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === "compare" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <GitCompare size={14} />
                <span>Benchmarking</span>
              </button>
            </nav>
          </div>

          <div className="flex-1"></div>

          {/* Active repo deletion trigger */}
          {activeRepo && (
            <div className="p-4 border-t border-card-border bg-slate-950/20">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 truncate">
                <span className="truncate pr-1">Active ID: {activeRepo.id}</span>
                <span className="font-semibold capitalize text-slate-300">{activeRepo.source_type}</span>
              </div>
              <button
                onClick={() => handleDelete(activeRepo.id)}
                className="w-full py-1.5 px-3 rounded-lg border border-rose-950 hover:bg-rose-950/20 text-rose-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={12} />
                <span>Remove Index</span>
              </button>
            </div>
          )}
        </aside>

        {/* Central Display Pane */}
        <main className="flex-1 bg-[#060910] p-6 overflow-y-auto scrollbar-thin">
          {analysisLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
              <span>Assembling repository details...</span>
            </div>
          ) : activeRepo ? (
            activeRepo.status === "pending" || activeRepo.status === "indexing" ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-indigo-600 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-300">
                    {activeRepo.status === "pending" ? "0%" : "35%"}
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Indexing repository structure...</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    We are scanning directories, calculating complexity metrics, mapping import statements, and constructing the dependency hierarchy. This page will update automatically.
                  </p>
                </div>
              </div>
            ) : activeRepo.status === "failed" ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto space-y-3">
                <AlertCircle size={36} className="text-red-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">Analysis Pipeline Failed</h3>
                  <p className="text-xs text-red-400 mt-1 border border-red-950 bg-red-950/20 p-3 rounded-lg font-mono text-left max-h-48 overflow-y-auto">
                    {activeRepo.error_message || "Unknown error during parser execution."}
                  </p>
                </div>
              </div>
            ) : (
              /* TAB RENDERS */
              <div>
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* 3D Glassmorphic Header Card */}
                    <div className="glass-panel-3d p-6 relative overflow-hidden">
                      <div className="relative z-10 space-y-1.5">
                        <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-pulse"></span>
                          Workspace Intelligence Dashboard
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                          Welcome to RepoScope. Below is the parsed metrics topology, language distributions, and AI-compiled onboarding analysis of your codebase.
                        </p>
                      </div>
                    </div>

                    {/* Repository overview stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="glass-panel-3d p-5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Indexed Files</span>
                        <h4 className="text-xl font-bold text-slate-100 mt-1 font-mono">{activeRepo.files_count}</h4>
                      </div>
                      <div className="glass-panel-3d p-5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Folders Scanned</span>
                        <h4 className="text-xl font-bold text-slate-100 mt-1 font-mono">{activeRepo.folders_count}</h4>
                      </div>
                      <div className="glass-panel-3d p-5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Volume</span>
                        <h4 className="text-xl font-bold text-slate-100 mt-1 font-mono">{formatSize(activeRepo.size_bytes)}</h4>
                      </div>
                      <div className="glass-panel-3d p-5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">Health Grade</span>
                        <h4 className="text-xl font-bold mt-1 text-emerald-400 font-mono">
                          {activeRepoData.metrics ? `${activeRepoData.metrics.maintainability_avg.toFixed(1)}%` : "—"}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Language Distribution (Pie Chart) */}
                      <div className="glass-panel-3d p-5 flex flex-col h-[320px]">
                        <h3 className="text-xs font-semibold text-slate-100 mb-3">Language Code Distribution</h3>
                        <div className="flex-1 w-full flex items-center justify-center">
                          {languageChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={languageChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {languageChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <ChartTooltip 
                                  contentStyle={{ backgroundColor: "#0b0f19", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px" }}
                                />
                                <Legend formatter={(value) => <span className="text-[11px] text-slate-400">{value}</span>} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="text-xs text-slate-500">No language data found.</div>
                          )}
                        </div>
                      </div>

                      {/* Largest Files (Bar Chart) */}
                      <div className="glass-panel-3d p-5 flex flex-col h-[320px]">
                        <h3 className="text-xs font-semibold text-slate-100 mb-3">Top 8 Largest Code Files (LOC)</h3>
                        <div className="flex-1 w-full">
                          {largestFilesChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={largestFilesChartData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={9} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} width={80} />
                                <ChartTooltip 
                                  contentStyle={{ backgroundColor: "#0b0f19", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px" }}
                                />
                                <Bar dataKey="loc" fill="#6366f1" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="text-xs text-slate-500 flex items-center justify-center h-full">No LOC data found.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Executive Summary */}
                    {activeRepoData.metrics && (
                      <div className="glass-panel-3d p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-card-border">
                          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                            <Bot size={16} className="text-indigo-400" />
                            AI Onboarding & Architecture Summary
                          </h3>
                          <div className="flex items-center gap-2">
                            <a 
                              href={`http://127.0.0.1:8000/api/repositories/${activeRepoId}/export/pdf`}
                              className="text-[10px] px-2.5 py-1 bg-slate-900 border border-slate-800 hover:text-white rounded font-medium text-slate-400"
                            >
                              Download PDF
                            </a>
                            <a 
                              href={`http://127.0.0.1:8000/api/repositories/${activeRepoId}/export/markdown`}
                              className="text-[10px] px-2.5 py-1 bg-slate-900 border border-slate-800 hover:text-white rounded font-medium text-slate-400"
                            >
                              Download MD
                            </a>
                            <a 
                              href={`http://127.0.0.1:8000/api/repositories/${activeRepoId}/export/json`}
                              className="text-[10px] px-2.5 py-1 bg-slate-900 border border-slate-800 hover:text-white rounded font-medium text-slate-400"
                            >
                              Download JSON
                            </a>
                          </div>
                        </div>
                        <div className="prose prose-invert max-w-none text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                          {activeRepoData.metrics.ai_summary}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "explorer" && activeRepoData.topology && (
                  <RepositoryExplorer 
                    topology={activeRepoData.topology}
                    ownershipData={activeRepoData.git?.ownership || {}}
                  />
                )}

                {activeTab === "heatmap" && activeRepoData.topology && (
                  <Heatmap files={activeRepoData.topology.tree.children ? 
                    (() => {
                      const list: any[] = [];
                      const coll = (n: any) => {
                        if (n.type === "file") list.push(n);
                        else if (n.children) n.children.forEach(coll);
                      };
                      coll(activeRepoData.topology.tree);
                      // Map maintainability/complexity metrics from fileIndex
                      return list.map(item => {
                        // find matching metrics file
                        const matched = activeRepoData.git?.hotspots.find((h: any) => h.path === item.path);
                        return {
                          ...item,
                          complexity: item.complexity || 3,
                          maintainability: item.maintainability || 82
                        };
                      });
                    })() : []} 
                  />
                )}

                {activeTab === "graph" && activeRepoId && (
                  <KnowledgeGraph repoId={activeRepoId} />
                )}

                {activeTab === "health" && activeRepoData.metrics && (
                  <HealthMetrics metrics={activeRepoData.metrics} />
                )}

                {activeTab === "git" && activeRepoData.git && (
                  <GitAnalytics gitData={activeRepoData.git} />
                )}

                {activeTab === "security" && (
                  <SecurityPanel vulnerabilities={activeRepoData.security} />
                )}

                {activeTab === "cicd" && (
                  <CICDPanel pipelines={activeRepoData.cicd} />
                )}

                {activeTab === "chat" && activeRepoId && (
                  <AIChat repoId={activeRepoId} />
                )}

                {activeTab === "compare" && (
                  <BenchmarkView repositories={repositories} activeRepoId={activeRepoId || undefined} />
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs gap-2 py-20">
              <Database size={32} />
              <span>No repositories ingested. Ingest a workspace path or clone a Git project to begin.</span>
            </div>
          )}
        </main>
      </div>

      {/* Ingestion Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-card-border">
              <h3 className="text-sm font-bold text-slate-100">Ingest Repository Workspace</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIngest} className="space-y-4">
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIngestType("local")}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    ingestType === "local" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  Local Path
                </button>
                <button
                  type="button"
                  onClick={() => setIngestType("git")}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    ingestType === "git" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  Git Repo
                </button>
                <button
                  type="button"
                  onClick={() => setIngestType("zip")}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                    ingestType === "zip" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  ZIP Archive
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Project Name (Optional)</label>
                  <input
                    type="text"
                    value={ingestName}
                    onChange={(e) => setIngestName(e.target.value)}
                    placeholder="e.g. MyPlatform"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {ingestType === "local" && (
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Absolute Directory path</label>
                    <input
                      type="text"
                      required
                      value={ingestPath}
                      onChange={(e) => setIngestPath(e.target.value)}
                      placeholder="e.g. C:/Users/name/Projects/api"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[10px]"
                    />
                  </div>
                )}

                {ingestType === "git" && (
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Git Clone HTTP URL</label>
                    <input
                      type="url"
                      required
                      value={ingestGitUrl}
                      onChange={(e) => setIngestGitUrl(e.target.value)}
                      placeholder="https://github.com/user/project.git"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {ingestType === "zip" && (
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Select ZIP Archive File</label>
                    <input
                      type="file"
                      required
                      accept=".zip"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {error && (
                <p className="text-[10px] text-red-500 font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={ingestLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                {ingestLoading ? "Triggering..." : "Start Analyzer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
