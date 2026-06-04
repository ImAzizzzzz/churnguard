from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid
import datetime


class DigestSchedule(Base):
    """Per-admin configuration for a scheduled email digest of churn risk.

    NOTE: This is a configuration + stub only. No emails are actually sent and
    no background scheduler runs yet — sending will be wired up later once an
    SMTP provider is added. The model simply persists the user's preferences.
    """
    __tablename__ = "digest_schedules"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_email   = Column(String, nullable=False, index=True)  # one config per admin
    enabled       = Column(Boolean, nullable=False, default=False)
    frequency     = Column(String, nullable=False, default="weekly")  # daily | weekly | monthly
    recipients    = Column(Text, nullable=True)        # comma-separated email addresses
    risk_threshold = Column(String, nullable=False, default="high")   # high | medium | all
    last_run_at   = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
