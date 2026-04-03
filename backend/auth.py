import os
import json
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

TESTING = os.getenv("TESTING", "false").lower() == "true"

# Initialize Firebase Admin SDK (only once)
# Prefer FIREBASE_SERVICE_ACCOUNT_JSON (env var with full JSON) over file path,
# so production deployments don't need the file on disk.
if not firebase_admin._apps:
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    else:
        sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")
        cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)

security = HTTPBearer(auto_error=False)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify a Firebase ID token and return the decoded payload."""
    if TESTING and (not credentials or credentials.credentials == "test-token"):
        return {"uid": "test-user-123"}

    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials.strip()

    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except firebase_auth.InvalidIdTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def get_current_user_id(payload: dict = Depends(verify_token)) -> str:
    """Dependency that returns the authenticated user's Firebase UID."""
    uid = payload.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="UID not found in token")
    return uid
