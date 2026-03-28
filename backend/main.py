import os
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Parallel Me API", version="1.0.0")

from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=os.getenv("AUTH0_SECRET", "default-dev-secret-key"))

@app.get("/")
def read_root():
    return {"status": "ok", "app": "Parallel Me"}

from routers.entry import router as entry_router
from routers.room import router as room_router
from routers.auth_web import router as auth_web_router
from jobs import start_jobs

app.include_router(entry_router)
app.include_router(room_router)
app.include_router(auth_web_router)

@app.on_event("startup")
async def startup_event():
    start_jobs()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
