import re
import os
import math
import yaml
import json
import networkx as nx
from typing import List, Dict, Any, Tuple

# Regex patterns for complexity counting (conditions and loops)
COMPLEXITY_KEYWORDS = re.compile(
    r'\b(if|for|while|elif|catch|case|and|or)\b|'  # keywords
    r'&&|\|\|'                                      # logical operators
)

# Regex for security scanning
AWS_SECRET_RE = re.compile(r'AKIA[0-9A-Z]{16}')
GENERIC_SECRET_RE = re.compile(r'(?i)(api_key|apikey|secret|password|passwd|private_key|privatekey)\s*[:=]\s*[\'"]([0-9a-zA-Z_-]{16,})[\'"]')
PRIVATE_KEY_RE = re.compile(r'-----BEGIN [A-Z ]+ PRIVATE KEY-----')

DANGEROUS_PATTERNS = {
    "Python": [
        (re.compile(r'\beval\s*\('), "eval() statement - risk of code injection"),
        (re.compile(r'\bexec\s*\('), "exec() statement - risk of code execution"),
        (re.compile(r'os\.system\s*\('), "os.system() - risk of command injection, use subprocess"),
        (re.compile(r'subprocess\.(?:Popen|run|call)\s*\(.*shell\s*=\s*True'), "subprocess with shell=True - command injection risk")
    ],
    "JavaScript": [
        (re.compile(r'\beval\s*\('), "eval() statement - code execution risk"),
        (re.compile(r'child_process\.exec\s*\('), "child_process.exec() - command injection risk"),
        (re.compile(r'dangerouslySetInnerHTML'), "dangerouslySetInnerHTML - Cross-site scripting (XSS) risk")
    ],
    "TypeScript": [
        (re.compile(r'\beval\s*\('), "eval() statement - code execution risk"),
        (re.compile(r'child_process\.exec\s*\('), "child_process.exec() - command injection risk"),
        (re.compile(r'dangerouslySetInnerHTML'), "dangerouslySetInnerHTML - Cross-site scripting (XSS) risk")
    ],
    "C++": [
        (re.compile(r'\bstrcpy\s*\('), "strcpy() - buffer overflow vulnerability, use strncpy"),
        (re.compile(r'\bgets\s*\('), "gets() - buffer overflow vulnerability, use fgets")
    ]
}

def calculate_complexity(file_path: str, ext: str) -> int:
    """
    Estimates Cyclomatic Complexity of a file.
    For Python, uses AST to count branches.
    For other languages, scans line-by-line for branch keywords and operators.
    """
    complexity = 1 # Base complexity is 1
    
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        if ext == ".py":
            # AST based complexity for Python
            try:
                tree = ast.parse(content)
                class CCVisitor(ast.NodeVisitor):
                    def __init__(self):
                        self.cc = 1
                    def visit_If(self, node):
                        self.cc += 1
                        self.generic_visit(node)
                    def visit_For(self, node):
                        self.cc += 1
                        self.generic_visit(node)
                    def visit_While(self, node):
                        self.cc += 1
                        self.generic_visit(node)
                    def visit_ExceptHandler(self, node):
                        self.cc += 1
                        self.generic_visit(node)
                    def visit_BoolOp(self, node):
                        self.cc += len(node.values) - 1
                        self.generic_visit(node)
                import ast
                visitor = CCVisitor()
                visitor.visit(tree)
                return visitor.cc
            except Exception:
                pass # Fallback to lexical
                
        # Lexical branch token counting
        matches = COMPLEXITY_KEYWORDS.findall(content)
        complexity += len(matches)
    except Exception:
        pass
        
    return complexity

def calculate_maintainability_index(loc: int, complexity: int, file_size: int) -> float:
    """
    Computes SEI Maintainability Index.
    Formula: MI = 171 - 5.2 * ln(Volume) - 0.23 * CC - 16.2 * ln(LOC)
    We approximate Halstead Volume = size_bytes * 8.
    """
    if loc <= 0:
        return 100.0
        
    try:
        # Avoid log(0)
        volume = max(1, file_size * 8)
        loc_val = max(1, loc)
        
        mi = 171.0 - (5.2 * math.log(volume)) - (0.23 * complexity) - (16.2 * math.log(loc_val))
        # Clamp to [0.0, 100.0]
        mi_normalized = max(0.0, min(100.0, mi))
        return round(mi_normalized, 2)
    except Exception:
        return 100.0

