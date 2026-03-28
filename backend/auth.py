import os
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")
ALGORITHMS = ["RS256"]
TESTING = os.getenv("TESTING", "false").lower() == "true"

# Ensure domain formatting
if AUTH0_DOMAIN and not AUTH0_DOMAIN.startswith("https://"):
    AUTH0_DOMAIN = f"https://{AUTH0_DOMAIN}"

jwks_url = f"{AUTH0_DOMAIN}/.well-known/jwks.json" if AUTH0_DOMAIN else None
jwks_client = PyJWKClient(jwks_url) if jwks_url else None

security = HTTPBearer(auto_error=False)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if TESTING and (not credentials or credentials.credentials == "test-token"):
        return {"sub": "test-user-123"}
        
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    token = credentials.credentials.strip().strip('"').strip("'")
    print(f"DEBUG AUTH: Received raw token. Length: {len(token)}. Starts with: {token[:10]}...")
    
    if not jwks_client:
        raise HTTPException(status_code=500, detail="Auth0 configuration missing on server")
    
    # If the token is too short, it's an opaque token, not a JWT (Audience issue)
    if len(token) < 50:
        print("DEBUG AUTH: Token is OPAQUE! Auth0 didn't recognize the API Audience.")
    
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=ALGORITHMS,
            audience=AUTH0_API_AUDIENCE,
            issuer=f"{AUTH0_DOMAIN}/"
        )
        return payload
    except jwt.exceptions.PyJWKClientError as e:
        raise HTTPException(status_code=500, detail=f"JWKS Error: {str(e)}")
    except jwt.exceptions.DecodeError as e:
        print(f"DEBUG AUTH: DecodeError -> {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.exceptions.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

def get_current_user_id(payload: dict = Depends(verify_token)) -> str:
    """Dependency that returns the user's Auth0 ID string (sub)."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="User sub not found in token")
    return sub

# --- Auth0 Web App SDK Setup Setup (For Testing Frontend) ---
from auth0_server_python.auth_server.server_client import ServerClient

class MemoryStateStore:
    def __init__(self):
        self._data = {}
    async def get(self, key, options=None):
        return self._data.get(key)
    async def set(self, key, value, options=None):
        self._data[key] = value
    async def delete(self, key, options=None):
        self._data.pop(key, None)
    async def delete_by_logout_token(self, claims, options=None):
        pass

class MemoryTransactionStore:
    def __init__(self):
        self._data = {}
    async def get(self, key, options=None):
        return self._data.get(key)
    async def set(self, key, value, options=None):
        self._data[key] = value
    async def delete(self, key, options=None):
        self._data.pop(key, None)

state_store = MemoryStateStore()
transaction_store = MemoryTransactionStore()

AUTH0_CLIENT_ID = os.getenv('AUTH0_CLIENT_ID')
AUTH0_CLIENT_SECRET = os.getenv('AUTH0_CLIENT_SECRET')
AUTH0_SECRET = os.getenv('AUTH0_SECRET')
AUTH0_REDIRECT_URI = os.getenv('AUTH0_REDIRECT_URI', 'http://localhost:8000/callback')

auth0 = None
if AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET:
    auth0 = ServerClient(
        domain=os.getenv("AUTH0_DOMAIN") or '',
        client_id=AUTH0_CLIENT_ID,
        client_secret=AUTH0_CLIENT_SECRET,
        secret=AUTH0_SECRET or 'dev-secret',
        redirect_uri=AUTH0_REDIRECT_URI,
        state_store=state_store,
        transaction_store=transaction_store,
        authorization_params={
            'scope': 'openid profile email',
            'audience': AUTH0_API_AUDIENCE or ''
        }
    )

