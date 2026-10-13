@echo off
cd /d "%~dp0\..\.."
call npm run tuner:github
pause
