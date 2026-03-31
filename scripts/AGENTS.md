# Scripts Folder

This folder contains helper scripts to start and stop local Docker services.

## Platform scripts

- Linux: `start-linux.sh`, `stop-linux.sh`
- macOS: `start-mac.sh`, `stop-mac.sh`
- Windows (PowerShell): `start-windows.ps1`, `stop-windows.ps1`

## Behavior

- Start scripts run `docker compose up -d --build` from the project root.
- Stop scripts run `docker compose down --remove-orphans` from the project root.

## Notes

- Keep scripts minimal and deterministic.
- Prefer explicit script names by OS instead of clever auto-detection.