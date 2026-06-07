@echo off
echo Starting RPH Automation Server...
cd /d "C:\Users\Akmal Nasir\Desktop\SISTEM DEPLOY\cidsauto"
start http://localhost:3001
node server.js
pause
