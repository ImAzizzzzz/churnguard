import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, SessionLocal, Base
from models.user import User, RoleEnum
from models.permissions import UserPermissions  # noqa: F401 — ensures table is created
from models.prediction_history import PredictionHistory  # noqa: F401 — ensures table is created
from models.workflow import Watchlist, Intervention  # noqa: F401 — ensures tables are created
from models.schedule import DigestSchedule  # noqa: F401 — ensures table is created
from models.notification_state import NotificationState  # noqa: F401 — ensures table is created
from models import data as _data_models  # noqa: F401 — schema source of truth for core tables
from services.auth_service import hash_password
from services.ml_service import load_model
from routers import auth, predict, analytics, reports, chat, notifications
from routers import customers, permissions, upload, workflow, schedules
from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("churnguard")


# New columns added after the initial schema. Lightweight forward-only migrations
# applied on startup. For anything more complex, adopt Alembic.
_PERM_COLS = [
    "show_revenue_at_risk", "show_churn_trend", "show_high_risk_table",
    "show_churn_by_partyclass", "show_churn_by_nature",
    "show_insights_marital", "show_insights_tenure", "show_insights_balance",
    "show_insights_age", "show_insights_kyc", "show_cohort_compare",
    "show_what_if_simulator",
]


def _run_migrations() -> None:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"))
        conn.execute(text("ALTER TABLE prediction_history ADD COLUMN IF NOT EXISTS customer_no VARCHAR"))
        for col in _PERM_COLS:
            conn.execute(text(
                f"ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS {col} BOOLEAN NOT NULL DEFAULT TRUE"
            ))

        # Fix the historical is_active column: it was created as VARCHAR ("true"/"false"),
        # which made every value truthy → disabled accounts could still log in.
        col_type = conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'is_active'"
        )).scalar()
        if col_type and col_type != "boolean":
            log.info("Migrating users.is_active %s -> boolean", col_type)
            conn.execute(text(
                "ALTER TABLE users ALTER COLUMN is_active DROP DEFAULT"
            ))
            conn.execute(text(
                "ALTER TABLE users ALTER COLUMN is_active TYPE boolean "
                "USING (lower(is_active::text) IN ('true','t','1','yes','y'))"
            ))
            conn.execute(text(
                "ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true"
            ))
            conn.execute(text(
                "ALTER TABLE users ALTER COLUMN is_active SET NOT NULL"
            ))
        conn.commit()


def _ensure_superadmin() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.FIRST_SUPERADMIN_EMAIL).first()
        if not existing:
            db.add(User(
                email=settings.FIRST_SUPERADMIN_EMAIL,
                hashed_password=hash_password(settings.FIRST_SUPERADMIN_PASSWORD),
                full_name="Super Admin",
                role=RoleEnum.super_admin,
            ))
            db.commit()
            log.info("Super admin created: %s", settings.FIRST_SUPERADMIN_EMAIL)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        log.warning("DB schema creation failed: %s", e)
    try:
        load_model()
    except Exception as e:
        log.warning("Model load error: %s", e)
    try:
        _run_migrations()
    except Exception as e:
        log.info("Column migration note: %s", e)
    try:
        _ensure_superadmin()
    except Exception as e:
        log.warning("DB startup error: %s", e)
    yield


app = FastAPI(title="Churn Prediction API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(chat.router)
app.include_router(notifications.router)
app.include_router(customers.router)
app.include_router(permissions.router)
app.include_router(upload.router)
app.include_router(workflow.router)
app.include_router(schedules.router)


@app.get("/")
def root():
    return {"status": "Churn API running"}