def scan_security_issues(file_path: str, rel_path: str, language: str) -> List[Dict[str, Any]]:
    """
    Scans a source file for API keys, passwords, private keys, and unsafe imports.
    """
    vulns = []
    
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            
        for idx, line in enumerate(lines):
            line_num = idx + 1
            clean_line = line.strip()
            
            # 1. AWS Secret detection
            if AWS_SECRET_RE.search(clean_line):
                vulns.append({
                    "file_path": rel_path,
                    "line_number": line_num,
                    "severity": "Critical",
                    "category": "Secret",
                    "description": "Hardcoded AWS Access Key detected",
                    "code_snippet": clean_line[:100]
                })
                
            # 2. Generic API Key / Password detection
            sec_match = GENERIC_SECRET_RE.search(clean_line)
            if sec_match:
                # Do not trigger on comments or obvious placeholders
                if not any(placeholder in clean_line.lower() for placeholder in ["your_", "placeholder", "key_here", "example", "<", "["]):
                    vulns.append({
                        "file_path": rel_path,
                        "line_number": line_num,
                        "severity": "High",
                        "category": "Secret",
                        "description": f"Potential hardcoded credential or secret '{sec_match.group(1)}' detected",
                        "code_snippet": f"{sec_match.group(1)} = '********'"
                    })
                    
            # 3. Private Key file detection
            if PRIVATE_KEY_RE.search(clean_line):
                vulns.append({
                    "file_path": rel_path,
                    "line_number": line_num,
                    "severity": "Critical",
                    "category": "Secret",
                    "description": "Private Cryptographic Key block detected in source file",
                    "code_snippet": "-----BEGIN PRIVATE KEY-----"
                })
                
            # 4. Dangerous imports/functions based on language
            if language in DANGEROUS_PATTERNS:
                for pattern, desc in DANGEROUS_PATTERNS[language]:
                    if pattern.search(clean_line):
                        vulns.append({
                            "file_path": rel_path,
                            "line_number": line_num,
                            "severity": "Medium",
                            "category": "Unsafe Pattern",
                            "description": desc,
                            "code_snippet": clean_line[:100]
                        })
    except Exception:
        pass
        
    return vulns

