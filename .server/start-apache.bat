@echo off
"C:\xampp\apache\bin\httpd.exe" -k install -n JRPGApache >nul 2>&1
"C:\xampp\apache\bin\httpd.exe" -k start -n JRPGApache
