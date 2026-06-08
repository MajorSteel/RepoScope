import os
from groq import Groq
from typing import List, Dict, Any, Tuple
from .config import settings

def get_groq_client() -> Groq:
    """Initializes and returns the Groq client if an API key is available."""
    if settings.GROQ_API_KEY:
        try:
            return Groq(api_key=settings.GROQ_API_KEY)
        except Exception:
            return None
    return None

def generate_repository_summary(repo_name: str, tech_stack: List[str], lang_dist: Dict[str, float], file_tree_summary: str, smells: List[Dict[str, Any]]) -> str:
    """
    Generates a structured architecture summary using the Groq LLM.
    Falls back to a detailed rules-based template if no key is set or execution fails.
    """
    client = get_groq_client()
    
    # Format data for LLM context
    langs = ", ".join([f"{l} ({p}%)" for l, p in lang_dist.items()])
    stacks = ", ".join(tech_stack)
    smells_text = "\n".join([f"- [{s['category']}] {s['entity']} in {s['location']}: {s['description']}" for s in smells[:10]])
    
    system_prompt = (
        "You are RepoScope, an expert AI software architect. You analyze repository details "
        "and generate professional, markdown-formatted engineering onboarding and architecture reports. "
        "Be technical, clear, and structured. Avoid fluff."
    )
    
    user_prompt = f"""
    Generate an Executive Architecture Summary for the repository: '{repo_name}'.
    
    Repository Metadata:
    - Detected Technologies/Build Systems: {stacks}
    - Languages Distribution: {langs}
    - Key Files Structure:
    {file_tree_summary}
    
    Critical Architectural Issues/Smells:
    {smells_text if smells else "None detected!"}
    
    Please structure the response as a markdown document with the following headers:
    # Executive Summary
    ## Architecture Overview & Design Patterns
    ## Technology Stack Analysis
    ## Critical Modules & Entry Points
    ## Technical Debt & Risk Assessment
    ## Suggested Engineering Roadmap & Roadmap
    ## Onboarding Guide for New Developers
    """
    
    if client:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="llama3-70b-8192",
                temperature=0.2,
                max_tokens=2500
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            # Fallback on exception
            pass
            
    # Rules-based fallback summary template
    fallback = f"""# Executive Summary (Local Rules-Based Report)

RepoScope scanned the `{repo_name}` repository and generated this localized overview.

## Architecture Overview & Design Patterns
- **Detected Language Stack**: {langs or "Unknown"}
- **Detected Frameworks**: {stacks or "Standard local folder tree"}

The codebase layout is structured hierarchically. Based on analysis of files, it appears to implement standard architectural separations, centering around source modules, testing utilities, and project-specific entry points.

## Critical Modules & Entry Points
Based on the topological analysis, the following files represent important logical points:
- Configuration / Setup: `{", ".join(tech_stack[:3]) if tech_stack else "None"}`

## Technical Debt & Risk Assessment
A total of {len(smells)} architectural smells were flagged during ingestion. 

### Key Risks:
{smells_text if smells else "- No severe technical debt or circular dependencies detected."}

## Suggested Roadmap
1. Refactor God classes and large files flagged in the health panel.
2. Resolve circular dependency cycles to ensure clean interface layers.
3. Modularize entry points and introduce comprehensive unit test coverages.

## Onboarding Guide for New Developers
1. Clone this repository and run verification scripts.
2. Check the configurations: `{", ".join(tech_stack[:2]) if tech_stack else "Standard"}`.
3. Follow the dependency graph in the interactive dashboard to trace class/function interactions.
"""
    return fallback

