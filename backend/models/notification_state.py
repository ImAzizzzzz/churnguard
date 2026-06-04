"""Per-user read/dismissed state for the derived notification alerts.

Notifications themselves are computed live from the data (stable ids like
'critical'/'high'/'medium'/'stable'); this table only records, per user, which
of those ids they've seen or dismissed — so the state survives reloads and is
shared across devices instead of living in localStorage.
"""
import uuid
import datetime

from sqlalchemy import Column, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class NotificationState(Base):
    __tablename__ = "notification_state"
    __table_args__ = (UniqueConstraint("user_id", "notif_id", name="uq_notif_user_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    notif_id = Column(String, nullable=False)
    seen = Column(Boolean, nullable=False, default=False)
    dismissed = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
