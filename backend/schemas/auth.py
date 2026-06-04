from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from enum import Enum
import datetime

class RoleEnum(str, Enum):
    super_admin = "super_admin"
    admin = "admin"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: RoleEnum = RoleEnum.admin
    phone: Optional[str] = None
    department: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[RoleEnum] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    avatar: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    role: RoleEnum
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime.datetime] = None
    avatar: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
