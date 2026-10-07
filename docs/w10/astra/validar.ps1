param(
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][string]$Rotulo,
  [Parameter(Mandatory=$true)][string[]]$Testes,
  [switch]$SoTestes,
  [string]$ConfigVitest
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Worktree).TrimEnd('\')
if ($root -notmatch '^C:\\Users\\silas\\Projects\\OncoGlobal-wt\\w10-(astra|luna[1-5])$') { throw 'Worktree fora da cadeia W10.' }
if ($Testes.Count -eq 0 -or ($Testes | Where-Object { $_ -notmatch '^tests/[a-zA-Z0-9_./-]+$' -or $_ -match '\.\.' })) { throw 'Selecione pastas/arquivos de testes especificos.' }
if ($ConfigVitest -and $ConfigVitest -notmatch '^tests/[a-zA-Z0-9_/-]+/vitest\.config\.ts$') { throw 'Config invalida.' }
if ($Rotulo -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Rotulo invalido.' }
$lockDir = 'C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks'
$logDir = 'C:\Users\silas\Projects\OncoGlobal-wt\_w10-astra\logs'
New-Item -ItemType Directory -Force -Path $lockDir,$logDir | Out-Null
$lockPath = Join-Path $lockDir 'vitest.lock'
$lockHandle = $null
try {
  $lockHandle = [IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
} catch [IO.IOException] { Write-Output 'LOCK_OCUPADO: repetir depois; nenhum processo foi interrompido.'; exit 75 }
$logPath = Join-Path $logDir ((Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + $Rotulo + '.log')
$meta = @{ agente='W10-ASTRA'; pid=$PID; worktree=$root; comando=$Rotulo; desde=(Get-Date -Format o); log=$logPath } | ConvertTo-Json -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($meta)
$lockHandle.Write($bytes,0,$bytes.Length)
$lockHandle.Flush()
$result = 1
try {
  Push-Location -LiteralPath $root
  try {
    Start-Transcript -LiteralPath $logPath -Force | Out-Null
    try {
      Write-Output "WORKTREE=$root"
      & 'C:\Program Files\Git\cmd\git.exe' rev-parse HEAD
      $env:NO_COLOR='1'
      $env:FORCE_COLOR='0'
      if (-not $SoTestes) {
        & '.\node_modules\.bin\tsc.cmd' --noEmit 2>&1 | Tee-Object -FilePath ($logPath + '.typecheck.txt')
        Write-Output "TYPECHECK_EXIT=$LASTEXITCODE"
        if ($LASTEXITCODE -ne 0) { throw 'Typecheck falhou.' }
        & node '.\scripts\check-boundaries.mjs' 2>&1 | Tee-Object -FilePath ($logPath + '.boundaries.txt')
        Write-Output "BOUNDARIES_EXIT=$LASTEXITCODE"
        if ($LASTEXITCODE -ne 0) { throw 'Boundaries falhou.' }
        & node '.\scripts\validate-corpus.mjs' 2>&1 | Tee-Object -FilePath ($logPath + '.corpus.txt')
        Write-Output "CORPUS_EXIT=$LASTEXITCODE"
        if ($LASTEXITCODE -ne 0) { throw 'Corpus falhou.' }
      }
      # Process isolation avoids a timed-out HTTP worker retaining handles in the runner.
      # Fixed single worker and bounded I/O timeout support this low-memory workstation.
      $vitestArgs = @('run') + $Testes + @('--no-file-parallelism','--pool=forks','--maxWorkers=1','--testTimeout=30000','--hookTimeout=30000')
      if ($ConfigVitest) { $vitestArgs += @('--config',$ConfigVitest) }
      Write-Output ('VITEST_ARGUMENTS=' + ($vitestArgs -join ' '))
      & '.\node_modules\.bin\vitest.cmd' @vitestArgs 2>&1 | Tee-Object -FilePath ($logPath + '.vitest.txt')
      $result = $LASTEXITCODE
      Write-Output "VITEST_EXIT=$result"
    } finally { Stop-Transcript | Out-Null }
  } finally { Pop-Location }
} finally {
  $lockHandle.Dispose()
  Remove-Item -LiteralPath $lockPath
  Write-Output "LOG=$logPath"
}
exit $result
