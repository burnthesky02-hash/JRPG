@echo off
"C:\xampp\apache\bin\httpd.exe" -k stop -n JRPGApache
"C:\xampp\apache\bin\httpd.exe" -k uninstall -n JRPGApache >nul 2>&1
