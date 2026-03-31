import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.router import router

app = FastAPI(title="PM MVP Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise database (creates file + tables + seed data on first run)
init_db()

app.include_router(router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Serve the built Next.js static export at /.
# API routes above take priority over this mount.
if os.path.isdir("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
