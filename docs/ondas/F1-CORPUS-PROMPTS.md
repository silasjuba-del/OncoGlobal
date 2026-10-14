# F1 · Prompts para preencher a árvore do corpus

Referência: `docs/ondas/F1-CORPUS-ARVORE.md` (D-F1-05 e D-F1-06). Cada LLM recebe uma frente sozinha, com WRITE_SET próprio, para que dois escritores nunca toquem o mesmo arquivo.

| Frente | LLM | Pastas |
|---|---|---|
| 0. Estrutura, loader e D-F1-05 | **Codex** | código + `git mv` |
| 1. Interações, contraindicações e CTCAE-ação | **Kimi** | `4-…`, `5-…` |
| 2. Laudos sociais | **Grok** | `3-laudos/` |
| 3. Receitas especiais e classes | **DeepSeek** | `2-receitas/` |
| 4. Orientações e encaminhamentos | **Mistral** | `7-…`, `8-…` |
| 5. Packs de tumor e exames por tumor | **Claude** | `6-pack-tumor/`, `1-exames/{labs,rads,path,endoscopicos}` |

O GLM fica fora porque só gera código, não documento. O Cursor fica fora porque só faz testes (regra fixa).

---

## BLOCO COMUM (colar no início de todo prompt, menos no do Codex)

```
REPO: silasjuba-del/OncoGlobal. Base: f1/integrado. Lei: AGENTS.md (PR #5).
PAPEL: auxiliar de curadoria. Você redige; o Dr. Silas aprova; o código só consome.
LEIA ANTES: docs/ondas/F1-CORPUS-ARVORE.md, docs/DECISOES.md (D-F1-01 a D-F1-06), um arquivo vizinho da sua pasta como modelo de header.
FORMATO: JSON. Header obrigatório {id, versao, vigenteDesde, fonte{tipo∈DECISAO_MEDICA|DIRETRIZ|NORMA|LITERATURA, referencia, trecho, edicao}, curador:"Dr. Silas Negrão", aprovadoEm}. Até a aprovação: status "RASCUNHO"; aprovadoEm = data da redação; cada item com consultavel:true, alerta:false.
FONTE: todo item clínico precisa de fonte real {tipo, referencia, trecho literal curto}. Sem fonte = campo null + "pendencia":"SEM_FONTE". PROIBIDO inventar fonte, dose, corte, artigo de lei ou número.
ESTRUTURA FATO × DECISÃO: o que vem do prontuário fica como FATO_CONFIRMADO (campo a preencher pelo app); o que o médico decide fica como DECISAO_MEDICA. O texto fixo é só o que vale para todo paciente.
PHI: nenhum. Exemplos só com dados fictícios.
SUS/BRASIL: linguagem e fluxo do SUS e da legislação brasileira vigente; citar portaria, lei ou bula ANVISA quando houver.
LEI L10: textos curtos; 1 parágrafo por seção; nada obrigatório que trave o serviço.
PROIBIDO: src/**, package.json, arquivos fora do seu WRITE_SET, alterar corpus existente, desligar testes.
SAÍDA: commits só no WRITE_SET; `node scripts/validate-corpus.mjs` verde (cole a saída real); docs/ondas/F1-CORPUS-<FRENTE>.md com a lista do que foi redigido, o que ficou SEM_FONTE e as perguntas ao Dr. Silas em 1 frase cada. PR para f1/integrado; revisor Codex.
```

---

## 0 · CODEX: estrutura, loader e biblioteca × alerta

```
REPO silasjuba-del/OncoGlobal, branch f1/corpus-arvore a partir de f1/integrado. Lei AGENTS.md.
TAREFA 1 (D-F1-06): criar a árvore de docs/ondas/F1-CORPUS-ARVORE.md. Mover com `git mv` os arquivos da tabela "De onde vem o que já existe"; ajustar loader (src/server/corpus.ts e afins), scripts/validate-corpus.mjs e imports. IDs não mudam. Pasta vazia = README.md de 3 linhas.
TAREFA 2 (D-F1-05): substituir o campo `ativo` por `consultavel` + `alerta` nos contratos (zod) e no corpus, migrando assim: ativo:true → consultavel:true, alerta:true; ativo:false com fonte → consultavel:true, alerta:false; ativo:false sem fonte → consultavel:false, alerta:false. O motor de alerta só lê `alerta`. Criar a leitura de biblioteca, só consulta, para a página do tema, com marca "não curado" quando status ≠ VERIFICADO.
TAREFA 3: fundir os 4 pares duplicados de interacoes.v1.json (capecitabina×varfarina, capecitabina×fenitoína, fluoropirimidinas×brivudina, doxorrubicina×trastuzumabe), mantendo o registro ativo e a fonte mais específica.
TAREFA 4 (D-F1-01): tirar da Flash o vermelho e o alaranjado da dose acumulada (0261ff7) e levá-los para a tela do tema.
NÃO FAZER: mudar conteúdo clínico, corte ou cor de farol.
DoD: tsc limpo; suíte inteira verde (saída real); validate-corpus verde; diff de corpus = só mv + campo; PR para f1/integrado revisado por quem não escreveu.
```

