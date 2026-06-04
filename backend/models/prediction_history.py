from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid
import datetime


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_no   = Column(String, nullable=True, index=True)   # links a prediction to a customer
    admin_id      = Column(String, nullable=True)
    admin_name    = Column(String, nullable=True)
    customer_data = Column(JSON, nullable=True)   # full input snapshot
    churn_prob    = Column(Float, nullable=True)
    risk_level    = Column(String, nullable=True)
    confidence    = Column(String, nullable=True)
    shap_json     = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)
