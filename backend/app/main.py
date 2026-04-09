import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Use explicit path so .env is found regardless of cwd when uvicorn starts
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from app.routers import auth, datasets, rooms, lecturers, courses, time_slots

app = FastAPI(title="PWL2 Class Scheduler API", version="2.0.0")

# ---------------------------------------------------------------------------
# CORS — always added; origins from ALLOW_ORIGINS env var or fallback to all
# ---------------------------------------------------------------------------
allow_origins_raw = os.getenv("ALLOW_ORIGINS", "*")
origins = [o.strip() for o in allow_origins_raw.split(",") if o.strip()] if allow_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],  # credentials only when origins are explicit
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API routes  — must be registered BEFORE static file mounts
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(rooms.router)
app.include_router(lecturers.router)
app.include_router(courses.router)
app.include_router(time_slots.router)

# ---------------------------------------------------------------------------
# Static files — serve Vite build output in production
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.exists():
    # Serve JS/CSS/image assets
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Catch-all route: return index.html so React Router handles navigation."""
        index = STATIC_DIR / "index.html"
        return FileResponse(index)


# ---------------------------------------------------------------------------
# Static files — serve Vite build output in production
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.exists():
    # Serve JS/CSS/image assets
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Catch-all route: return index.html so React Router handles navigation."""
        index = STATIC_DIR / "index.html"
        return FileResponse(index)
