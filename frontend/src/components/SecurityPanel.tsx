"use client";

import React, { useMemo } from "react";
import { ShieldAlert, ShieldCheck, AlertOctagon, Terminal } from "lucide-react";

interface Vulnerability {
  id: number;
  file_path: string;
  line_number: number;
  severity: "Critical" | "High" | "Medium" | "Low";
  category: "Secret" | "Dangerous Import" | "Unsafe Pattern";
  description: string;
  code_snippet: string;
}

interface SecurityPanelProps {
  vulnerabilities: Vulnerability[];
}

export default function SecurityPanel({ vulnerabilities }: SecurityPanelProps) {
  // Sort vulnerabilities by severity level weight
  const sortedVulns = useMemo(() => {
    const weights = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return [...vulnerabilities].sort((a, b) => weights[b.severity] - weights[a.severity]);
  }, [vulnerabilities]);

  // Counts of each severity level
  const stats = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    vulnerabilities.forEach((v) => {
      if (v.severity in counts) counts[v.severity]++;
    });
    return counts;
  }, [vulnerabilities]);

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "Critical": return "bg-red-950/40 border border-red-900/60 text-red-400";
      case "High": return "bg-orange-950/40 border border-orange-900/60 text-orange-400";
      case "Medium": return "bg-amber-950/40 border border-amber-900/60 text-amber-400";
      default: return "bg-blue-950/40 border border-blue-900/60 text-blue-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Critical Risks</p>
            <h4 className="text-xl font-bold text-red-500 font-mono mt-1">{stats.Critical}</h4>
          </div>
          <div className={`p-2.5 rounded-lg ${stats.Critical > 0 ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-slate-900 text-slate-500"}`}>
            <AlertOctagon size={18} />
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">High Risks</p>
            <h4 className="text-xl font-bold text-orange-500 font-mono mt-1">{stats.High}</h4>
          </div>
          <div className={`p-2.5 rounded-lg ${stats.High > 0 ? "bg-orange-500/10 text-orange-500" : "bg-slate-900 text-slate-500"}`}>
            <AlertOctagon size={18} />
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Medium Risks</p>
            <h4 className="text-xl font-bold text-amber-500 font-mono mt-1">{stats.Medium}</h4>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 text-slate-500">
            <AlertOctagon size={18} />
          </div>
        </div>

        <div className="bg-card border border-card-border p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Low Risks</p>
            <h4 className="text-xl font-bold text-blue-500 font-mono mt-1">{stats.Low}</h4>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 text-slate-500">
            <AlertOctagon size={18} />
          </div>
        </div>
      </div>

      <div className="bg-card border border-card-border p-5 rounded-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-card-border mb-4">
          <ShieldAlert size={18} className="text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Security Audit Findings</h3>
            <p className="text-xs text-slate-500">
              Scanned credentials, secrets, dangerous API patterns, and buffer vulnerability candidates.
            </p>
          </div>
        </div>

        {sortedVulns.length > 0 ? (
          <div className="space-y-4">
            {sortedVulns.map((v) => (
              <div 
                key={v.id} 
                className="p-4 bg-slate-950/20 border border-slate-800/80 rounded-xl hover:border-slate-800 transition-colors space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSeverityBadgeColor(v.severity)}`}>
                      {v.severity}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {v.category}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {v.file_path}:{v.line_number}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {v.description}
                </p>

                {v.code_snippet && (
                  <div className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 flex items-start gap-2 overflow-hidden">
                    <Terminal size={12} className="text-slate-600 shrink-0 mt-0.5" />
                    <pre className="font-mono text-[10px] text-slate-400 overflow-x-auto select-all leading-normal truncate w-full">
                      <code>{v.code_snippet}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">No Vulnerabilities Identified</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">
                RepoScope did not identify any credentials, dangerous patterns, or private key blocks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
