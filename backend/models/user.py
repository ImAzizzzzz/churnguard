from sqlalchemy import Column, String, DateTime, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid, datetime, enum

class RoleEnum(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"

class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email        = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name    = Column(String, nullable=True)
    role         = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.admin)
    created_at   = Column(DateTime, default=datetime.datetime.utcnow)
    is_active    = Column(Boolean, default=True, nullable=False)
    phone        = Column(String, nullable=True)
    department   = Column(String, nullable=True)
    avatar       = Column(String, nullable=True)  # base64 data URI
