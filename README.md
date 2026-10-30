# OncoGlobal

Repo autônomo, do zero. Isolado. Não é ONCOMED.

**OncoGlobal (WORK)** é um motor longitudinal de contexto oncológico, centrado na consulta paciente ↔ médico. A IA propõe, o código calcula e valida, e o médico decide, corrige e assina. O app alerta e nunca bloqueia o clínico. Os dados do paciente ficam no PC.

- Plano executável: [`docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md`](docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md) (a Parte 0 é normativa)
- Decisões do Dr. Silas: [`docs/DECISOES.md`](docs/DECISOES.md) (Q01–Q59 + A1–A11)
- Eixo X/Y/Z (o que / o estado / a ação): [`docs/EIXO-CORRECAO.md`](docs/EIXO-CORRECAO.md) e [`docs/planejamento/fontes/`](docs/planejamento/fontes/)
- Manifesto da primeira onda (histórico, não é o estado de hoje): [`docs/MANIFESTO-W1-F0.md`](docs/MANIFESTO-W1-F0.md)
- Estado atual da F1: [`docs/RELATORIO-F1.md`](docs/RELATORIO-F1.md) e [`docs/MATRIZ-RASTREABILIDADE-F1.md`](docs/MATRIZ-RASTREABILIDADE-F1.md).
- Base integrada: `main`. Branches de entrega passam por PR e pelos gates; a existência de um relatório histórico não comprova integração.
- Legado preservado: [`docs/_arquivo/INDICE.md`](docs/_arquivo/INDICE.md). Prompts e estados de ondas arquivadas não orientam novas execuções.

## Stack
Node 24 · TypeScript strict · Zod (contrato único) · SQLite (`node:sqlite`) · Vitest. Monólito modular, monousuário na v1.

## Verificar
```bash
npm ci
npm run verify   # typecheck + fronteiras de import + testes
```

## Operação local

O perfil padrão da interface é médico monousuário: agenda/cadastro, pré-consulta,
documentos, conversa OncoAssist e orientações dietéticas. Os módulos adiados
continuam preservados; `VITE_ONCOGLOBAL_PERFIL=LEGADO` mantém o percurso anterior.
O plano e os limites da entrega estão em
[`MACROFATIAS-123-EXECUCAO.md`](docs/planejamento/MACROFATIAS-123-EXECUCAO.md).
`npm run test:medico-m123` verifica a jornada com dados sintéticos, modelo local
simulado no transporte HTTP/SSE e recuperação do SQLite após reinício.

Use Node 24 e as dependências do lockfile. `npm run oncoassist:local` abre o aplicativo
com servidor HTTP e ledger locais; a demonstração de `npm run ui:dev` usa outro
percurso e não comprova persistência clínica.

O aplicativo exige uma pasta absoluta já provisionada com `ledger.sqlite`. Ele não
cria pacientes nem um banco alternativo quando esse arquivo falta. Configure, por
um mecanismo local de segredos, `ONCOGLOBAL_SENHA`, `ONCOGLOBAL_MEDICO_ID` e
`ONCOGLOBAL_CRM`; não coloque seus valores em comandos compartilhados, logs ou Git.
A senha precisa ter entre 12 e 512 caracteres. Depois execute:

```powershell
npm run oncoassist:local -- --data-dir <pasta-absoluta-dos-dados> --port 4181
```

Substitua o argumento entre `< >` pelo caminho local, entre aspas se contiver
espaços. O launcher compila o entrypoint e inicia o servidor em `127.0.0.1`; ele
precisa manter acesso de escrita ao diretório local. `--port` prevalece sobre
`ONCOGLOBAL_API_PORT`; sem ambos, a porta é 4181. Encerre o processo pelo terminal
com Ctrl+C quando terminar a sessão.

Erros `CREDENCIAIS_LOCAIS_AUSENTES`, `LEDGER_LOCAL_AUSENTE`, `PORTA_INVALIDA` ou
`SERVIDOR_LOCAL_INDISPONIVEL` indicam pré-requisitos a corrigir. Não substituir um
ledger existente nem iniciar outro servidor sobre os dados para contornar erro.
Para desenvolver a UI separadamente, `ONCOGLOBAL_API_PORT` aponta o proxy Vite para
o backend local e cobre `/login`, `/consulta`, `/config`, `/acao`, `/biblioteca` e
`/salao`. Esse proxy não configura nenhum provedor externo.

## Backup e restauração

O backup inclui os três stores existentes (`ledger.sqlite`, `config-w10.sqlite`,
`workspace.sqlite`) e os anexos físicos referenciados sob a raiz informada.
Referências internas reconhecidas permanecem no snapshot SQLite. Referência
ausente, desconhecida, insegura ou ambígua deve impedir um backup conclusivo;
mensagem de sucesso não substitui uma prova de restauração.

