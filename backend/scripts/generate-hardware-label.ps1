param(
  [Parameter(Mandatory = $true)][string]$JsonBase64,
  [Parameter(Mandatory = $true)][string]$DestinationFolder
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $DestinationFolder)) {
  throw "Pasta de etiquetas inacessivel: $DestinationFolder"
}

$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($JsonBase64)) | ConvertFrom-Json
$serial = [string]$data.Serial_BIOS
if ([string]::IsNullOrWhiteSpace($serial)) { $serial = [string]$data.ID_Equipamento }
if ([string]::IsNullOrWhiteSpace($serial)) { $serial = [guid]::NewGuid().ToString('N').Substring(0, 12) }
$safeSerial = ($serial -replace '[^a-zA-Z0-9_-]', '_')
$fileName = "etiqueta_$safeSerial-$([DateTime]::Now.ToString('yyyyMMdd-HHmmssfff')).docx"
$targetPath = Join-Path $DestinationFolder $fileName
$tempRoot = Join-Path $env:TEMP "techflow-label-$([guid]::NewGuid().ToString('N'))"
$wordFolder = Join-Path $tempRoot 'word'
$relsFolder = Join-Path $tempRoot '_rels'

function Xml([object]$value) {
  return [System.Security.SecurityElement]::Escape(([string]$value).Trim())
}

function Paragraph([string]$value, [int]$size = 20, [bool]$bold = $false) {
  $boldTag = if ($bold) { '<w:b/>' } else { '' }
  return ('<w:p><w:r><w:rPr>' + $boldTag + '<w:sz w:val="' + $size + '"/></w:rPr><w:t xml:space="preserve">' + (Xml $value) + '</w:t></w:r></w:p>')
}

try {
  New-Item -ItemType Directory -Force -Path $wordFolder, $relsFolder | Out-Null
  $rows = @(
    @{ Label = 'DATA/HORA'; Value = (Get-Date -Format 'dd/MM/yyyy HH:mm') },
    @{ Label = 'ID EQUIPAMENTO'; Value = $data.ID_Equipamento },
    @{ Label = 'FABRICANTE / MODELO'; Value = "$($data.Fabricante) $($data.Modelo)" },
    @{ Label = 'PROCESSADOR'; Value = $data.Processador },
    @{ Label = 'GERACAO'; Value = $data.Geracao_Processador },
    @{ Label = 'MEMORIA RAM'; Value = "$($data.Memoria_RAM) ($($data.Saude_RAM))" },
    @{ Label = 'ARMAZENAMENTO'; Value = $data.Armazenamento },
    @{ Label = 'VIDEO/GRAFICOS'; Value = $data.Graficos },
    @{ Label = 'USB 3.0+'; Value = $data.USB_3 },
    @{ Label = 'REDE SEM FIO'; Value = $data.Rede_Sem_Fio },
    @{ Label = 'SISTEMA OPERACIONAL'; Value = "$($data.Sistema_Operacional) $($data.Versao_SO)" },
    @{ Label = 'SERIAL BIOS'; Value = $data.Serial_BIOS }
  )
  $body = (Paragraph 'MAQUINA TESTADA E LIBERADA' 32 $true)
  $body += (Paragraph 'TECHFLOW ERP - ETIQUETA DE EQUIPAMENTO' 22 $true)
  $body += (Paragraph '----------------------------------------' 18 $false)
  foreach ($row in $rows) {
    if (-not [string]::IsNullOrWhiteSpace([string]$row.Value)) {
      $body += (Paragraph "$($row.Label): $($row.Value)" 20 $true)
    }
  }
  $body += (Paragraph '----------------------------------------' 18 $false)
  $body += '<w:sectPr><w:pgSz w:w="5669" w:h="8505" w:orient="portrait"/><w:pgMar w:top="283" w:right="283" w:bottom="283" w:left="283"/></w:sectPr>'
  $documentXml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + $body + '</w:body></w:document>')
  $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText((Join-Path $tempRoot '[Content_Types].xml'), $contentTypes, $utf8)
  [IO.File]::WriteAllText((Join-Path $relsFolder '.rels'), $rels, $utf8)
  [IO.File]::WriteAllText((Join-Path $wordFolder 'document.xml'), $documentXml, $utf8)
  [IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $targetPath)
  Write-Output $targetPath
} finally {
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}