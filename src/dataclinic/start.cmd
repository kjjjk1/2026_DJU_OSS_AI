@echo off
setlocal
where py >nul 2>nul
if errorlevel 1 goto usepython
py -3 -B "%~dp0server.py" --open --ask-key
goto done
:usepython
python -B "%~dp0server.py" --open --ask-key
:done
if errorlevel 1 pause

