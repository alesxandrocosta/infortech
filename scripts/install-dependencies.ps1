param(
    [switch]$InitializeDatabase
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$envExamplePath = Join-Path $backendPath '.env.example'
$envPath = Join-Path $backendPath '.env'

function Invoke-Npm {
    param(
        [string]$WorkingDirectory,
        [string[]]$Arguments
    )

    Push-Location $WorkingDirectory
    try {
        & npm.cmd @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "O comando npm falhou em $WorkingDirectory (código $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }
}

Write-Host 'Verificando Node.js e npm...'
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
    throw 'Node.js não foi encontrado. Instale o Node.js LTS (18 ou superior) e execute este script novamente.'
}

$nodeVersion = (node --version).TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
    throw "Node.js $nodeVersion encontrado. Este projeto exige Node.js 18 ou superior."
}

$npmVersion = (npm --version).Trim()
$npmMajor = [int]($npmVersion.Split('.')[0])
if ($npmMajor -lt 9) {
    throw "npm $npmVersion encontrado. Este projeto exige npm 9 ou superior."
}

Write-Host "Node.js v$nodeVersion e npm $npmVersion encontrados."

Write-Host 'Instalando dependências da raiz...'
Invoke-Npm -WorkingDirectory $root -Arguments @('ci')

Write-Host 'Instalando dependências do backend...'
Invoke-Npm -WorkingDirectory $backendPath -Arguments @('ci')

Write-Host 'Instalando dependências do frontend...'
Invoke-Npm -WorkingDirectory $frontendPath -Arguments @('ci')

if (-not (Test-Path $envPath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host 'backend/.env criado a partir de backend/.env.example.' -ForegroundColor Green
    Write-Host 'Revise principalmente DB_PASSWORD, JWT_SECRET e os dados do administrador antes de iniciar.' -ForegroundColor Yellow
} else {
    Write-Host 'backend/.env existente preservado.'
}

$mysql = Get-Command mysql.exe -ErrorAction SilentlyContinue
if (-not $mysql) {
    Write-Warning 'MySQL Client não foi encontrado no PATH. Instale o MySQL Server/Client e execute npm run init-db depois de configurar o backend/.env.'
} elseif ($InitializeDatabase) {
    Write-Host 'Inicializando o banco de dados...'
    Invoke-Npm -WorkingDirectory $backendPath -Arguments @('run', 'init-db')
}

Write-Host ''
Write-Host 'Instalação concluída.' -ForegroundColor Green
Write-Host 'Para iniciar o sistema: npm run dev'