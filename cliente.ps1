# =========================================================================
# CONFIGURAÇÕES DO SERVIDOR E LOGS
# =========================================================================

$DestinoRede = "\\DESKTOP-TI60S88\Etiquetas"
$CaminhoLogLocal = Join-Path $env:TEMP "log_etiqueta.txt"

function Registrar-LogEParar ($MensagemErro) {
    $DataHora = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $TextoLog = "[$DataHora] ERRO: $MensagemErro"
    
    Add-Content -Path $CaminhoLogLocal -Value $TextoLog -ErrorAction SilentlyContinue
    
    if (Test-Path $DestinoRede) {
        $CaminhoLogRede = Join-Path $DestinoRede "log_erros_bancada.txt"
        $SerialMaq = (Get-CimInstance Win32_Bios).SerialNumber.Trim()
        Add-Content -Path $CaminhoLogRede -Value "[$DataHora] [Maquina: $SerialMaq] ERRO: $MensagemErro" -ErrorAction SilentlyContinue
    }

    Write-Host "`n==========================================================" -ForegroundColor Red
    Write-Host " EXECUÇÃO INTERROMPIDA POR ERRO:" -ForegroundColor Red
    Write-Host " $MensagemErro" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Red
    
    Write-Host "`nPressione ENTER para fechar esta janela..." -ForegroundColor Cyan
    Read-Host | Out-Null
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  EXECUTANDO COLETA E GERAÇÃO DE ETIQUETA (.DOCX)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Validação de Acesso à Rede
if (!(Test-Path $DestinoRede)) {
    Registrar-LogEParar "Caminho de rede ($DestinoRede) inacessível ou sem conexão."
}

# 2. Definição de Arquivo e Coleta de Hardware
try {
    $Serial = (Get-CimInstance Win32_Bios).SerialNumber.Trim()
    if ([string]::IsNullOrWhiteSpace($Serial) -or $Serial -eq "To be filled by O.E.M.") {
        $Serial = Get-Random -Minimum 100000 -Maximum 999999
    }

    $NomeArquivo = "etiqueta_$Serial.docx"
    $CaminhoLocalTemp = Join-Path $env:TEMP $NomeArquivo
    $CaminhoFinalRede = Join-Path $DestinoRede $NomeArquivo

    if (Test-Path $CaminhoLocalTemp) { Remove-Item $CaminhoLocalTemp -Force -ErrorAction Stop }

    Write-Host "Coletando informações de hardware avançadas..." -ForegroundColor Green
    
    # --- PROCESSADOR ---
    $CPUObj = Get-CimInstance Win32_Processor -ErrorAction Stop
    $CPUNome = $CPUObj.Name.Trim()
    $GeracaoCPU = "Nao identificada / Outra linha"

    if ($CPUNome -match "Intel.*Core.*i[3579]-([0-9]{2})([0-9]{2})") {
        $GeracaoCPU = "$($Matches[1])ª Geracao Intel Core"
    } elseif ($CPUNome -match "Intel.*Core.*i[3579]-([0-9])([0-9]{3})") {
        $GeracaoCPU = "$($Matches[1])ª Geracao Intel Core"
    } elseif ($CPUNome -match "AMD Ryzen.*([0-9])([0-9]{3}[0-9]?[X]?)") {
        $GeracaoCPU = "$($Matches[1])ª Geracao AMD Ryzen"
    }

    # --- MEMÓRIA RAM ---
    $RAM_Modules = Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop
    $RAM_Bytes = ($RAM_Modules | Measure-Object -Property Capacity -Sum).Sum
    $RAM_GB = [Math]::Round($RAM_Bytes / 1GB)
    $RAM = "$RAM_GB GB"
    
    $RAM_Valida = ($RAM_Modules | Where-Object { $_.ConfiguredClockSpeed -gt 0 })
    if ($RAM_Valida) {
        $SaudeRAM = "Saudável (Operacional)"
    } else {
        $SaudeRAM = "Verificar"
    }

    # --- ARMAZENAMENTO (DETALHAMENTO MULTI-DISCO) ---
    $DiscosFisicos = Get-PhysicalDisk -ErrorAction Stop
    $ListaDiscos = @()
    
    foreach ($Disco in $DiscosFisicos) {
        $Tipo = $Disco.MediaType
        if ($Tipo -eq "Unspecified" -or !$Tipo) {
            if ($Disco.Model -match "SSD" -or $Disco.FriendlyName -match "SSD" -or $Disco.BusType -eq "NVMe") { 
                $Tipo = "SSD" 
            } else { 
                $Tipo = "HDD" 
            }
        }
        $TamanhoGB = [Math]::Round($Disco.Size / 1GB)
        $ListaDiscos += "$TamanhoGB GB $Tipo ($($Disco.HealthStatus))"
    }

    # Gera elementos XML dinâmicos para unidades de armazenamento
    $ArmazenamentoXml = ""
    if ($ListaDiscos.Count -eq 1) {
        $ArmazenamentoXml = "<w:p><w:r><w:rPr><w:b/><w:sz w:val=""22""/></w:rPr><w:t>ARMAZENAMENTO: $($ListaDiscos[0])</w:t></w:r></w:p>"
    } else {
        $num = 1
        foreach ($d in $ListaDiscos) {
            $ArmazenamentoXml += "<w:p><w:r><w:rPr><w:b/><w:sz w:val=""22""/></w:rPr><w:t>ARMAZENAMENTO (DISCO $num): $d</w:t></w:r></w:p>"
            $num++
        }
    }

    # --- RECURSOS AVANÇADOS (USB 3.0, WI-FI, BLUETOOTH, VÍDEO) ---
    # 1. USB 3.0+
    $TemUSB3 = Get-CimInstance Win32_USBController -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "3\.0|3\.1|3\.2|xHCI" }
    $TextoUSB = if ($TemUSB3) { "Presente (Alta Velocidade)" } else { "Apenas USB 2.0" }

    # 2. Conectividade (Wi-Fi e Bluetooth)
    $Redes = Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue
    $TemWiFi = ($Redes | Where-Object { $_.Name -match "Wireless|Wi-Fi|802\.11" -and $_.PhysicalAdapter -eq $true }).Count -gt 0
    $TemBT   = ($Redes | Where-Object { $_.Name -match "Bluetooth" }).Count -gt 0
    
    $RecursosRede = @()
    if ($TemWiFi) { $RecursosRede += "Wi-Fi Integrated" }
    if ($TemBT)   { $RecursosRede += "Bluetooth" }
    $TextoRedeSemFio = if ($RecursosRede.Count -gt 0) { $RecursosRede -join " + " } else { "Apenas Rede Cabeada" }

    # 3. Placa de Vídeo (GPU)
    $GPU = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -First 1).Name

    # --- SISTEMA E DATA ---
    $SO = (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).Caption
    $Data = Get-Date -Format "dd/MM/yyyy HH:mm"

} catch {
    Registrar-LogEParar "Falha durante a consulta de hardware: $_"
}