---

## 1 · KIMI: interações, contraindicações e CTCAE-ação

```
[BLOCO COMUM]
FRENTE: INTERACOES-CTCAE. Branch f1/corpus-kimi.
WRITE_SET: corpus/4-interacoes-contraindicacoes/*.RASCUNHO.json, corpus/5-ctcae-acao/*.RASCUNHO.json, docs/ondas/F1-CORPUS-INTERACOES-CTCAE.md.
(Se a árvore ainda não existir na base, escreva nesses caminhos mesmo; o Codex concilia.)
A) interacoes-complemento.v1.RASCUNHO.json: para cada uma das 37 interações inativas de corpus/rulesets/interacoes.v1.json, propor severidade ∈ {GRAVE, MODERADA, MENOR}, monitorização e conduta curta, com fonte (bula ANVISA ou referência). Acrescentar, se faltarem: tamoxifeno×CYP2D6 forte, capecitabina×varfarina (INR), TKI×IBP, TKI/CDK4-6×QT longo, ondansetrona×QT. Marcar em cada item "propostaAlerta": true|false com 1 frase de motivo (L10).
B) contraindicacoes-complemento.v1.RASCUNHO.json: além das 22 de f0c/condicionais.v1.json, propor: renal (cisplatina, pemetrexede ClCr<45, capecitabina ClCr<30, carboplatina via Calvert), hepático (doxorrubicina, docetaxel já existe), gestação das drogas que faltam (antraciclinas, ciclofosfamida, gemcitabina, orais), anti-HER2×FEVE, tamoxifeno×TEV prévio, imunoterapia×autoimune ativa ou transplante. Regra: limiar do serviço = alerta; ficha relaxa ou endurece com fonte; nunca bloqueia.
C) ctcae-graus.v1.RASCUNHO.json: graus 1–4 do CTCAE 6 para diarreia, mucosite oral, náusea, vômito, neuropatia periférica sensitiva, síndrome mão-pé, fadiga, reação infusional, rash acneiforme, hipertensão, proteinúria, ALT/AST, bilirrubina, creatinina, neutropenia febril, diarreia por imunoterapia (colite), pneumonite, hipotireoidismo. Fonte: docs/referencias/onco-referencia/02-ctcae-v6.csv (citar a linha).
D) ctcae-acao.v1.RASCUNHO.json: classe (taxano, platina, irinotecano, fluoropirimidina, antraciclina, anti-HER2, antimetabólito, imunoterapia, TKI) × termo × grau → acao ∈ {MANTER, REDUZIR_20, REDUZIR_25, REDUZIR_30, ADIAR, SUSPENDER, SUSPENDER_DEFINITIVO, CONSULTA} + suporte (receita ou orientação, por id) + fonte (bula ou diretriz). Sem fonte = null. A ação é PROPOSTA na tela; o médico decide.
```

---

## 2 · GROK: laudos sociais

```
[BLOCO COMUM]
FRENTE: LAUDOS. Branch f1/corpus-grok.
WRITE_SET: corpus/3-laudos/**/*.RASCUNHO.json, docs/ondas/F1-CORPUS-LAUDOS.md.
Modelo de estrutura: corpus/templates/kit/relatorio-pericial.v1.json (já existe; NÃO alterar, só usar como padrão).
Para cada laudo: inss (perícia/auxílio por incapacidade), afastamento (atestado de afastamento do trabalho), loas (BPC, deficiência de longo prazo), transporte (TFD e passe livre intermunicipal/municipal), judicializacao-drogas (relatório para ação judicial de medicamento fora do SUS), fraldas (Farmácia Popular/município), fgts (saque por neoplasia maligna), nutricao (dieta enteral ou suplemento), oxigenio (oxigenoterapia domiciliar), incapacidade (isenção de IR, aposentadoria por incapacidade).
Cada JSON: base legal {norma, artigo, trecho} (Lei 8.213/91, Lei 8.742/93, Lei 8.036/90 art. 20 XI, Lei 7.713/88 art. 6 XIV, Portaria TFD SAS 55/1999, etc.: só cite o que puder transcrever); requisitos que o laudo precisa conter (CID, data do diagnóstico, estadiamento, tratamento, prognóstico, limitação funcional, tempo estimado); seções FATO_CONFIRMADO (o app preenche a partir do prontuário) × DECISAO_MEDICA (o médico escreve); texto fixo mínimo; documentos que acompanham; quem recebe (INSS, CEF, Secretaria, Defensoria).
Nunca escrever conclusão pericial pronta: a conclusão é DECISAO_MEDICA.
```

---

## 3 · DEEPSEEK: receitas especiais e classes

