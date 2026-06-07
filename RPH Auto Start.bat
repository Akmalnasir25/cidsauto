@echo off
echo Starting RPH Automation...
cd /d "C:\Users\Akmal Nasir\Desktop\SISTEM DEPLOY\cidsauto"
start /B node server.js
timeout /t 3 /nobreak >nul
start http://localhost:3001
start ngrok http 3001
