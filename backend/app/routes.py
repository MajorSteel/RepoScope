import os
import json
import shutil
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List, Dict, Any, Optional

from .database import get_db, SessionLocal
from .config import settings
from . import models, schemas, ingestion, parser, metrics, git_analytics, ai, export

router = APIRouter()

def run_analysis_pipeline(repo_id: int):
    """
    Asynchronous background analyzer that runs ingestion, parsing,
    git history computation, vulnerability auditing, and AI report synthesis.
    """
    db = SessionLocal()
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        db.close()
        return
        
    try:
        repo.status = "indexing"
        db.commit()
        
        # 1. Ingestion / Source fetching
        target_path = repo.path
        if repo.source_type == "git":
            temp_dir = os.path.join(settings.UPLOAD_DIR, "clones")
            os.makedirs(temp_dir, exist_ok=True)
            target_path = ingestion.clone_git_repository(repo.path, temp_dir)
            # Update path to cloned directory
            repo.path = target_path
            db.commit()
            
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Path does not exist: {target_path}")
            
        # 2. Topology Scan
        topo = ingestion.scan_directory_topology(target_path)
        repo.files_count = topo["files_count"]
        repo.folders_count = topo["folders_count"]
        repo.size_bytes = topo["size_bytes"]
        db.commit()
        
        # 3. Detect tech stack and configs
        lang_dist, frameworks, config_files = ingestion.detect_languages_and_configs(target_path)
        
        # 4. Insert File Index records and compute metrics
        flat_files = []
        
        def collect_files(node):
            if node["type"] == "file":
                flat_files.append(node)
            else:
                for child in node.get("children", []):
                    collect_files(child)
                    
        collect_files(topo["tree"])
        
        file_db_instances = {}
        for f in flat_files:
            file_path_abs = os.path.join(target_path, f["path"])
            _, ext = os.path.splitext(f["name"].lower())
            
            # Complexity and Maintainability
            cc = metrics.calculate_complexity(file_path_abs, ext)
            mi = metrics.calculate_maintainability_index(f["loc"], cc, f["size_bytes"])
            
            db_file = models.FileIndex(
                repo_id=repo.id,
                path=f["path"],
                name=f["name"],
                extension=ext,
                language=f["language"],
                size_bytes=f["size_bytes"],
                loc=f["loc"],
                complexity=cc,
                maintainability=mi
            )
            db.add(db_file)
            file_db_instances[f["path"]] = db_file
            
        db.commit() # Commit file indices so we have IDs
        
        # 5. Extract symbols and dependencies
        all_indexed_paths = list(file_db_instances.keys())
        symbols_list, resolved_deps = parser.parse_repository_source(target_path, all_indexed_paths)
        
        for sym in symbols_list:
            file_path = sym["file_path"]
            file_inst = file_db_instances.get(file_path)
            if file_inst:
                db_sym = models.Symbol(
                    repo_id=repo.id,
                    file_index_id=file_inst.id,
                    name=sym["name"],
                    type=sym["type"],
                    line_number=sym["line_number"],
                    signature=sym.get("signature"),
                    parent_name=sym.get("parent_name")
                )
                db.add(db_sym)
                
        for dep in resolved_deps:
            db_dep = models.Dependency(
                repo_id=repo.id,
                source_file=dep["source_file"],
                target_file=dep["target_file"],
                import_path=dep["import_path"],
                type=dep["type"]
            )
            db.add(db_dep)
            
        db.commit()
        
        # 6. Run Git Evolution Analytics
        git_results = git_analytics.analyze_git_repository(target_path)
        if git_results["is_git"]:
            # Insert Git Contributors
            for email, contrib in git_results["contributors"].items():
                db_contrib = models.GitContributor(
                    repo_id=repo.id,
                    name=contrib["name"],
                    email=email,
                    commits_count=contrib["commits_count"],
                    additions=contrib["additions"],
                    deletions=contrib["deletions"]
                )
                db.add(db_contrib)
                
            # Update File Indices with Git stats
            for path, churn in git_results["file_churn"].items():
                file_inst = file_db_instances.get(path)
                if file_inst:
                    file_inst.commits_count = churn["commits_count"]
                    file_inst.changes_churn = churn["additions"] + churn["deletions"]
                    
            for path, bug_count in git_results["bug_prone_files"].items():
                file_inst = file_db_instances.get(path)
                if file_inst:
                    file_inst.bug_fixes_count = bug_count
                    
            for path, owner_info in git_results["ownership"].items():
                file_inst = file_db_instances.get(path)
                if file_inst:
                    file_inst.primary_owner = owner_info["primary_owner"]
                    file_inst.ownership_percent = owner_info["ownership_percent"]
                    
            db.commit()
            
        # 7. Run Security Scanner
        for path, file_inst in file_db_instances.items():
            file_path_abs = os.path.join(target_path, path)
            vulns = metrics.scan_security_issues(file_path_abs, path, file_inst.language)
            for v in vulns:
                db_vuln = models.SecurityVulnerability(
                    repo_id=repo.id,
                    file_path=v["file_path"],
                    line_number=v["line_number"],
                    severity=v["severity"],
                    category=v["category"],
                    description=v["description"],
                    code_snippet=v["code_snippet"]
                )
                db.add(db_vuln)
        db.commit()
        
        # 8. Parse CI/CD workflows
        pipelines = metrics.parse_cicd_pipelines(target_path)
        for p in pipelines:
            db_p = models.PipelineNode(
                repo_id=repo.id,
                platform=p["platform"],
                stage=p["stage"],
                job_name=p["job_name"],
                commands=p["commands"],
                depends_on=p["depends_on"]
            )
            db.add(db_p)
        db.commit()
        
        # 9. Compute health smells and generate AI summary report
        files_db = db.query(models.FileIndex).filter(models.FileIndex.repo_id == repo.id).all()
        symbols_db = db.query(models.Symbol).filter(models.Symbol.repo_id == repo.id).all()
        deps_db = db.query(models.Dependency).filter(models.Dependency.repo_id == repo.id).all()
        vulns_db = db.query(models.SecurityVulnerability).filter(models.SecurityVulnerability.repo_id == repo.id).all()
        
        smells = metrics.find_architectural_smells(files_db, symbols_db, deps_db, target_path)
        
        # Compile a visual tree representation summary for the LLM prompt context
        tree_summary_lines = []
        for f in files_db[:15]: # Take first 15 files
            tree_summary_lines.append(f" - {f.path} (Language: {f.language}, LOC: {f.loc}, CC: {f.complexity})")
        tree_summary = "\n".join(tree_summary_lines)
        
        ai_markdown = ai.generate_repository_summary(
            repo_name=repo.name,
            tech_stack=frameworks,
            lang_dist=lang_dist,
            file_tree_summary=tree_summary,
            smells=smells
        )
        
        # Save Analysis Report
        avg_complexity = sum(f.complexity for f in files_db) / len(files_db) if files_db else 0.0
        avg_maintainability = sum(f.maintainability for f in files_db) / len(files_db) if files_db else 100.0
        
        db_report = models.AnalysisReport(
            repo_id=repo.id,
            complexity_avg=avg_complexity,
            maintainability_avg=avg_maintainability,
            languages_distribution=json.dumps(lang_dist),
            smells=json.dumps(smells),
            ai_summary=ai_markdown
        )
        db.add(db_report)
        
        repo.status = "completed"
        db.commit()
        
    except Exception as e:
        db.rollback()
        repo.status = "failed"
        repo.error_message = str(e)
        db.commit()
    finally:
        db.close()

