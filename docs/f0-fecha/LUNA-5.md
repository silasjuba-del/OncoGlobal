# LUNA-5 — relatório de execução

## GOAL

Estabilidade de `tests/ui-telas/percursos.test.tsx`, varredura PHI do repositório e paridade entre `npm run verify` e CI, além de inventário CRLF/LF.

## Estado inicial

- Worktree: `C:\Users\silas\Projects\OncoGlobal-wt\f0f-luna5`
- Ramo: `f0/f0f-luna5`
- Base verificada: `369db84732ab5a46283a2356bd85eb656916f009`
- `node_modules`: junction presente.
- Faixa: L5 de `docs/f0-fecha/DISTRIBUICAO-B.md`.

## Critérios

| Critério | Estado | Evidência / limite |
|---|---|---|
| A — três rodadas de `tests/ui-telas` + `tests/ui` | PASS | Três comandos consecutivos exit 0; cada um passou 23 arquivos/69 testes. Durações: 259,14 s; 327,78 s; 253,79 s. Nenhuma asserção foi alterada. Saídas resumidas em `evidencias/luna5/ui-round-{1,2,3}.log`. |
| B — varredura PHI de repo | BLOCKED | As provas positivas/negativas passaram (1 teste). A varredura completa falhou (1 teste) por 180 correspondências candidatas — não confirmadas como PHI — e 14 arquivos binários não escaneados. Categorias: CNS 50, CPF 17, e-mail 37, nome em cabeçalho 2, telefone 74, credencial de portal 0. Os detalhes são somente categoria, caminho e linha em `evidencias/luna5/phi-scan-attempt3.log`. |
| C — paridade local/CI | PASS — inspeção estática, com diferenças registradas | `npm run verify` cobre typecheck, fronteiras, corpus e `npm test`; `.github/workflows/verify.yml` chama esse script após `npm ci` e setup Node 24, e acrescenta jobs adversariais separados W10/W8. `vite.config.ts:59-62` define `pool: "threads"`, `maxWorkers: 1` e `fileParallelism: false`; portanto, o Vitest local já serializa arquivos sem exigir a flag na linha de comando. Ainda assim, `npm run verify` executa a suíte inteira em um único bloco, não os blocos da §5, e não inclui os jobs adversariais do workflow. Nenhum workflow foi executado. |
| D — higiene CRLF/LF | PASS — inspeção estática | 1.206 arquivos textuais: 54 CRLF, 1.152 LF, nenhum misto. `.gitattributes` já existia; nenhum diff foi aplicado a ele. |

## Saídas reais disponíveis antes do slot

- `git status --short --branch` antes das provas: `## f0/f0f-luna5`, somente arquivos da faixa L5 modificados/não rastreados.
- `git diff --check`: saída vazia, exit code 0.
- Inventário EOL (TS/JS, JSON, Markdown, YAML, HTML, CSS, PowerShell, TXT, SQL, shell, TOML, XML, CSV e ENV): `FILES=1206 CRLF=54 LF=1152 MIXED=0 NONE=0`.
- Inventário por extensão: 4 PDFs, 8 PNG, 2 JPG e 1 WEBP. Não foi encontrado arquivo com extensão SQLite/DB; nenhum store operacional foi aberto.
- Rodada UI 1: exit 0; 23 arquivos, 69 testes; 259,14 s.
- Rodada UI 2: exit 0; 23 arquivos, 69 testes; 327,78 s.
- Rodada UI 3: exit 0; 23 arquivos, 69 testes; 253,79 s.
- Scanner, tentativa final: exit 1; 1 teste passou e 1 falhou; 180 ocorrências candidatas; 14 arquivos não escaneados. Scanner prova as classes positivas/negativas, mas a varredura do estado atual do repo não está verde.

## Arquivos desta faixa

- `tests/ui-telas/percursos.test.tsx` — somente timeout de esperas.
- `tests/f0-fecha/phi-repo.test.ts` — scanner e provas positivas/negativas.
- `docs/f0-fecha/HIGIENE.md` — EOL, paridade e limites de cobertura.
- `docs/f0-fecha/LUNA-5.md` — relatório final desta fatia.
- `docs/f0-fecha/evidencias/luna5/` — resumos dos três percursos e três tentativas do scanner; nenhum valor encontrado é registrado.

## Bloqueios e próximo passo

**Bloqueio B — classificação dos candidatos:** as 180 correspondências são candidatos do detector, não 180 casos reais de PHI. Correspondências CPF/CNS/telefone/e-mail em arquivos de `tests/` incluem dados de entrada para testes de vínculo, segurança e red team; a origem de cada ocorrência não foi individualmente comprovada, portanto não foram liberadas como sintéticas. Correspondências em `corpus/` e referências clínicas podem ser números de esquema/regime ou identificadores e também permanecem não classificados. E-mails em documentos de proveniência W3/W8, handoff/contexto/planejamento e no PDF externo são candidatos a metadados públicos de autoria/contato; sem inspecionar os valores, a classificação fica UNCERTAIN e bloqueia. Nenhuma allowlist genérica de diretório ou metadado foi criada. A única regra sintética aplicada é o padrão declarado `Paciente Teste NN`, apoiado pelo manifesto e pelo README dos laudos sintéticos.

As 14 fontes não escaneadas (sempre UNVERIFIED pelo scanner) são: 11 arquivos raster — `docs/design/oncochart/assets/{annot.png,crop-header.png,crop-right.png,crop-timeline.png,ct-abdome.jpg,ct-torax.jpg,ref.png}`, `docs/referencias/ui-modelo-consulta.webp` e `docs/w7/kit-preview/{apac-html.png,apac-pg1.png,workspace-pesquisa.png}` —; uma planilha binária `docs/referencias/protocolos/protocolos-citotoxicos-revisado-silas.xlsx`; e duas fontes WOFF2 em `src/ui/oncochart/fontes/`. Sem OCR, as imagens de CT e capturas permanecem PARTIAL/UNVERIFIED. A planilha de protocolos foi inventariada somente como caminho/tipo, sem abertura, e permanece UNVERIFIED. As duas WOFF2 foram classificadas pelo caminho/extensão como fontes técnicas; a classificação não converteu o resultado do scanner em PASS.

O relatório não classifica ausência de achado em mídia opaca como PASS. Nenhuma fonte possivelmente sensível foi alterada ou removida. Não executei TSC ou build.

Hash do commit final F0F-L05: registrado no retorno da fatia após `git rev-parse HEAD`.
