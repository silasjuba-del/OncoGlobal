# F5: somente copias no detached real. Contratos/testes probatorios nunca mutados.
param([string]$Worktree='C:\Users\silas\Projects\OncoGlobal-wt\w5-mut-red-final')
$ErrorActionPreference='Stop'
$expected='C:\Users\silas\Projects\OncoGlobal-wt\w5-mut-red-final'
if([IO.Path]::GetFullPath($Worktree) -ne $expected){throw 'TARGET_FORA_DO_DESCARTAVEL'}
if((Get-Item -LiteralPath $Worktree).LinkType){throw 'DESCARTAVEL_E_LINK'}
$branch = & git -C $Worktree rev-parse --abbrev-ref HEAD
if($branch -ne 'HEAD'){throw 'DESCARTAVEL_NAO_DETACHED'}
$base=(& git -C $Worktree rev-parse HEAD).Trim()
$scriptLock='C:\Users\silas\Projects\OncoGlobal-wt\w5-orq\docs\w5\ferramentas\vitest-lock.ps1'
function Run-Locked([string]$command){
  $out=@(& $scriptLock -Agente RED -Worktree $Worktree -Comando $command -LinhasFinais 12)
  $m=[regex]::Match(($out -join "`n"),'EXIT_CODE=(\d+) - LOG=([^\r\n]+)')
  if(-not $m.Success){throw 'LOCK_SEM_RESULTADO'}
  [pscustomobject]@{Code=[int]$m.Groups[1].Value;Log=$m.Groups[2].Value.Trim()}
}
function Replace-One([string]$text,[string]$old,[string]$new){
  if($text.IndexOf($old) -lt 0 -or $text.IndexOf($old) -ne $text.LastIndexOf($old)){throw 'MUTACAO_NAO_UNICA'}
  $text.Replace($old,$new)
}
$cases=@(
  @{Gate='G-01';File='src/rules/identidade.ts';Test='tests/identity/g01-vinculo.test.ts';Mode='identity'},
  @{Gate='G-17';File='src/kernel/corpus/loader.ts';Test='tests/corpus/g17-packs-cob.test.ts';Mode='corpus'},
  @{Gate='G-19';File='src/kernel/gateway/gateway.ts';Test='tests/kernel/kernel.test.ts';Mode='intent'},
  @{Gate='G-20';File='src/kernel/ledger/idempotencia.ts';Test='tests/ledger/adv001-idempotencia.test.ts';Mode='store'},
  @{Gate='G-11';File='src/rules/apac.ts';Test='tests/apac/apac.test.ts';Mode='emitir'},
  @{Gate='G-12';File='src/rules/apac.ts';Test='tests/apac/apac.test.ts';Mode='finalidade'},
  @{Gate='G-18';File='src/modules/documentos/render.ts';Test='tests/modules/adv015-template.test.ts';Mode='render'}
)
if(@(& git -C $Worktree status --porcelain).Count){throw 'DETACHED_DIRTY'}
$baseline=Run-Locked 'npx vitest run tests/identity/g01-vinculo.test.ts tests/corpus/g17-packs-cob.test.ts tests/kernel/kernel.test.ts tests/ledger/adv001-idempotencia.test.ts tests/apac/apac.test.ts tests/modules/adv015-template.test.ts --no-file-parallelism'
Write-Output "BASELINE_EXIT=$($baseline.Code) BASE=$base LOG=$($baseline.Log)"
if($baseline.Code -ne 0){throw 'BASELINE_NAO_VERDE'}
foreach($case in $cases){
  if(@(& git -C $Worktree status --porcelain).Count){throw 'DIRTY_ANTES_MUTACAO'}
  $path=Join-Path $Worktree $case.File
  $bytes=[IO.File]::ReadAllBytes($path)
  $hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  try{
    $text=[Text.Encoding]::UTF8.GetString($bytes)
    switch($case.Mode){
      'identity' {$text=Replace-One $text 'if (encontrados.size > 1)' 'if (false && encontrados.size > 1)'}
      'corpus' {$text=Replace-One $text 'if (parse.success) return { ok: true, header: parse.data };' 'return { ok: true, header: (json as { header: HeaderRuleset }).header };'}
      'intent' {$text=Replace-One $text 'const p = ActionIntent.safeParse(bruto);' 'const p = { success: true, data: { verbo: "IMPRIMIR", objeto: { tipo: "DOCUMENTO", id: "mutacao-teste", versao: 1 }, escopo: { patientId: "Paciente Teste 01", encounterId: "teste" }, destino: null, idempotencyKey: "mutacao-chave", ...(bruto as object) } as Intent };'}
      'store' {
        $start=$text.IndexOf('export function sqliteIdempotencia(')
        if($start -lt 0){throw 'STORE_AUSENTE'}
        $text='import { memoriaIdempotencia } from "../gateway/gateway.js";'+"`n"+$text.Substring(0,$start)+'export function sqliteIdempotencia(db: DatabaseSync): StoreIdempotencia { return memoriaIdempotencia(); }'+"`n"
      }
      'emitir' {$text=Replace-One $text 'const podeEmitir = valid.estado === "RASCUNHO" && faltantes.length === 0;' 'const podeEmitir = true;'}
      'finalidade' {$text=Replace-One $text 'campos: { ...campos, finalidadeApac: finalidade }' 'campos: { ...campos, finalidadeApac: prescricaoAssinada.campos.intencao ?? finalidade }'}
      'render' {
        $old='if (!Array.isArray(entrada.template.proibidoConter)'+"`n"+'      || !ORIGENS_RECONHECIDAS.has(fato.origem)'+"`n"+'      || entrada.template.proibidoConter.includes(fato.origem)) continue;'
        $normalized=$text.Replace("`r`n","`n")
        $text=Replace-One $normalized $old 'if (false) continue;'
      }
    }
    [IO.File]::WriteAllText($path,$text,[Text.UTF8Encoding]::new($false))
    $result=Run-Locked ('npx vitest run '+$case.Test+' --no-file-parallelism')
    $logText=[IO.File]::ReadAllText($result.Log)
    $detected=$result.Code -ne 0 -and $logText.Contains('AssertionError') -and $logText.Contains('FAIL  '+$case.Test)
    Write-Output "$($case.Gate) MUTACAO=$($case.Mode) DETECTADA_ASSERT=$detected EXIT=$($result.Code) LOG=$($result.Log)"
    if(-not $detected){throw "MUTACAO_SEM_ASSERTION_NEGATIVA_$($case.Gate)"}
  }finally{
    [IO.File]::WriteAllBytes($path,$bytes)
    if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $hash){throw 'RESTAURACAO_HASH_FALHOU'}
    if(@(& git -C $Worktree status --porcelain).Count){throw 'DIRTY_APOS_RESTAURACAO'}
    Write-Output "$($case.Gate) BYTES_RESTAURADOS=$hash STATUS_LIMPO=SIM"
  }
}
Write-Output "FINAL_BASE=$base DETACHED_LIMPO=SIM"
