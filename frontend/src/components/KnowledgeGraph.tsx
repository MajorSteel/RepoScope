"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge
} from "reactflow";
import "reactflow/dist/style.css";
import { Network, FileText, Folder, Box, Search } from "lucide-react";
import { api } from "../lib/api";

interface KnowledgeGraphProps {
  repoId: number;
}

export default function KnowledgeGraph({ repoId }: KnowledgeGraphProps) {
  const [level, setLevel] = useState<"file" | "module" | "package">("file");
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const data = await api.getDependencies(repoId, level);
        if (active) {
          setGraphData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchGraph();
    return () => { active = false; };
  }, [repoId, level]);

  // Compute Layout Node Positions in Grid
  const { nodes, edges } = useMemo(() => {
    const rawNodes = graphData.nodes || [];
    const rawLinks = graphData.links || [];
    const q = searchQuery.toLowerCase();

    // 1. Grid layout spacing parameters
    const cols = Math.ceil(Math.sqrt(rawNodes.length)) || 1;
    const spacingX = 220;
    const spacingY = 100;

    // 2. Build ReactFlow Nodes
    const flowNodes: Node[] = rawNodes.map((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      
      const isMatched = q ? n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) : false;
      const isSearchActive = !!q;

      // Color mapping based on node type and search match
      let borderStyle = "1px solid #1e293b";
      let background = "#0f1626";
      let textColor = "#f8fafc";
      
      if (isSearchActive) {
        if (isMatched) {
          background = "#312e81"; // Indigo Highlight
          borderStyle = "2px solid #6366f1";
        } else {
          background = "#090d16";
          textColor = "#475569";
        }
      } else {
        if (n.type === "file") {
          borderStyle = "1px solid #4f46e5"; // Indigo border
        } else if (n.type === "module") {
          borderStyle = "1px solid #059669"; // Emerald border
        } else if (n.type === "external_package") {
          borderStyle = "1px solid #e11d48"; // Rose border
        }
      }

      // Add a nice visual header label
      const getIcon = () => {
        if (n.type === "file") return "📄";
        if (n.type === "module") return "📁";
        return "📦";
      };

      return {
        id: n.id,
        position: { x: col * spacingX, y: row * spacingY },
        style: {
          background,
          border: borderStyle,
          color: textColor,
          width: 180,
          boxShadow: isMatched ? "0 0 15px rgba(99, 102, 241, 0.4)" : "0 4px 8px rgba(0,0,0,0.3)"
        },
        data: { 
          label: (
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs">{getIcon()}</span>
              <span className="truncate font-medium text-[11px]" title={n.label}>
                {n.label}
              </span>
            </div>
          )
        }
      };
    });

    // 3. Build ReactFlow Edges
    const flowEdges: Edge[] = rawLinks.map((l) => {
      const isSourceMatched = q ? l.source.toLowerCase().includes(q) : false;
      const isTargetMatched = q ? l.target.toLowerCase().includes(q) : false;
      const strokeColor = (q && isSourceMatched && isTargetMatched) ? "#6366f1" : "#475569";

      return {
        id: l.id,
        source: l.source,
        target: l.target,
        animated: level === "file" || (q && isSourceMatched && isTargetMatched),
        style: { 
          stroke: strokeColor,
          strokeWidth: (q && isSourceMatched && isTargetMatched) ? 3 : 1.5 
        }
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graphData, level, searchQuery]);

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col h-[600px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-card-border">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Network size={18} className="text-indigo-400" />
            Repository Knowledge Graph Explorer
          </h3>
          <p className="text-xs text-slate-500">
            Interactive node-link layout showing structural imports and module dependencies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Level Switcher */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setLevel("file")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                level === "file" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText size={12} />
              File → File
            </button>
            <button
              onClick={() => setLevel("module")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                level === "module" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Folder size={12} />
              Module → Module
            </button>
            <button
              onClick={() => setLevel("package")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                level === "package" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Box size={12} />
              Package → Package
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full sm:w-48">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-slate-950/20 rounded-lg overflow-hidden border border-slate-800/30 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 z-10 text-xs text-slate-400">
            Compiling graph structures...
          </div>
        ) : nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.1}
            maxZoom={1.5}
          >
            <Background color="#334155" gap={16} />
            <Controls showInteractive={false} className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg [&>button]:fill-slate-300 [&>button]:border-slate-800" />
            <MiniMap 
              style={{ height: 100, width: 150 }} 
              nodeColor={(n) => {
                if (n.id.includes(searchQuery.toLowerCase()) && searchQuery) return "#6366f1";
                return "#1e293b";
              }}
              maskColor="rgba(8, 12, 20, 0.7)"
              className="bg-slate-900 border border-slate-800 rounded-lg"
            />
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            No dependencies found at this level.
          </div>
        )}
      </div>
    </div>
  );
}