# API Handlers

@router.post("/api/repositories", response_model=schemas.RepositoryResponse)
def ingest_repo(repo_in: schemas.RepositoryCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Ingests a repository (Git URL or Local Folder path)."""
    if not repo_in.path and not repo_in.clone_url:
        raise HTTPException(status_code=400, detail="Either path or clone_url must be provided.")
        
    name = repo_in.name
    source_type = "local"
    path_val = repo_in.path
    
    if repo_in.clone_url:
        source_type = "git"
        path_val = repo_in.clone_url
        if not name:
            name = repo_in.clone_url.split("/")[-1].replace(".git", "")
    else:
        if not name:
            name = os.path.basename(repo_in.path.rstrip("/\\"))
            
    db_repo = models.Repository(
        name=name,
        path=path_val,
        source_type=source_type,
        status="pending"
    )
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    
    background_tasks.add_task(run_analysis_pipeline, db_repo.id)
    return db_repo

@router.post("/api/repositories/upload", response_model=schemas.RepositoryResponse)
def upload_zip(background_tasks: BackgroundTasks, file: UploadFile = File(...), name: Optional[str] = Form(None), db: Session = Depends(get_db)):
    """Ingests an uploaded ZIP repository archive."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP archive files are supported.")
        
    zip_dir = os.path.join(settings.UPLOAD_DIR, "zips")
    os.makedirs(zip_dir, exist_ok=True)
    temp_zip = os.path.join(zip_dir, file.filename)
    
    with open(temp_zip, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    extracted_dir = os.path.join(settings.UPLOAD_DIR, "extracted")
    os.makedirs(extracted_dir, exist_ok=True)
    extracted_path = ingestion.extract_zip_archive(temp_zip, extracted_dir)
    
    repo_name = name or os.path.splitext(file.filename)[0]
    
    db_repo = models.Repository(
        name=repo_name,
        path=extracted_path,
        source_type="zip",
        status="pending"
    )
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    
    background_tasks.add_task(run_analysis_pipeline, db_repo.id)
    return db_repo

@router.get("/api/repositories", response_model=List[schemas.RepositoryResponse])
def list_repos(db: Session = Depends(get_db)):
    """Lists all analyzed repositories."""
    return db.query(models.Repository).all()

@router.get("/api/repositories/{id}", response_model=schemas.RepositoryResponse)
def get_repo(id: int, db: Session = Depends(get_db)):
    """Gets repository metadata."""
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo

@router.delete("/api/repositories/{id}")
def delete_repo(id: int, db: Session = Depends(get_db)):
    """Deletes a repository and all its indexed analysis data."""
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    # Delete local git clone/extracted folders if applicable
    if repo.source_type in ["git", "zip"] and os.path.exists(repo.path):
        shutil.rmtree(repo.path, ignore_errors=True)
        
    db.delete(repo)
    db.commit()
    return {"status": "success", "detail": f"Repository {id} deleted."}

@router.get("/api/repositories/{id}/topology", response_model=schemas.TopologyResponse)
def get_topology(id: int, db: Session = Depends(get_db)):
    """Fetches the hierarchical file system topology tree."""
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repo.status != "completed":
        raise HTTPException(status_code=400, detail=f"Repository analysis is in status '{repo.status}'.")
        
    # Rebuild directory topology from actual scanned folder (to keep dynamic tree nodes fast)
    topo = ingestion.scan_directory_topology(repo.path)
    return topo

@router.get("/api/repositories/{id}/dependencies", response_model=schemas.DependencyGraphResponse)
def get_dependencies(id: int, level: str = "file", db: Session = Depends(get_db)):
    """
    Returns dependency graph links and nodes.
    Supports file-to-file (level='file'), module-to-module (level='module'),
    and package-to-package (level='package') layouts.
    """
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    deps = db.query(models.Dependency).filter(models.Dependency.repo_id == id).all()
    files = db.query(models.FileIndex).filter(models.FileIndex.repo_id == id).all()
    
    nodes_dict = {}
    links = []
    
    if level == "file":
        # Node mapping
        for f in files:
            nodes_dict[f.path] = {
                "id": f.path,
                "label": f.name,
                "type": "file",
                "language": f.language,
                "loc": f.loc,
                "complexity": f.complexity,
                "maintainability": f.maintainability
            }
            
        for d in deps:
            if d.source_file in nodes_dict and d.target_file in nodes_dict:
                links.append({
                    "id": f"link-{d.id}",
                    "source": d.source_file,
                    "target": d.target_file,
                    "label": d.type
                })
                
    elif level == "module":
        # Module represents folders
        for f in files:
            folder = os.path.dirname(f.path).replace("\\", "/")
            if not folder:
                folder = "/"
            if folder not in nodes_dict:
                nodes_dict[folder] = {
                    "id": folder,
                    "label": folder,
                    "type": "module",
                    "files_count": 0,
                    "loc": 0
                }
            nodes_dict[folder]["files_count"] += 1
            nodes_dict[folder]["loc"] += f.loc
            
        # Deduplicated links at folder level
        added_links = set()
        for d in deps:
            src_folder = os.path.dirname(d.source_file).replace("\\", "/") or "/"
            tgt_folder = os.path.dirname(d.target_file).replace("\\", "/") or "/"
            
            if src_folder != tgt_folder and src_folder in nodes_dict and tgt_folder in nodes_dict:
                link_key = f"{src_folder}->{tgt_folder}"
                if link_key not in added_links:
                    added_links.add(link_key)
                    links.append({
                        "id": f"link-module-{len(links)}",
                        "source": src_folder,
                        "target": tgt_folder
                    })
                    
    elif level == "package":
        # Package level links external library dependencies
        # Target files that are not physical files inside our codebase
        internal_paths = set(f.path for f in files)
        package_nodes = set()
        
        # Gather external dependencies
        for d in deps:
            if d.target_file not in internal_paths:
                package_nodes.add(d.target_file)
                
        # Group file node dependencies to package
        for f in files:
            folder = os.path.dirname(f.path).replace("\\", "/") or "/"
            nodes_dict[folder] = {
                "id": folder,
                "label": folder,
                "type": "module"
            }
            
        for p in package_nodes:
            nodes_dict[p] = {
                "id": p,
                "label": p,
                "type": "external_package"
            }
            
        added_links = set()
        for d in deps:
            src_folder = os.path.dirname(d.source_file).replace("\\", "/") or "/"
            tgt = d.target_file
            
            if tgt not in internal_paths:
                link_key = f"{src_folder}->{tgt}"
                if link_key not in added_links:
                    added_links.add(link_key)
                    links.append({
                        "id": f"link-pkg-{len(links)}",
                        "source": src_folder,
                        "target": tgt
                    })
                    
    return {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

@router.get("/api/repositories/{id}/symbols", response_model=List[schemas.SymbolResponse])
def get_symbols(id: int, query: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetches indexed code symbols, supporting text query searches."""
    base_query = db.query(models.Symbol).filter(models.Symbol.repo_id == id)
    if query:
        base_query = base_query.filter(models.Symbol.name.like(f"%{query}%"))
    return base_query.all()

@router.get("/api/repositories/{id}/metrics")
def get_metrics_panel(id: int, db: Session = Depends(get_db)):
    """Fetches details for the Architecture Health Panel (averages, technical debt, smells)."""
    report = db.query(models.AnalysisReport).filter(models.AnalysisReport.repo_id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found")
        
    return {
        "complexity_avg": report.complexity_avg,
        "maintainability_avg": report.maintainability_avg,
        "languages": json.loads(report.languages_distribution),
        "smells": json.loads(report.smells)
    }

@router.get("/api/repositories/{id}/git")
def get_git_analytics_panel(id: int, db: Session = Depends(get_db)):
    """Fetches git contribution metrics, churn, hotspots, and bus factors."""
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    contributors = db.query(models.GitContributor).filter(models.GitContributor.repo_id == id).all()
    files = db.query(models.FileIndex).filter(models.FileIndex.repo_id == id).all()
    
    # Recalculate or load git analytics using the git_analytics module
    git_results = git_analytics.analyze_git_repository(repo.path)
    
    return {
        "is_git": git_results["is_git"],
        "commits": git_results["commits"][:100], # Cap history lists
        "contributors": [
            {
                "name": c.name,
                "email": c.email,
                "commits_count": c.commits_count,
                "additions": c.additions,
                "deletions": c.deletions
            } for c in contributors
        ],
        "hotspots": git_results["hotspots"],
        "bus_factor": git_results["bus_factor"],
        "bug_prone_files": [{"path": k, "bug_fixes": v} for k, v in git_results["bug_prone_files"].items()]
    }

@router.get("/api/repositories/{id}/security", response_model=List[schemas.SecurityVulnerabilityResponse])
def get_security_audit(id: int, db: Session = Depends(get_db)):
    """Fetches detected security vulnerabilities and exposed secrets."""
    return db.query(models.SecurityVulnerability).filter(models.SecurityVulnerability.repo_id == id).all()

@router.get("/api/repositories/{id}/cicd", response_model=List[schemas.PipelineNodeResponse])
def get_cicd_pipelines(id: int, db: Session = Depends(get_db)):
    """Fetches discovered CI/CD pipelines."""
    return db.query(models.PipelineNode).filter(models.PipelineNode.repo_id == id).all()

@router.post("/api/repositories/{id}/chat", response_model=schemas.AIChatResponse)
def ask_codebase_chat(id: int, req: schemas.AIChatRequest, db: Session = Depends(get_db)):
    """
    Executes a RAG-based query inside the repository codebase.
    """
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    files = db.query(models.FileIndex).filter(models.FileIndex.repo_id == id).all()
    symbols = db.query(models.Symbol).filter(models.Symbol.repo_id == id).all()
    
    # Dict formats for local parsing helpers
    files_list = [{"path": f.path, "name": f.name, "size_bytes": f.size_bytes} for f in files]
    
    # 1. Search relevant documents
    matched_contexts = ai.search_repo_codebase(req.query, repo.path, files_list, symbols)
    
    # 2. Query RAG Compiler
    response_text = ai.query_repository_chat(req.query, repo.path, matched_contexts)
    
    return {
        "response": response_text,
        "sources": matched_contexts
    }

@router.get("/api/benchmark", response_model=schemas.BenchmarkResponse)
def benchmark_repos(repo_a_id: int, repo_b_id: int, db: Session = Depends(get_db)):
    """
    Compares Repository A vs Repository B across multiple LOC, complexity,
    file counts, technical debt, and test setups side-by-side.
    """
    repo_a = db.query(models.Repository).filter(models.Repository.id == repo_a_id).first()
    repo_b = db.query(models.Repository).filter(models.Repository.id == repo_b_id).first()
    
    if not repo_a or not repo_b:
        raise HTTPException(status_code=404, detail="One or both repositories not found")
        
    files_a = db.query(models.FileIndex).filter(models.FileIndex.repo_id == repo_a_id).all()
    files_b = db.query(models.FileIndex).filter(models.FileIndex.repo_id == repo_b_id).all()
    
    report_a = db.query(models.AnalysisReport).filter(models.AnalysisReport.repo_id == repo_a_id).first()
    report_b = db.query(models.AnalysisReport).filter(models.AnalysisReport.repo_id == repo_b_id).first()
    
    # Compile stats
    loc_a = sum(f.loc for f in files_a)
    loc_b = sum(f.loc for f in files_b)
    
    cc_a = report_a.complexity_avg if report_a else 0.0
    cc_b = report_b.complexity_avg if report_b else 0.0
    
    mi_a = report_a.maintainability_avg if report_a else 100.0
    mi_b = report_b.maintainability_avg if report_b else 100.0
    
    deps_a = db.query(models.Dependency).filter(models.Dependency.repo_id == repo_a_id).count()
    deps_b = db.query(models.Dependency).filter(models.Dependency.repo_id == repo_b_id).count()
    
    langs_a = json.loads(report_a.languages_distribution) if report_a else {}
    langs_b = json.loads(report_b.languages_distribution) if report_b else {}
    
    def make_metric(v_a, v_b, inverse=False):
        better = "draw"
        delta = v_a - v_b
        if delta != 0:
            if not inverse:
                better = "A" if delta > 0 else "B"
            else:
                better = "B" if delta > 0 else "A"
        return {"value_a": v_a, "value_b": v_b, "delta": abs(delta), "better": better}
        
    metrics_map = {
        "files_count": make_metric(repo_a.files_count, repo_b.files_count),
        "loc": make_metric(loc_a, loc_b),
        "complexity_avg": make_metric(cc_a, cc_b, inverse=True),
        "maintainability_avg": make_metric(mi_a, mi_b),
        "dependency_count": make_metric(deps_a, deps_b, inverse=True),
        "size_bytes": make_metric(repo_a.size_bytes, repo_b.size_bytes, inverse=True)
    }
    
    return {
        "repo_a_name": repo_a.name,
        "repo_b_name": repo_b.name,
        "metrics": metrics_map,
        "languages_a": langs_a,
        "languages_b": langs_b
    }

@router.get("/api/repositories/{id}/export/{format}")
def trigger_export(id: int, format: str, db: Session = Depends(get_db)):
    """Triggers download of generated JSON, CSV, Markdown, or PDF reports."""
    repo = db.query(models.Repository).filter(models.Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    files = db.query(models.FileIndex).filter(models.FileIndex.repo_id == id).all()
    report = db.query(models.AnalysisReport).filter(models.AnalysisReport.repo_id == id).first()
    vulnerabilities = db.query(models.SecurityVulnerability).filter(models.SecurityVulnerability.repo_id == id).all()
    
    smells = json.loads(report.smells) if report else []
    summary = report.ai_summary if report else ""
    
    if format == "csv":
        csv_data = export.generate_csv_report(files)
        return StreamingResponse(
            io.StringIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reposcope-{repo.name}-audit.csv"}
        )
    elif format == "json":
        deps = db.query(models.Dependency).filter(models.Dependency.repo_id == id).all()
        symbols = db.query(models.Symbol).filter(models.Symbol.repo_id == id).all()
        contributors = db.query(models.GitContributor).filter(models.GitContributor.repo_id == id).all()
        
        json_data = export.generate_json_report(repo, files, deps, symbols, contributors, vulnerabilities, smells, summary)
        return StreamingResponse(
            io.StringIO(json_data),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=reposcope-{repo.name}-audit.json"}
        )
    elif format == "markdown":
        md_data = export.generate_markdown_report(repo, files, smells, summary)
        return StreamingResponse(
            io.StringIO(md_data),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=reposcope-{repo.name}-audit.md"}
        )
    elif format == "pdf":
        pdf_bytes = export.generate_pdf_report(repo, files, vulnerabilities, smells, summary)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=reposcope-{repo.name}-audit.pdf"}
        )
    else:
        raise HTTPException(status_code=400, detail="Supported export formats: csv, json, markdown, pdf.")
