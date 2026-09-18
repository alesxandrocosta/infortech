param(
  [int]$Port = 5310,
  [string]$PrintScript = (Join-Path $PSScriptRoot 'cliente.ps1')
)

$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
$listener.Start()

function Write-JsonResponse($context, $statusCode, $payload) {
  $json = $payload | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $context.Response.StatusCode = $statusCode
  $context.Response.ContentType = 'application/json; charset=utf-8'
  $context.Response.Headers.Add('Access-Control-Allow-Origin', '*')
  $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
  $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}

function Get-HardwareData {
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name
  $computer = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, TotalPhysicalMemory
  $os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture
  $bios = Get-CimInstance Win32_BIOS | Select-Object SerialNumber
  $uuid = (Get-CimInstance Win32_ComputerSystemProduct | Select-Object -First 1 UUID).UUID
  $ramModules = @(Get-CimInstance Win32_PhysicalMemory)
  $memory = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
    [PSCustomObject]@{
      CapacityGB = [math]::Round($_.Capacity / 1GB, 2)
      TypeCode = $_.SMBIOSMemoryType
      SpeedMHz = $_.ConfiguredClockSpeed
      Manufacturer = $_.Manufacturer
      PartNumber = $_.PartNumber
    }
  })
  $disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object {
    [PSCustomObject]@{
      Model = $_.Model
      SerialNumber = $_.SerialNumber
      SizeGB = [math]::Round($_.Size / 1GB, 2)
      Interface = $_.InterfaceType
    }
  })
  $network = @(Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue)
  $graphics = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
  $memoryTypes = @{ 20 = 'DDR'; 21 = 'DDR2'; 22 = 'DDR2'; 24 = 'DDR3'; 26 = 'DDR4'; 34 = 'DDR5' }
  $totalMemory = ($ramModules | Measure-Object -Property Capacity -Sum).Sum / (1024 * 1024 * 1024)
  $wifi = @($network | Where-Object { $_.Name -match 'Wireless|Wi-Fi|802[.]11' -and $_.PhysicalAdapter -eq $true })
  $bluetooth = @($network | Where-Object { $_.Name -match 'Bluetooth' })
  $usb3 = @(Get-CimInstance Win32_USBController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '3[.]0|3[.]1|3[.]2|xHCI' })
  $equipmentId = if (-not [string]::IsNullOrWhiteSpace([string]$uuid)) { [string]$uuid } else { [string]$bios.SerialNumber }

  return [PSCustomObject]@{
    ID_Equipamento = (($equipmentId -replace '-', '').Substring(0, [math]::Min(16, ($equipmentId -replace '-', '').Length))).ToUpper()
    Serial_BIOS = [string]$bios.SerialNumber
    UUID_Sistema = [string]$uuid
    Processador = [string]$cpu.Name
    Geracao_Processador = 'Nao identificada'
    Memoria_RAM = "{0:N2} GB" -f $totalMemory
    Tipo_Memoria = (($memory | ForEach-Object { $memoryTypes[[int]$_.TypeCode] }) | Where-Object { $_ } | Select-Object -Unique) -join ', '
    Saude_RAM = if (($ramModules | Where-Object { $_.ConfiguredClockSpeed -gt 0 }).Count -gt 0) { 'Saudavel (operacional)' } else { 'Verificar' }
    Modulos_Memoria = $memory
    Sistema_Operacional = [string]$os.Caption
    Versao_SO = [string]$os.Version
    Arquitetura_SO = [string]$os.OSArchitecture
    Fabricante = [string]$computer.Manufacturer
    Modelo = [string]$computer.Model
    Armazenamento = ($disks | ForEach-Object { "$($_.Model) $($_.SizeGB) GB" }) -join ' | '
    Discos = $disks
    Graficos = $graphics -join ' | '
    USB_3 = if ($usb3.Count -gt 0) { 'Presente (alta velocidade)' } else { 'Apenas USB 2.0' }
    Rede_Sem_Fio = @($(if ($wifi.Count -gt 0) { 'Wi-Fi' }); $(if ($bluetooth.Count -gt 0) { 'Bluetooth' })) -join ' + '
    Data_Cadastro = (Get-Date).ToString('o')
  }
}

try {
  Write-Host "Agente local ativo em http://localhost:$Port"
  Write-Host 'Mantenha esta janela aberta enquanto o sistema estiver em uso.'
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      if ($context.Request.HttpMethod -eq 'OPTIONS') {
        Write-JsonResponse $context 204 @{ success = $true }
        continue
      }
      if ($context.Request.HttpMethod -eq 'GET' -and $context.Request.Url.AbsolutePath -eq '/hardware') {
        Write-JsonResponse $context 200 @{ success = $true; data = (Get-HardwareData) }
        continue
      }
      if ($context.Request.HttpMethod -eq 'POST' -and $context.Request.Url.AbsolutePath -eq '/print') {
        if (-not (Test-Path -LiteralPath $PrintScript)) { throw "Script de impressao nao encontrado: $PrintScript" }
        & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PrintScript
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'O script de impressao retornou erro.' }
        Write-JsonResponse $context 200 @{ success = $true; data = @{ labels = 1 } }
        continue
      }
      Write-JsonResponse $context 404 @{ success = $false; error = 'Endpoint nao encontrado.' }
    } catch {
      Write-JsonResponse $context 500 @{ success = $false; error = $_.Exception.Message }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
