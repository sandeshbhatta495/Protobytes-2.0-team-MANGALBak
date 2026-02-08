# PowerShell activation script for Sarkari-Sarathi
# Usage: .\activate_env.ps1

Write-Host "🚀 Activating Sarkari-Sarathi Virtual Environment..." -ForegroundColor Green

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPath = Join-Path $ScriptDir ".env"

if (Test-Path $VenvPath) {
    $ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
    
    if (Test-Path $ActivateScript) {
        Write-Host "✅ Virtual environment found at: $VenvPath" -ForegroundColor Green
        Write-Host "🌐 Starting backend setup..." -ForegroundColor Blue
        
        # Change to backend directory
        Set-Location $ScriptDir
        
        # Run startup script
        python startup.py
    } else {
        Write-Host "❌ Activation script not found at: $ActivateScript" -ForegroundColor Red
        Write-Host "Please ensure virtual environment is properly installed." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Virtual environment not found at: $VenvPath" -ForegroundColor Red
    Write-Host "Please create virtual environment first:" -ForegroundColor Yellow
    Write-Host "  python -m venv .env" -ForegroundColor Cyan
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
