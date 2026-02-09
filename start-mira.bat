@echo off
echo ========================================
echo    MIRA AI - Online Deployment
echo ========================================
echo.

echo [1/3] Checking files...
if not exist "index.html" (
    echo ERROR: index.html not found!
    pause
    exit /b 1
)
if not exist "script.js" (
    echo ERROR: script.js not found!
    pause
    exit /b 1
)
echo ✓ All files found!
echo.

echo [2/3] Starting local server...
echo.
echo Your local server is running at:
echo.
echo    http://192.168.0.102:8099
echo.
echo Open this URL on your mobile (same WiFi required)
echo.
echo ========================================
echo    DEPLOYMENT OPTIONS:
echo ========================================
echo.
echo Option 1: Netlify Drop (Recommended)
echo    1. Open: https://app.netlify.com/drop
echo    2. Drag and drop this folder
echo    3. Get your HTTPS link!
echo.
echo Option 2: GitHub Pages
echo    1. Open: https://github.com/new
echo    2. Upload all files
echo    3. Enable Pages in Settings
echo.
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

python server.py
