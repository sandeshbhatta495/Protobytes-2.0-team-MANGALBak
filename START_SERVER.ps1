# PowerShell script to start Sarkari-Sarathi server
# Usage: .\START_SERVER.ps1

Write-Host "🚀 Starting Sarkari-Sarathi Backend Setup..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"

Write-Host "📁 Script directory: $ScriptDir" -ForegroundColor Cyan
Write-Host "📁 Backend directory: $BackendDir" -ForegroundColor Cyan

# Check if backend directory exists
if (-not (Test-Path $BackendDir)) {
    Write-Host "❌ Error: Backend directory not found!" -ForegroundColor Red
    Write-Host "   Expected: $BackendDir" -ForegroundColor Red
    Write-Host "   Current: $ScriptDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this from the project root directory." -ForegroundColor Yellow
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "✅ Project structure verified" -ForegroundColor Green

# Change to backend directory
Set-Location $BackendDir
Write-Host "📁 Changed to backend directory" -ForegroundColor Blue

# Check if virtual environment exists
$VenvPath = Join-Path $ScriptDir ".env"
if (-not (Test-Path $VenvPath)) {
    Write-Host "⚠️  Virtual environment not found" -ForegroundColor Yellow
    Write-Host "Creating virtual environment..." -ForegroundColor Blue
    python -m venv $VenvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
        Write-Host "Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host "✅ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
if (Test-Path $ActivateScript) {
    Write-Host "🔧 Activating virtual environment..." -ForegroundColor Blue
    & $ActivateScript
} else {
    Write-Host "⚠️  Activation script not found, using direct Python" -ForegroundColor Yellow
    # Use the Python executable directly without storing in variable
    & (Join-Path $VenvPath "Scripts\python.exe") startup.py
    return
}

Write-Host "✅ Virtual environment ready" -ForegroundColor Green

# Run startup script
Write-Host "🌟 Running setup and starting server..." -ForegroundColor Magenta

try {
    python startup.py
} catch {
    Write-Host "❌ Failed to start server: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're in the project root directory" -ForegroundColor White
    Write-Host "2. Check if all dependencies are installed" -ForegroundColor White
    Write-Host "3. Try running: python backend\startup.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "🎉 Server stopped successfully!" -ForegroundColor Green
