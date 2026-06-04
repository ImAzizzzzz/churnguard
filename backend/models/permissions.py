import uuid
from sqlalchemy import Column, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class UserPermissions(Base):
    __tablename__ = "user_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # ---- Page access -------------------------------------------------------
    can_view_dashboard = Column(Boolean, default=True, nullable=False)
    can_view_predictions = Column(Boolean, default=True, nullable=False)
    can_view_insights = Column(Boolean, default=True, nullable=False)
    can_view_reports = Column(Boolean, default=True, nullable=False)

    # ---- Feature access ----------------------------------------------------
    can_export_data = Column(Boolean, default=True, nullable=False)
    can_batch_predict = Column(Boolean, default=True, nullable=False)
    can_view_analytics = Column(Boolean, default=True, nullable=False)

    # ---- Chart visibility (Dashboard) --------------------------------------
    show_risk_chart = Column(Boolean, default=True, nullable=False)
    show_confusion_matrix = Column(Boolean, default=True, nullable=False)
    show_probability_dist = Column(Boolean, default=True, nullable=False)
    show_churn_by_age = Column(Boolean, default=True, nullable=False)
    show_churn_by_tenure = Column(Boolean, default=True, nullable=False)
    show_churn_by_balance = Column(Boolean, default=True, nullable=False)
    show_churn_by_industry = Column(Boolean, default=True, nullable=False)
    show_churn_by_nationality = Column(Boolean, default=True, nullable=False)

    # ---- Chart visibility — Dashboard (new) --------------------------------
    show_revenue_at_risk     = Column(Boolean, default=True, nullable=False)
    show_churn_trend         = Column(Boolean, default=True, nullable=False)
    show_high_risk_table     = Column(Boolean, default=True, nullable=False)
    show_churn_by_partyclass = Column(Boolean, default=True, nullable=False)
    show_churn_by_nature     = Column(Boolean, default=True, nullable=False)

    # ---- Chart visibility — Insights (new) ---------------------------------
    show_insights_marital    = Column(Boolean, default=True, nullable=False)
    show_insights_tenure     = Column(Boolean, default=True, nullable=False)
    show_insights_balance    = Column(Boolean, default=True, nullable=False)
    show_insights_age        = Column(Boolean, default=True, nullable=False)
    show_insights_kyc        = Column(Boolean, default=True, nullable=False)
    show_cohort_compare      = Column(Boolean, default=True, nullable=False)

    # ---- Chart visibility — Predict (new) ----------------------------------
    show_what_if_simulator   = Column(Boolean, default=True, nullable=False)
