# Backend Folder

This folder contains the FastAPI backend service for the Project Management MVP.

## Current scope (Part 2)

- `app/main.py`: FastAPI app with simple health and hello endpoints
- `pyproject.toml`: backend Python dependencies managed by `uv`
- `Dockerfile`: container image for the backend service

## Runtime behavior

- The service listens on port `8000`
- `GET /api/health` returns a basic health response
- `GET /api/hello` returns a hello-world JSON payload

## Notes

- Keep backend changes simple and MVP-focused.
- Use `uv` for Python dependency management in Docker.