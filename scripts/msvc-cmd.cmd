@echo off
rem Runs an arbitrary command line with the Visual Studio MSVC toolchain
rem environment loaded, for cargo/bun invocations that cannot go through
rem `bun run tauri` (tests, clippy, fmt). Same toolchain discovery as
rem tauri-win.cmd. Usage: scripts\msvc-cmd.cmd cargo test
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
%*
exit /b %ERRORLEVEL%

:find_vs
for /f "usebackq delims=" %%d in (`dir /b /o:n "%~1" 2^>nul`) do (
  for /f "usebackq delims=" %%e in (`dir /b /o:n "%~1\%%d" 2^>nul`) do (
    if exist "%~1\%%d\%%e\Common7\Tools\vsdevcmd.bat" (
      if exist "%~1\%%d\%%e\VC\Tools\MSVC" set "VSCMD=%~1\%%d\%%e\Common7\Tools\vsdevcmd.bat"
    )
  )
)
exit /b 0
