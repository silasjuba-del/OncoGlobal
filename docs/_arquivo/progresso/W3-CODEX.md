# W3 - CODEX

Executor: CODEX  
Branch: f0/w3-codex  
Worktree: C:\Users\silas\Projects\OncoGlobal-wt\w3-codex

| Fatia | Estado | Commit | Verify | Pendencias |
|---|---|---|---|---|
| CDX-01 tipos-w3.ts | FEITA | d239c77 | PASS serial: typecheck; 52 arquivos; 20 files/183 tests | tipos locais W3; contratos congelados preservados |
| CDX-02 labAlerts.ts | FEITA | f57e2a7 | PASS serial: 52 arquivos; 20 files/183 tests; 23.91s | threshold inativo PENDENTE; numericos/conversoes invalidos rejeitados |
| CDX-03 radAlerts.ts | FEITA | adce743 | PASS serial: 20 files/183 tests; 16.17s | ocorrencias independentes; alerta nunca confirma fato; fonte integral preservada |
| CDX-04 redFlagsCanal.ts | FEITA | 58c6c87 | PASS serial: 20 files/183 tests; 19.35s | negacao e tempo por ocorrencia; alvo contato preservado |
| CDX-05 cumulativoAlerta.ts | FEITA | f9cc8bc | PASS serial: 20 files/183 tests; 13.40s | dedupe por adminId; divergencia vermelha; limite da mesma droga; escopo explicito |
| CDX-06 ctcaeGrau.ts | FEITA | fe123ee | PASS serial: 20 files/183 tests; 12.76s | basal obrigatorio; sem coercao; grau candidato e PENDENTE de revisao |
| CDX-07 recist.ts | FEITA | eb06f63 | PASS serial: 20 files/183 tests; 11.46s | decimais exatos na decisao; codigos conferidos; precedencia PR/PD [VERIFICAR] |
| CDX-08 escores.ts | FEITA | 070b817 | PASS serial: 20 files/183 tests; 9.63s | SOMA/PESOS sem eval; numeros e interpretacoes ambiguas geram pendencia |
| CDX-09 intervaloQt.ts | FEITA | 1a290cc | PASS serial: 20 files/183 tests; 10.06s | contrato real; quantidade efetiva; revisao e supersessao; metadados A4 |
| CDX-10 tests/w3/** | FEITA | b208bab | PASS serial: 22 files/216 tests; 10.50s | positivos/negativos/bordas; pureza; fixtures sinteticas locais |

## Retomada 2026-10-05

Base integrada com merge 07ccd74; WIP preservado. Git autorizado expressamente.
Primeira execucao serial: 182 PASS / 1 FAIL (CTCAE devolvia grau inferior apesar de basal obrigatorio ausente).
Reparo minimo no WIP de CDX-06 para restabelecer a verificacao; arquivo sera completado e commitado em sua fatia.
Reexecucao: typecheck PASS, fronteiras ok (52 arquivos), 20 files / 183 tests passed, Duration 21.23s.
Comando autorizado de retomada: `npm.cmd run typecheck`, `npm.cmd run check:boundaries`, `npx.cmd vitest run --no-file-parallelism`, em sequencia, interrompendo no primeiro erro.
O verify literal com workers paralelos nao foi repetido devido ao OOM documentado. Evidencias abaixo desta secao sao historicas.

## Saida historica do verify anterior a retomada

npm.cmd run verify falhou inicialmente porque o PowerShell bloqueou npm.ps1; usando npm.cmd, o vitest estourou heap nos workers com o limite padrao.

Reexecucao equivalente com memoria de Node ampliada:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; npm.cmd run verify
```

## CDX-02 verify

`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm.cmd run verify`:

- typecheck: PASS
- check:boundaries: PASS, `fronteiras ok (24 arquivos)`
- vitest paralelo: FALHOU por OOM/VirtualAlloc em workers, sem falha de assert.

Evidencia complementar equivalente para testes, limitando workers:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; npx.cmd vitest run --maxWorkers=1
```

```text
Test Files  9 passed (9)
     Tests  122 passed (122)
  Duration  19.83s
```

Saida:

```text
> oncoglobal@0.0.1 verify
> npm run typecheck && npm run check:boundaries && npm test

> oncoglobal@0.0.1 typecheck
> tsc --noEmit

> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs

fronteiras ok (23 arquivos)

> oncoglobal@0.0.1 test
> vitest run

 RUN  v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w3-codex

 Test Files  9 passed (9)
      Tests  122 passed (122)
   Start at  17:18:10
   Duration  1.68s (import 69%, transform 21%, tests 9%, worker 2%)
```








CDX-09: primeira verificacao interrompida por crash de worker Windows em tests/server/server.test.ts (3221226505), sem assertion failure. Repeticao integral serial PASS. Tipos locais e fixture W3 ajustados para o contrato real; contratos congelados preservados.


## Fechamento das dez fatias

Arquivos W3: src/rules/{tipos-w3,labAlerts,radAlerts,redFlagsCanal,cumulativoAlerta,ctcaeGrau,recist,escores,intervaloQt}.ts; tests/w3/{fixtures,w3.test,bordas.test,propriedades.test}.ts.
Comando serial autorizado (equivalente aos tres estagios de verify), saida real:

```text
> oncoglobal@0.0.1 typecheck
> tsc --noEmit
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (52 arquivos)
RUN v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w3-codex
Test Files 22 passed (22)
Tests 216 passed (216)
Start at 17:58:41
Duration 10.50s
```

Pendencias ao tech lead: [VERIFICAR] curadoria/fontes dos rulesets e templates reais; precedencia PR/PD quando simultaneos; fuso do servico para A4; capacidade CTCAE/RECIST permanece candidata, sem ativacao clinica F0 (K-20). Nao houve push, ativacao de corpus, mudanca dos contratos congelados nem edicao de arquivos de outros executores. Proxima etapa autorizada: avaliacao adversarial do projeto, com reproducoes em tests/w3 e achados fora do escopo registrados para seus donos.

## Auditoria adversarial posterior ao fechamento W3 — 2026-10-05

Resultado: **W3 verificado; projeto integrado REPROVADO nos nove cenarios externos abaixo.** Nao confundir a suite regular verde com aprovacao da auditoria. Correcao dos arquivos externos: **BLOQUEADO_ESCOPO**, por restricao expressa do prompt W3. Os testes novos ficam exclusivamente em tests/w3; nenhuma expectativa foi enfraquecida, nenhum teste foi apagado ou marcado skip/fails.

### Falhas reproduzidas que permanecem abertas

| ID | Prioridade | Local | Reproducao / observado | Correcao a cargo do dono |
|---|---|---|---|---|
| A01 | P1 | src/kernel/gateway/gateway.ts:55 | duas chamadas simultaneas, mesma chave; executor roda **2 vezes**, esperado 1 | reservar chave atomicamente antes do await; compartilhar resultado em andamento |
| A02 | P1 | src/kernel/gateway/gateway.ts:63 | executor simula efeito e lanca erro; repetir mesma chave executa **2 vezes** | persistir resultado incerto/reserva antes do efeito; excecao nao pode permitir reenvio silencioso |
| A03 | P2 | src/kernel/gateway/gateway.ts:50 | agora 10:00Z; expiracao 12:30+03:00 (09:30Z); retorna EXECUTADA | comparar instantes validados; sessao do servidor atual em Z mitiga este caso no fluxo HTTP, mas o gateway publico aceita offsets |
| A04 | P1 | src/kernel/projections/cumulativos.ts:9 | dois eventos com mesmo adminId e 50 mg; projeta **100 mg**, esperado 50 | deduplicar identidade da administracao; conflito explicito para divergencias |
| A05 | P1 | src/kernel/projections/series.ts:29 | administracao 50 mg substituida por 30 mg; projeta **80 mg**, esperado 30 | filtrar supersedes antes da serie/soma; preservar historico sem recontar |
| A06 | P2 | src/kernel/projections/snapshot.ts:49 | chamada direta com RAW produz campo VERDE em snapshot CONFIRMED | filtrar revisao na projecao; gravarOperacao ja rejeita RAW, portanto este repro nao prova bypass HTTP |
| A07 | P1 | src/kernel/projections/snapshot.ts:65 | evento confirmado com valor null produz **VERDE**, esperado PENDENTE | representar ausencia no tipo ValorProjetado e preservar estado do dado |
| A08 | P1 | src/kernel/projections/snapshot.ts:80 | dois fatos confirmados conflitantes + proposta CURRENT: conflito/candidatos substituidos por **VERDE** | manter conflito e proveniencia; proposta separada, sem autoridade para apagar fato |
| A13 | P1 | src/server/rotas.ts:64; src/server/sessao.ts:48 | bundle exibiu doc@1/hash A; draft atualizado para hash B sem mudar doc@1; confirmar com revision atual retorna **200**, esperado 409 | vincular bundle exibido a hash e revisao, verificar imutabilidade da versao antes de assinar |

A13 usa o roteador real, sessao real e SQLite em memoria com streams de requisicao/resposta sinteticos; nao abre servidor nem envia dados externos. Nao demonstra acesso sem autenticacao: demonstra falta de vinculo entre conteudo exibido e conteudo assinado em sessao valida.

Execucao dedicada (exit code **1**, esperado enquanto os defeitos persistirem):

```powershell
npx.cmd vitest run --config tests/w3/auditoria.config.ts --no-file-parallelism
```

Saida real resumida:

```text
RUN v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w3-codex
FAIL tests/w3/projeto.repro.ts
A01: expected 2 to be 1
A02: expected 2 to be 1
A03: expected EXECUTADA to be NEGADA
A04: expected 100 to be 50
A05: expected 80 to be 30
A06: expected campo RAW to be undefined; received VERDE
A07: expected VERDE to be PENDENTE
A08: expected VERDE to be VERMELHO
A13: expected 200 to be 409
Test Files 1 failed (1)
Tests 9 failed (9)
Start at 18:03:15
Duration 1.00s
```

O sufixo .repro.ts e o config dedicado preservam as falhas abertas fora da suite regular, sem skip nem inversao de expectativa. O tech lead deve executar **ambos os comandos** antes de integrar/liberar; a suite regular sozinha nao atesta estes gates.

### Falhas W3 encontradas na auditoria e corrigidas

- A09: ponte A4 reconhecia somente TREATMENT_ADMINISTRATION e payload plano. O WriteRouter real produz TreatmentAdministration com payload.data. Ambos os formatos agora sao aceitos; a modalidade vem explicitamente do dado ou de mapa por ciclo injetado; ausencia/divergencia continua PENDENTE. Prova integrada com SQLite em memoria, salvarDraft -> confirmar -> listarEventos -> ponte A4.
- A10: incerteza depois do termo ("TEP nao descartado", "TEP nao pode ser excluido") agora gera REVISAO_URGENTE; nunca confirmado.
- A11: "sem melhora do TEP" nao e tratado como ausencia de TEP.
- A12: conversao 3 x 0.1 produzia 0.30000000000000004 e falso conflito com 0.3. Multiplicacao decimal exata antes da representacao numerica elimina esse caso sem tolerancia arbitraria.
- INV-14: rastreabilidade tambem no envelope de todos os resultados, alem de cada Achado.

Primeira prova W3 de integracao/adversarial: **5 tests failed (5)**. Apos os reparos e testes adicionais, suite regular completa:

```text
> oncoglobal@0.0.1 typecheck
> tsc --noEmit
> oncoglobal@0.0.1 check:boundaries
> node scripts/check-boundaries.mjs
fronteiras ok (52 arquivos)
RUN v5.0.3 C:/Users/silas/Projects/OncoGlobal-wt/w3-codex
Test Files 23 passed (23)
Tests 223 passed (223)
Start at 18:05:06
Duration 12.51s
```

Comando real: npm.cmd run typecheck; se exit 0, npm.cmd run check:boundaries; se exit 0, npx.cmd vitest run --no-file-parallelism. O verify literal paralelo permanece NOT_RUN nesta retomada, conforme substituicao expressamente pedida apos OOM.

### Duplicidades e limites da avaliacao

- Busca SHA-256 em src/**: nenhum arquivo integralmente identico encontrado. Ha repeticao do construtor Achado e da mensagem de ruleset inativo em sete funcoes W3. Baixo impacto; helper compartilhado nao criado pois a fronteira atual de rules importa apenas contratos em runtime. Nao criar dependencia clandestina para eliminar repeticao.
- Duplicidade funcional relevante: projecao cumulativa do kernel e avaliador de alerta W3 possuem politicas diferentes de replay/supersessao. Corrigir o kernel antes de consumir as duas visoes em conjunto; o alerta W3 nao substitui o ledger.
- Busca de consumidores em src/**: funcoes W3 aparecem apenas nas proprias definicoes. Testes comprovam capacidade local e uma ponte real com o ledger; integracao na orquestracao/UI e ativacao clinica nao estao comprovadas.
- Avaliacao focada: regras W3, contratos consumidos, ledger/WriteRouter, projecoes, gateway e confirmacao no servidor. Nao e auditoria exaustiva de seguranca de todo o produto.
- UI/browser, producao, providers reais e regras clinicas reais: NOT_RUN. Rulesets dos testes sao exclusivamente sinteticos; nenhum novo limiar clinico ou template real foi aprovado.
- [VERIFICAR] servico deve definir fuso A4; CTCAE declarativo exige curadoria semantica dos criterios/basal; RECIST cobre apenas as lesoes-alvo fornecidas e permanece candidato, sem classificacao clinica global automatica; NLP por regras nao representa validacao de linguagem clinica irrestrita.

Handoff: dez fatias FEITAS com commits individuais + commit de auditoria/reparos W3. Base integrada 07ccd74. Sem push; contratos, kernel, servidor, corpus e arquivos de outros executores preservados apos o merge autorizado. Proximo trabalho do tech lead: corrigir A01-A08/A13 nas respectivas propriedades e promover as reproducoes para gates permanentes.
