@echo off
rem Runs the Tauri dev/build pipeline with the Visual Studio MSVC toolchain
rem environment loaded. Needed on Windows because Git Bash puts its own
rem coreutils link.exe on PATH and never exports INCLUDE/LIB, so rustc's
rem x86_64-pc-windows-msvc target cannot link. Usage: scripts\tauri-win.cmd dev
setlocal
set "VSCMD="
for /f "usebackq tokens=1 delims=" %%d in (`dir /b /o:n "%ProgramFiles%\Microsoft Visual Studio\2022" 2^>nul`) do (
  if exist "%ProgramFiles%\Microsoft Visual Studio\2022\%%d\Common7\Tools\vsdevcmd.bat" set "VSCMD=%ProgramFiles%\Microsoft Visual Studio\2022\%%d\Common7\Tools\vsdevcmd.bat"
)
if not defined VSCMD (
  echo Visual Studio 2022 with the C++ build tools was not found. 1>&2
  exit /b 1
)
call "%VSCMD%" -arch=x64 -no_logo || exit /b 1
cd /d "%~dp0.."
call npm run tauri -- %*
