@echo off
setlocal
cd /d "%~dp0"

set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" set "NODE=node"

"%NODE%" "%~dp0dist\mcp-device.js" admin --runtime-dir "%USERPROFILE%\.mcp-device\server" invite create 1
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Failed to create invite. Make sure the repo is built first.
)
pause
exit /b %RC%
