# PowerShell script to start Sarkari-Sarathi
# Usage: .\StartSarkari.ps1

Write-Host "🚀 Starting Sarkari-Sarathi..." -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

# Change to backend directory
Set-Location "backend"
Write-Host "📁 Changed to backend directory" -ForegroundColor Blue

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Start the server
Write-Host "🌟 Starting server with Nepali ASR..." -ForegroundColor Magenta
Write-Host ""
Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API docs at: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start the server
python startup.py

Write-Host ""
Write-Host "🎉 Server stopped!" -ForegroundColor Green
