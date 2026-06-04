@echo off
title ChocoFreseo - Instalador del Sistema de Impresion
color 0A
cls

echo.
echo  ==========================================
echo   CHOCOFRESEO - INSTALADOR
echo   Sistema de Impresion Automatica
echo  ==========================================
echo.

REM Verificar si Node.js esta instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  [!] Node.js no esta instalado.
  echo  [!] Descargando Node.js automaticamente...
  echo.
  REM Descargar Node.js 64 bits
  powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\nodejs.msi'"
  echo  [!] Instalando Node.js...
  msiexec /i "%TEMP%\nodejs.msi" /quiet /norestart
  echo  [!] Node.js instalado. Continuando...
  REM Refrescar PATH
  call refreshenv >nul 2>&1
) else (
  echo  [OK] Node.js encontrado:
  node --version
)

echo.
echo  [*] Instalando dependencias...
cd /d "%~dp0"
call npm install
echo  [OK] Dependencias instaladas.

echo.
echo  [*] Configurando inicio automatico con Windows...
REM Crear tarea programada para inicio automatico
schtasks /create /tn "ChocoFreseo Impresor" ^
  /tr "cmd /c cd /d \"%~dp0\" && node impresor.js >> \"%~dp0\logs.txt\" 2>&1" ^
  /sc onlogon ^
  /ru "%USERNAME%" ^
  /f >nul 2>&1

if %errorlevel% eq 0 (
  echo  [OK] Inicio automatico configurado.
  echo       Se iniciara solo cuando enciendas el PC.
) else (
  echo  [!] No se pudo configurar inicio automatico.
  echo      Usa INICIAR_IMPRESOR.bat manualmente.
)

echo.
echo  [*] Creando acceso directo en el escritorio...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\ChocoFreseo Impresor.lnk'); $s.TargetPath = '%~dp0INICIAR_IMPRESOR.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = 'shell32.dll,137'; $s.Description = 'Sistema de impresion ChocoFreseo'; $s.Save()"
echo  [OK] Acceso directo creado en el escritorio.

echo.
echo  ==========================================
echo   INSTALACION COMPLETADA
echo  ==========================================
echo.
echo  El sistema se iniciara automaticamente
echo  cada vez que enciendas el PC.
echo.
echo  Si quieres iniciarlo ahora mismo:
echo  Doble click en "INICIAR_IMPRESOR.bat"
echo.
pause
