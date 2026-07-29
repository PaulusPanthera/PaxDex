@echo off
setlocal
cd /d "%~dp0"
if not exist "input\dump.zip" (
  echo Put the newest PokeMMO dump at:
  echo %cd%\input\dump.zip
  echo.
  pause
  exit /b 1
)
where py >nul 2>nul
if %errorlevel%==0 (
  py scripts\build_data.py input\dump.zip .
) else (
  python scripts\build_data.py input\dump.zip .
)
if %errorlevel% neq 0 (
  echo.
  echo Update failed. Check the error above.
  pause
  exit /b 1
)
echo.
echo PaxDex data and sprites updated successfully.
pause
