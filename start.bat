@echo off
setlocal EnableExtensions
title GirlScan
cd /d "%~dp0"
set "ROOT=%CD%"

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

rem ===== 2. Go (backend) =====
where go >nul 2>nul && goto havego
if exist "%ProgramFiles%\Go\bin\go.exe" goto addgo
echo.
echo  Go is not installed. Installing it with winget...
winget install -e --id GoLang.Go --accept-package-agreements --accept-source-agreements
if exist "%ProgramFiles%\Go\bin\go.exe" goto addgo
echo.
echo  Could not install Go automatically. Install it from https://go.dev/dl/ and run start.bat again.
start "" https://go.dev/dl/
pause
exit /b 1
:addgo
set "PATH=%ProgramFiles%\Go\bin;%PATH%"
:havego

rem ===== 3. Node.js (frontend) =====
where npm >nul 2>nul && goto havenode
echo.
echo  Node.js is not installed. Install the LTS version from https://nodejs.org and run start.bat again.
start "" https://nodejs.org
pause
exit /b 1
:havenode

rem ===== 4. Build =====
taskkill /im girlscan-api.exe /f >nul 2>nul
echo.
echo  Building the API...
go build -o "bin\girlscan-api.exe" ./api/cmd/server
if errorlevel 1 goto failed
echo  Installing web dependencies...
pushd web
call npm install --no-audit --no-fund
if errorlevel 1 (popd & goto failed)
popd

rem ===== 5. Run: API + site in their own windows, then open the browser =====
rem 127.0.0.1 only: nothing is exposed to the network and Windows doesn't show a firewall prompt.
set "ADDR=127.0.0.1:8080"
start "GirlScan API" /d "%ROOT%" cmd /k "bin\girlscan-api.exe"
start "GirlScan Web" /d "%ROOT%\web" cmd /k "npm run dev -- --strictPort"
timeout /t 4 /nobreak >nul
start "" http://localhost:5173
echo.
echo  [ok] GirlScan is running: http://localhost:5173
echo  To stop it, close the "GirlScan API" and "GirlScan Web" windows.
timeout /t 6 >nul
exit /b 0

:nosecret
echo  No secret entered.
pause
exit /b 1

:failed
echo.
echo  Something went wrong, see the messages above.
pause
exit /b 1
