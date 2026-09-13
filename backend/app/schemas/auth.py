from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginUserInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    role: str


class LoginResponse(TokenResponse):
    user: LoginUserInfo


class UserRole(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole