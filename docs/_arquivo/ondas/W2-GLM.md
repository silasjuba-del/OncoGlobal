# PROMPT PERSISTENTE — GLM · ONDA W2 · 10 FATIAS (corpus, carregadores, esqueletos, scripts)

> Primeiro leia e obedeça `W2-CABECALHO-COMUM.md` (vale integralmente). EXECUTOR = `GLM`.
> **Worktree:** `C:\Users\silas\Projects\OncoGlobal-wt\w2-glm` · **Branch:** `f0/w2-glm`
> **Seu papel:** gerar código e dados **mecânicos e estruturais**. Você **não** escreve conteúdo clínico: onde o conteúdo depende de decisão médica ou fonte, você cria a **estrutura** e preenche com `"[VERIFICAR]"` e `"ativo": false`.
> **Modo de uso pela CLI** (o tech lead executa): uma fatia = um ou mais `glm -q "<fatia>" -l node -o <arquivo>`. Se você for invocado com a fatia inteira, gere todos os arquivos dela.

---

## GLM-01 · Carregador de corpus com G-17
**Arquivos:** `src/kernel/corpus/loader.ts`, `tests/corpus/loader.test.ts`
**Objetivo:** função pura `validarRuleset(json: unknown): { ok: true; header } | { ok: false; erros: string[] }` usando `RulesetHeader` de `src/contracts`; e `carregarDiretorio(lerArquivo: (p)=>string, listar: (d)=>string[], dir)`, com I/O **injetado** (o carregador não importa `node:fs`).
**Aceite:** ruleset sem `fonte` → rejeitado; fonte externa sem `trecho` → rejeitado; os 4 rulesets atuais → aceitos; teste positivo + negativo.
**Proibido:** ler disco direto; cache global.

## GLM-02 · Esqueleto `lab-thresholds.v1.json`
**Arquivos:** `corpus/rulesets/lab-thresholds.v1.json` (NOVO), `tests/corpus/lab-thresholds.test.ts`
**Objetivo:** estrutura `{header, analitos: [{codigo, nome, unidadeCanonica, limiarInferior, limiarSuperior, ativo, fonte}]}` para os analitos da BASE §15 (neutrófilos, leucócitos, plaquetas, Hb, creatinina, ClCr/eGFR, AST, ALT, bilirrubinas, Na, K, Mg, Ca, P, glicose, albumina, LDH, ácido úrico, troponina, TSH, T4, cortisol).
**Regra:** **ativos só** os 3 do salão, com os valores decididos (Hb 8,0 g/dL = 80 dg/dL; ANC 1500/µL; Plq 100000/µL), referência `salao-triagem.v1`. Todos os outros: `limiarInferior/Superior: null`, `ativo: false`, `fonte: "[VERIFICAR]"`.
**Aceite:** passa `validarRuleset`; teste confirma que só 3 estão ativos.

## GLM-03 · Esqueleto `rad-emergencia.v1.json`
**Arquivos:** `corpus/rulesets/rad-emergencia.v1.json` (NOVO), `tests/corpus/rad-emergencia.test.ts`
**Objetivo:** catálogo de termos do PLANO BASE §18 / R-12 FN-20 (compressão medular, cauda equina, efeito de massa, herniação, hidrocefalia, hemorragia intracraniana, edema cerebral importante, síndrome de veia cava superior, obstrução de via aérea central, TEP, tamponamento/derrame pericárdico, pneumotórax, obstrução intestinal, perfuração, pneumoperitônio, enterocolite neutropênica, hidronefrose bilateral, obstrução biliar, fratura patológica, risco iminente de fratura, instabilidade vertebral, comprometimento epidural). Cada item: `{id, termo, sinonimosPt[], naturezaAlerta: "AMEACA_IMEDIATA"|"REVISAO_URGENTE", ativo:false, fonte:"[VERIFICAR]"}`. **Inclua campo `negacoes`** com padrões genéricos ("sem", "ausência de", "não há") para o extrator não disparar com "sem TEP".
**Aceite:** passa `validarRuleset`; nenhum item ativo.

## GLM-04 · Esqueleto `canal-redflags.v1.json`
**Arquivos:** `corpus/rulesets/canal-redflags.v1.json` (NOVO), `tests/corpus/canal-redflags.test.ts`
**Objetivo:** estrutura para FN-21 com os candidatos do plano (febre em quimioterapia, sangramento, dispneia, dor torácica, confusão, vômito incoercível), cada um com `ativo:false`, `fonte:"[VERIFICAR]"`, e `respostaFixaTemplateId: null`. **A lista final e os textos das respostas são do Dr. Silas** (pendência 0.8-3).
**Aceite:** estrutura válida; nada ativo; nenhum texto de resposta inventado.

