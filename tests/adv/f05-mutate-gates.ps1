# F5 RED: muta apenas a worktree detached w5-mut. Nunca edita fonte em worktrees ativos.
# As falhas dos testes sao esperadas; a restauracao exata roda em finally por gate.
param(
  [string]$Worktree = 'C:\Users\silas\Projects\OncoGlobal-wt\w5-mut',
  [string[]]$Gates = @('02','03','05','10','13','14','23','25','26')
)
$ErrorActionPreference = 'Stop'
$git = 'C:\Program Files\Git\cmd\git.exe'
$red = 'C:\Users\silas\Projects\OncoGlobal-wt\w5-red'
$lockScript = 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\vitest-lock.ps1'
$expected = [IO.Path]::GetFullPath('C:\Users\silas\Projects\OncoGlobal-wt\w5-mut')
$actual = [IO.Path]::GetFullPath($Worktree)
if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
  throw "TARGET_FORA_DO_DESCARTAVEL: $actual"
}
if (-not (Test-Path -LiteralPath (Join-Path $actual '.git'))) { throw 'WORKTREE_SEM_GIT' }
$item = Get-Item -LiteralPath $actual
if ($item.LinkType) { throw 'WORKTREE_EH_LINK_NAO_REMOVER_OU_MUTAR' }
$branch = (& $git -C $actual rev-parse --abbrev-ref HEAD).Trim()
$sha = (& $git -C $actual rev-parse HEAD).Trim()
$redSha = (& $git -C $red rev-parse HEAD).Trim()
if ($branch -ne 'HEAD' -or $sha -ne $redSha) { throw "DETACHED_OU_BASE_INVALIDA: $branch $sha $redSha" }
$source = Join-Path $actual 'src\kernel\harness\gates.ts'
if (-not (Test-Path -LiteralPath $source)) { throw 'GATES_AUSENTES' }
if (@(& $git -C $actual status --porcelain).Count -gt 0) { throw 'WORKTREE_DESCARTAVEL_DIRTY_ANTES_DE_MUTAR' }

$names = @{
  '02'='g02PhiEgress'; '03'='g03Assinatura'; '05'='g05VerdeHonesto'
  '10'='g10DosePura'; '13'='g13Letra'; '14'='g14Interpolacao'
  '23'='g23ComandoDeepgram'; '25'='g25EscopoAssinatura'; '26'='g26VisaoSemAutoridade'
}
foreach ($gate in $Gates) {
  if (-not $names.ContainsKey($gate)) { throw "GATE_DESCONHECIDO: $gate" }
}

function Run-Locked([string]$command) {
  $out = @(& $lockScript -Agente RED -Worktree $actual -Comando $command -LinhasFinais 16)
  $match = [regex]::Match(($out -join "`n"), 'EXIT_CODE=(\d+) - LOG=([^\r\n]+)')
  if (-not $match.Success) { throw "LOCK_SEM_EXIT_CODE: $command`n$($out -join "`n")" }
  return [pscustomobject]@{ Code = [int]$match.Groups[1].Value; Log = $match.Groups[2].Value.Trim() }
}

$baseline = Run-Locked 'npx vitest run tests/kernel/kernel.test.ts --no-file-parallelism'
Write-Output "BASELINE_EXIT=$($baseline.Code) LOG=$($baseline.Log)"
if ($baseline.Code -ne 0) { throw 'BASELINE_KERNEL_NAO_VERDE_NAO_MUTAR' }

foreach ($gate in $Gates) {
  if (@(& $git -C $actual status --porcelain).Count -gt 0) { throw "DIRTY_ANTES_G-$gate" }
  $original = [IO.File]::ReadAllBytes($source)
  $hashBefore = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  $changed = $false
  try {
    $text = [Text.Encoding]::UTF8.GetString($original)
    $start = $text.IndexOf("export function $($names[$gate])(", [StringComparison]::Ordinal)
    if ($start -lt 0) { throw "FUNCAO_NAO_ENCONTRADA_G-$gate" }
    $bodyMarker = '): Veredito {'
    $bodyStart = $text.IndexOf($bodyMarker, $start, [StringComparison]::Ordinal)
    if ($bodyStart -lt 0) { throw "CORPO_NAO_ENCONTRADO_G-$gate" }
    $bodyStart += $bodyMarker.Length
    $close = $text.IndexOf("`n}", $bodyStart, [StringComparison]::Ordinal)
    if ($close -lt 0) { throw "FECHO_NAO_ENCONTRADO_G-$gate" }
    $mutated = $text.Substring(0, $bodyStart) +
      "`n  return passa(`"G-$gate`");`n" + $text.Substring($close)
    [IO.File]::WriteAllText($source, $mutated, [Text.UTF8Encoding]::new($false))
    $changed = $true
    $result = Run-Locked "npx vitest run tests/kernel/kernel.test.ts --no-file-parallelism -t G-$gate"
    $logText = [IO.File]::ReadAllText($result.Log, [Text.Encoding]::UTF8)
    $detected = $result.Code -ne 0 -and $logText.Contains('FAIL  tests/kernel/kernel.test.ts') `
      -and $logText.Contains("G-$gate")
    Write-Output "G-$gate MUTACAO=PASSA TARGET_EXIT=$($result.Code) DETECTED_BY_UNIT=$detected LOG=$($result.Log)"
    if (-not $detected) {
      $full = Run-Locked 'npx vitest run --no-file-parallelism --exclude tests/adv/**'
      Write-Output "G-$gate FULL_REGULAR_EXIT=$($full.Code) LOG=$($full.Log)"
    }
    if ($gate -eq '25') {
      $http = Run-Locked 'npx vitest run tests/server/server.test.ts --no-file-parallelism -t G-25'
      Write-Output "G-25 HTTP_TARGET_EXIT=$($http.Code) LOG=$($http.Log)"
    }
  } finally {
    if ($changed) { [IO.File]::WriteAllBytes($source, $original) }
    $hashAfter = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    if ($hashBefore -ne $hashAfter) { throw "RESTAURACAO_FALHOU_G-$gate" }
    if (@(& $git -C $actual status --porcelain).Count -gt 0) { throw "DIRTY_APOS_RESTAURAR_G-$gate" }
    Write-Output "G-$gate RESTAURADO=SIM WORKTREE_LIMPA=SIM"
  }
}
Write-Output "FINAL_DETACHED=$sha STATUS_LIMPO=SIM"
