@echo off
setlocal
REM Use the same environment selection and Python version checks as pnpm wav:server.
cd /d "%~dp0.."
node "%~dp0..\scripts\wav-server.mjs"
exit /b %errorlevel%
