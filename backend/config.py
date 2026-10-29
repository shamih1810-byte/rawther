import os
from pathlib import Path
from dotenv import load_dotenv

# Base backend directory
BASE_DIR = Path(__file__).resolve().parent

# Load .env
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'biriyani.db'}")
SECRET_KEY = os.getenv("SECRET_KEY", "biriyani_secret_super_key_jwt_2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "rawadmin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "rawadmin786")
STAFF_USERNAME = os.getenv("STAFF_USERNAME", "rawchef")
STAFF_PASSWORD = os.getenv("STAFF_PASSWORD", "rawchef786")

RESTAURANT_NAME = os.getenv("RESTAURANT_NAME", "Rawther Biriyani")
CURRENCY_SYMBOL = os.getenv("CURRENCY_SYMBOL", "₹")
RATE_LIMIT_ORDERS_PER_MINUTE = int(os.getenv("RATE_LIMIT_ORDERS_PER_MINUTE", "3"))

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
