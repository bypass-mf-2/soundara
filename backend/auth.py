"""
Authentication module for Soundara
Handles JWT token generation, verification, and user authentication
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import os

# Load from environment variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Security schemes
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a stored password against one provided by user."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Dictionary containing user info (user_id, email, etc.)
        expires_delta: Optional expiration time delta
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create JWT refresh token with longer expiration
    
    Args:
        data: Dictionary containing user info
    
    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verify JWT token and extract user information
    
    Args:
        credentials: HTTP Bearer credentials from request header
    
    Returns:
        Dictionary containing token payload (user_id, email, etc.)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != "access":
            raise credentials_exception
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        
        return payload
        
    except JWTError:
        raise credentials_exception


def verify_refresh_token(token: str) -> dict:
    """
    Verify refresh token
    
    Args:
        token: Refresh token string
    
    Returns:
        Dictionary containing token payload
    
    Raises:
        HTTPException: If token is invalid or not a refresh token
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Verify token type
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        return payload
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verify that the user has admin privileges
    
    Args:
        credentials: HTTP Bearer credentials from request header
    
    Returns:
        Dictionary containing token payload
    
    Raises:
        HTTPException: If user is not admin or token is invalid
    """
    payload = verify_token(credentials)
    
    if not payload.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return payload


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Extract current user_id from token (convenience function)
    
    Args:
        credentials: HTTP Bearer credentials from request header
    
    Returns:
        User ID string
    """
    payload = verify_token(credentials)
    return payload.get("sub")


# Optional: Token blacklist for logout functionality
class TokenBlacklist:
    """
    Simple in-memory token blacklist
    In production, use Redis or database
    """
    def __init__(self):
        self.blacklisted_tokens = set()
    
    def add(self, token: str):
        """Add token to blacklist"""
        self.blacklisted_tokens.add(token)
    
    def is_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        return token in self.blacklisted_tokens
    
    def cleanup_expired(self):
        """
        Remove expired tokens from blacklist
        Should be run periodically (e.g., daily cron job)
        """
        # Implementation would decode each token and check expiration
        # For now, just clear all (since in-memory resets on restart anyway)
        pass


# Global blacklist instance
token_blacklist = TokenBlacklist()