def parse_cicd_pipelines(repo_path: str) -> List[Dict[str, Any]]:
    """
    Scans for CI/CD files and parses jobs, stages, and command dependencies.
    """
    pipelines = []
    
    # 1. GitHub Actions
    github_actions_dir = os.path.join(repo_path, ".github", "workflows")
    if os.path.isdir(github_actions_dir):
        for file in os.listdir(github_actions_dir):
            if file.endswith((".yml", ".yaml")):
                file_path = os.path.join(github_actions_dir, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                    
                    if data and "jobs" in data:
                        job_list = data["jobs"]
                        for job_name, job_data in job_list.items():
                            needs = job_data.get("needs", [])
                            if isinstance(needs, str):
                                needs = [needs]
                                
                            steps = job_data.get("steps", [])
                            commands = []
                            for step in steps:
                                if "run" in step:
                                    commands.append(step["run"].strip().split("\n")[0])
                                elif "uses" in step:
                                    commands.append(f"uses: {step['uses']}")
                                    
                            pipelines.append({
                                "platform": "GitHub Actions",
                                "stage": "workflow",
                                "job_name": job_name,
                                "commands": json.dumps(commands),
                                "depends_on": json.dumps(needs)
                            })
                except Exception:
                    pass
                    
    # 2. GitLab CI
    gitlab_file = os.path.join(repo_path, ".gitlab-ci.yml")
    if os.path.isfile(gitlab_file):
        try:
            with open(gitlab_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if data:
                stages = data.get("stages", ["build", "test", "deploy"])
                for key, val in data.items():
                    if isinstance(val, dict) and "script" in val:
                        job_name = key
                        stage = val.get("stage", "test")
                        script = val["script"]
                        if isinstance(script, str):
                            script = [script]
                        needs = val.get("needs", [])
                        
                        pipelines.append({
                            "platform": "GitLab CI",
                            "stage": stage,
                            "job_name": job_name,
                            "commands": json.dumps(script),
                            "depends_on": json.dumps(needs)
                        })
        except Exception:
            pass
            
    # 3. Dockerfile
    dockerfile = os.path.join(repo_path, "Dockerfile")
    if os.path.isfile(dockerfile):
        try:
            with open(dockerfile, "r", encoding="utf-8") as f:
                lines = f.readlines()
            commands = []
            for line in lines:
                if line.startswith(("FROM", "RUN", "CMD", "ENTRYPOINT", "EXPOSE", "ENV")):
                    commands.append(line.strip())
            pipelines.append({
                "platform": "Docker",
                "stage": "build",
                "job_name": "Docker Build",
                "commands": json.dumps(commands),
                "depends_on": json.dumps([])
            })
        except Exception:
            pass
            
    # 4. Docker Compose
    compose_file = os.path.join(repo_path, "docker-compose.yml")
    if not os.path.isfile(compose_file):
        compose_file = os.path.join(repo_path, "docker-compose.yaml")
    if os.path.isfile(compose_file):
        try:
            with open(compose_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if data and "services" in data:
                for service_name, service_data in data["services"].items():
                    depends_on = list(service_data.get("depends_on", {}).keys()) if isinstance(service_data.get("depends_on"), dict) else service_data.get("depends_on", [])
                    image = service_data.get("image", service_data.get("build", "custom build"))
                    pipelines.append({
                        "platform": "Docker Compose",
                        "stage": "orchestration",
                        "job_name": service_name,
                        "commands": json.dumps([f"image: {image}"]),
                        "depends_on": json.dumps(depends_on)
                    })
        except Exception:
            pass
            
    return pipelines

def find_architectural_smells(files: List[Any], symbols: List[Any], dependencies: List[Any], repo_path: str) -> List[Dict[str, Any]]:
    """
    Detects:
    - God Classes
    - Large Files
    - Circular Dependencies (using NetworkX)
    - High Complexity Functions
    - Dead Code Candidates (files with 0 incoming dependencies)
    - Tight Coupling Hotspots (files with high in-degree or out-degree)
    """
    smells = []
    
    # 1. God Classes & High Complexity Functions
    # Group symbols by class name
    class_methods = {}
    for sym in symbols:
        if sym.type == "method" and sym.parent_name:
            class_methods.setdefault(sym.parent_name, []).append(sym)
        elif sym.type == "class":
            class_methods.setdefault(sym.name, [])
            
    for class_name, methods in class_methods.items():
        if len(methods) > 15:
            # Find file containing class
            file_path = next((sym.file_index.path if hasattr(sym, "file_index") else sym.get("file_path", "unknown") for sym in symbols if sym.name == class_name), "unknown")
            smells.append({
                "category": "God Class",
                "entity": class_name,
                "location": file_path,
                "description": f"Class '{class_name}' contains {len(methods)} methods. Suggest partitioning responsibilities."
            })
            
    # 2. Large Files
    for file in files:
        if file.loc > 800:
            smells.append({
                "category": "Large File",
                "entity": file.name,
                "location": file.path,
                "description": f"File exceeds 800 lines of code ({file.loc} lines). Suggest decomposing into smaller files."
            })
            
    # 3. Circular Dependencies using NetworkX
    G = nx.DiGraph()
    for dep in dependencies:
        G.add_edge(dep.source_file, dep.target_file)
        
    try:
        cycles = list(nx.simple_cycles(G))
        for cycle in cycles:
            if len(cycle) > 1: # Cycles of size 1 are self-dependencies (ignore)
                cycle_str = " -> ".join(cycle) + f" -> {cycle[0]}"
                smells.append({
                    "category": "Circular Dependency",
                    "entity": f"Cycle of size {len(cycle)}",
                    "location": cycle[0],
                    "description": f"Circular reference detected: {cycle_str}. Tends to break class loaders and tightly couples code."
                })
    except Exception:
        pass
        
    # 4. Dead Code Candidates
    # Entrypoint lists to exclude
    entrypoints = ["main.py", "app.py", "index.ts", "index.js", "setup.py", "wsgi.py", "manage.py", "index.html"]
    
    # Files that are imported
    imported_files = set(dep.target_file for dep in dependencies)
    for file in files:
        # Ignore external libs/configs and entrypoints
        is_entry = file.name in entrypoints or any(file.path.startswith(d) for d in ["tests", "docs", "scripts", "configs"])
        if file.path not in imported_files and not is_entry:
            smells.append({
                "category": "Dead Code Candidate",
                "entity": file.name,
                "location": file.path,
                "description": f"File is not imported by any other module in this repository. Verify if it is dead code or needs an entry definition."
            })
            
    # 5. Tight Coupling Hotspots
    # Out-degree/In-degree calculations
    for node in G.nodes():
        in_degree = G.in_degree(node)
        out_degree = G.out_degree(node)
        
        if in_degree > 10:
            smells.append({
                "category": "Coupling Hotspot (Inflow)",
                "entity": os.path.basename(node),
                "location": node,
                "description": f"File is imported by {in_degree} other modules. Modifying this file could lead to widespread side effects."
            })
        if out_degree > 10:
            smells.append({
                "category": "Coupling Hotspot (Outflow)",
                "entity": os.path.basename(node),
                "location": node,
                "description": f"File imports {out_degree} other modules. High outward coupling increases fragility."
            })
            
    return smells
