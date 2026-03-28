from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from auth import auth0
import json

router = APIRouter(tags=["Web Auth"])
templates = Jinja2Templates(directory="templates")

@router.get("/login")
async def login(request: Request):
    if not auth0:
        raise HTTPException(status_code=500, detail="Auth0 SDK not configured. Check your .env file.")
    try:
        # Note: auth0-server-python requires store_options for session info sometimes. 
        # Using simple login wrapper
        login_url = await auth0.start_interactive_login()
        return RedirectResponse(url=login_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/callback")
async def callback(request: Request):
    if not auth0:
        return RedirectResponse(url="/")
        
    url = str(request.url)
    try:
        # Pass the full URL to exchange code for tokens
        # We also need a way to link this to a session
        token_set = await auth0.complete_interactive_login(url)
        
        # In a real app we'd save the token_set to our session 
        # Here we just save the user object derived from the token_set
        request.session["user"] = token_set
        return RedirectResponse(url="/profile")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Callback handling failed: {e}")

@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    if auth0:
        logout_url = await auth0.logout(options={"return_to": "http://localhost:8000/"})
        return RedirectResponse(url=logout_url)
    return RedirectResponse(url="/")

@router.get("/profile", response_class=HTMLResponse)
async def profile(request: Request):
    user = request.session.get("user")
    if not user:
        return RedirectResponse(url="/")
        
    pretty_user = json.dumps(user, indent=4)
    return templates.TemplateResponse(
        request=request, 
        name="profile.html", 
        context={"user": user, "pretty_user": pretty_user}
    )

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    user = request.session.get("user")
    return templates.TemplateResponse(
        request=request, 
        name="index.html", 
        context={"user": user}
    )
