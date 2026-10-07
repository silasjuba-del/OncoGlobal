# W5 - Semaforo de arquivos (secao 6.1). Registra/libera reservas em docs/w5/CLAIMS.md do ORQUESTRADOR
# e recusa arquivo fora da trilha do agente (secao 3). ARQUIVO SO-ASCII de proposito (PowerShell 5.1).
# Uso:
#   & '...\docs\w5\ferramentas\claim.ps1' -Agente KERNEL -Achado ADV-003 -Arquivos 'src/server/rotas.ts','tests/server/rotas.test.ts'
#   & '...\docs\w5\ferramentas\claim.ps1' -Agente KERNEL -Achado ADV-003 -Arquivos 'src/server/rotas.ts' -Liberar -Commit abc1234
param(
  [Parameter(Mandatory = $true)][ValidateSet('RED', 'KERNEL', 'REGRAS', 'DOMINIO', 'E2E-UI')][string]$Agente,
  [Parameter(Mandatory = $true)][string]$Achado,
  [Parameter(Mandatory = $true)][string[]]$Arquivos,
  [switch]$Liberar,
  [string]$Commit = ''
)
$ErrorActionPreference = 'Stop'
$claims = 'C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\CLAIMS.md'
$mutex = 'C:\Users\silas\Projects\OncoGlobal-wt\_w5-locks\claims.lock'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Dono por arquivo (W5 secao 3). Congelados: ninguem.
$congelados = @('^src/contracts/', '^package\.json$', '^package-lock\.json$', '^tsconfig\.json$', '^\.github/',
  '^scripts/check-boundaries\.mjs$', '^tests/w3/auditoria-regressao\.test\.ts$', '^tests/w3/fixtures\.ts$',
  '^docs/DECISOES\.md$', '^docs/PLANO-')
$donos = [ordered]@{
  'RED'     = @('^tests/adv/', '^docs/w5/achados/')
  'KERNEL'  = @('^src/kernel/', '^src/server/', '^src/orchestration/', '^scripts/backup[^/]*\.mjs$',
                '^tests/(kernel|ledger|projections|identity|orchestration|server|backup|w4)/')
  'REGRAS'  = @('^src/rules/', '^corpus/rulesets/', '^corpus/prompts/', '^tests/(rules|apac|prompts|fixtures)/',
                '^tests/w3/(?!auditoria-regressao\.test\.ts$)[^/]+\.test\.ts$')
  'DOMINIO' = @('^src/modules/', '^corpus/packs/', '^corpus/templates/', '^corpus/capabilities\.v1\.json$',
                '^scripts/(validate-corpus|sigtap-import)\.mjs$', '^tests/(modules|corpus)/')
  'E2E-UI'  = @('^src/ui/', '^tests/ui/', '^tests/e2e/', '^index\.html$', '^vite\.config\.ts$')
}
function Normalizar([string]$p) { ($p -replace '\\', '/') -replace '^\./', '' }
function Dono([string]$p) {
  foreach ($c in $congelados) { if ($p -match $c) { return 'CONGELADO' } }
  foreach ($k in $donos.Keys) { foreach ($re in $donos[$k]) { if ($p -match $re) { return $k } } }
  return 'SEM_DONO'
}

$fs = $null
for ($i = 0; $i -lt 100 -and $null -eq $fs; $i++) {
  try { $fs = [System.IO.File]::Open($mutex, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None) }
  catch [System.IO.IOException] { Start-Sleep -Milliseconds 300 }
}
if ($null -eq $fs) { Write-Output 'CLAIMS ocupado; tente de novo.'; exit 75 }
try {
  $txt = [System.IO.File]::ReadAllText($claims, $utf8)
  $ativos = @{}
  foreach ($m in [regex]::Matches($txt, '(?m)^\| [^|]+ \| (RESERVA|LIBERA) \| `([^`]+)` \| ([A-Z0-9-]+) \|')) {
    $acao = $m.Groups[1].Value; $arq = $m.Groups[2].Value; $ag = $m.Groups[3].Value
    if ($acao -eq 'RESERVA') { $ativos[$arq] = $ag } elseif ($ativos[$arq] -eq $ag) { $ativos.Remove($arq) }
  }
  $agora = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $novas = New-Object System.Collections.Generic.List[string]
  foreach ($a in $Arquivos) {
    $p = Normalizar $a
    $dono = Dono $p
    if (-not $Liberar) {
      if ($dono -ne $Agente) { Write-Output "RECUSADO: $p pertence a $dono (W5 secao 3). Abra pedido ao orquestrador; nao edite."; exit 65 }
      if ($ativos.ContainsKey($p) -and $ativos[$p] -ne $Agente) { Write-Output "OCUPADO: $p reservado por $($ativos[$p]). Espere ou peca ao orquestrador."; exit 66 }
      if ($ativos[$p] -eq $Agente) { continue }
      $novas.Add("| $agora | RESERVA | ``$p`` | $Agente | $Achado | |")
    } else {
      if ($ativos[$p] -ne $Agente) { continue }
      $novas.Add("| $agora | LIBERA | ``$p`` | $Agente | $Achado | $Commit |")
    }
  }
  if ($novas.Count -gt 0) {
    $fim = if ($txt.EndsWith("`n")) { '' } else { "`n" }
    [System.IO.File]::AppendAllText($claims, $fim + (($novas -join "`n") + "`n"), $utf8)
  }
  Write-Output ("OK: {0} linha(s) registrada(s) em CLAIMS.md" -f $novas.Count)
} finally {
  $fs.Close()
  Remove-Item -LiteralPath $mutex -Force -ErrorAction SilentlyContinue
}
