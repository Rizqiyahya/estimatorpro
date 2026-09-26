# ============================================================
# EstimatorPro Deploy Script (Windows / PowerShell)
# Stages, commits, and pushes changes to GitHub Pages.
#
# Usage:
#   .\deploy.ps1                    # auto-generate commit message
#   .\deploy.ps1 "fix: message"     # custom commit message
#   .\deploy.ps1 -Path "C:\...\estimatorpro"  # override project path
# ============================================================

param(
    [Parameter(Position = 0)]
    [string]$Message = "",

    [Parameter()]
    [string]$Path = ""
)

$ErrorActionPreference = "Stop"

# --- Resolve project directory ---
if (-not $Path) {
    # Default: try current directory, then known project location
    if (Test-Path ".\.git") {
        $Path = (Get-Location).Path
    } else {
        # Fall back to searching for the estimatorpro repo
        $candidate = Get-ChildItem -Path "$env:APPDATA\AionUi\aionui\conversations" -Recurse -Directory -Filter "estimatorpro" -ErrorAction SilentlyContinue |
            Where-Object { Test-Path (Join-Path $_.FullName ".git") } |
            Select-Object -First 1
        if ($candidate) { $Path = $candidate.FullName }
    }
}

if (-not $Path -or -not (Test-Path (Join-Path $Path ".git"))) {
    Write-Host "ERROR: Could not find the EstimatorPro git repository." -ForegroundColor Red
    Write-Host "Pass the project path explicitly: .\deploy.ps1 -Path C:\...\estimatorpro" -ForegroundColor Yellow
    exit 1
}

Set-Location $Path
Write-Host "Deploying from: $Path" -ForegroundColor Cyan
Write-Host ""

# --- Check for uncommitted changes ---
$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to deploy." -ForegroundColor Yellow
    exit 0
}

# --- Show what will be committed ---
Write-Host "Changes to deploy:" -ForegroundColor White
git status --short
Write-Host ""

# --- Auto-generate commit message if none provided ---
if (-not $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "deploy: update $timestamp"
}

# --- Stage, commit, push ---
Write-Host "Committing: $Message" -ForegroundColor White
git add -A
git commit -m $Message

Write-Host ""
Write-Host "Pushing to origin/main..." -ForegroundColor White
git push origin main

Write-Host ""
Write-Host "DEPLOY SUCCESSFUL" -ForegroundColor Green
Write-Host "Live site: https://rizqiyahya.github.io/estimatorpro" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: GitHub Pages takes 1-2 minutes to rebuild." -ForegroundColor Yellow
Write-Host "If the site looks stale, hard-refresh with Ctrl+Shift+R." -ForegroundColor Yellow
