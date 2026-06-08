"use client";

import React, { useState } from "react";
import { Folder, FolderOpen, FileCode, Search, User } from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  size_bytes?: number;
  loc?: number;
  language?: string;
  children?: FileNode[];
}

interface RepositoryExplorerProps {
  topology: {
    tree: FileNode;
    files_count: number;
    folders_count: number;
    size_bytes: number;
  };
  ownershipData?: Record<string, { primary_owner: string; ownership_percent: number }>;
}

export default function RepositoryExplorer({ topology, ownershipData = {} }: RepositoryExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ "": true });

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Filter tree recursively
  const filterTree = (node: FileNode, query: string): FileNode | null => {
    const q = query.toLowerCase();
    
    if (node.type === "file") {
      if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q) || (node.language && node.language.toLowerCase().includes(q))) {
        return node;
      }
      return null;
    }

    const filteredChildren: FileNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        const res = filterTree(child, query);
        if (res) filteredChildren.push(res);
      }
    }

    if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  const activeTree = searchQuery ? filterTree(topology.tree, searchQuery) : topology.tree;

  const renderNode = (node: FileNode, depth = 0) => {
    const isDir = node.type === "directory";
    const isExpanded = expandedNodes[node.path];
    const hasChildren = isDir && node.children && node.children.length > 0;
    
    // Ownership check
    const ownerInfo = ownershipData[node.path];
    const ownerName = ownerInfo ? ownerInfo.primary_owner : null;
    const ownerPct = ownerInfo ? ownerInfo.ownership_percent : null;

    return (
      <div key={node.path} className="select-none">
        {/* Row element */}
        <div 
          onClick={() => isDir && toggleNode(node.path)}
          className={`flex items-center justify-between py-1.5 px-3 rounded-lg cursor-pointer text-sm transition-colors hover:bg-slate-800/40 ${
            isDir ? "text-slate-200" : "text-slate-400"
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <div className="flex items-center gap-2 overflow-hidden mr-4">
            {isDir ? (
              isExpanded ? (
                <FolderOpen size={16} className="text-indigo-400 shrink-0" />
              ) : (
                <Folder size={16} className="text-indigo-400 shrink-0" />
              )
            ) : (
              <FileCode size={16} className="text-slate-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 shrink-0">
            {!isDir && (
              <>
                {node.language && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800/50 text-[10px] text-indigo-300 font-medium">
                    {node.language}
                  </span>
                )}
                {node.loc !== undefined && (
                  <span className="w-16 text-right font-mono">{node.loc} LOC</span>
                )}
                <span className="w-20 text-right font-mono">{formatSize(node.size_bytes)}</span>
                <span className="w-32 flex items-center gap-1 justify-end truncate">
                  {ownerName ? (
                    <>
                      <User size={10} className="text-slate-400" />
                      <span className="truncate max-w-[80px]" title={ownerName}>{ownerName}</span>
                      <span className="text-[10px] text-slate-600">({ownerPct}%)</span>
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Children node list */}
        {isDir && isExpanded && node.children && (
          <div className="mt-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col h-[600px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-card-border">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Repository Topology Explorer</h3>
          <p className="text-xs text-slate-500">
            Expand the hierarchy to explore codebase structure, file sizes, and ownership.
          </p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search folders or files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin">
        {activeTree ? (
          renderNode(activeTree)
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
            No files or folders matched your query.
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between text-xs text-slate-500">
        <div>
          Total files: <span className="font-mono text-slate-300 font-semibold">{topology.files_count}</span>
        </div>
        <div>
          Total folders: <span className="font-mono text-slate-300 font-semibold">{topology.folders_count}</span>
        </div>
        <div>
          Total size: <span className="font-mono text-slate-300 font-semibold">{formatSize(topology.size_bytes)}</span>
        </div>
      </div>
    </div>
  );
}
