$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $projectRoot 'server'
$clientPath = Join-Path $projectRoot 'client'
$tempPath = Join-Path $env:TEMP 'rifa-pos-dev-web'
$apiTunnelLog = Join-Path $tempPath 'api-tunnel.log'
$webTunnelLog = Join-Path $tempPath 'web-tunnel.log'
$serverProcess = $null
$apiTunnelProcess = $null
$clientProcess = $null
$webTunnelProcess = $null

function Get-CloudflareUrl($logPath) {
  $logPaths = @($logPath, "$logPath.err") | Where-Object { Test-Path $_ }
  if ($logPaths.Count -eq 0) { return $null }
  $content = ($logPaths | ForEach-Object { Get-Content $_ -Raw -ErrorAction SilentlyContinue }) -join "`n"
  $match = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { return $match.Value }
  return $null
}

function Wait-ForCloudflareUrl($logPath, $process, $label) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $url = Get-CloudflareUrl $logPath
    if ($url) { return $url }
    if ($process.HasExited) { throw "$label termino antes de crear el enlace publico." }
    Start-Sleep -Milliseconds 500
  }
  throw "No se pudo obtener el enlace publico de $label."
}

function Stop-ChildProcess($process) {
  if ($process -and -not $process.HasExited) {
    taskkill /PID $process.Id /T /F | Out-Null
  }
}

function Get-FreePort($startingPort) {
  for ($port = $startingPort; $port -lt ($startingPort + 20); $port++) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try {
      $listener.Start()
      $listener.Stop()
      return $port
    } catch {
      $listener.Stop()
    }
  }
  throw "No hay puertos disponibles desde $startingPort."
}

try {
  New-Item -ItemType Directory -Path $tempPath -Force | Out-Null
  Remove-Item $apiTunnelLog, $webTunnelLog, "$webTunnelLog.err" -Force -ErrorAction SilentlyContinue

  $serverProcess = Start-Process npm.cmd -ArgumentList 'run', 'dev' -WorkingDirectory $serverPath -PassThru
  Write-Host 'Iniciando API...' -ForegroundColor Cyan

  $apiReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $health = Invoke-RestMethod 'http://localhost:4000/api/health' -TimeoutSec 2
      if ($health.ok) { $apiReady = $true; break }
    } catch { }
    if ($serverProcess.HasExited) { throw 'La API no pudo iniciar. Revisa la configuracion de server/.env.' }
    Start-Sleep -Milliseconds 500
  }
  if (-not $apiReady) { throw 'La API no respondio en el puerto 4000.' }

  $apiTunnelProcess = Start-Process cloudflared.exe -ArgumentList 'tunnel', '--url', 'http://localhost:4000' -RedirectStandardOutput $apiTunnelLog -RedirectStandardError "$apiTunnelLog.err" -PassThru
  $apiUrl = Wait-ForCloudflareUrl $apiTunnelLog $apiTunnelProcess 'El tunel de la API'

  $clientPort = Get-FreePort 5173
  $clientCommand = "set VITE_API_URL=$apiUrl&& npm run dev -- --host 0.0.0.0 --port $clientPort"
  $clientProcess = Start-Process cmd.exe -ArgumentList '/c', $clientCommand -WorkingDirectory $clientPath -PassThru
  Start-Sleep -Seconds 2

  $webTunnelProcess = Start-Process cloudflared.exe -ArgumentList 'tunnel', '--url', "http://localhost:$clientPort" -RedirectStandardOutput $webTunnelLog -RedirectStandardError "$webTunnelLog.err" -PassThru
  $webUrl = Wait-ForCloudflareUrl $webTunnelLog $webTunnelProcess 'El tunel de la web'

  Write-Host ''
  Write-Host 'Web publica:' -ForegroundColor Green
  Write-Host $webUrl -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'API publica:' -ForegroundColor Green
  Write-Host $apiUrl -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'Presiona Ctrl+C para detener la web y los tuneles.' -ForegroundColor Cyan

  while ($true) {
    if ($serverProcess.HasExited) { throw 'La API se detuvo inesperadamente.' }
    if ($clientProcess.HasExited) { throw 'El cliente web se detuvo inesperadamente.' }
    if ($apiTunnelProcess.HasExited) { throw 'El tunel de la API se detuvo inesperadamente.' }
    if ($webTunnelProcess.HasExited) { throw 'El tunel de la web se detuvo inesperadamente.' }
    Start-Sleep -Seconds 2
  }
} finally {
  Stop-ChildProcess $webTunnelProcess
  Stop-ChildProcess $clientProcess
  Stop-ChildProcess $apiTunnelProcess
  Stop-ChildProcess $serverProcess
}