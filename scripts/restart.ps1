$ErrorActionPreference = 'Stop'

$ports = @(5000, 5173)

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

    foreach ($connection in $connections) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue

        if ($process) {
            Write-Host "Encerrando processo $($process.Id) na porta $port..."
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host 'Iniciando backend e frontend...'
& npm.cmd run dev
exit $LASTEXITCODE
