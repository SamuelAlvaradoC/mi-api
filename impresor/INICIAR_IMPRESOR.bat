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

if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ChocoFreseo Impresor.lnk" (
  echo  [!] Inicio automatico no encontrado.
  echo      Ejecuta INSTALAR.bat para que no tengas que abrir esto a mano cada vez.
  echo.
)

node impresor.js

pause
