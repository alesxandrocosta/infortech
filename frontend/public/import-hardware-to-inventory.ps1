param(
    [string]$ApiUrl,
    [string]$Email,
    [string]$Token
)

$ErrorActionPreference = 'Stop'
if (-not $ApiUrl) { $ApiUrl = Read-Host 'URL da API (ex.: http://192.168.100.155:5000/api)' }
$ApiUrl = $ApiUrl.TrimEnd('/')
if (-not $Email) { $Email = Read-Host 'E-mail do usuario autorizado' }

function Get-FirstCim([string]$Name) {
    try { Get-CimInstance $Name -ErrorAction Stop | Select-Object -First 1 } catch { $null }
}

if (-not $Token) {
    $secure = Read-Host 'Senha do usuario autorizado' -AsSecureString
    $password = (New-Object PSCredential('local', $secure)).GetNetworkCredential().Password
    $login = Invoke-RestMethod -Method Post -Uri "$ApiUrl/auth/login" -ContentType 'application/json' -Body (@{ email = $Email; password = $password } | ConvertTo-Json)
    $Token = $login.data.token
}

$cpu = Get-FirstCim 'Win32_Processor'
$computer = Get-FirstCim 'Win32_ComputerSystem'
$bios = Get-FirstCim 'Win32_BIOS'
$product = Get-FirstCim 'Win32_ComputerSystemProduct'
$os = Get-FirstCim 'Win32_OperatingSystem'
$memory = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)
$disks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{ Modelo=$_.Model; Serial=([string]$_.SerialNumber).Trim(); Capacidade_GB=if ($_.Size) { [math]::Round($_.Size / 1GB, 2) } else { $null } } })
$graphics = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
$uuid = [string]$product.UUID
$serial = [string]$bios.SerialNumber
$id = (($uuid -replace '[^a-zA-Z0-9]', '').ToUpperInvariant())
if (-not $id) { $id = (($serial -replace '[^a-zA-Z0-9]', '').ToUpperInvariant()) }
if (-not $id) { $id = (($env:COMPUTERNAME -replace '[^a-zA-Z0-9]', '').ToUpperInvariant()) }

$hardware = [ordered]@{
    ID_Equipamento=$id.Substring(0, [math]::Min(32, $id.Length)); Fabricante=[string]$computer.Manufacturer; Modelo=[string]$computer.Model
    Serial_BIOS=$serial; UUID_Sistema=$uuid; Processador=[string]$cpu.Name
    Geracao_Processador="$($cpu.NumberOfCores) núcleo(s), $($cpu.MaxClockSpeed) MHz"
    Memoria_RAM=if ($computer.TotalPhysicalMemory) { "{0:N2} GB" -f ($computer.TotalPhysicalMemory / 1GB) } else { '' }
    Tipo_Memoria=(($memory | ForEach-Object { $_.SMBIOSMemoryType } | Sort-Object -Unique) -join ', ')
    Modulos_Memoria=@($memory | ForEach-Object { [ordered]@{ Capacidade_GB=[math]::Round($_.Capacity / 1GB, 2); Velocidade_MHz=$_.Speed; Fabricante=$_.Manufacturer; PartNumber=$_.PartNumber } })
    Sistema_Operacional=[string]$os.Caption; Versao_SO=[string]$os.Version; Arquitetura_SO=[string]$os.OSArchitecture
    Armazenamento=(($disks | ForEach-Object { "$($_.Modelo) $($_.Capacidade_GB) GB" }) -join ' | '); Discos=$disks
    Graficos=($graphics -join ' | '); Hostname=$env:COMPUTERNAME; Origem_Leitura='PowerShell local'; Data_Cadastro=(Get-Date).ToUniversalTime().ToString('o')
}

try {
    $result = Invoke-RestMethod -Method Post -Uri "$ApiUrl/inventory/hardware/local/register" -Headers @{ Authorization="Bearer $Token" } -ContentType 'application/json' -Body ($hardware | ConvertTo-Json -Depth 8)
} catch {
    $details = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Error "Falha ao importar hardware para o banco: $details"
    Read-Host 'Pressione ENTER para fechar'
    exit 1
}
Write-Host $result.message -ForegroundColor Green
Write-Host "Equipamento: $($hardware.ID_Equipamento)"
Write-Host "Computador: $($hardware.Fabricante) $($hardware.Modelo)"
Read-Host 'Pressione ENTER para fechar'
