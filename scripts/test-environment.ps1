$ErrorActionPreference = 'Stop'

$ports = @(5000, 5173, 5174)

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

    foreach ($connection in $connections) {
        if ($connection.OwningProcess -eq 4) {
            Write-Host "A porta $port pertence ao Windows (PID 4); nao sera encerrada automaticamente."
            continue
        }

        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Encerrando processo $($process.Id) na porta $port..."
            taskkill.exe /PID $process.Id /T /F | Out-Null
        }
    }
}

Write-Host ''
Write-Host 'Iniciando ambiente de teste:'
Write-Host '  Backend:  http://localhost:5000'
Write-Host '  Frontend: http://localhost:5173 (ou 5174 se a 5173 estiver ocupada)'
Write-Host ''

& npm.cmd run dev:test
exit $LASTEXITCODE
