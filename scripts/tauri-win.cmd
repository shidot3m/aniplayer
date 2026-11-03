@echo off
rem Runs the Tauri dev/build pipeline with the Visual Studio MSVC toolchain
rem environment loaded. Needed on Windows because Git Bash puts its own coreutils
rem link.exe on PATH and never exports INCLUDE/LIB, so rustc's
rem x86_64-pc-windows-msvc target cannot link. Usage: bun run tauri:win dev
rem
rem Editions live two levels under a Visual Studio root — the root is numbered by
rem year (2022) or by version (18), and a Build Tools edition sits under
rem "Program Files (x86)" — so both roots are searched for an install that carries
rem the C++ toolchain.
setlocal
set "VSCMD="
call :find_vs "%ProgramFiles%\Microsoft Visual Studio"
call :find_vs "%ProgramFiles(x86)%\Microsoft Visual Studio"
if not defined VSCMD (
  echo Visual Studio with the C++ build tools was not found. 1>&2
  exit /b 1
)
call "%VSCMD%" -arch=x64 -no_logo || exit /b 1
cd /d "%~dp0.."
call bun run tauri -- %*
goto :eof

rem Sets VSCMD to the dev-environment script of any edition under %1 that has the
rem MSVC tools. Kept as a subroutine because a for-in list cannot hold the
rem parentheses of the (x86) path.
:find_vs
for /f "usebackq delims=" %%d in (`dir /b /o:n "%~1" 2^>nul`) do (
  for /f "usebackq delims=" %%e in (`dir /b /o:n "%~1\%%d" 2^>nul`) do (
    if exist "%~1\%%d\%%e\Common7\Tools\vsdevcmd.bat" (
      if exist "%~1\%%d\%%e\VC\Tools\MSVC" set "VSCMD=%~1\%%d\%%e\Common7\Tools\vsdevcmd.bat"
    )
  )
)
exit /b 0
