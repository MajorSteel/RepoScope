import os

class Settings:
    PROJECT_NAME: str = "RepoScope"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./reposcope.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    ELASTICSEARCH_URL: str = os.getenv("ELASTICSEARCH_URL", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    
    # Ensure upload directory exists
    def __init__(self):
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)

settings = Settings()
