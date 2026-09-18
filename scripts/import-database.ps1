$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$databaseFiles = @(
  'database/init.sql',
  'database/migration-20260905-operational-flows.sql',
  'database/migration-20260909-service-bench.sql',
  'database/migration-20260912-customer-contact-whatsapp.sql',
  'database/migration-20260913-hardware-audit.sql'
) | ForEach-Object { Join-Path $root $_ }

foreach ($file in $databaseFiles) {
  if (-not (Test-Path $file)) {
    throw "Arquivo SQL não encontrado: $file"
  }
}

$mysql = Get-Command mysql -ErrorAction SilentlyContinue
$mysqldump = Get-Command mysqldump -ErrorAction SilentlyContinue
if (-not $mysql -or -not $mysqldump) {
  throw 'Os comandos mysql e mysqldump não foram encontrados no PATH. Instale o MySQL Client ou adicione a pasta bin ao PATH.'
}

$tempSql = Join-Path $env:TEMP "infortec-schema-$([guid]::NewGuid().ToString('N')).sql"
$backupDirectory = Join-Path $root 'backend/backups'
$backupFile = Join-Path $backupDirectory "schema-$((Get-Date).ToString('yyyyMMdd-HHmmss')).sql"

try {
  New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
  $sql = ($databaseFiles | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_ }) -join "`r`n"
  Set-Content -Path $tempSql -Value $sql -Encoding UTF8

  Write-Host 'Importando esquema completo no MySQL...'
  & cmd.exe /c "mysql --host=localhost --user=root --protocol=tcp < `"$tempSql`""
  if ($LASTEXITCODE -ne 0) {
    throw 'A importação do esquema falhou.'
  }

  Write-Host "Salvando cópia do esquema em $backupFile..."
  & mysqldump --host=localhost --user=root --protocol=tcp --no-data --routines --events bd_infortec | Out-File -FilePath $backupFile -Encoding utf8
  if ($LASTEXITCODE -ne 0) {
    throw 'A exportação do esquema falhou.'
  }

  Write-Host 'Esquema importado e salvo com sucesso.' -ForegroundColor Green
} finally {
  if (Test-Path $tempSql) {
    Remove-Item $tempSql -Force
  }
}
