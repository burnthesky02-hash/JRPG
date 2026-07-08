@echo off
cd /d "C:\Users\BurnT\OneDrive\Documents\System"

set "JRPG_USER="
set /p JRPG_USER=Username [jrpg]: 
if "%JRPG_USER%"=="" set "JRPG_USER=jrpg"

set "JRPG_PASS="
set /p JRPG_PASS=Password: 
if "%JRPG_PASS%"=="" (
  echo Password is required.
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File ".server\start-stable.ps1" -Username "%JRPG_USER%" -Password "%JRPG_PASS%" -Public
