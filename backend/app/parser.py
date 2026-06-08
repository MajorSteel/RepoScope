import re
import ast
import os
from typing import List, Dict, Any, Tuple

# Regex patterns for imports
JS_IMPORT_RE = re.compile(
    r'(?:import\s+(?:[\w*\s{},]*\s+from\s+)?[\'"]([^\'"]+)[\'"])|'  # ES6: import x from 'y' or import 'y'
    r'(?:require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\))'                   # CommonJS: require('y')
)

JAVA_IMPORT_RE = re.compile(r'^\s*import\s+([\w\.]+)\s*;')
CPP_INCLUDE_RE = re.compile(r'^\s*#include\s*[\'<]([^\'>]+)[\'>]')

# Regex patterns for symbols
JS_SYMBOL_RE = re.compile(
    r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?class\s+(\w+)|'                         # Class
    r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)|'        # Function
    r'^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>|'                   # Arrow Function
    r'^\s*(?:export\s+)?interface\s+(\w+)'                                                   # Interface
)

JAVA_SYMBOL_RE = re.compile(
    r'^\s*(?:public|protected|private|static|\s)*class\s+(\w+)|'                            # Class
    r'^\s*(?:public|protected|private|static|\s)*interface\s+(\w+)|'                        # Interface
    r'^\s*(?:public|protected|private|static|\s)+([\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{' # Method
)

CPP_SYMBOL_RE = re.compile(
    r'^\s*(?:class|struct)\s+(\w+)|'                                                        # Class/Struct
    r'^\s*(?:[\w:*&<>]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;)'                      # Function/Method
)