# 3. Construção do Documento Word (.DOCX) Via Empacotamento Nativo (OpenXML)
try {
    Write-Host "Criando estrutura do documento .DOCX (100x150 mm)..." -ForegroundColor Yellow

    # Estrutura XML do Documento Word (Layout Térmico 100x150 mm)
    $DocumentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>MAQUINA TESTADA</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>E LIBERADA</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>----------------------------------------</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>DATA/HORA: $Data</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>PROCESSADOR: $CPUNome</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>GERACAO: $GeracaoCPU</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>MEMORIA RAM: $RAM (Saude: $SaudeRAM)</w:t></w:r></w:p>
    $ArmazenamentoXml
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>VIDEO/GRAFICOS: $GPU</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>PORTAS USB 3.0+: $TextoUSB</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>SEM FIO: $TextoRedeSemFio</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>SISTEMA OPERACIONAL: $SO</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>----------------------------------------</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="5669" w:h="8505" w:orient="portrait"/>
      <w:pgMar w:top="283" w:right="283" w:bottom="283" w:left="283"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

    $ContentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    $RelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $TempZipFolder = Join-Path $env:TEMP ("docx_build_" + (Get-Random))
    $WordFolder = Join-Path $TempZipFolder "word"
    $RelsFolder = Join-Path $TempZipFolder "_rels"
    
    New-Item -ItemType Directory -Path $WordFolder -Force | Out-Null
    New-Item -ItemType Directory -Path $RelsFolder -Force | Out-Null

    # Força escrita em UTF-8 sem BOM para compatibilidade perfeita de caracteres em PT-BR
    $Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText((Join-Path $TempZipFolder "[Content_Types].xml"), $ContentTypesXml, $Utf8NoBomEncoding)
    [System.IO.File]::WriteAllText((Join-Path $RelsFolder ".rels"), $RelsXml, $Utf8NoBomEncoding)
    [System.IO.File]::WriteAllText((Join-Path $WordFolder "document.xml"), $DocumentXml, $Utf8NoBomEncoding)

    # Empacota e gera o arquivo final .docx
    [System.IO.Compression.ZipFile]::CreateFromDirectory($TempZipFolder, $CaminhoLocalTemp)
    Remove-Item $TempZipFolder -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "Copiando arquivo para a pasta de rede..." -ForegroundColor Yellow
    Copy-Item -Path $CaminhoLocalTemp -Destination $CaminhoFinalRede -Force -ErrorAction Stop
    Remove-Item $CaminhoLocalTemp -Force -ErrorAction SilentlyContinue

    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " SUCESSO: Arquivo $NomeArquivo enviado para o servidor!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Start-Sleep -Seconds 3
}
catch {
    Registrar-LogEParar "Falha na geração OpenXML ou transferência do arquivo .docx: $_"
}