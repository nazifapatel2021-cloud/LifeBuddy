import os
import hmac
import hashlib
import base64
import json
import secrets
import time
from fastapi import Header, HTTPException, status
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16
)

SECRET_KEY = os.environ.get("LIFEBUDDY_SECRET_KEY", "lifebuddy_mindful_productivity_secret_2026_super_secure_key")
ACCESS_TOKEN_EXPIRY_SECONDS = int(os.environ.get("ACCESS_TOKEN_EXPIRY_SECONDS", 15 * 60))        # 15 minutes
REFRESH_TOKEN_EXPIRY_SECONDS = int(os.environ.get("REFRESH_TOKEN_EXPIRY_SECONDS", 7 * 24 * 3600))  # 7 days

def hash_password(password: str) -> str:
    """Hashes password using Argon2id (PHC winner)."""
    return ph.hash(password)

def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies password using Argon2 with graceful PBKDF2 backwards compatibility."""
    if not stored_hash:
        return False
    try:
        # Check if hash is Argon2 format
        if stored_hash.startswith("$argon2"):
            try:
                ph.verify(stored_hash, password)
                return True
            except (VerifyMismatchError, VerificationError):
                return False

        # Fallback to PBKDF2 for legacy / seeded demo accounts
        if ":" in stored_hash:
            salt, key_hex = stored_hash.split(":", 1)
            key = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                100000
            )
            return hmac.compare_digest(key.hex(), key_hex)

        return False
    except Exception:
        return False

def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def _b64_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ""
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))

def create_access_token(user_id: int, username: str) -> str:
    """Issues short-lived JWT access token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "type": "access",
        "exp": int(time.time()) + ACCESS_TOKEN_EXPIRY_SECONDS,
        "jti": secrets.token_hex(8)
    }
    
    header_bytes = _b64_encode(json.dumps(header).encode("utf-8"))
    payload_bytes = _b64_encode(json.dumps(payload).encode("utf-8"))
    message = f"{header_bytes}.{payload_bytes}"
    
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).digest()
    sig_b64 = _b64_encode(signature)
    
    return f"{message}.{sig_b64}"

def create_refresh_token(user_id: int, username: str) -> str:
    """Issues long-lived JWT refresh token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "type": "refresh",
        "exp": int(time.time()) + REFRESH_TOKEN_EXPIRY_SECONDS,
        "jti": secrets.token_hex(16)
    }
    
    header_bytes = _b64_encode(json.dumps(header).encode("utf-8"))
    payload_bytes = _b64_encode(json.dumps(payload).encode("utf-8"))
    message = f"{header_bytes}.{payload_bytes}"
    
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).digest()
    sig_b64 = _b64_encode(signature)
    
    return f"{message}.{sig_b64}"

def verify_token(token: str, expected_type: str = "access") -> dict:
    """Verifies HS256 signature, expiry, and token type."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        message = f"{parts[0]}.{parts[1]}"
        expected_sig = _b64_encode(hmac.new(
            SECRET_KEY.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256
        ).digest())
        
        if not hmac.compare_digest(expected_sig, parts[2]):
            return None
        
        payload = json.loads(_b64_decode(parts[1]).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None

        # If token type specified, verify
        token_type = payload.get("type", "access")
        if expected_type and token_type != expected_type:
            return None
        
        return payload
    except Exception:
        return None

def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    
    token = authorization.replace("Bearer ", "").strip()
    payload = verify_token(token, expected_type="access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )
    
    return {"id": payload["sub"], "username": payload["username"]}
