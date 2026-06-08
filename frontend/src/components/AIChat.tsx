"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Sparkles, HelpCircle, FileText } from "lucide-react";
import { api } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ path: string; name: string; reasons: string[] }>;
}

interface AIChatProps {
  repoId: number;
}

const SUGGESTIONS = [
  "Where is the main application entry point?",
  "How are metrics and code complexity calculated?",
  "List any circular dependencies or code smells.",
  "Which files contain database or connection logic?"
];

export default function AIChat({ repoId }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am RepoScope AI. Ask me anything about this repository's architecture, dependencies, or security configuration. I will search the codebase and explain the logic directly."
    }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const handleSend = async (queryText: string) => {
    if (!queryText.trim() || sending) return;
    
    const userQuery = queryText;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);

    try {
      const data = await api.askChat(repoId, userQuery);
      setMessages((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          content: data.response, 
          sources: data.sources 
        }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          content: `Failed to fetch response: ${err.message || "Unknown error occurred"}` 
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  // Crude helper to render markdown code blocks and lists
  const renderMessageContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const lang = lines[0].replace("```", "").trim();
        const code = lines.slice(1, -1).join("\n");
        return (
          <div key={index} className="my-2 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
            {lang && (
              <div className="bg-slate-900 px-3 py-1 text-[10px] text-slate-400 border-b border-slate-800 uppercase font-semibold">
                {lang}
              </div>
            )}
            <pre className="bg-slate-950 p-3 overflow-x-auto text-indigo-200 leading-relaxed scrollbar-thin">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      
      // Simple line break and bold parsing
      return (
        <div key={index} className="whitespace-pre-line leading-relaxed text-slate-300 text-xs">
          {part.split("\n").map((line, lIdx) => {
            // Check for list items
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
              return (
                <li key={lIdx} className="ml-4 list-disc pl-1 py-0.5">
                  {parseInlineFormatting(line.trim().substring(2))}
                </li>
              );
            }
            if (line.trim().match(/^\d+\.\s/)) {
              const content = line.trim().replace(/^\d+\.\s/, "");
              return (
                <li key={lIdx} className="ml-4 list-decimal pl-1 py-0.5">
                  {parseInlineFormatting(content)}
                </li>
              );
            }
            return <p key={lIdx} className="mb-1">{parseInlineFormatting(line)}</p>;
          })}
        </div>
      );
    });
  };

  const parseInlineFormatting = (line: string) => {
    const boldParts = line.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((bp, bpIdx) => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return <strong key={bpIdx} className="text-slate-100 font-semibold">{bp.slice(2, -2)}</strong>;
      }
      // Parse inline code
      const codeParts = bp.split(/(`.*?`)/g);
      return codeParts.map((cp, cpIdx) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return <code key={cpIdx} className="bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-400">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 flex flex-col h-[600px]">
      <div className="flex items-center justify-between pb-3 border-b border-card-border mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-1.5">
            <Bot size={18} className="text-indigo-400" />
            AI Architecture Copilot
          </h3>
          <p className="text-xs text-slate-500">
            Ask complex structural questions. The AI uses local code search indexing to answer.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          <Sparkles size={12} className="text-indigo-400" />
          <span>RAG Active</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 scrollbar-thin">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
            )}
            
            <div className="max-w-[85%] space-y-2">
              <div className={`p-3.5 rounded-xl text-xs ${
                m.role === "user" 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-slate-900 border border-slate-800/80 rounded-tl-none"
              }`}>
                {m.role === "user" ? m.content : renderMessageContent(m.content)}
              </div>

              {/* RAG Sources */}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <div className="pl-1 space-y-1">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold uppercase">
                    <FileText size={10} /> Indexed Code Contexts:
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {m.sources.map((s, sIdx) => (
                      <span 
                        key={sIdx}
                        title={`Reasons:\n${s.reasons.join("\n")}`}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded text-[9px] font-mono text-slate-400 cursor-help transition-colors"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {m.role === "user" && (
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        
        {sending && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center shrink-0 animate-pulse">
              <Bot size={16} />
            </div>
            <div className="bg-slate-900 border border-slate-800/80 p-3.5 rounded-xl rounded-tl-none max-w-[85%] flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span className="ml-1 text-[10px] font-medium">Scanning source files...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 font-semibold mb-2 uppercase flex items-center gap-1">
            <HelpCircle size={10} /> Suggested Questions:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, sIdx) => (
              <button
                key={sIdx}
                onClick={() => handleSend(s)}
                className="text-left bg-slate-900/60 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 text-[11px] text-slate-300 p-2.5 rounded-lg transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
        className="flex items-center gap-2 pt-3 border-t border-card-border"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the repository..."
          disabled={sending}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white p-2.5 rounded-xl transition-colors shrink-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
