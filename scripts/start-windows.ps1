$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

Set-Location $ProjectRoot
docker compose up -d --build

Write-Host "Services started."
Write-Host "App: http://localhost:8000"
Write-Host "API: http://localhost:8000/api/health"
