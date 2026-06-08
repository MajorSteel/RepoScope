from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Repository(Base):
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String)
    source_type = Column(String) # local, git, zip
    status = Column(String, default="pending") # pending, indexing, completed, failed
    error_message = Column(String, nullable=True)
    files_count = Column(Integer, default=0)
    folders_count = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    files = relationship("FileIndex", back_populates="repository", cascade="all, delete-orphan")
    symbols = relationship("Symbol", back_populates="repository", cascade="all, delete-orphan")
    dependencies = relationship("Dependency", back_populates="repository", cascade="all, delete-orphan")
    contributors = relationship("GitContributor", back_populates="repository", cascade="all, delete-orphan")
    vulnerabilities = relationship("SecurityVulnerability", back_populates="repository", cascade="all, delete-orphan")
    pipelines = relationship("PipelineNode", back_populates="repository", cascade="all, delete-orphan")
    report = relationship("AnalysisReport", back_populates="repository", uselist=False, cascade="all, delete-orphan")

class FileIndex(Base):
    __tablename__ = "file_indices"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    path = Column(String, index=True)
    name = Column(String)
    extension = Column(String)
    language = Column(String)
    size_bytes = Column(Integer, default=0)
    loc = Column(Integer, default=0)
    complexity = Column(Integer, default=0)
    maintainability = Column(Float, default=100.0)
    commits_count = Column(Integer, default=0)
    changes_churn = Column(Integer, default=0)
    bug_fixes_count = Column(Integer, default=0)
    primary_owner = Column(String, nullable=True)
    ownership_percent = Column(Float, default=0.0)
    
    repository = relationship("Repository", back_populates="files")
    symbols = relationship("Symbol", back_populates="file_index", cascade="all, delete-orphan")

class Symbol(Base):
    __tablename__ = "symbols"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    file_index_id = Column(Integer, ForeignKey("file_indices.id"))
    name = Column(String, index=True)
    type = Column(String) # class, function, method, interface
    line_number = Column(Integer)
    signature = Column(String, nullable=True)
    parent_name = Column(String, nullable=True) # e.g. ClassName
    
    repository = relationship("Repository", back_populates="symbols")
    file_index = relationship("FileIndex", back_populates="symbols")

class Dependency(Base):
    __tablename__ = "dependencies"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    source_file = Column(String, index=True) # relative path
    target_file = Column(String, index=True) # relative path or external library
    import_path = Column(String)
    type = Column(String) # import, include
    
    repository = relationship("Repository", back_populates="dependencies")

class GitContributor(Base):
    __tablename__ = "git_contributors"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    name = Column(String, index=True)
    email = Column(String)
    commits_count = Column(Integer, default=0)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    
    repository = relationship("Repository", back_populates="contributors")

class SecurityVulnerability(Base):
    __tablename__ = "security_vulnerabilities"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    file_path = Column(String, index=True)
    line_number = Column(Integer)
    severity = Column(String) # Critical, High, Medium, Low
    category = Column(String) # Secret, Dangerous Import, Unsafe Pattern
    description = Column(String)
    code_snippet = Column(String)
    
    repository = relationship("Repository", back_populates="vulnerabilities")

class PipelineNode(Base):
    __tablename__ = "pipeline_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"))
    platform = Column(String) # GitHub Actions, GitLab CI, Jenkins, Docker, K8s
    stage = Column(String) # build, test, deploy, etc.
    job_name = Column(String)
    commands = Column(Text, nullable=True) # JSON list
    depends_on = Column(Text, nullable=True) # JSON list
    
    repository = relationship("Repository", back_populates="pipelines")

class AnalysisReport(Base):
    __tablename__ = "analysis_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), unique=True)
    complexity_avg = Column(Float, default=0.0)
    maintainability_avg = Column(Float, default=100.0)
    languages_distribution = Column(Text) # JSON dict string
    smells = Column(Text) # JSON list string
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    repository = relationship("Repository", back_populates="report")