```
[BLOCO COMUM]
FRENTE: RECEITAS. Branch f1/corpus-deepseek.
WRITE_SET: corpus/2-receitas/especiais/**/*.RASCUNHO.json, corpus/2-receitas/classes/*.RASCUNHO.json, docs/ondas/F1-CORPUS-RECEITAS.md.
NÃO tocar corpus/receitas/comuns.v1.json nem toxicidade.v1.json (o Dr. Silas já tem 50 receitas validadas fora do repo; elas entram depois).
especiais/cardio: anticoagulação no câncer (TEV: enoxaparina, rivaroxabana, apixabana, com ajuste renal e plaquetas), hipertensão por anti-VEGF, cardioproteção em antraciclina/anti-HER2.
especiais/nefro: hidratação de cisplatina, ajuste por ClCr, hipomagnesemia e hipocalemia, profilaxia de lise (alopurinol, hidratação).
especiais/infecciosas: neutropenia febril de baixo risco ambulatorial (MASCC ≥21), profilaxia de HBV (entecavir/tenofovir conforme sorologia), PJP em corticoide prolongado, herpes zoster.
especiais/endocrino: hiperglicemia por corticoide, hipotireoidismo por imunoterapia (levotiroxina), insuficiência adrenal por imunoterapia (reposição), osteoproteção em IA/ADT (cálcio, vitamina D, bifosfonato/denosumabe).
classes: lista por classe farmacológica (antieméticos, analgésicos pela escada OMS, opioides, laxativos, antidiarreicos, corticoides, anticoagulantes, antimicrobianos, protetores gástricos, estimulantes de apetite, G-CSF), com nome genérico, apresentação disponível no SUS (RENAME), controle especial (Portaria 344/98: receita A/B/C) e id da receita que a usa.
Cada receita: indicação, posologia com fonte (bula ANVISA ou diretriz), ajuste renal/hepático, interação crítica (referência ao id da frente 1), orientação ao paciente em 1 frase. Dose sem fonte = null.
```

---

## 4 · MISTRAL: orientações e encaminhamentos

```
[BLOCO COMUM]
FRENTE: ORIENTACOES. Branch f1/corpus-mistral.
WRITE_SET: corpus/7-orientacoes/**/*.RASCUNHO.json, corpus/8-encaminhamentos/**/*.RASCUNHO.json, docs/ondas/F1-CORPUS-ORIENTACOES.md.
Texto para o PACIENTE: linguagem simples (até 8ª série), frases curtas, sem jargão, 100% pré-aprovável (D-WhatsApp: nenhum texto gerado por LLM vai ao paciente sem aprovação; aqui você só redige o rascunho).
7-orientacoes/dieta: geral durante a QT; por tumor (cabeça e pescoço, esôfago e estômago, colorretal com estomia, pâncreas); por toxicidade (náusea, mucosite, diarreia, constipação, perda de peso, neutropenia: segurança alimentar). Fonte: INCA, Consenso Nacional de Nutrição Oncológica, ESPEN.
7-orientacoes/atividade-fisica: durante e após o tratamento, com contraindicações (plaquetas baixas, metástase óssea com risco de fratura, anemia sintomática). Fonte: ACSM / INCA.
7-orientacoes/sinais-alarme: unificar os 3 arquivos atuais (templates/sinais-alarme, templates/kit/sinais-alarme, redflags/sinais-alarme) num rascunho único, sem perder item, com 2 saídas apenas: SAMU 192 ou PS agora. Febre: usar o corte já decidido no repo (procure em corpus/rulesets e docs/DECISOES.md); se não houver, deixe null e pergunte.
8-encaminhamentos (mastologia, cirurgia-oncologica, radioterapia): modelo de encaminhamento com motivo (lista fechada), FATO_CONFIRMADO (diagnóstico, estadiamento, AP/IHQ, imagens com data, tratamento feito), pergunta clínica (DECISAO_MEDICA), urgência (eletivo / prioritário / urgente, com critério), documentos que seguem, destino no SUS (regulação/SISREG).
```

---

## 5 · CLAUDE: packs de tumor e exames por tumor

```
[BLOCO COMUM]
FRENTE: PACKS. Branch f1/corpus-claude.
WRITE_SET: corpus/6-pack-tumor/**/*.RASCUNHO.json, corpus/1-exames/{labs,rads,path,endoscopicos}/*.RASCUNHO.json, docs/ondas/F1-CORPUS-PACKS.md.
Partir de corpus/packs/{mama,colorretal,prostata,pulmao}.v1.json (não alterar o original; rascunho novo ao lado) e criar gastrico.
Cada pack aponta exames SÓ por id de corpus/exames/exames-sigtap.v1.json (nunca nome livre): estadiamento inicial, basal pré-QT, seguimento por fase (em QT, pós-tratamento, metastático), biomarcadores obrigatórios (path), intervalos com fonte (NCCN/ESMO/INCA/PCDT).
1-exames/rads: modelo do pedido de imagem com resumo do caso (D-F1-04): campos FATO_CONFIRMADO (diagnóstico, estadiamento, tratamento atual e anterior, cirurgia, RT, exame anterior comparável com data) + pergunta clínica (DECISAO_MEDICA); máximo 5 linhas.
1-exames/labs: labs por esquema (painel de ciclo por classe de droga, apontando ids).
1-exames/path e endoscopicos: o que cada laudo deve conter para o app extrair (campos), por tumor.
```
