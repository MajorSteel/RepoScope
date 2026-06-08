from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class RepositoryCreate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    clone_url: Optional[str] = None

class RepositoryResponse(BaseModel):
    id: int
    name: str
    path: str
    source_type: str
    status: str
    error_message: Optional[str] = None
    files_count: int
    folders_count: int
    size_bytes: int
    created_at: datetime

    class Config:
        from_attributes = True

class FileIndexResponse(BaseModel):
    id: int
    repo_id: int
    path: str
    name: str
    extension: str
    language: str
    size_bytes: int
    loc: int
    complexity: int
    maintainability: float
    commits_count: int
    changes_churn: int
    bug_fixes_count: int
    primary_owner: Optional[str] = None
    ownership_percent: float

    class Config:
        from_attributes = True

class SymbolResponse(BaseModel):
    id: int
    repo_id: int
    file_index_id: int
    name: str
    type: str
    line_number: int
    signature: Optional[str] = None
    parent_name: Optional[str] = None

    class Config:
        from_attributes = True

class DependencyResponse(BaseModel):
    id: int
    repo_id: int
    source_file: str
    target_file: str
    import_path: str
    type: str

    class Config:
        from_attributes = True

class GitContributorResponse(BaseModel):
    id: int
    repo_id: int
    name: str
    email: str
    commits_count: int
    additions: int
    deletions: int

    class Config:
        from_attributes = True

class SecurityVulnerabilityResponse(BaseModel):
    id: int
    repo_id: int
    file_path: str
    line_number: int
    severity: str
    category: str
    description: str
    code_snippet: str

    class Config:
        from_attributes = True

class PipelineNodeResponse(BaseModel):
    id: int
    repo_id: int
    platform: str
    stage: str
    job_name: str
    commands: Optional[str] = None
    depends_on: Optional[str] = None

    class Config:
        from_attributes = True

class AnalysisReportResponse(BaseModel):
    id: int
    repo_id: int
    complexity_avg: float
    maintainability_avg: float
    languages_distribution: str # JSON
    smells: str # JSON
    ai_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TopologyResponse(BaseModel):
    tree: Dict[str, Any]
    files_count: int
    folders_count: int
    size_bytes: int

class DependencyGraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]

class BenchmarkMetric(BaseModel):
    value_a: Any
    value_b: Any
    delta: Optional[Any] = None
    better: Optional[str] = None # 'A', 'B', or 'draw'

class BenchmarkResponse(BaseModel):
    repo_a_name: str
    repo_b_name: str
    metrics: Dict[str, BenchmarkMetric]
    languages_a: Dict[str, float]
    languages_b: Dict[str, float]

class AIChatRequest(BaseModel):
    query: str

class AIChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]]
