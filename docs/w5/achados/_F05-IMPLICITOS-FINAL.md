# F5 RED · controles implícitos (complemento final)

Detached **real**, sem branch/junção: `C:\Users\silas\Projects\OncoGlobal-wt\w5-mut-red-final`, base `17222e49247a1b45f4013c24e223206933c611ef`. npm ci instalou 97 pacotes (exit0). Baseline dos 6 arquivos usados: **45 testes PASS**, exit0, log `_w5-locks/logs/20261005-233435-RED.log`. Integrado pós-correções também GREEN: `c29cc8b`, 84 arquivos / 476 testes, log233104-ORQ. As 6 fontes mutadas foram comparadas com RED `e981456` (que contémc29cc8b): SHA idêntico em todas. Não há divergência de implementação entre a base detached e o integrado para esses controles.

Runner: `tests/adv/f05-mutate-implicitos.ps1`. Bypass isolado somente na fonte da detached, testes probatórios e contratos sem mudança. Cada execução passou pelo lock RED e `--no-file-parallelism`. Todos os negativos abaixo falharam por **AssertionError**, não por erro de compilação/import.

| Gate | Bypass na implementação copiada | Teste regular que detectou | Resultado | Log |
|---|---|---|---|---|
| G-01 | resolverIdentidade ignora encontrados.size>1 (devolve exato arbitrário) | identity/g01-vinculo: identificadores de pacientes distintos não promovem vínculo, mesmo contato único | 1 FAIL/1 PASS, exit1 | 233606-RED |
| G-17 | validarRuleset aceita header bruto sem safeParse | corpus/g17-packs-cob: pack sem fonte/versão deve ser rejeitado | 1 FAIL/1 PASS, exit1 | 233622-RED |
| G-19 | gateway aceita intent incompleto com defaults sintéticos | kernel/kernel: sem sessão/expirada/intent incompleto não dispara | 1 FAIL/22 PASS, exit1 | 233627-RED |
| G-20 | sqliteIdempotencia retorna store volátil nova | ledger/adv001: reinício, reserva/crash, payload diferente, concorrência e HTTP (6 negativos) | 6 FAIL/2 PASS, exit1 | 233634-RED |
| G-11 | validarEmissaoApac podeEmitir=true apesar campos faltantes | apac/apac:T28/29/N03 emissão incompleta bloqueia documento e preserva negativa | 1 FAIL/4 PASS, exit1 | 233642-RED |
| G-12 | apacGerar aceita intencao da prescrição como finalidade | apac/apac:T27, Q33, T28/N03 e G12 sem conversão | 4 FAIL/1 PASS, exit1 | 233651-RED |
| G-18 | render ignora proibidoConter/origem/política reconhecida | modules/adv015-template: 3 origens proibidas e origem/política ausente | 4 FAIL/1 PASS, exit1 | 233659-RED |

Cada carimbo de log corresponde a `_w5-locks/logs/20261005-<carimbo>.log`.

| Fonte restaurada após mutação | SHA-256 original = final (também igual ao ativo e981456) |
|---|---|
| src/rules/identidade.ts | 9F10DB21B32BFBDDFC120AE498425341C15D253E532C1AD80C816E454163CB89 |
| src/kernel/corpus/loader.ts | 5C4471D002343C3CD197A413208798F2F6FEB7E47B296AB219CAE350A715FA1C |
| src/kernel/gateway/gateway.ts | 433A0BADBE01D6440466F2E93C45ED62D4890424A56E72C1455A3FE29166C510 |
| src/kernel/ledger/idempotencia.ts | 3D73C32EA84CA53F1A54853C3EAC3FD84B54025F39577B7C37B26E19C95B9C87 |
| src/rules/apac.ts (duas mutações, restaurado entre elas) | B0E09BFE4895880B126CCF0086C49B3C5C2B17493B7F453EE6DFB5C7628D6E55 |
| src/modules/documentos/render.ts | DC4658B576299BB72EC142A2E9A10FB957C357BBB74B8CB07B849A1B46CC2E34 |

**Limpeza comprovada:** status Git vazio após cada restauração; HEAD detached; caminho absoluto resolvido e LinkType vazio verificados antes da remoção. `git worktree remove C:/Users/silas/Projects/OncoGlobal-wt/w5-mut-red-final` sem force terminou com `DETACHED_REMOVIDO=True`. Nenhuma mutação entrou nos worktrees ativos.

**Veredito:** complemento 7/7 detectado. Junto das 9 funções gNN em `_F05-MUTACAO.md`, há **16 controles distintos com provas reais de bypass**. Não generalizar para 28 IDs nem para todos consumidores. G04 é verificação no próprio teste/CI: mutar o teste probatório foi proibido; G07/08/09/27 não têm enforcement executável demonstrado; G16/G22 têm metadados/contratos sem consumer de autoridade testado. G06(layout/E1), G15(estadoORK) e G28(tema) possuem evidência parcial em testes, mas não receberam bypass neste complemento. Todos esses limites permanecem explícitos, e os estados do mapa não são automaticamente promovidos por estas mutações. A prova é do controle efetivamente mutado; não é certificado de segurança clínica global.
