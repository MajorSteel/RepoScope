"use client";

import React, { useState, useEffect } from "react";
import { GitCompare, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api, Repository } from "../lib/api";

interface BenchmarkViewProps {
  repositories: Repository[];
  activeRepoId?: number;
}

export default function BenchmarkView({ repositories, activeRepoId }: BenchmarkViewProps) {
  const [repoA, setRepoA] = useState<number | "">("");
  const [repoB, setRepoB] = useState<number | "">("");
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Set default selection based on current repo
  useEffect(() => {
    if (activeRepoId) {
      setRepoA(activeRepoId);
    }
  }, [activeRepoId]);

  const handleCompare = async () => {
    if (!repoA || !repoB) {
      setError("Please select two repositories to compare.");
      return;
    }
    if (repoA === repoB) {
      setError("Please select different repositories to compare.");
      return;
    }
    setError("");
    setLoading(true);
    setBenchmarkResult(null);
    try {
      const data = await api.getBenchmark(Number(repoA), Number(repoB));
      setBenchmarkResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch benchmark details");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const renderMetricRow = (label: string, key: string, isSize = false) => {
    if (!benchmarkResult) return null;
    const metric = benchmarkResult.metrics[key];
    if (!metric) return null;

    const valA = isSize ? formatSize(metric.value_a) : metric.value_a.toFixed ? metric.value_a.toFixed(1) : metric.value_a;
    const valB = isSize ? formatSize(metric.value_b) : metric.value_b.toFixed ? metric.value_b.toFixed(1) : metric.value_b;
    const delta = isSize ? formatSize(metric.delta) : metric.delta.toFixed ? metric.delta.toFixed(1) : metric.delta;

    const isDraw = metric.better === "draw";
    const isABetter = metric.better === "A";

    return (
      <tr key={key} className="border-b border-slate-800/40 hover:bg-slate-900/10 text-xs">
        <td className="py-3.5 font-medium text-slate-300">{label}</td>
        
        {/* Repo A Cell */}
        <td className={`py-3.5 text-right font-mono ${
          isDraw ? "" : isABetter ? "text-emerald-500 font-semibold" : "text-slate-400"
        }`}>
          {valA}
        </td>

        {/* Comparison Indicator */}
        <td className="py-3.5 text-center font-medium">
          {isDraw ? (
            <span className="text-slate-600 flex items-center justify-center gap-0.5"><Minus size={12} /> Draw</span>
          ) : isABetter ? (
            <span className="text-indigo-400 flex items-center justify-center gap-0.5"><TrendingUp size={12} /> A wins (-{delta})</span>
          ) : (
            <span className="text-rose-400 flex items-center justify-center gap-0.5"><TrendingDown size={12} /> B wins (+{delta})</span>
          )}
        </td>

        {/* Repo B Cell */}
        <td className={`py-3.5 text-right font-mono ${
          isDraw ? "" : !isABetter ? "text-emerald-500 font-semibold" : "text-slate-400"
        }`}>
          {valB}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-1.5">
          <GitCompare size={16} className="text-indigo-400" />
          Repository Benchmarking Engine
        </h3>

        {/* Selectors */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          <div className="flex-1 w-full">
            <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1.5">Repository A (Target)</label>
            <select
              value={repoA}
              onChange={(e) => setRepoA(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Choose Repository A --</option>
              {repositories.filter(r => r.status === "completed").map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 text-slate-600 mt-5 hidden sm:block">
            <ArrowRight size={16} />
          </div>

          <div className="flex-1 w-full">
            <label className="text-[10px] text-slate-500 font-semibold uppercase block mb-1.5">Repository B (Comparison)</label>
            <select
              value={repoB}
              onChange={(e) => setRepoB(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Choose Repository B --</option>
              {repositories.filter(r => r.status === "completed").map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={loading}
            className="sm:mt-5 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Analyzing..." : "Compare Repositories"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}
      </div>

      {/* Results Table */}
      {benchmarkResult && (
        <div className="bg-card border border-card-border p-5 rounded-xl">
          <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Benchmarking Comparisons</h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Side-By-Side Stats</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-xs">
                <th className="py-2">Quality Metric</th>
                <th className="py-2 text-right">A: {benchmarkResult.repo_a_name}</th>
                <th className="py-2 text-center">Comparison Delta</th>
                <th className="py-2 text-right">B: {benchmarkResult.repo_b_name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {renderMetricRow("Total Files Indexed", "files_count")}
              {renderMetricRow("Total Lines of Code (LOC)", "loc")}
              {renderMetricRow("Average Complexity", "complexity_avg")}
              {renderMetricRow("Average Maintainability Index", "maintainability_avg")}
              {renderMetricRow("File Dependency Links Count", "dependency_count")}
              {renderMetricRow("Total Build/Code Size", "size_bytes", true)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
