"""
Source-of-truth ORM models for the two core data tables.

These tables are populated outside the app (data pipeline / CSV upload), so the
models are effectively read-only documentation of the live schema. They are NOT
created by ``Base.metadata.create_all`` unless the tables are absent — the real
data is owned by the ingestion pipeline. Keeping them here gives one canonical
place to see every column instead of hunting through raw SQL strings.

Composite key on (customer_no, account_no): a customer holds many accounts, each
with its own churn prediction.
"""
from sqlalchemy import Column, BigInteger, Float, Text
from database import Base


class ClientClean(Base):
    __tablename__ = "clients_clean"

    customer_no = Column(BigInteger, primary_key=True)
    account_no = Column(Float, primary_key=True)
    lob = Column(BigInteger)
    industry = Column(BigInteger)
    nationality = Column(Text)
    residence = Column(Text)
    partyclass = Column(Text)
    branch = Column(BigInteger)
    account_status = Column(Text)
    score_kyc = Column(Text)
    nature_client = Column(Text)
    marital_status = Column(Text)
    age = Column(Float)
    tenure = Column(Float)
    account_category = Column(Float)
    currency = Column(Text)
    accountnature = Column(Text)
    acct_balance = Column(Float)
    churn = Column(BigInteger)
    residence_grouped = Column(Text)
    nationality_grouped = Column(Text)


class ChurnPrediction(Base):
    __tablename__ = "churn_predictions"

    customer_no = Column(BigInteger, primary_key=True)
    account_no = Column(Float, primary_key=True)
    churn_reel = Column(BigInteger)
    churn_predit = Column(BigInteger)
    probabilite_churn = Column(Float)
    segment_risque = Column(Text)