Antes de executar, defina `ONCOGLOBAL_BACKUP_PASSWORD` por mecanismo local de
segredos (mínimo 12 caracteres). Os argumentos abaixo são modelos: substitua todos
os caminhos entre `< >` por caminhos absolutos existentes, exceto a pasta nova de
restauração. Não inclua senha na linha de comando.

```powershell
node scripts/backup.mjs <ledger.sqlite> <config-w10.sqlite> <workspace.sqlite> <raiz-dos-anexos> <pasta-de-backups> <nome-sem-extensao>
node scripts/backup-restore.mjs <arquivo.ogbak> <pasta-nova-para-restaurar>
```

A pasta de backups precisa existir; o nome aceita letras, números, `_` e `-`.
Arquivo de backup existente não é sobrescrito. Restaure em destino novo, confira
os stores e bytes de anexos e só depois planeje qualquer substituição operacional.
Não use a pasta ativa como destino de teste. A restauração recusa destino ocupado,
senha/integridade incorreta e caminhos fora da raiz. O formato v2 contém os três
stores; a leitura de backups v1 permanece compatível.

Não há agendamento diário instalado por esses comandos. Destino real, guarda da
chave, retenção e rotina de restore precisam ser definidos para a operação.

## Validação de mudanças

Execute uma suíte por vez. Use fixtures sintéticas; nunca aponte os testes ao
diretório de pacientes.

```powershell
npm run verify
npm run verify:f1
npm run test:b2
node node_modules/vitest/vitest.mjs run --config tests/redteam/vitest.config.ts --no-file-parallelism
node node_modules/vitest/vitest.mjs run --config tests/adv-w8/vitest.config.ts --no-file-parallelism
```

`test:b2` exige Chromium disponível para Playwright e demonstra as jornadas locais
com reabertura; não valida serviços clínicos externos. Registre SHA, comando, exit
code e falhas. Um reteste isolado verde não torna verde a execução integral que
falhou. CI, revisão técnica, integração e aprovação clínica são evidências distintas.

O check agregador `typecheck + fronteiras + testes` exige também sucesso do job
`Jornadas B2 no Chromium`. Falha, cancelamento ou salto desse job impede a aprovação
do consolidado. A jornada de consulta confiável usa documentos e pacientes sintéticos
na interface real, com falhas HTTP controladas e reabertura do mesmo SQLite.

Para aceite ou demonstração, use um checkout limpo do SHA integrado ou do PR em
avaliação. Confira `git rev-parse HEAD` e `git status --short` antes de iniciar. Um
checkout com WIP pode conter comportamento ainda não revisado; não o resete nem
incorpore suas mudanças automaticamente para reproduzir um resultado. O plano do
lote e suas evidências ficam em
[`docs/planejamento/CONSULTA-CONFIAVEL-REFATORACAO-20261026.md`](docs/planejamento/CONSULTA-CONFIAVEL-REFATORACAO-20261026.md).

## Estrutura
```
src/contracts/   contratos Zod (mudanças no escopo autorizado e com revisão)
src/rules/       funções puras (sem I/O)
src/kernel/      ledger · projections · identity · harness · gateway · llm
corpus/rulesets/ regras clínicas versionadas com fonte; há regras legadas no código
tests/           testes positivos, negativos e de borda
docs/            decisões e specs vigentes; histórico preservado em docs/_arquivo
```

## Estado integrado e trabalho em revisão — 30/10/2026

O main confirmado antes deste lote é `d5850b40` (PR #81): incorpora as PRs #76, #78, #79 e #80, a jornada do consultório, integrações documentais e o aplicativo PDFforge original em `apps/pdfforge`. A ponte do consultório fica em `integrations/pdfforge`; a presença do desktop não comprova validação nativa Windows nem autorização de conectores externos. O smoke Windows permanece não confirmado.

Esta branch corrige seis pontos: falha declarada do ORK nunca vira sucesso; troca de paciente/encontro reinicia ambos os formulários do Salão; recusa 409 conserva rastro no contexto em tela sem copiar texto clínico; fronteiras falham em erro de leitura/raiz vazia e aceitam caminhos com espaço/acento; extração distingue as expressões de hipótese/negação cobertas pelos testes; timeline conserva observações sem data/fonte com pendência explícita. Dose, cadeia de hash do ledger e pipeline geral não foram alterados. Só considerar integrado após merge da PR.

Validação técnica é separada de aprovação clínica. Permanecem pendências previamente auditadas em RECIST, dose, PHI, backup e segurança do servidor; não interpretar este lote como fechamento global. Gate/CI verde não equivale a proteção de branch: em 30/10/2026, a API do GitHub informou `main.protected=false`.

Para assumir trabalho, consultar PRs e SHA remoto, e conferir o status do worktree escolhido. O checkout principal pode estar atrás e conter WIP protegido; não fazer pull/reset por cima dele. Frentes ainda locais devem ser declaradas, preservadas e triadas antes de compartilhamento. Draft PR ajuda na coordenação, mas não substitui a inspeção do disco nem justifica publicar todo WIP. Não há sincronização, rebase, merge ou alerta periódico automático instalado por este lote.
