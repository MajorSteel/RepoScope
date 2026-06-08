import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .routes import router, run_analysis_pipeline
from .models import Repository
from .config import settings

# Create database tables
Base.metadata.create_all(bind=engine)

# Preload sample repositories if database is empty on start
db = SessionLocal()
try:
    if db.query(Repository).count() == 0:
        sample1_path = os.path.abspath("samples/demo-project").replace("\\", "/")
        sample2_path = os.path.abspath("samples/demo-project-v2").replace("\\", "/")
        
        if os.path.exists(sample1_path):
            repo1 = Repository(name="Calculator Service v1", path=sample1_path, source_type="local", status="pending")
            db.add(repo1)
            db.commit()
            db.refresh(repo1)
            run_analysis_pipeline(repo1.id)
            
        if os.path.exists(sample2_path):
            repo2 = Repository(name="Calculator Service v2", path=sample2_path, source_type="local", status="pending")
            db.add(repo2)
            db.commit()
            db.refresh(repo2)
            run_analysis_pipeline(repo2.id)
finally:
    db.close()

app = FastAPI(title=settings.PROJECT_NAME)

# CORS middleware config to allow Next.js development server connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def get_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "database_url": settings.DATABASE_URL.split("://")[0] + "://...",
        "groq_api_key_loaded": bool(settings.GROQ_API_KEY)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
