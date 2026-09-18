param([switch]$StartAgent)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -StartAgent"
  Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
  exit 0
}

$url = 'http://+:5310/'
$existing = netsh http show urlacl url=$url 2>$null
if (-not ($existing -match [regex]::Escape($url))) {
  netsh http add urlacl url=$url user=Everyone | Out-Host
}

if ($StartAgent) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'cliente-agent.ps1')
}
