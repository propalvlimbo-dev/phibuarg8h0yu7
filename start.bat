@echo off
setlocal EnableExtensions
title GirlScan
cd /d "%~dp0"

rem ===== 1. Discord settings (.env, never committed) =====
if exist ".env" goto haveenv
set "SECRET=%~1"
if not "%SECRET%"=="" goto writeenv
echo.
echo  First start: Discord settings are needed once.
set /p "SECRET=  Paste Discord Client Secret and press Enter: "
if "%SECRET%"=="" goto nosecret
:writeenv
> ".env" echo DISCORD_CLIENT_ID=1525921185903149096
>> ".env" echo DISCORD_CLIENT_SECRET=%SECRET%
>> ".env" echo DISCORD_REDIRECT_URI=http://localhost:5173/api/auth/callback
echo  [ok] Saved Discord settings to .env
:haveenv

rem ===== 2. Node.js =====
rem Discord login runs inside the Node dev server (web\dev-auth.ts), so Go is NOT needed locally.
where npm >nul 2>nul && goto havenode
echo.
echo  Node.js is not installed. Install the LTS version from https://nodejs.org and run start.bat again.
start "" https://nodejs.org
pause
exit /b 1
:havenode

rem ===== 3. Dependencies =====
cd web
echo.
echo  Installing web dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed

rem ===== 4. Run (opens the browser when ready; Ctrl+C or close the window to stop) =====
echo.
echo  Starting GirlScan on http://localhost:5173 ...
call npm run dev -- --strictPort --open
goto end

:nosecret
echo  No secret entered.
pause
exit /b 1

:failed
echo.
echo  Something went wrong, see the messages above.
pause
exit /b 1

:end
