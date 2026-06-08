"use client";

import React, { useMemo } from "react";
import { AlertCircle, Layers, CheckCircle2, ChevronRight, Activity } from "lucide-react";

interface Smell {
  category: string;
  entity: string;
  location: string;
  description: string;
}

interface HealthMetricsProps {
  metrics: {
    complexity_avg: number;
    maintainability_avg: number;
    languages: Record<string, number>;
    smells: Smell[];
  };
}

export default function HealthMetrics({ metrics }: HealthMetricsProps) {
  const smells = metrics.smells || [];
  
  // Categorize smells
  const categorizedSmells = useMemo(() => {
    const categories: Record<string, Smell[]> = {};
    smells.forEach((s) => {
      if (!categories[s.category]) categories[s.category] = [];
      categories[s.category].push(s);
    });
    return categories;
  }, [smells]);

  const maintainabilityColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const maintainabilityBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10";
    if (score >= 60) return "bg-amber-500/10";
    if (score >= 40) return "bg-orange-500/10";
    return "bg-red-500/10";
  };

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Maintainability Gauge card */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Maintainability Score</span>
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Simple SVG Circular Gauge */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle 
                cx="50" cy="50" r="40" 
                stroke="#1e293b" strokeWidth="8" fill="transparent" 
              />
              <circle 
                cx="50" cy="50" r="40" 
                stroke={metrics.maintainability_avg >= 80 ? "#10b981" : metrics.maintainability_avg >= 60 ? "#d97706" : "#ef4444"} 
                strokeWidth="8" fill="transparent" 
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - metrics.maintainability_avg / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold font-mono ${maintainabilityColor(metrics.maintainability_avg)}`}>
                {metrics.maintainability_avg.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-500">out of 100</span>
            </div>
          </div>
          <span className="text-xs text-slate-400 mt-3 font-medium">
            {metrics.maintainability_avg >= 85 ? "Excellent Health" : metrics.maintainability_avg >= 65 ? "Moderate Health" : "Refactoring Required"}
          </span>
        </div>

        {/* Complexity Card */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Average Complexity</span>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-extrabold text-slate-100 font-mono">
                {metrics.complexity_avg.toFixed(1)}
              </h4>
              <span className="text-xs text-slate-500">CC score</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 leading-relaxed">
            The average branching factor of source routines. A score <span className="text-emerald-400 font-semibold font-mono">&lt; 10.0</span> indicates highly readable, linear logic.
          </div>
        </div>

        {/* Smells Summary */}
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Architectural Health Issues</span>
            <div className="flex items-baseline gap-2">
              <h4 className={`text-3xl font-extrabold font-mono ${smells.length > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {smells.length}
              </h4>
              <span className="text-xs text-slate-500">smells flagged</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 leading-relaxed">
            {smells.length > 5 
              ? "Multiple complexity and coupling warnings raised. Review the architectural smells catalog below." 
              : smells.length > 0 
                ? "Minor smells detected. Codebase structure is relatively sound." 
                : "Perfect compliance! No architectural smells or cycles detected."
            }
          </div>
        </div>
      </div>

      {/* Smells Details catalog */}
      <div className="bg-card border border-card-border p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center gap-1.5">
          <Layers size={16} className="text-indigo-400" />
          Codebase Architectural Smells Catalog
        </h3>

        {smells.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(categorizedSmells).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5 uppercase flex items-center gap-1.5">
                  <Activity size={12} className="text-slate-500" />
                  {category} ({items.length})
                </h4>

                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-slate-950/20 border border-slate-800/80 rounded-xl flex items-start gap-3 text-xs"
                    >
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-200">{item.entity}</span>
                          <span className="text-[10px] text-slate-500 truncate font-mono">
                            in {item.location}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs text-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <div>
              <p className="font-semibold text-slate-200">Your Codebase is Clean!</p>
              <p className="text-[10px] text-slate-500 mt-0.5">No god classes, circular references, or dead modules found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
