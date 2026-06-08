import os
import zipfile
import shutil
import tempfile
import git
from typing import Dict, List, Tuple, Any

# Map extension to language
EXTENSION_MAP = {
    ".py": "Python",
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
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".html": "HTML",
    ".css": "CSS",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".sh": "Shell Script",
    ".bat": "Batch Script",
    ".ps1": "PowerShell Script"
}

# Framework and package files mapping
CONFIG_SIGNATURES = {
    "requirements.txt": ("Python", "pip"),
    "pyproject.toml": ("Python", "poetry/pip"),
    "setup.py": ("Python", "setuptools"),
    "package.json": ("JavaScript/TypeScript", "npm/yarn"),
    "pom.xml": ("Java", "maven"),
    "build.gradle": ("Java", "gradle"),
    "CMakeLists.txt": ("C++", "cmake"),
    "Makefile": ("C/C++", "make"),
    "Cargo.toml": ("Rust", "cargo"),
    "go.mod": ("Go", "go modules"),
    "Gemfile": ("Ruby", "bundler"),
    "composer.json": ("PHP", "composer")
}

def detect_languages_and_configs(repo_path: str) -> Tuple[Dict[str, float], List[str], List[str]]:
    """
    Scans the repository path and detects:
    - Language distribution (based on file size/counts)
    - Frameworks / build systems detected
    - Configuration files
    """
    lang_sizes = {}
    total_size = 0
    detected_frameworks = []
    config_files = []

    for root, dirs, files in os.walk(repo_path):
        # Skip hidden folders like .git
        if ".git" in root.split(os.sep) or ".venv" in root.split(os.sep) or "node_modules" in root.split(os.sep):
            continue
            
        for file in files:
            file_path = os.path.join(root, file)
            # Skip symlinks and special files
            if not os.path.isfile(file_path):
                continue
                
            # Check for configuration file signatures
            if file in CONFIG_SIGNATURES:
                lang, mgr = CONFIG_SIGNATURES[file]
                config_files.append(os.path.relpath(file_path, repo_path).replace("\\", "/"))
                framework_desc = f"{lang} ({mgr})"
                if framework_desc not in detected_frameworks:
                    detected_frameworks.append(framework_desc)
            
            # Check extension for language size stats
            _, ext = os.path.splitext(file.lower())
            if ext in EXTENSION_MAP:
                lang = EXTENSION_MAP[ext]
                try:
                    size = os.path.getsize(file_path)
                except OSError:
                    size = 0
                lang_sizes[lang] = lang_sizes.get(lang, 0) + size
                total_size += size

    # Convert sizes to percentages
    lang_dist = {}
    if total_size > 0:
        for lang, size in lang_sizes.items():
            lang_dist[lang] = round((size / total_size) * 100, 2)
    else:
        # If no size, count files
        total_files = 0
        file_counts = {}
        for root, dirs, files in os.walk(repo_path):
            if ".git" in root.split(os.sep) or ".venv" in root.split(os.sep) or "node_modules" in root.split(os.sep):
                continue
            for file in files:
                _, ext = os.path.splitext(file.lower())
                if ext in EXTENSION_MAP:
                    lang = EXTENSION_MAP[ext]
                    file_counts[lang] = file_counts.get(lang, 0) + 1
                    total_files += 1
        if total_files > 0:
            for lang, count in file_counts.items():
                lang_dist[lang] = round((count / total_files) * 100, 2)

    return lang_dist, detected_frameworks, config_files

def clone_git_repository(url: str, dest_dir: str) -> str:
    """Clones a remote git repository to the destination directory."""
    os.makedirs(dest_dir, exist_ok=True)
    repo_name = url.split("/")[-1].replace(".git", "")
    target_path = os.path.join(dest_dir, repo_name)
    
    # If path already exists, delete it first
    if os.path.exists(target_path):
        shutil.rmtree(target_path, ignore_errors=True)
        
    git.Repo.clone_from(url, target_path)
    return target_path

def extract_zip_archive(zip_path: str, dest_dir: str) -> str:
    """Extracts a ZIP archive to the destination directory."""
    os.makedirs(dest_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(zip_path))[0]
    target_path = os.path.join(dest_dir, base_name)
    
    if os.path.exists(target_path):
        shutil.rmtree(target_path, ignore_errors=True)
        
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_path)
        
    # If it extracted to a nested folder with the same name, collapse it
    extracted_items = os.listdir(target_path)
    if len(extracted_items) == 1 and os.path.isdir(os.path.join(target_path, extracted_items[0])):
        nested_path = os.path.join(target_path, extracted_items[0])
        temp_dest = os.path.join(dest_dir, f"{base_name}_temp")
        shutil.move(nested_path, temp_dest)
        shutil.rmtree(target_path, ignore_errors=True)
        shutil.move(temp_dest, target_path)
        
    return target_path

def scan_directory_topology(repo_path: str) -> Dict[str, Any]:
    """
    Builds a JSON-serializable directory tree hierarchy and counts files and folders.
    """
    topology = {
        "name": os.path.basename(repo_path),
        "type": "directory",
        "path": "",
        "children": []
    }
    
    files_count = 0
    folders_count = 0
    total_size = 0
    
    def build_tree(current_dir: str, current_node: Dict[str, Any]):
        nonlocal files_count, folders_count, total_size
        
        try:
            entries = os.scandir(current_dir)
        except OSError:
            return
            
        for entry in entries:
            name = entry.name
            # Skip hidden and boilerplate files to avoid noise in visualization
            if name.startswith(".") or name in ["node_modules", "venv", ".venv", "__pycache__", "build", "dist", "bin", "obj"]:
                continue
                
            rel_path = os.path.relpath(entry.path, repo_path).replace("\\", "/")
            
            if entry.is_dir():
                folders_count += 1
                child_node = {
                    "name": name,
                    "type": "directory",
                    "path": rel_path,
                    "children": []
                }
                current_node["children"].append(child_node)
                build_tree(entry.path, child_node)
            else:
                files_count += 1
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = 0
                total_size += size
                
                _, ext = os.path.splitext(name.lower())
                language = EXTENSION_MAP.get(ext, "Unknown")
                
                # Count lines of code (LOC)
                loc = 0
                if language != "Unknown" and size < 2 * 1024 * 1024: # only read files < 2MB
                    try:
                        with open(entry.path, "r", encoding="utf-8", errors="ignore") as f:
                            loc = sum(1 for _ in f)
                    except Exception:
                        pass
                
                child_node = {
                    "name": name,
                    "type": "file",
                    "path": rel_path,
                    "size_bytes": size,
                    "loc": loc,
                    "language": language
                }
                current_node["children"].append(child_node)

    build_tree(repo_path, topology)
    
    return {
        "tree": topology,
        "files_count": files_count,
        "folders_count": folders_count,
        "size_bytes": total_size
    }
