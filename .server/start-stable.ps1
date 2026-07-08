param(
  [string]$Username = "jrpg",
  [string]$Password = "ChangeThisNow-123!",
  [switch]$Public
)

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\BurnT\OneDrive\Documents\System"
$serverDir = Join-Path $projectRoot ".server"
$caddyConfig = Join-Path $serverDir "Caddyfile"

function Stop-ExistingProcesses {
  Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Resolve-CaddyPath {
  $cmd = Get-Command caddy -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $default = "C:\Program Files\Caddy\caddy.exe"
  if (Test-Path $default) {
    return $default
  }

  Write-Host "Installing Caddy via winget..."
  winget install --id CaddyServer.Caddy -e --accept-package-agreements --accept-source-agreements | Out-Null

  $cmd = Get-Command caddy -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  if (Test-Path $default) {
    return $default
  }

  throw "Caddy install failed."
}

function Resolve-CloudflaredPath {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $default = "C:\Program Files\Cloudflare\Cloudflared\cloudflared.exe"
  if (Test-Path $default) {
    return $default
  }

  Write-Host "Installing cloudflared via winget..."
  winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements | Out-Null

  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  if (Test-Path $default) {
    return $default
  }

  throw "cloudflared install failed."
}

$caddyExe = Resolve-CaddyPath
$hash = & $caddyExe hash-password --plaintext $Password
if (-not $hash) {
  throw "Could not generate password hash."
}

@"
:8080 {
  root * $projectRoot
  encode zstd gzip

  basic_auth {
    $Username $hash
  }

  file_server
}
"@ | Set-Content -Path $caddyConfig -Encoding ASCII

Write-Host "Stopping any existing Caddy or cloudflared processes..."
Stop-ExistingProcesses

Write-Host "Starting Caddy on http://localhost:8080"
Write-Host "Login: $Username"
Write-Host "Password: $Password"

Start-Process -FilePath $caddyExe -ArgumentList @("run", "--config", $caddyConfig, "--adapter", "caddyfile") -WorkingDirectory $projectRoot

if ($Public) {
  $cloudflaredExe = Resolve-CloudflaredPath
  Write-Host "Starting Cloudflare quick tunnel..."
  Write-Host "Keep this terminal open to keep the public URL alive."
  & $cloudflaredExe tunnel --url http://127.0.0.1:8080
}