def search_repo_codebase(query: str, repo_path: str, all_files: List[Dict[str, Any]], symbols: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Performs a localized context retrieval (RAG step 1) to find files matching a query.
    Matches path names, symbol names, and file contents.
    """
    matched = []
    query_lower = query.lower()
    
    # 1. First, search symbols (classes, functions)
    matched_files_from_symbols = set()
    symbol_matches = []
    
    for s in symbols:
        name = s.name.lower()
        if query_lower in name or name in query_lower:
            file_path = s.file_path if hasattr(s, "file_path") else s.get("file_path")
            if file_path:
                matched_files_from_symbols.add(file_path)
                symbol_matches.append((file_path, s.name, s.type))
                
    # 2. Search file names and content keywords
    for file in all_files:
        path = file.path if hasattr(file, "path") else file.get("path")
        name = file.name if hasattr(file, "name") else file.get("name")
        full_absolute_path = os.path.join(repo_path, path)
        
        score = 0
        reasons = []
        
        # Path matches query
        if query_lower in path.lower():
            score += 50
            reasons.append("Path matches query")
            
        # File name matches query
        if query_lower in name.lower():
            score += 30
            reasons.append("Filename matches query")
            
        # File has matching symbols
        if path in matched_files_from_symbols:
            score += 25
            matching_syms = [sym[1] for sym in symbol_matches if sym[0] == path]
            reasons.append(f"Contains matching symbols: {', '.join(matching_syms[:3])}")
            
        # Keyword search inside content (if file is < 1MB)
        if file.get("size_bytes", 0) < 1024 * 1024:
            try:
                with open(full_absolute_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                matches = list(re.finditer(re.escape(query_lower), content.lower()))
                if matches:
                    score += min(len(matches) * 5, 40)
                    reasons.append(f"Found {len(matches)} occurrences of query in code")
            except Exception:
                pass
                
        if score > 0:
            matched.append({
                "path": path,
                "name": name,
                "score": score,
                "reasons": reasons
            })
            
    # Sort by score descending
    matched.sort(key=lambda x: x["score"], reverse=True)
    return matched[:5] # Return top 5 relevant files

def query_repository_chat(query: str, repo_path: str, matched_contexts: List[Dict[str, Any]]) -> str:
    """
    RAG step 2: Compiles the matched codebase contexts and queries Groq.
    """
    client = get_groq_client()
    
    # Load file contents for the top files
    code_contexts = []
    for ctx in matched_contexts:
        file_path = ctx["path"]
        abs_path = os.path.join(repo_path, file_path)
        
        try:
            with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            # Truncate file to first 150 lines to keep context clean
            truncated_content = "".join(lines[:150])
            if len(lines) > 150:
                truncated_content += "\n... [Code truncated for length] ..."
                
            code_contexts.append(
                f"--- File: {file_path} ---\n"
                f"```{os.path.splitext(file_path)[1][1:] or 'text'}\n"
                f"{truncated_content}\n"
                f"```"
            )
        except Exception:
            pass
            
    context_str = "\n\n".join(code_contexts)
    
    system_prompt = (
        "You are RepoScope Chat, a highly advanced code intelligence assistant. "
        "You help developers understand a repository by answering technical questions. "
        "We have extracted matching files from the repository database to help you. "
        "Base your answer primarily on the provided source code contexts. Cite files, functions, and lines where possible."
    )
    
    user_prompt = f"""
    User Question: {query}
    
    Here is the matching source code context retrieved from the repository:
    
    {context_str if context_str else "No source code files matching this query could be found."}
    
    Please provide a detailed, engineering-level explanation to answer the user's question. Use Markdown syntax.
    """
    
    if client:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model="llama3-70b-8192",
                temperature=0.1,
                max_tokens=1500
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error connecting to LLM server: {str(e)}. (Local retrieval matched files: {', '.join([c['path'] for c in matched_contexts])})"
            
    # Mock fallback answer showing retrieved paths
    reasons = "\n".join([f"- **{c['path']}** ({', '.join(c['reasons'])})" for c in matched_contexts])
    return f"""### RepoScope AI Chat (API Key Offline)

To use full AI code questioning, please set the `GROQ_API_KEY` environment variable.

However, the local search engine successfully scanned the repository and identified the following files as relevant to your query:

{reasons if matched_contexts else "- No matching files or symbols found."}

Please set your API key to get deep, code-level explanations!
"""
