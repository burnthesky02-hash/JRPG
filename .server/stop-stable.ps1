$ErrorActionPreference = "SilentlyContinue"
Get-Process caddy | Stop-Process -Force
Get-Process cloudflared | Stop-Process -Force
Write-Host "Stopped Caddy and cloudflared (if running)."
