[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ApiUrl = 'http://192.168.100.155:5000/api',
    [Parameter(Mandatory = $true)]
    [string]$Email,
    [Parameter(Mandatory = $false)]
    [string]$Token
)

$ErrorActionPreference = 'Stop'
$ApiUrl = $ApiUrl.TrimEnd('/')

function Get-PlainPassword {
    $securePassword = Read-Host 'Senha do usuario autorizado' -AsSecureString
    $credential = New-Object System.Management.Automation.PSCredential('local', $securePassword)
    return $credential.GetNetworkCredential().Password
}

function Get-CimFirst {
    param([string]$ClassName)
    try { return Get-CimInstance -ClassName $ClassName -ErrorAction Stop | Select-Object -First 1 } catch { return $null }
}

if (-not $Token) {
    $password = Get-PlainPassword
    $login = Invoke-RestMethod -Method Post -Uri "$ApiUrl/auth/login" -ContentType 'application/json' -Body (@{ email = $Email; password = $password } | ConvertTo-Json)
    $Token = $login.data.token
}

$cpu = Get-CimFirst 'Win32_Processor'
$computer = Get-CimFirst 'Win32_ComputerSystem'
$bios = Get-CimFirst 'Win32_BIOS'
$product = Get-CimFirst 'Win32_ComputerSystemProduct'
$os = Get-CimFirst 'Win32_OperatingSystem'
$ramModules = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)
$disks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{
        Modelo = $_.Model
        Serial = ($_.SerialNumber -as [string]).Trim()
        Capacidade_GB = if ($_.Size) { [math]::Round($_.Size / 1GB, 2) } else { $null }
        Interface = $_.InterfaceType
        Tipo = $_.MediaType
    }
})
$graphics = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
$network = @(Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object { $_.PhysicalAdapter -eq $true } | Select-Object -ExpandProperty Name)
$uuid = [string]$product.UUID
$biosSerial = [string]$bios.SerialNumber
$equipmentId = ($uuid -replace '[^a-zA-Z0-9]', '').ToUpperInvariant()
if (-not $equipmentId) { $equipmentId = ($biosSerial -replace '[^a-zA-Z0-9]', '').ToUpperInvariant() }
if (-not $equipmentId) { $equipmentId = ($env:COMPUTERNAME -replace '[^a-zA-Z0-9]', '').ToUpperInvariant() }

$hardware = [ordered]@{
    ID_Equipamento = $equipmentId.Substring(0, [math]::Min(32, $equipmentId.Length))
    Fabricante = [string]$computer.Manufacturer
    Modelo = [string]$computer.Model
    Serial_BIOS = $biosSerial
    UUID_Sistema = $uuid
    Processador = [string]$cpu.Name
    Geracao_Processador = if ($cpu.MaxClockSpeed) { "$($cpu.NumberOfCores) núcleo(s), $($cpu.MaxClockSpeed) MHz" } else { '' }
    Memoria_RAM = if ($computer.TotalPhysicalMemory) { "{0:N2} GB" -f ($computer.TotalPhysicalMemory / 1GB) } else { '' }
    Tipo_Memoria = (($ramModules | ForEach-Object { $_.SMBIOSMemoryType } | Sort-Object -Unique) -join ', ')
    Saude_RAM = if ($ramModules.Count -gt 0) { 'Detectada' } else { 'Não informada' }
    Modulos_Memoria = @($ramModules | ForEach-Object { [ordered]@{ Capacidade_GB = [math]::Round($_.Capacity / 1GB, 2); Velocidade_MHz = $_.Speed; Fabricante = $_.Manufacturer; PartNumber = $_.PartNumber } })
    Sistema_Operacional = [string]$os.Caption
    Versao_SO = [string]$os.Version
    Arquitetura_SO = [string]$os.OSArchitecture
    Armazenamento = (($disks | ForEach-Object { "$($_.Modelo) $($_.Capacidade_GB) GB" }) -join ' | ')
    Discos = $disks
    Graficos = ($graphics -join ' | ')
    Rede = ($network -join ' | ')
    Hostname = $env:COMPUTERNAME
    Origem_Leitura = 'PowerShell local'
    Data_Cadastro = (Get-Date).ToUniversalTime().ToString('o')
}

$headers = @{ Authorization = "Bearer $Token" }
$body = $hardware | ConvertTo-Json -Depth 8
try {
    $result = Invoke-RestMethod -Method Post -Uri "$ApiUrl/inventory/hardware/local/register" -Headers $headers -ContentType 'application/json' -Body $body
} catch {
    $details = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Error "Falha ao importar hardware para o banco: $details"
    exit 1
}

Write-Host ''
Write-Host $result.message -ForegroundColor Green
Write-Host "Equipamento: $($hardware.ID_Equipamento)"
Write-Host "Computador: $($hardware.Fabricante) $($hardware.Modelo)"
Write-Host "Sistema: $($hardware.Sistema_Operacional) $($hardware.Versao_SO)"
Write-Host "Origem: $($hardware.Origem_Leitura)"
