@echo off
cd /d "%~dp0"
if not exist dist\index.html (
  echo Run npm install and npm run build once before launching.
  pause
  exit /b 1
)
start "" http://127.0.0.1:4317
node scripts\serve.ts
pause
