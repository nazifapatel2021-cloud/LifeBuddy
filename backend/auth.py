import os
import hmac
import hashlib
import base64
import json
import secrets
import time
from fastapi import Header, HTTPException, status

SECRET_KEY = os.environ.get("LIFEBUDDY_SECRET_KEY", "lifebuddy_mindful_productivity_secret_2026_super_secure_key")
TOKEN_EXPIRY_SECONDS = 30 * 24 * 3600  # 30 days token

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key_hex = stored_hash.split(':')
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _b64_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ''
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))

def create_access_token(user_id: int, username: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS
    }
    
    header_bytes = _b64_encode(json.dumps(header).encode('utf-8'))
    payload_bytes = _b64_encode(json.dumps(payload).encode('utf-8'))
    message = f"{header_bytes}.{payload_bytes}"
    
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sig_b64 = _b64_encode(signature)
    
    return f"{message}.{sig_b64}"

def verify_token(token: str) -> dict:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        message = f"{parts[0]}.{parts[1]}"
        expected_sig = _b64_encode(hmac.new(
            SECRET_KEY.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).digest())
        
        if not hmac.compare_digest(expected_sig, parts[2]):
            return None
        
        payload = json.loads(_b64_decode(parts[1]).decode('utf-8'))
        if payload.get("exp", 0) < time.time():
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
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    return {"id": payload["sub"], "username": payload["username"]}
