@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 24 LTS desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
call npm ci --prefix sidecars\wa-gateway
if errorlevel 1 (
  echo No se pudieron instalar las dependencias. Revisa la conexion y el error anterior.
  pause
  exit /b 1
)
node scripts\whatsapp.mjs
pause
