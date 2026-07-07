$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $docker) {
    $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
}
if (-not (Test-Path $docker)) {
    Write-Host 'Docker Desktop est absent. Installez-le puis relancez ce fichier.' -ForegroundColor Yellow
    Write-Host 'Commande : winget install --exact --id Docker.DockerDesktop' -ForegroundColor Gray
    Read-Host 'Appuyez sur Entrée pour fermer'
    exit 1
}

& $docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    Write-Host 'Démarrage de Docker Desktop...' -ForegroundColor Cyan
    Start-Process -FilePath $desktop -WindowStyle Hidden
    $ready = $false
    1..60 | ForEach-Object {
        if (-not $ready) {
            Start-Sleep -Seconds 2
            & $docker info *> $null
            if ($LASTEXITCODE -eq 0) { $ready = $true }
        }
    }
    if (-not $ready) {
        Write-Host 'Docker ne répond pas. Vérifiez Docker Desktop puis réessayez.' -ForegroundColor Yellow
        Read-Host 'Appuyez sur Entrée pour fermer'
        exit 1
    }
}

& $docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Démarrez Docker Desktop, attendez quelques secondes, puis réessayez.' -ForegroundColor Yellow
    Read-Host 'Appuyez sur Entrée pour fermer'
    exit $LASTEXITCODE
}
Write-Host 'Annuaire RP est disponible sur http://localhost:8080' -ForegroundColor Green
Start-Process 'http://localhost:8080'