def parse_python_file(file_path: str, repo_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses a Python file using standard ast library to extract:
    - Symbols (classes, functions, methods)
    - Imports (dependencies)
    """
    symbols = []
    dependencies = []
    rel_path = os.path.relpath(file_path, repo_path).replace("\\", "/")
    
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()
            
        tree = ast.parse(code)
        
        class SymbolVisitor(ast.NodeVisitor):
            def __init__(self):
                self.current_class = None
                
            def visit_ClassDef(self, node: ast.ClassDef):
                bases = []
                for base in node.bases:
                    if isinstance(base, ast.Name):
                        bases.append(base.id)
                    elif isinstance(base, ast.Attribute):
                        bases.append(base.attr)
                
                sig = f"class {node.name}"
                if bases:
                    sig += f"({', '.join(bases)})"
                    
                symbols.append({
                    "name": node.name,
                    "type": "class",
                    "line_number": node.lineno,
                    "signature": sig,
                    "parent_name": None
                })
                
                old_class = self.current_class
                self.current_class = node.name
                self.generic_visit(node)
                self.current_class = old_class
                
            def visit_FunctionDef(self, node: ast.FunctionDef):
                args = [arg.arg for arg in node.args.args]
                sig = f"def {node.name}({', '.join(args)})"
                
                symbols.append({
                    "name": node.name,
                    "type": "method" if self.current_class else "function",
                    "line_number": node.lineno,
                    "signature": sig,
                    "parent_name": self.current_class
                })
                self.generic_visit(node)
                
            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                args = [arg.arg for arg in node.args.args]
                sig = f"async def {node.name}({', '.join(args)})"
                
                symbols.append({
                    "name": node.name,
                    "type": "method" if self.current_class else "function",
                    "line_number": node.lineno,
                    "signature": sig,
                    "parent_name": self.current_class
                })
                self.generic_visit(node)
                
            def visit_Import(self, node: ast.Import):
                for alias in node.names:
                    dependencies.append({
                        "source_file": rel_path,
                        "target_file": alias.name,
                        "import_path": f"import {alias.name}",
                        "type": "import"
                    })
                self.generic_visit(node)
                
            def visit_ImportFrom(self, node: ast.ImportFrom):
                module = node.module or ""
                # For relative imports like: from .utils import helper
                level = node.level
                prefix = "." * level if level > 0 else ""
                full_module = prefix + module
                
                for alias in node.names:
                    dependencies.append({
                        "source_file": rel_path,
                        "target_file": f"{full_module}.{alias.name}" if full_module else alias.name,
                        "import_path": f"from {full_module} import {alias.name}",
                        "type": "import"
                    })
                self.generic_visit(node)
                
        SymbolVisitor().visit(tree)
    except Exception:
        # Fallback to empty if syntax errors or parsing issues
        pass
        
    return symbols, dependencies

def parse_lexical_file(file_path: str, repo_path: str, lang: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Line-by-line regex parser for JS/TS, Java, and C++ to extract imports and symbols.
    """
    symbols = []
    dependencies = []
    rel_path = os.path.relpath(file_path, repo_path).replace("\\", "/")
    
    # Select regexes based on language
    if lang in ["JavaScript", "JavaScript (React)", "TypeScript", "TypeScript (React)"]:
        import_re = JS_IMPORT_RE
        symbol_re = JS_SYMBOL_RE
        lang_type = "js"
    elif lang == "Java":
        import_re = JAVA_IMPORT_RE
        symbol_re = JAVA_SYMBOL_RE
        lang_type = "java"
    elif lang in ["C++", "C", "C/C++ Header", "C++ Header"]:
        import_re = CPP_INCLUDE_RE
        symbol_re = CPP_SYMBOL_RE
        lang_type = "cpp"
    else:
        return [], []
        
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            
        current_class = None
        brace_count = 0
        class_brace_level = 0
        
        for idx, line in enumerate(lines):
            line_num = idx + 1
            
            # Track braces for class context (crude but effective)
            if lang_type in ["java", "cpp", "js"]:
                open_braces = line.count("{")
                close_braces = line.count("}")
                
                if open_braces > 0 or close_braces > 0:
                    for _ in range(open_braces):
                        brace_count += 1
                    for _ in range(close_braces):
                        brace_count -= 1
                        if current_class and brace_count < class_brace_level:
                            current_class = None
            
            # 1. Check imports
            import_match = import_re.search(line)
            if import_match:
                # Get the first non-None group
                target = next((g for g in import_match.groups() if g is not None), None)
                if target:
                    dependencies.append({
                        "source_file": rel_path,
                        "target_file": target,
                        "import_path": line.strip(),
                        "type": "import" if lang_type != "cpp" else "include"
                    })
                continue
                
            # 2. Check symbols
            symbol_match = symbol_re.search(line)
            if symbol_match:
                groups = symbol_match.groups()
                # Determine which group matched
                if lang_type == "js":
                    # JS_SYMBOL_RE groups:
                    # 0: class name
                    # 1, 2: function name, function args
                    # 3, 4: arrow function name, arrow function args
                    # 5: interface name
                    if groups[0]:
                        current_class = groups[0]
                        class_brace_level = brace_count + (1 if "{" in line else 0)
                        symbols.append({
                            "name": groups[0],
                            "type": "class",
                            "line_number": line_num,
                            "signature": f"class {groups[0]}",
                            "parent_name": None
                        })
                    elif groups[1]:
                        symbols.append({
                            "name": groups[1],
                            "type": "method" if current_class else "function",
                            "line_number": line_num,
                            "signature": f"function {groups[1]}({groups[2] or ''})",
                            "parent_name": current_class
                        })
                    elif groups[3]:
                        symbols.append({
                            "name": groups[3],
                            "type": "method" if current_class else "function",
                            "line_number": line_num,
                            "signature": f"const {groups[3]} = ({groups[4] or ''}) =>",
                            "parent_name": current_class
                        })
                    elif groups[5]:
                        symbols.append({
                            "name": groups[5],
                            "type": "interface",
                            "line_number": line_num,
                            "signature": f"interface {groups[5]}",
                            "parent_name": None
                        })
                        
                elif lang_type == "java":
                    # JAVA_SYMBOL_RE groups:
                    # 0: class name
                    # 1: interface name
                    # 2, 3, 4: method return type, method name, method args
                    if groups[0]:
                        current_class = groups[0]
                        class_brace_level = brace_count + (1 if "{" in line else 0)
                        symbols.append({
                            "name": groups[0],
                            "type": "class",
                            "line_number": line_num,
                            "signature": f"class {groups[0]}",
                            "parent_name": None
                        })
                    elif groups[1]:
                        symbols.append({
                            "name": groups[1],
                            "type": "interface",
                            "line_number": line_num,
                            "signature": f"interface {groups[1]}",
                            "parent_name": None
                        })
                    elif groups[3]:
                        symbols.append({
                            "name": groups[3],
                            "type": "method",
                            "line_number": line_num,
                            "signature": f"{groups[2]} {groups[3]}({groups[4] or ''})",
                            "parent_name": current_class
                        })
                        
                elif lang_type == "cpp":
                    # CPP_SYMBOL_RE groups:
                    # 0: class/struct name
                    # 1, 2: function name, args
                    if groups[0]:
                        current_class = groups[0]
                        class_brace_level = brace_count + (1 if "{" in line else 0)
                        symbols.append({
                            "name": groups[0],
                            "type": "class",
                            "line_number": line_num,
                            "signature": f"class {groups[0]}",
                            "parent_name": None
                        })
                    elif groups[1]:
                        symbols.append({
                            "name": groups[1],
                            "type": "method" if current_class else "function",
                            "line_number": line_num,
                            "signature": f"{groups[1]}({groups[2] or ''})",
                            "parent_name": current_class
                        })
    except Exception:
        pass
        
    return symbols, dependencies

def resolve_imports(all_deps: List[Dict[str, Any]], all_files: List[str]) -> List[Dict[str, Any]]:
    """
    Tries to match abstract import targets (like "import { x } from './utils'") 
    with real file paths (like "src/utils.ts") in the workspace.
    """
    resolved = []
    file_map = {os.path.basename(f): f for f in all_files}
    file_no_ext_map = {os.path.splitext(os.path.basename(f))[0]: f for f in all_files}
    
    # Build complete directory lookups
    all_files_set = set(all_files)
    
    for dep in all_deps:
        src = dep["source_file"]
        tgt = dep["target_file"]
        
        # Skip empty
        if not tgt:
            continue
            
        src_dir = os.path.dirname(src)
        matched_target = None
        
        # 1. Check relative paths (e.g. "./helper", "../utils/auth")
        if tgt.startswith("."):
            # Resolve relative parts
            base_dir = src_dir
            parts = tgt.split("/")
            
            # Simple simulation of directory moving
            for part in parts:
                if part == ".":
                    continue
                elif part == "..":
                    base_dir = os.path.dirname(base_dir)
                else:
                    base_dir = os.path.join(base_dir, part)
            
            # Normalize target relative path
            target_candidate = base_dir.replace("\\", "/")
            
            # Check with extension candidates
            for ext in [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".cpp", ".h", ""]:
                cand = target_candidate + ext
                if cand in all_files_set:
                    matched_target = cand
                    break
                    
        # 2. Check direct filename match (for C++ #include "helper.h" or Python imports in same directory)
        if not matched_target:
            base_tgt = os.path.basename(tgt)
            if base_tgt in file_map:
                matched_target = file_map[base_tgt]
            elif base_tgt in file_no_ext_map:
                matched_target = file_no_ext_map[base_tgt]
                
        # 3. Check python package styles (e.g., "src.utils.auth" or "utils.auth")
        if not matched_target and "." in tgt and "/" not in tgt:
            candidate_path = tgt.replace(".", "/")
            for ext in [".py", ".ts", ".js"]:
                cand = candidate_path + ext
                # check if there's any file in all_files ending with this
                for f in all_files:
                    if f.endswith(cand):
                        matched_target = f
                        break
                if matched_target:
                    break
                    
        # 4. Check submodules/directories (e.g. import from a parent module)
        if not matched_target:
            # Check if there exists a file whose path contains the imported module name
            for f in all_files:
                if tgt in f:
                    matched_target = f
                    break
                    
        if matched_target and matched_target != src:
            resolved.append({
                "source_file": src,
                "target_file": matched_target,
                "import_path": dep["import_path"],
                "type": dep["type"]
            })
            
    return resolved

def parse_repository_source(repo_path: str, all_indexed_files: List[str]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Iterates through all files in the repository and parses symbols and raw imports.
    Then resolves the raw imports to physical files.
    """
    all_symbols = []
    raw_dependencies = []
    
    for root, dirs, files in os.walk(repo_path):
        if ".git" in root.split(os.sep) or ".venv" in root.split(os.sep) or "node_modules" in root.split(os.sep):
            continue
            
        for file in files:
            file_path = os.path.join(root, file)
            rel_file_path = os.path.relpath(file_path, repo_path).replace("\\", "/")
            
            # Only parse if file is in our index list
            if rel_file_path not in all_indexed_files:
                continue
                
            _, ext = os.path.splitext(file.lower())
            
            if ext == ".py":
                syms, deps = parse_python_file(file_path, repo_path)
                # Map to include file index reference path
                for s in syms:
                    s["file_path"] = rel_file_path
                all_symbols.extend(syms)
                raw_dependencies.extend(deps)
            elif ext in [".js", ".jsx", ".ts", ".tsx", ".java", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp"]:
                # Lookup language mapped from extensions
                lang = EXTENSION_MAP_PROV.get(ext, "Unknown")
                syms, deps = parse_lexical_file(file_path, repo_path, lang)
                for s in syms:
                    s["file_path"] = rel_file_path
                all_symbols.extend(syms)
                raw_dependencies.extend(deps)
                
    # Resolve imports to physical files
    resolved_dependencies = resolve_imports(raw_dependencies, all_indexed_files)
    
    return all_symbols, resolved_dependencies

EXTENSION_MAP_PROV = {
    ".js": "JavaScript",
    ".jsx": "JavaScript (React)",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)",
    ".java": "Java",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header"
}
