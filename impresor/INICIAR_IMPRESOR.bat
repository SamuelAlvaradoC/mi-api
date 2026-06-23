@echo off
title ChocoFreseo - Sistema de Impresion
color 0A

echo.
echo  ==========================================
echo   CHOCOFRESEO - SISTEMA DE IMPRESION
echo  ==========================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo  Instalando dependencias por primera vez...
    echo.
    npm install
    echo.
)

echo  Iniciando sistema de impresion...
echo  Presiona Ctrl+C para detener.
echo.

schtasks /query /tn "ChocoFreseo Impresor" >nul 2>nul
if %errorlevel% neq 0 (
  echo  [!] Tarea automatica no encontrada.
  echo      Ejecuta INSTALAR.bat como administrador.
  echo.
)

node impresor.js

pause
