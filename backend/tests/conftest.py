"""
Pytest configuration for the ChurnGuard backend test-suite.

Sets safe default environment variables BEFORE any application module is
imported, so tests run without a real .env file or live database. The
SQLAlchemy engine is created lazily, so a dummy DATABASE_URL is enough for
the pure-logic unit tests below — no connection is ever opened.
"""
import os
import sys
from pathlib import Path

# Ensure the backend package root is importable (services/, config, ...)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Provide defaults only if the developer's .env hasn't already set them.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unit-tests")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")
os.environ.setdefault("FIRST_SUPERADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("FIRST_SUPERADMIN_PASSWORD", "test-password")
