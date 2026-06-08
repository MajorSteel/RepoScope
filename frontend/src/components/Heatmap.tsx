"use client";

import React, { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface FileMetric {
  path: string;
  name: string;
  language: string;
  size_bytes: number;
  loc: number;
  complexity: number;
  maintainability: number;
}

interface HeatmapProps {
  files: FileMetric[];
}

export default function Heatmap({ files }: HeatmapProps) {
  // Filter out non-code or zero LOC files for visual clarity, capping at top 150 files for SVG performance
  const treemapData = useMemo(() => {
    return files
      .filter((f) => f.loc > 0)
      .map((f) => ({
        name: f.name,
        path: f.path,
        language: f.language,
        // Recharts Treemap requires 'size' key for rectangle weighting
        size: f.loc,
        loc: f.loc,
        complexity: f.complexity,
        mi: f.maintainability
      }))
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 150); // Cap to avoid rendering overload
  }, [files]);

  // Map Maintainability Index to color
  const getColor = (mi: number) => {
    if (mi >= 80) return "#059669"; // Green (Healthy)
    if (mi >= 60) return "#d97706"; // Yellow (Moderate)
    if (mi >= 40) return "#ea580c"; // Orange (High Complexity)
    return "#dc2626"; // Red (Critical)
  };

  // Custom cell renderer for Treemap
  const CustomizedContent = (props: any) => {
    const { x, y, width, height, index, name, mi } = props;
    if (width < 30 || height < 15) return null; // Skip drawing text if too small

    const cellColor = getColor(mi);
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: cellColor,
            stroke: "#080c14",
            strokeWidth: 1.5,
            strokeOpacity: 1,
            cursor: "pointer"
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 + 3}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={10}
          fontWeight="bold"
          style={{ pointerEvents: "none" }}
        >
          {width > 60 ? (name.length > 12 ? name.substring(0, 10) + ".." : name) : ""}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-200">{data.path}</p>
          <div className="flex justify-between gap-8 text-slate-400">
            <span>Language:</span>
            <span className="text-indigo-400 font-medium">{data.language}</span>
          </div>
          <div className="flex justify-between gap-8 text-slate-400">
            <span>Lines of Code (LOC):</span>
            <span className="text-slate-200 font-mono font-semibold">{data.loc}</span>
          </div>
          <div className="flex justify-between gap-8 text-slate-400">
            <span>Complexity Score:</span>
            <span className="text-slate-200 font-mono font-semibold">{data.complexity}</span>
          </div>
          <div className="flex justify-between gap-8 text-slate-400">
            <span>Maintainability Index:</span>
            <span className="font-mono font-semibold" style={{ color: getColor(data.mi) }}>
              {data.mi} / 100
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col h-[600px]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-100">SonarQube-Style Quality Heatmap</h3>
        <p className="text-xs text-slate-500">
          Size represents Lines of Code (LOC). Color shows Maintainability: Green (healthy), Yellow (moderate), Orange (complex), Red (critical).
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-600"></span>
          <span>Healthy (MI &gt;= 80)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-600"></span>
          <span>Moderate (MI 60-80)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-600"></span>
          <span>Complex (MI 40-60)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-600"></span>
          <span>Critical (MI &lt; 40)</span>
        </div>
      </div>

      <div className="flex-1 w-full bg-slate-950/20 rounded-lg overflow-hidden border border-slate-800/30">
        {treemapData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#080c14"
              content={<CustomizedContent />}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            No file metrics data available.
          </div>
        )}
      </div>
    </div>
  );
}
