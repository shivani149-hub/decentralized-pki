from datetime import datetime, timedelta, timezone
from functools import wraps
import jwt
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from app.config import Config
from app.models import get_db_connection

def hash_password(password: str) -> str:
    return generate_password_hash(password, method='pbkdf2:sha256')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, plain_password)

def generate_jwt_token(user_id: int, email: str, org_identifier: str, org_name: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "org_identifier": org_identifier,
        "org_name": org_name,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=Config.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)

def decode_jwt_token(token: str):
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token required."}), 401

        token = auth_header.split(" ")[1]
        payload = decode_jwt_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired authorization session."}), 401

        # Load fresh user and org details from DB
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.email, u.role, o.id as org_id, o.name as org_name, o.identifier as org_identifier, o.org_type
            FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.id = ? AND o.identifier = ?
        """, (payload["sub"], payload["org_identifier"]))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"error": "User account or organization no longer active."}), 401

        current_user = dict(user)
        return f(current_user, *args, **kwargs)
    return decorated

