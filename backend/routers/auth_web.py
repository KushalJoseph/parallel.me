# auth_web.py — removed (was Auth0-only dev-testing routes)
# Firebase auth is handled entirely on the frontend client SDK.
# This file is kept to avoid import errors; it exports an empty router.
from fastapi import APIRouter
router = APIRouter()
