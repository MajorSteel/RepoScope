"use client";

import React, { useMemo, useState } from "react";
import { Play, Copy, Check, Terminal, Cpu } from "lucide-react";

interface PipelineNode {
  id: number;
  platform: string;
  stage: string;
  job_name: string;
  commands?: string; // JSON string
  depends_on?: string; // JSON string
}

interface CICDPanelProps {
  pipelines: PipelineNode[];
}

export default function CICDPanel({ pipelines }: CICDPanelProps) {
  const [copied, setCopied] = useState(false);

  // Group by platform
  const groupedByPlatform = useMemo(() => {
    const groups: Record<string, PipelineNode[]> = {};
    pipelines.forEach((p) => {
      if (!groups[p.platform]) groups[p.platform] = [];
      groups[p.platform].push(p);
    });
    return groups;
  }, [pipelines]);

  // Generate Mermaid Script representation
  const mermaidScript = useMemo(() => {
    if (pipelines.length === 0) return "";
    
    let md = "graph TD\n";
    
    // Group definitions by platform
    const platformJobs: Record<string, string[]> = {};
    
    pipelines.forEach((p) => {
      if (!platformJobs[p.platform]) platformJobs[p.platform] = [];
      const safeId = p.job_name.replace(/[^a-zA-Z0-9]/g, "_");
      platformJobs[p.platform].push(`${safeId}["${p.job_name} (${p.stage})"]`);
      
      // Add links
      try {
        const deps = JSON.parse(p.depends_on || "[]");
        deps.forEach((dep: string) => {
          const safeDep = dep.replace(/[^a-zA-Z0-9]/g, "_");
          md += `    ${safeDep} --> ${safeId}\n`;
        });
      } catch (e) {}
    });
    
    // Write subgraphs
    Object.entries(platformJobs).forEach(([platform, declarations]) => {
      const safeSubId = platform.replace(/[^a-zA-Z0-9]/g, "_");
      md += `  subgraph ${safeSubId} ["${platform} Pipeline"]\n`;
      declarations.forEach((decl) => {
        md += `    ${decl}\n`;
      });
      md += "  end\n";
    });
    
    return md;
  }, [pipelines]);

  const copyToClipboard = () => {
    if (!mermaidScript) return;
    navigator.clipboard.writeText(mermaidScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseJsonList = (str?: string): string[] => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch (e) {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-card-border p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-1.5">
          <Cpu size={16} className="text-indigo-400" />
          CI/CD Pipeline Configurations
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Discovered deployment pipelines, docker containers, and automated workflows.
        </p>

        {pipelines.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedByPlatform).map(([platform, nodes]) => (
              <div key={platform} className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 border-b border-slate-800 pb-2 uppercase tracking-wider">
                  {platform}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nodes.map((node) => {
                    const commands = parseJsonList(node.commands);
                    const dependsOn = parseJsonList(node.depends_on);
                    
                    return (
                      <div key={node.id} className="bg-slate-950/20 border border-slate-800/80 p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">{node.job_name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-indigo-400 uppercase font-medium">
                            {node.stage}
                          </span>
                        </div>

                        {dependsOn.length > 0 && (
                          <div className="text-[10px] text-slate-500">
                            Depends on: <span className="text-slate-400">{dependsOn.join(", ")}</span>
                          </div>
                        )}

                        {commands.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                              <Terminal size={10} /> Script steps:
                            </span>
                            <div className="bg-slate-950/80 rounded border border-slate-900 p-2 font-mono text-[9px] text-slate-400 space-y-1 overflow-x-auto">
                              {commands.map((cmd, cIdx) => (
                                <div key={cIdx} className="truncate select-all">
                                  $ {cmd}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs">
            No CI/CD pipeline configuration files (GitHub Actions, GitLab CI, Dockerfile) detected.
          </div>
        )}
      </div>

      {/* Mermaid flowchart generator */}
      {pipelines.length > 0 && (
        <div className="bg-card border border-card-border p-5 rounded-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Mermaid.js Flowchart Code</h3>
              <p className="text-xs text-slate-500">
                Generated flowchart script. Copy this to draw interactive pipeline diagrams in markdown.
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-950 p-4 border border-slate-900 rounded-lg font-mono text-xs text-indigo-300 leading-normal overflow-x-auto select-all scrollbar-thin max-h-48">
            <code>{mermaidScript}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