## GLM-05 · `interacoes.v1.json` (sementes, inativas)
**Arquivos:** `corpus/rulesets/interacoes.v1.json` (NOVO), `tests/corpus/interacoes.test.ts`
**Objetivo:** contrato do Delta Δ15: `{drogaA, drogaBouClasse, mecanismo, severidade, monitorizacao, notaManejo, fonte, fonteVersao, verificadoEm, ativo}`. Sementes citadas no plano (capecitabina×varfarina; TKI×IBP; ribociclibe×antiemético 5-HT3; TKI×inibidor forte de CYP3A4), **todas `ativo:false`, `fonte:"[VERIFICAR]"`**.
**Aceite:** estrutura válida; teste garante que nenhuma interação está ativa sem fonte com trecho.

## GLM-06 · Esqueletos dos packs lote 1
**Arquivos:** `corpus/packs/{pulmao,mama,colorretal,prostata}.v1.json` (NOVOS), `tests/corpus/packs.test.ts`
**Objetivo:** estrutura do TumorPack (R-22): `{header, cid:[], estadiamento:{sistema, edicao}, labsBaseline:[], labsFollowup:[], imagem:{baseline:[], resposta:[], seguimento:[]}, biomarcadores:[], protocolos:[{id, nome, intencao, linhas, sigtap:"[VERIFICAR]", ativo:false}], intervalos:{}, roteiroAnamnese:[]}`. **Todo conteúdo clínico vazio ou `"[VERIFICAR]"`**; nenhum nome de droga com dose; nenhum código SIGTAP.
**Aceite:** os 4 arquivos válidos; teste verifica ausência de qualquer campo `dose` numérico e de qualquer `sigtap` diferente de `"[VERIFICAR]"`.

## GLM-07 · Templates de documento (esqueleto)
**Arquivos:** `corpus/templates/{evolucao,receita,pedido-exame,resumo-14,sinais-alarme,laudo-judicial,folha-operacional-salao}.v1.json` (NOVOS), `tests/corpus/templates.test.ts`
**Objetivo:** cada template = `{id, versao, secoes:[{id, titulo, origem: "FATO_CONFIRMADO"|"DECISAO_MEDICA"|"TEXTO_FIXO", campos:[]}], proibidoConter:["ALERTA","CORRECAO_IA"]}`. `resumo-14` segue os 14 blocos da BASE §42. `folha-operacional-salao` é o único que mostra E1 (K-12). Texto fixo: só títulos; **nenhuma frase clínica**.
**Aceite:** teste verifica que nenhum template, exceto a folha operacional, aceita origem "ALERTA" (INV-09).

## GLM-08 · Script `validate-corpus`
**Arquivos:** `scripts/validate-corpus.mjs`, edição permitida em `package.json` **apenas** para adicionar o script `"check:corpus": "node scripts/validate-corpus.mjs"`
**Objetivo:** percorre `corpus/**/*.json`, valida headers (usa o loader de GLM-01 via import do build TS ou validação equivalente em JS), conta `[VERIFICAR]` e itens `ativo:true` por arquivo, imprime tabela e sai com código 1 se houver `ativo:true` sem fonte com trecho (ou `DECISAO_MEDICA`).
**Aceite:** roda limpo no corpus atual; prova negativa com um arquivo temporário inválido (apagar depois).

## GLM-09 · Importador SIGTAP (esqueleto, sem dados)
**Arquivos:** `scripts/sigtap-import.mjs`, `tests/corpus/sigtap-import.test.ts`
**Objetivo:** função pura `parseSigtapCsv(texto, competencia)` → `{competencia, procedimentos:[{codigo, nome, ...}]}` + CLI que lê um arquivo **fornecido pelo usuário** e grava `corpus/sigtap/<competencia>.json`. Formato real do arquivo oficial **[VERIFICAR]**: o parser recebe o mapeamento de colunas como parâmetro. Teste com CSV **sintético** de 3 linhas.
**Proibido:** baixar da internet; incluir qualquer código real.

## GLM-10 · Registro de capacidades
**Arquivos:** `corpus/capabilities.v1.json` (NOVO), `tests/corpus/capabilities.test.ts`
**Objetivo:** lista dos agentes/capacidades do plano (pós-cortes: AG-01…AG-08, AG-11, AG-13, AG-14, AG-15, AG-16, AG-19, AG-20) com `{id, nome, capabilityStatus, fase, dono, phiAllowed:false}`. Tudo `SPECIFIED`, exceto o que já tem teste verde (consulte `docs/progresso/*`); AG-20 (visão) `DISABLED`.
**Aceite:** `AgentSpec`/`CapabilityStatus` de `src/contracts` validam cada item; nenhum `phiAllowed:true`.
