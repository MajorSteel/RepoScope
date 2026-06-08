import os
import git
from datetime import datetime
from typing import List, Dict, Any, Tuple

def analyze_git_repository(repo_path: str) -> Dict[str, Any]:
    """
    Analyzes a Git repository using GitPython to compile:
    - Commits history over time
    - Contributor contribution stats (commits, additions, deletions)
    - File code churn (lines added/deleted)
    - File modification frequency (hotspots)
    - Bug-prone files (commits referencing bugs/fixes)
    - File-level author ownership mapping
    """
    analytics = {
        "is_git": False,
        "commits": [],
        "contributors": {},
        "file_churn": {},
        "hotspots": [],
        "bug_prone_files": {},
        "ownership": {},
        "bus_factor": {}
    }
    
    try:
        repo = git.Repo(repo_path)
        if repo.bare:
            return analytics
        analytics["is_git"] = True
    except Exception:
        # Not a git repo, return clean empty structures
        return analytics
        
    try:
        # Get all commits (limit to last 1000 commits for performance on huge repos)
        commits_list = list(repo.iter_commits('HEAD', max_count=1000))
        
        # 1. Parse commits list
        for commit in commits_list:
            author_name = commit.author.name or "Unknown"
            author_email = commit.author.email or "unknown@domain.com"
            commit_date = datetime.fromtimestamp(commit.committed_date)
            msg = commit.message or ""
            
            analytics["commits"].append({
                "hash": commit.hexsha[:8],
                "author": author_name,
                "email": author_email,
                "date": commit_date.isoformat(),
                "message": msg.strip().split("\n")[0]
            })
            
            # Update contributor summary
            if author_email not in analytics["contributors"]:
                analytics["contributors"][author_email] = {
                    "name": author_name,
                    "email": author_email,
                    "commits_count": 0,
                    "additions": 0,
                    "deletions": 0
                }
            analytics["contributors"][author_email]["commits_count"] += 1
            
            # 2. Parse commit stats (files modified, additions, deletions)
            # We wrap this in try-except because some merge commits have complex parents
            try:
                # Get stats for this commit relative to parent
                stats = commit.stats.files
                is_bug_fix = any(keyword in msg.lower() for keyword in ["fix", "bug", "issue", "crash", "error", "fault", "patch", "resolve"])
                
                for file_path, file_stats in stats.items():
                    # Normalize file path to forward slashes
                    norm_path = file_path.replace("\\", "/")
                    add = file_stats.get("insertions", 0)
                    delete = file_stats.get("deletions", 0)
                    
                    # Update contributor additions/deletions
                    analytics["contributors"][author_email]["additions"] += add
                    analytics["contributors"][author_email]["deletions"] += delete
                    
                    # Update file churn
                    if norm_path not in analytics["file_churn"]:
                        analytics["file_churn"][norm_path] = {
                            "commits_count": 0,
                            "additions": 0,
                            "deletions": 0,
                            "authors": {}
                        }
                    
                    file_info = analytics["file_churn"][norm_path]
                    file_info["commits_count"] += 1
                    file_info["additions"] += add
                    file_info["deletions"] += delete
                    
                    # Update authorship count for ownership mapping
                    file_info["authors"][author_name] = file_info["authors"].get(author_name, 0) + 1
                    
                    # Update bug-prone metrics
                    if is_bug_fix:
                        analytics["bug_prone_files"][norm_path] = analytics["bug_prone_files"].get(norm_path, 0) + 1
            except Exception:
                pass
                
        # 3. Process File Ownership & Hotspots
        for path, churn in analytics["file_churn"].items():
            total_commits_file = churn["commits_count"]
            authors_commits = churn["authors"]
            
            # Find primary owner (author with most commits to this file)
            primary_owner = "Unknown"
            max_commits = 0
            owner_pct = 0.0
            
            if total_commits_file > 0:
                for author, comms in authors_commits.items():
                    if comms > max_commits:
                        max_commits = comms
                        primary_owner = author
                owner_pct = round((max_commits / total_commits_file) * 100, 2)
                
            analytics["ownership"][path] = {
                "primary_owner": primary_owner,
                "ownership_percent": owner_pct,
                "all_authors": {auth: round((comms / total_commits_file) * 100, 2) for auth, comms in authors_commits.items()}
            }
            
            # Add to hotspots
            analytics["hotspots"].append({
                "path": path,
                "commits_count": total_commits_file,
                "churn": churn["additions"] + churn["deletions"]
            })
            
        # Sort hotspots by commits count
        analytics["hotspots"].sort(key=lambda x: x["commits_count"], reverse=True)
        analytics["hotspots"] = analytics["hotspots"][:15] # Top 15 hotspots
        
        # 4. Calculate Folder-level Bus Factor
        # Bus factor is defined as the min contributors who wrote >= 50% of the commits in a directory
        # Group file commits by folder
        folder_commits = {} # folder_path -> { author_name -> commit_count }
        for path, churn in analytics["file_churn"].items():
            folder = os.path.dirname(path).replace("\\", "/")
            if not folder:
                folder = "/"
            
            folder_commits.setdefault(folder, {})
            for author, comms in churn["authors"].items():
                folder_commits[folder][author] = folder_commits[folder].get(author, 0) + comms
                
        for folder, authors in folder_commits.items():
            total_folder_commits = sum(authors.values())
            if total_folder_commits == 0:
                analytics["bus_factor"][folder] = 1
                continue
                
            # Sort authors by commit volume in folder desc
            sorted_authors = sorted(authors.items(), key=lambda x: x[1], reverse=True)
            
            cumulative = 0
            bus_count = 0
            for author, comms in sorted_authors:
                cumulative += comms
                bus_count += 1
                if cumulative >= total_folder_commits * 0.5:
                    break
            analytics["bus_factor"][folder] = bus_count
            
    except Exception:
        # Graceful handling if git history extraction fails (e.g. shallow repo or config issues)
        pass
        
    return analytics
