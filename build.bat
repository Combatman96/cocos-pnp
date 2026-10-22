@echo off
rem Builds playable-adapter-core, then the Cocos extension.
rem Usage: build.bat [3x|2x] [--skip-tests]   (default: 3x)
rem Both versions write to packages\playable-ads-adapter\dist, so the last one built wins.
setlocal

set "VERSION=3x"
set "SKIP_TESTS=0"
:parse
if "%~1"=="" goto run
if /i "%~1"=="3x" set "VERSION=3x"
if /i "%~1"=="2x" set "VERSION=2x"
if /i "%~1"=="--skip-tests" set "SKIP_TESTS=1"
shift
goto parse

:run
set "ROOT=%~dp0"

echo === playable-adapter-core ===
pushd "%ROOT%packages\playable-adapter-core" || exit /b 1
if "%SKIP_TESTS%"=="0" (
  call npm test || goto fail
)
call npx rollup -c || goto fail
popd

echo === playable-ads-adapter (%VERSION%) ===
pushd "%ROOT%packages\playable-ads-adapter" || exit /b 1
if exist dist rmdir /s /q dist
call npx rollup -c --environment BUILD_VERSION:%VERSION% || goto fail
popd

echo.
echo Build finished: packages\playable-ads-adapter\dist\playable-ads-adapter (%VERSION%)
exit /b 0

:fail
set "CODE=%ERRORLEVEL%"
popd
echo.
echo Build FAILED (exit %CODE%)
exit /b %CODE%
