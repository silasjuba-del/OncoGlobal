# W8-GLM · 10 FATIAS · microprompts, corpus estrutural e packs

> Leia primeiro `docs/ondas/W8-COMUM.md`. EXECUTOR = `GLM`. Worktree `C:\Users\silas\Projects\OncoGlobal-wt\w8-glm` · branch `f0/w8-glm`.
> **Faixa:** `corpus/prompts/**`, `corpus/rulesets/**` (só estrutura; valores não decididos = `[VERIFICAR]`, `ativo:false`), `corpus/packs/**`, `corpus/capabilities.v1.json`, `tests/{prompts,corpus}/**`, `docs/progresso/W8-GLM.md`.
> **Papel:** você **não** escreve conteúdo clínico novo. Você estrutura, versiona e testa. Microprompts nunca contêm número de corte clínico (G-04).

## GLM-11 · RADS@1.1.0 com resumo em 2 níveis
`corpus/prompts/RADS@1.1.0.md` (mantenha o 1.0.0). Saída JSON: `resumo1 {sede, tamanho}`; `resumo2 {lesao, dimensaoRecist, linfonodos, osso, pleura, orgaosAdjacentes, infiltracaoObstrucaoPerfuracao, naoOncologicos}` cada um com **uma palavra**; valores possíveis por campo: texto curto | `"ausente"` (negação explícita) | `"nao_descrito"` (laudo não fala) | `null`. Regras: negação preservada ("sem TEP" = ausente); "hiperfixação/captação articular" ≠ lesão óssea oncológica; trecho riscado → `riscado:true`, sem valor. **Aceite:** teste estático de G-04 + presença das regras "não inventar", "null quando ausente", "nao_descrito ≠ ausente".

## GLM-12 · PATH@1.1.0 por sítio
`corpus/prompts/PATH@1.1.0.md`. Saída: `sitios[] {sitio, lateralidade, posicao, fragmentosComprometidos, fragmentosAvaliados, percentuais[], gleasonPrimario, gleasonSecundario, grupoGrau, cribriforme: "presente"|"ausente"|null, intraductal, invasaoPerineural, invasaoVascular}` + `ihq[] {anticorpo, clone, interpretacao}` literal. **Proibido** agregar o caso ("grau do caso" é regra, não LLM). **Aceite:** teste com laudo sintético de 6 sítios e cribriforme em 1 → o prompt instrui extração por sítio e proíbe agregação.

## GLM-13 · DOC-ID@1.0.0 (classificador de documento e identificador)
`corpus/prompts/DOCID@1.0.0.md`: classifica a página (`FICHA_ADMIN`, `LAUDO_PRIMARIO`, `RESUMO_SECUNDARIO`, `DOC_PESSOAL`, `COMPROVANTE_TERCEIRO`) e extrai identificadores **com o rótulo impresso e o valor separados** (`{rotulo, valor}`); nunca decide o tipo do identificador pelo rótulo. Datas separadas: `dataClinica`, `dataEmissao`, `dataAssinaturaDigital`, `dataExtracaoSistema`. **Aceite:** teste de presença dessas regras (lições I1–I5, T1 do caso real).

## GLM-14 · CAPTURA@1.0.0 (qualidade de imagem)
`corpus/prompts/CAPTURA@1.0.0.md`: para cada campo, `confianca` 0–1 e `legivel`; sombra/inclinação/dobra/carimbo sobre texto → baixa confiança; QR code **nunca** seguido; trecho riscado à mão marcado. **Aceite:** teste estático.

## GLM-15 · Ruleset `identificadores.v1.json`
Estrutura das regras de validação por **valor**: CPF (11 dígitos + DV), CNS (15 dígitos, regras de início e DV) com `fonte` = norma oficial `[VERIFICAR]` (cite só o nome do documento oficial que o tech lead confirmar; não invente número de portaria). `ativo:false` até fonte. **Aceite:** `check:corpus` verde; teste de forma.

## GLM-16 · Ruleset `patologia-agregacao.v1.json`
Estrutura para agregar sítios em "grau do caso" (maior grupo de grau, cribriforme em qualquer sítio, % de fragmentos). **Todo critério `[VERIFICAR]`, `ativo:false`** (decisão do Dr. Silas pendente). **Aceite:** estrutura válida; nenhum ativo.

## GLM-17 · Ruleset `dedupe-exame.v1.json`
Chave de deduplicação por tipo: patologia/IHQ = laboratório + número do exame + data de entrada; imagem = serviço + registro + data do exame; **nunca** data impressa/extração. Concordância entre exames distintos ≠ duplicata. `fonte: DECISAO_TECNICA (tech lead, caso real 01)`. **Aceite:** teste de forma + caso D2 descrito.

## GLM-18 · Pack próstata estruturado
`corpus/packs/prostata.v1.json`: acrescente **estrutura** (sem valores) para: elementos de estadiamento que o app mostra com fonte (extensão extracapsular, vesículas, feixes, linfonodos, osso), PSA com `origem` (laudo primário × mencionado em fonte secundária), PIRADS (null quando não numerado), Gleason/ISUP por sítio. Tudo `[VERIFICAR]`, nenhum TNM automático. **Aceite:** teste: nenhum campo `dose` numérico, nenhum TNM derivado.

## GLM-19 · Capabilities atualizado
`corpus/capabilities.v1.json`: incluir os prompts novos (RADS 1.1, PATH 1.1, DOCID, CAPTURA) com `capabilityStatus: SPECIFIED`, `phiAllowed:false`; módulos do "centro de comando" (farmacêutico, enfermeiro, gestor administrativo) como `DISABLED` com versão de prompt `[VERIFICAR]`. **Aceite:** valida em `AgentSpec`; nenhum `phiAllowed:true`.

## GLM-20 · Fechamento
Testes das suas pastas verdes; `check:corpus` com contagem de `[VERIFICAR]`; relatório `docs/progresso/W8-GLM.md` com tabela, saídas reais e perguntas ao tech lead.
