# W5 - Semaforo do Vitest (secao 6.4): um agente por vez roda typecheck/Vitest/verify.
# ARQUIVO SO-ASCII de proposito (Windows PowerShell 5.1 le .ps1 sem BOM como ANSI).
# Uso (PowerShell):
#   & 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\vitest-lock.ps1' `
#       -Agente RED -Worktree 'C:\Users\silas\Projects\OncoGlobal-wt\w5-red' `
#       -Comando 'npx vitest run tests/adv --no-file-parallelism'
# O lock e atomico (FileMode.CreateNew) e fica FORA dos repositorios (_w5-locks\vitest.lock).
# Lock de processo morto e liberado sozinho (PID registrado). Saida completa vai para _w5-locks\logs.
param(
  [Parameter(Mandatory = $true)][ValidateSet('ORQ', 'RED', 'KERNEL', 'REGRAS', 'DOMINIO', 'E2E-UI')][string]$Agente,
  [Parameter(Mandatory = $true)][string]$Worktree,
  [Parameter(Mandatory = $true)][string]$Comando,
  [int]$EsperaMaxMin = 120,
  [int]$LinhasFinais = 120
)
$ErrorActionPreference = 'Stop'
$raiz = 'C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks'
$lock = Join-Path $raiz 'vitest.lock'
$logs = Join-Path $raiz 'logs'
$estado = 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ESTADO.md'
$utf8 = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if ($Comando -match 'vitest' -and $Comando -notmatch '--no-file-parallelism') {
  Write-Output 'RECUSADO: Vitest so roda em serie (--no-file-parallelism), secao 6.4.'
  exit 64
}
if (-not (Test-Path -LiteralPath (Join-Path $Worktree 'package.json'))) {
  Write-Output "RECUSADO: worktree invalido: $Worktree"
  exit 64
}

function Set-LinhaEstado([string]$valor) {
  for ($i = 0; $i -lt 8; $i++) {
    try {
      if (-not (Test-Path -LiteralPath $estado)) { return }
      $txt = [System.IO.File]::ReadAllText($estado, $utf8)
      $novo = [regex]::Replace($txt, '(?m)^- \*\*Agente ativo no Vitest:\*\*.*$', "- **Agente ativo no Vitest:** $valor")
      if ($novo -ne $txt) { [System.IO.File]::WriteAllText($estado, $novo, $utf8) }
      return
    } catch { Start-Sleep -Milliseconds 400 }
  }
}

$inicio = Get-Date
$fs = $null
$avisou = $false
while ($null -eq $fs) {
  try {
    $fs = [System.IO.File]::Open($lock, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
  } catch [System.IO.IOException] {
    try {
      $info = [System.IO.File]::ReadAllText($lock, $utf8) | ConvertFrom-Json
      if ($info.pid -and -not (Get-Process -Id ([int]$info.pid) -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
        Write-Output "Lock orfao de $($info.agente) (PID $($info.pid) morto) liberado."
        continue
      }
      if (-not $avisou) { Write-Output "Aguardando lock: $($info.agente) roda '$($info.comando)' desde $($info.desde)."; $avisou = $true }
    } catch { }
    if (((Get-Date) - $inicio).TotalMinutes -gt $EsperaMaxMin) { Write-Output 'LOCK_TIMEOUT: outro agente segura o Vitest; tente de novo depois.'; exit 75 }
    Start-Sleep -Seconds 10
  }
}

$desde = Get-Date -Format 'HH:mm:ss'
$carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $logs ("{0}-{1}.log" -f $carimbo, $Agente)
$meta = @{ agente = $Agente; pid = $PID; comando = $Comando; worktree = $Worktree; desde = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'); log = $log } | ConvertTo-Json -Compress
$bytes = $utf8.GetBytes($meta)
$fs.Write($bytes, 0, $bytes.Length)
$fs.Flush()
Set-LinhaEstado ("{0} desde {1} (``{2}``) - lock em _w5-locks\vitest.lock" -f $Agente, $desde, $Comando)

$codigo = 1
$saida = @()
try {
  $env:NO_COLOR = '1'
  $env:FORCE_COLOR = '0'
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Push-Location -LiteralPath $Worktree
  try {
    $saida = & cmd.exe /d /c "chcp 65001>nul & $Comando 2>&1"
    $codigo = $LASTEXITCODE
  } finally { Pop-Location }
  $texto = (@($saida) | ForEach-Object { [string]$_ }) -join "`r`n"
  [System.IO.File]::WriteAllText($log, ("# agente={0} worktree={1} comando={2} inicio={3} exit={4}`r`n{5}" -f $Agente, $Worktree, $Comando, $desde, $codigo, $texto), $utf8)
} finally {
  $fs.Close()
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
  Set-LinhaEstado ("nenhum (lock livre; ultimo: {0} as {1}, exit {2})" -f $Agente, (Get-Date -Format 'HH:mm:ss'), $codigo)
}

$linhas = @($saida)
if ($linhas.Count -gt $LinhasFinais) {
  Write-Output ("[... {0} linhas omitidas; saida completa em {1}]" -f ($linhas.Count - $LinhasFinais), $log)
  $linhas | Select-Object -Last $LinhasFinais
} else { $linhas }
Write-Output ("EXIT_CODE={0} - LOG={1}" -f $codigo, $log)
exit $codigo
