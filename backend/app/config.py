import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dpki-secure-college-demo-key-2026")
    JWT_SECRET = os.environ.get("JWT_SECRET", "dpki-jwt-cross-federation-secret-9988")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 12
    DATABASE_PATH = os.environ.get("DATABASE_PATH", str(DATA_DIR / "dpki_database.db"))

