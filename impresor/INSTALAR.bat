@echo off
title ChocoFreseo - Instalador
color 0A

echo.
echo  ==========================================
echo   CHOCOFRESEO - INSTALADOR
echo  ==========================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
  echo  [OK] Node.js ya esta instalado:
  node --version
  goto :instalar_deps
)

echo  [!] Node.js no encontrado.
echo  [!] Descargando Node.js LTS...
echo.

REM Intentar descarga con PowerShell
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.14.0/node-v20.14.0-x64.msi' -OutFile '%TEMP%\nodejs_installer.msi' -UseBasicParsing}" 2>nul

if not exist "%TEMP%\nodejs_installer.msi" (
  echo  [ERROR] No se pudo descargar Node.js automaticamente.
  echo.
  echo  Por favor descargalo manualmente en:
  echo  https://nodejs.org/es/download
  echo.
  echo  Instala Node.js y luego ejecuta este
  echo  archivo de nuevo.
  echo.
  pause
  exit /b 1
)

echo  [!] Instalando Node.js (requiere permisos de administrador)...
msiexec /i "%TEMP%\nodejs_installer.msi" /quiet /norestart
if %errorlevel% neq 0 (
  echo  [ERROR] La instalacion fallo.
  echo  Ejecuta este archivo como Administrador.
  pause
  exit /b 1
)

REM Actualizar PATH
set "PATH=%PATH%;C:\Program Files\nodejs"
echo  [OK] Node.js instalado correctamente.

:instalar_deps
echo.
echo  [*] Instalando dependencias...
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
  echo  [ERROR] npm install fallo.
  echo  Verifica tu conexion a internet.
  pause
  exit /b 1
)
echo  [OK] Dependencias instaladas.

echo.
echo  [*] Configurando inicio automatico...
schtasks /create /tn "ChocoFreseo Impresor" ^
  /tr "cmd /c cd /d \"%~dp0\" && node impresor.js >> \"%~dp0\logs.txt\" 2>&1" ^
  /sc onlogon ^
  /ru "%USERNAME%" ^
  /f >nul 2>&1

if %errorlevel% equ 0 (
  echo  [OK] Inicio automatico configurado.
) else (
  echo  [!] No se pudo configurar inicio automatico.
  echo      Usa el acceso directo del escritorio.
)

echo.
echo  [*] Creando acceso directo en el escritorio...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\ChocoFreseo Impresor.lnk'); $s.TargetPath = '%~dp0INICIAR_IMPRESOR.bat'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = 'shell32.dll,137'; $s.Save()" 2>nul
echo  [OK] Acceso directo creado.

echo.
echo  ==========================================
echo   INSTALACION COMPLETADA
echo  ==========================================
echo.
echo  El sistema arrancara solo cuando
echo  enciendas el PC.
echo.
echo  Para iniciar ahora: doble click en
echo  "INICIAR_IMPRESOR.bat"
echo.
pause
