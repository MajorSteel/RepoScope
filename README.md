# RepoScope – Repository Structure Analysis & Visualization System

RepoScope is a production-grade software intelligence platform that scans, parses, indexes, visualizes, and benchmarks codebase repositories of any size. It exposes structural metrics (SonarQube-style heatmaps), Git history evolution (churn, activity hotspots, bus factors), code symbol trees, full-text codebase search, security vulnerability analysis, and CI/CD pipeline deployment views.

---

## Key Features

1. **Repository Ingestion**: Scans local directory paths, clones git repos over HTTPS, and parses uploaded ZIP archives.
2. **Topology & Metrics Engine**: Hierarchical explorer of directories calculating lines of code (LOC), size, languages, Cyclomatic Complexity, and Maintainability Index.
3. **Architecture Heatmap**: Displays codebase files as a Treemap where size reflects LOC and color codes maintainability (green -> red).
4. **Knowledge Graph**: Interactive node-link visualizer mapping dependencies at File, Module, and Package levels (powered by React Flow).
5. **Git Evolution & Contributor Intelligence**: Maps commit counts, churn rates, hotspots, bug-prone files, developer ownerships, and directory Bus Factors using Git logs.
6. **Security Vulnerability Audits**: Audits source code for hardcoded secrets, private keys, and unsafe API patterns.
7. **CI/CD Workflows**: Detects GitHub Actions, GitLab CI, and Docker files, generating copyable Mermaid diagrams.
8. **AI Architecture Summarizer & Chat**: RAG-powered chatbot allowing you to ask natural language questions about the codebase, with automated onboard Markdown summaries.
9. **Benchmarking**: Performs side-by-side comparative audits of two repos highlighting metrics deltas.

---

## Technology Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, NetworkX, GitPython, PyTest, ReportLab.
- **Frontend**: Next.js 15 (TypeScript, Tailwind CSS v4, React Flow, Recharts, Lucide Icons).
- **Production Layer (Docker)**: PostgreSQL (DB), Redis (Cache), Elasticsearch (Search cluster).

---

## Project Structure

```
gdsc2/
 ├── backend/
 │    ├── app/
 │    │    ├── config.py         # App configurations
 │    │    ├── database.py       # SQL Alchemy init
 │    │    ├── models.py         # DB entities (tables)
 │    │    ├── schemas.py        # Pydantic request/response validation
 │    │    ├── ingestion.py      # Folder, Git, ZIP ingesters
 │    │    ├── parser.py         # AST & regex code parsers
 │    │    ├── metrics.py        # Complexity, smells, secrets audits
 │    │    ├── git_analytics.py  # Churn, contributors, Bus Factor
 │    │    ├── ai.py             # LLM Summaries and local RAG search
 │    │    ├── export.py         # PDF, CSV, JSON, Markdown reports
 │    │    ├── routes.py         # REST endpoints and background tasks
 │    │    └── main.py           # FastAPI entrypoint
 │    └── requirements.txt       # Python dependencies
 ├── frontend/
 │    ├── src/
 │    │    ├── app/              # Next.js layouts, styling, global css
 │    │    ├── components/       # Dashboard, explorer, charts, graphs
 │    │    └── lib/api.ts        # API client connector
 │    └── package.json           # Node packages
 ├── samples/                    # Calculator mock codebases for preloading
 ├── Dockerfile.backend
 ├── Dockerfile.frontend
 ├── docker-compose.yml
 └── README.md
```

---

## Local Development Setup

### 1. Backend Server Setup
From the root directory:
```bash
# Create python virtual environment
python -m venv backend/.venv

# Activate virtual environment
# On Windows:
backend/.venv/Scripts/activate
# On Unix:
source backend/.venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Start backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The API documentation will be interactive at: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup
From the root directory:
```bash
# Move to frontend directory
cd frontend

# Install Node modules
npm install

# Start Next.js development server
npm run dev
```
Open `http://localhost:3000` to interact with the RepoScope dashboard!

---

## Running Automated Tests

Run the PyTest test suite:
```bash
# Windows
$env:PYTHONPATH = "backend"
backend/.venv/Scripts/python -m pytest backend/tests/

# Unix
PYTHONPATH=backend ./backend/.venv/bin/pytest backend/tests/
```

---

## Docker Production Deployment

To spin up the complete containerized stack (including PostgreSQL, Redis, and Elasticsearch):
```bash
# Start Docker compose
docker-compose up --build -d
```
The client dashboard will run on port `3000`, the FastAPI service on `8000`, and Elasticsearch search nodes on `9200`.

---

## API Endpoints

- `POST /api/repositories`: Ingest repo.
- `POST /api/repositories/upload`: Upload ZIP repo.
- `GET /api/repositories`: List repositories.
- `GET /api/repositories/{id}/topology`: Folder/file tree nodes.
- `GET /api/repositories/{id}/dependencies`: Graph elements (nodes/links).
- `GET /api/repositories/{id}/git`: Contributors, hotspots, Bus Factor.
- `GET /api/repositories/{id}/security`: Secret scan issues list.
- `GET /api/repositories/{id}/cicd`: Pipeline jobs and script steps.
- `POST /api/repositories/{id}/chat`: Execute RAG chat.
- `GET /api/benchmark`: side-by-side comparison values.
- `GET /api/repositories/{id}/export/{format}`: Trigger PDF, CSV, JSON, MD downloads.
