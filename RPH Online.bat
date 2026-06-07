@echo off
echo ============================================
echo   RPH Automation - Server + Ngrok
echo ============================================
echo.

echo Starting Node.js server...
cd /d "C:\Users\Akmal Nasir\Desktop\SISTEM DEPLOY\cidsauto"
start /B node server.js
timeout /t 3 /nobreak >nul

echo Starting Ngrok tunnel...
echo.
echo ============================================
echo   LINK UNTUK FON/AKSES INTERNET:
echo   Akan keluar di bawah selepas ngrok start
echo ============================================
echo.

ngrok http 3001
