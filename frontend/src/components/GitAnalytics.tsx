"use client";

import React, { useMemo } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Users, History, AlertTriangle, HelpCircle, FileText, Bug } from "lucide-react";

interface GitAnalyticsProps {
  gitData: {
    is_git: boolean;
    commits: Array<{ hash: string; author: string; email: string; date: string; message: string }>;
    contributors: Array<{ name: string; email: string; commits_count: number; additions: number; deletions: number }>;
    hotspots: Array<{ path: string; commits_count: number; churn: number }>;
    bus_factor: Record<string, number>;
    bug_prone_files: Array<{ path: string; bug_fixes: number }>;
  };
}

export default function GitAnalytics({ gitData }: GitAnalyticsProps) {
  // If not a git repo, return clean error block
  if (!gitData || !gitData.is_git) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-8 flex flex-col items-center justify-center text-center h-[500px]">
        <AlertTriangle size={32} className="text-amber-500 mb-3" />
        <h3 className="text-base font-semibold text-slate-100 mb-1">Git Repository Not Detected</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Git Evolution and Contributor Analytics require a valid Git history. Cloned git targets or local folders with `.git` subfolders automatically enable these analytics.
        </p>
      </div>
    );
  }

  // 1. Group commits by date for chart (last 30 active days of commits)
  const chartData = useMemo(() => {
    const dates: Record<string, number> = {};
    gitData.commits.forEach((c) => {
      try {
        const dateStr = c.date.split("T")[0]; // YYYY-MM-DD
        dates[dateStr] = (dates[dateStr] || 0) + 1;
      } catch (e) {}
    });

    return Object.entries(dates)
      .map(([date, count]) => ({ date, commits: count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 points
  }, [gitData.commits]);

  const totalCommits = gitData.commits.length;
  const totalContributors = gitData.contributors.length;

  // Find critical bus factor items (Bus factor = 1)
  const busFactorAlerts = useMemo(() => {
    return Object.entries(gitData.bus_factor)
      .filter(([folder, count]) => count === 1 && folder !== "/" && !folder.startsWith("tests") && !folder.startsWith("docs"))
      .slice(0, 5); // Limit alerts
  }, [gitData.bus_factor]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-600/10 rounded-lg text-indigo-400">
            <History size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Analyzed Commits</p>
            <h4 className="text-xl font-bold text-slate-100 font-mono">{totalCommits}</h4>
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-600/10 rounded-lg text-emerald-400">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Active Contributors</p>
            <h4 className="text-xl font-bold text-slate-100 font-mono">{totalContributors}</h4>
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-600/10 rounded-lg text-rose-400">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Bus Factor Risk Modules</p>
            <h4 className="text-xl font-bold text-slate-100 font-mono">
              {Object.values(gitData.bus_factor).filter(v => v === 1).length}
            </h4>
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-600/10 rounded-lg text-amber-400">
            <Bug size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Bug-Prone Hotspots</p>
            <h4 className="text-xl font-bold text-slate-100 font-mono">{gitData.bug_prone_files.length}</h4>
          </div>
        </div>
      </div>

      {/* Main Commit Graph */}
      <div className="bg-card border border-card-border p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Commit Activity Trends (Last 30 Active Days)</h3>
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0b0f19", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Area type="monotone" dataKey="commits" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCommits)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500">
              No commit activity data to display.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contributor contributions */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-1.5">
            <Users size={16} className="text-indigo-400" />
            Contributor Leadership Board
          </h3>
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="py-2">Contributor</th>
                  <th className="py-2 text-right">Commits</th>
                  <th className="py-2 text-right text-emerald-500">Additions</th>
                  <th className="py-2 text-right text-rose-500">Deletions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {gitData.contributors.sort((a,b) => b.commits_count - a.commits_count).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-900/10">
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="py-2.5 text-right font-mono">{c.commits_count}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-600">+{c.additions}</td>
                    <td className="py-2.5 text-right font-mono text-rose-600">-{c.deletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bus Factor Panel */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-amber-500" />
            Knowledge Concentration & Bus Factor
          </h3>
          
          {busFactorAlerts.length > 0 && (
            <div className="mb-4 p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg text-xs space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1">
                <AlertTriangle size={12} /> Critical Bus Factor Detected!
              </span>
              <p className="text-slate-400 text-[11px]">
                The following directories are highly dependent on a single contributor (Bus Factor = 1):
              </p>
              <ul className="list-disc list-inside text-slate-300 text-[10px] space-y-0.5 mt-1.5">
                {busFactorAlerts.map(([folder]) => (
                  <li key={folder}>
                    <code className="text-indigo-300">{folder}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="py-2">Directory Module</th>
                  <th className="py-2 text-right">Bus Factor Score</th>
                  <th className="py-2 text-right">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {Object.entries(gitData.bus_factor)
                  .sort((a, b) => a[1] - b[1])
                  .map(([folder, score], i) => (
                    <tr key={i} className="hover:bg-slate-900/10">
                      <td className="py-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[240px]">{folder}</td>
                      <td className="py-2.5 text-right font-semibold font-mono text-slate-200">{score}</td>
                      <td className="py-2.5 text-right font-medium">
                        {score === 1 ? (
                          <span className="text-red-500">Critical</span>
                        ) : score <= 2 ? (
                          <span className="text-amber-500">Medium</span>
                        ) : (
                          <span className="text-emerald-500">Low</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hotspots files */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-1.5">
            <FileText size={16} className="text-indigo-400" />
            File Activity Hotspots (Most Changed)
          </h3>
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="py-2">File Path</th>
                  <th className="py-2 text-right">Touch Count</th>
                  <th className="py-2 text-right">Total Churn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {gitData.hotspots.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-900/10">
                    <td className="py-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[240px]">{h.path}</td>
                    <td className="py-2.5 text-right font-mono">{h.commits_count} commits</td>
                    <td className="py-2.5 text-right font-mono text-slate-400">{h.churn} lines</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bug-prone files */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-1.5">
            <Bug size={16} className="text-amber-500" />
            Bug-Prone Hotspots (Correlated to Fixes)
          </h3>
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            {gitData.bug_prone_files.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="py-2">File Path</th>
                    <th className="py-2 text-right">Fix Commits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {gitData.bug_prone_files.sort((a,b) => b.bug_fixes - a.bug_fixes).map((f, i) => (
                    <tr key={i} className="hover:bg-slate-900/10">
                      <td className="py-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[240px]">{f.path}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-rose-500">{f.bug_fixes} fixes</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs text-center">
                No bugs/fixes referenced in commit messages yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
