param([Parameter(Mandatory=$true)][string]$Etapa,
  [ValidateSet('threads','forks')][string]$Pool = 'threads')
$ErrorActionPreference = 'Stop'
$repoF0 = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $repoF0
$evidenciaF0 = Join-Path $PSScriptRoot "evidencias/$Etapa"
New-Item -ItemType Directory -Force -Path $evidenciaF0 | Out-Null
$env:NO_COLOR = '1'
$env:FORCE_COLOR = '0'
$gruposF0 = @(
  @('rules','rules-conhecimento','rules-morfometria','rules-prescricao','rules-w8','modules','corpus','corpus-fichas','corpus-kit','contracts'),
  @('kernel','projections','orchestration','leitura','ledger','identity','prompts'),
  @('server','e2e','apac','apac-w10','app','backup','sistema','impressao','oncoassist-local','oncoassist-jev'),
  @('ui','ui-telas','ui-copy','muse','w10-cursor'),
  @('w10-grok','w10-luna2','w10-luna3','w10-luna4','w10-luna5','w12-grok','w10-eixo-orquestra','w10-eixo-servidor','w10-eixo-temporal','w10-entrega','w10-fugu','w10-fugu-eixo','w10-int-gates'),
  @('w11-adv','w12-f1','w12-f2','w12-f3','w12-f4','w3','adv','cobertura','f0-fecha')
)
$cobertasF0 = @($gruposF0 | ForEach-Object { $_ }) + @('redteam','adv-w8','fixtures')
$extrasF0 = @(Get-ChildItem tests -Directory | Where-Object { $_.Name -notin $cobertasF0 } | ForEach-Object { $_.Name })
if ($extrasF0.Count -gt 0) { $gruposF0 += ,$extrasF0 }
$tarefasF0 = @(
  @{ nome='01-tsc'; exe='node'; argumentos=@('node_modules/typescript/bin/tsc','--noEmit') },
  @{ nome='02-fronteiras'; exe='node'; argumentos=@('scripts/check-boundaries.mjs') },
  @{ nome='03-corpus'; exe='node'; argumentos=@('scripts/validate-corpus.mjs') }
)
$indiceF0 = 4
foreach ($grupoF0 in $gruposF0) {
  $pastasF0 = @($grupoF0 | Where-Object { Test-Path "tests/$_" } | ForEach-Object { "tests/$_/" })
  if ($pastasF0.Count -eq 0) { continue }
  $tarefasF0 += @{ nome=('{0:d2}-bloco' -f $indiceF0); exe='node'; argumentos=@('node_modules/vitest/vitest.mjs','run') + $pastasF0 + @('--no-file-parallelism','--maxWorkers=1',"--pool=$Pool") }
  $indiceF0++
}
$raizF0 = @(Get-ChildItem tests -File | Where-Object { $_.Name -match '\.(test|spec)\.[cm]?[jt]sx?$' } | ForEach-Object { "tests/$($_.Name)" })
if ($raizF0.Count -gt 0) { $tarefasF0 += @{ nome='raiz'; exe='node'; argumentos=@('node_modules/vitest/vitest.mjs','run') + $raizF0 + @('--no-file-parallelism','--maxWorkers=1',"--pool=$Pool") } }
foreach ($adversarialF0 in @('redteam','adv-w8')) {
  $tarefasF0 += @{ nome=$adversarialF0; exe='node'; argumentos=@('node_modules/vitest/vitest.mjs','run','--config',"tests/$adversarialF0/vitest.config.ts",'--no-file-parallelism','--maxWorkers=1',"--pool=$Pool") }
}
$resultadosF0 = @()
git rev-parse HEAD | Set-Content -Encoding utf8 (Join-Path $evidenciaF0 'HEAD.txt')
$tarefasF0 | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $evidenciaF0 'comandos.json')
foreach ($tarefaF0 in $tarefasF0) {
  $inicioF0 = Get-Date
  Write-Output "INICIO $($tarefaF0.nome)"
  $logF0 = Join-Path $evidenciaF0 "$($tarefaF0.nome).log"
  & $tarefaF0.exe @($tarefaF0.argumentos) *> $logF0
  $codigoF0 = $LASTEXITCODE
  $resumoF0 = @(Get-Content -LiteralPath $logF0 | Select-String -Pattern 'Test Files|Tests |Duration|Error|FAIL|Passed|validado|fronteira' | ForEach-Object { $_.Line })
  $resultadosF0 += @{ bloco=$tarefaF0.nome; exitCode=$codigoF0; segundos=[math]::Round(((Get-Date)-$inicioF0).TotalSeconds,2); resumo=$resumoF0 }
  $resultadosF0 | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $evidenciaF0 'resultados.json')
  Write-Output "FIM $($tarefaF0.nome) exit=$codigoF0"
  $resumoF0 | Select-Object -Last 8 | Write-Output
}
if (@($resultadosF0 | Where-Object { $_.exitCode -ne 0 }).Count -gt 0) { exit 1 }
