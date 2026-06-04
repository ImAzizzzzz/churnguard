from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid
import datetime


class Watchlist(Base):
    """A customer flagged by an admin for retention follow-up."""
    __tablename__ = "watchlist"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_no   = Column(String, nullable=False, index=True)
    account_no    = Column(String, nullable=True)
    note          = Column(Text, nullable=True)
    added_by      = Column(String, nullable=True)   # admin user id
    added_by_name = Column(String, nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)


class Intervention(Base):
    """A retention action logged against a customer, with an outcome."""
    __tablename__ = "interventions"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_no    = Column(String, nullable=False, index=True)
    account_no     = Column(String, nullable=True)
    action         = Column(String, nullable=False)   # e.g. "Personal call", "Fee waiver"
    status         = Column(String, nullable=False, default="open")     # open | in_progress | done
    outcome        = Column(String, nullable=False, default="pending")  # pending | retained | churned
    note           = Column(Text, nullable=True)
    created_by     = Column(String, nullable=True)
    created_by_name = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
