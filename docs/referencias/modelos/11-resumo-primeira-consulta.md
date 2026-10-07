# Modelo 11 · Resumo de primeira consulta oncológica (kit documental → W1)

> Fonte: 3 kits reais de primeira consulta (SUS) enviados pelo Dr. Silas, analisados em 2026-10-07 só para extrair o padrão.
> **Sem PHI:** nenhum nome, documento, data de nascimento, endereço, telefone, médico ou serviço de origem. Casos chamados A, B e C; datas relativas à consulta (M0 = mês da consulta, M-2 = dois meses antes). Os PDFs originais não foram copiados para o repositório.
> Base: W1 de 5 blocos da skill SILAS NEGRÃO (D-W9-21), formato longitudinal (D-W9-42), pipeline multimodal (D-W9-33), modelos 03 e 10.

---

## 1. Os três kits (desidentificados)

### Padrão comum do kit SUS de 1ª vez
Um único PDF escaneado com **vários documentos colados**: ficha de recepção do serviço → guia de regulação (quando há) → encaminhamento / relatório de referência → documentos pessoais (RG, cartão SUS, conta de luz) → laudos (AP, IHQ, imagem, endoscopia) em ordem **não cronológica**. Não há evolução própria do serviço, nem labs, nem receita do serviço.

### CASO A · CEC cutâneo de face com recidiva locorregional (homem, 8ª década) — 10 p.
| Documento | Data relativa | Observação |
|---|---|---|
| Ficha de recepção | M0 | só cadastro |
| Encaminhamento do cirurgião | M-1 | CEC de pele "operado há 10 meses", recidiva perto do ângulo da mandíbula esquerda + pré-auricular esquerda com linfonodos suspeitos; CID C44 |
| RG, cartão SUS, conta de luz | — | não clínico (PHI) |
| AP nº1 — "lesão em face" (sem lado) | M-12 | CEC invasivo moderadamente diferenciado, 0,4 cm, margens laterais e profunda **comprometidas** |
| AP nº2 — malar **esquerdo** | M-11 | CEC mod. dif., 4,8 × 3,9 cm, profundidade 1,0 cm, sem invasão LV/PN, margens livres |
| AP nº3 — zigomático **direito** (2 páginas) | M-9 | CEC mod. dif., 3,5 × 1,7 cm, profundidade 0,3 cm, margens livres |
| TC face | M-1 (laudo assinado 2 dias depois) | lesão de partes moles ~4,2 × 4,6 × 4,7 cm, pele pré-auricular esquerda → músculo masseter; linfonodo submandibular esquerdo necrótico até 2,8 cm |
| TC pescoço | M-1 | **mesmo achado, texto idêntico** ao da TC de face |
| TC tórax | M-1 | sem nódulos, sem linfonodomegalia; degenerativo |

- **Estádio em termos gerais:** recidiva locorregional (pele/partes moles + N cervical) de CEC cutâneo de cabeça e pescoço, **clínico-radiológica**, sem M1 identificável no tórax. Recidiva **sem biópsia**.
- **Ausente:** histologia da recidiva; qual das lesões recidivou (documentado só por proximidade); descrição cirúrgica; RT prévia; ECOG; comorbidades, medicações, alergias; imunossupressão; labs; guia de regulação.
- **Contradições/ambiguidades:** três primários em três datas, **dois lados** (direito e esquerdo) e um sem lado; "operado há 10 meses" não diz qual cirurgia; CID C44 (pele) para doença com N+.
- **Armadilhas:** lateralidade por lesão (não é conflito, são lesões diferentes); a mesma lesão descrita em 2 laudos (face e pescoço) não pode virar 2 lesões; data do exame ≠ data de assinatura; "linfonodos suspeitos" do encaminhamento ≠ N+ confirmado; margem comprometida do AP mais antigo sem documento de reexcisão.

### CASO B · Carcinoma escamoso de esôfago torácico (homem, 6ª década) — 14 p.
| Documento | Data relativa | Observação |
|---|---|---|
| Ficha de recepção | M0 | |
| Guia de regulação (autorização) | M0 (extração de dados dias antes) | **CID R63.8** (sintoma de ingestão), não neoplasia; aviso do município datado de M-7 (texto-padrão antigo) |
| Relatório de encaminhamento estadual (4 p.) | M-1 | disfagia, perda de 14 kg em 2 meses, só líquidos; ECOG **1** marcado; tabagista ativo, ex-etilista; "RNM de abdome" listada **sem laudo**; campo estadiamento vazio; exames repetidos 2× no próprio formulário |
| Página de assinatura do encaminhamento | M-1 | sem conteúdo clínico |
| RG, cartão SUS, conta de luz (em nome de terceiro) | — | não clínico |
| AP (biópsia endoscópica) | M-2 (assinado ~1 semana depois) | "neoplasia pouco diferenciada"; pede IHQ |
| Nota de oncologista de **outro serviço** | M-1 | HD com hipótese de adenocarcinoma pela localização; **PS 2**; peso 64,9 kg / 172 cm; recusou sonda; plano do outro serviço (QT-RT se CEC) |
| IHQ | M-1 | p40+ em áreas, CDX2−, CK7−, sinaptofisina− → **CEC invasivo pouco diferenciado com áreas basaloides** |
| TC tórax | M-1 | **só a página 2/2** (impressão): espessamento concêntrico terço médio/distal, perda de planos com a aorta descendente, estase a montante; enfisema |
| TC abdome/pelve (2 p.) | M-1 | sem evidências **definitivas** de lesão secundária; sem linfonodomegalia |
| EDA | M-2 | lesão ulcerada friável a 33 cm da arcada, >75% da circunferência, aparelho não passa |

- **Estádio em termos gerais:** localmente avançado, cT e cN **indeterminados** (contato com aorta = SUSPEITO de T4b; sem EUS/PET), sem M1 identificável no abdome.
- **Ausente:** TC tórax página 1/2; EUS, PET-CT; broncoscopia (lesão logo abaixo da carina); labs (Hb, albumina, creatinina); avaliação nutricional; PD-L1/HER2 [VERIFICAR curadoria]; laudo da RM citada.
- **Contradições:** ECOG 1 (formulário) × PS 2 (nota do outro serviço); "esôfago distal" (encaminhamento) × "terço médio/distal" (TC) × 33 cm (EDA); "adeno pela localização" (antes da IHQ) × CEC (IHQ) — **IHQ prevalece, hipótese antiga fica no histórico**; "sem evidência de doença a distância" (encaminhamento) × "sem evidências **definitivas**" (laudo).
- **Armadilhas:** CID da guia ≠ diagnóstico (RAC-02); plano de outro serviço não é conduta deste serviço; encaminhamento escrito **antes** da IHQ (fica desatualizado); página faltando; OCR embutido do PDF ilegível (ver §2).

### CASO C · Carcinoma escamoso de colo uterino localmente avançado (mulher, 8ª década) — 12 p.
| Documento | Data relativa | Observação |
|---|---|---|
| Ficha de recepção | M0 | |
| Evolução ambulatorial do cirurgião (encaminhamento manuscrito no topo) | M-2 | sangramento pós-menopausa há 3 meses; G5P1A1; toque: parametrio **esquerdo**; resume RM; encaminha à RT e à oncologia clínica |
| RG, cartão SUS, conta de luz (terceiro) | — | não clínico |
| AP (biópsia de colo) | M-4 (assinado ~5 dias depois) | CEC invasivo SOE, sem invasão LV/PN; **pede IHQ para relação com HPV** |
| AP — **3 cópias adicionais idênticas** | M-4 | duplicatas (uma com marca de caneta) |
| USG inguinal direita | M-5 | hérnia inguinal **direta** à direita |
| Histeroscopia com biópsia | M-4 | lesão vegetante exteriorizando pelo orifício externo; espessamento endometrial difuso |
| RM abdome/pelve (2 p.) | M-2 | lesão 6,0 × 5,9 cm; parametrios **bilaterais**; ureter esquerdo com hidroureteronefrose moderada; parede posterior da bexiga com invasão transmural; fáscia mesorretal; miométrio; hematometra; sem linfonodomegalia pélvica/retroperitoneal; aneurisma de aorta toracolombar 3,5 cm; hérnia inguinal **indireta** à direita. **"Impressão diagnóstica" em branco** (página cortada) |
| USG inguinal — **cópia de cabeça para baixo** | M-5 | duplicata rotacionada 180° |

- **Estádio em termos gerais:** localmente avançado; pela RM, hidronefrose sugere FIGO IIIB (DERIVADO) e invasão de bexiga sugere IVA (**SUSPEITO** até cistoscopia/biópsia). Sem linfonodomegalia pélvica/para-aórtica. Tórax não estudado.
- **Ausente:** IHQ/p16 (pedida no AP); imagem de tórax; **creatinina/função renal** (hidronefrose); cistoscopia; retoscopia; HIV; ECOG; medicações, alergias; impressão da RM.
- **Contradições:** parametrio esquerdo (toque) × bilateral (RM); hérnia "direta" (USG) × "indireta" (RM); "cirurgia de duas hérnias" no passado × hérnia atual.
- **Armadilhas:** 4 cópias do mesmo AP e 2 da mesma USG (uma invertida); "colo" pode virar **cólon** na normalização (bug real, §2); seção de impressão vazia não pode ser preenchida; achado incidental relevante (aneurisma) não pode sumir nem virar oncológico.

### Lições transversais (viram regra no modelo)
1. Um PDF = muitos documentos; classificar **por página** antes de extrair.
2. CID de guia/encaminhamento é administrativo; diagnóstico vem do AP/IHQ.
3. Cada laudo tem até 4 datas (exame, entrada, assinatura, emissão/impressão); a linha do tempo usa **data do exame/coleta**.
4. Duplicatas são a regra, não exceção; dedupe por tipo + nº do exame + data + texto.
5. Encaminhamento é escrito antes de resultados que chegam depois (IHQ do caso B).
6. ECOG diverge entre fontes; nunca escolher em silêncio.
7. Recidiva/estádio por imagem sem histologia = SUSPEITO.
8. Lateralidade é **por lesão**, não por paciente.
9. Página faltando (n/N) e seção vazia precisam ser detectadas.
10. Páginas de identidade/conta de luz não têm fato clínico e têm muita PHI.

---

## 2. O que o código atual pega (extrator + leitura + reconciliação)

Arquivos lidos: `src/leitura/caixa-unica.ts`, `src/leitura/pdf-digital.ts`, `src/kernel/extracao/{extrator,normalizacao,reconciliacao,biomarcadores,safety,segmenter,tipos}.ts`, `src/kernel/extracao/dados/biomarcadoresRequeridos.ts`, `src/contracts/w10/extracao.ts`.

### 2.1 Leitura do PDF (antes de qualquer extração)
| Situação real | Caso | Hoje | Função | Lacuna |
|---|---|---|---|---|
| PDF 100% escaneado sem camada de texto | A, C | **PENDENTE** (correto pela D-W9-09) | `converterEntradaLocalAsync` → `lerPdfDigital` | 2 de 3 kits não rendem **nada** ao app; falta OCR local aprovado (decisão pendente) |
| PDF escaneado **com camada OCR ruim** | B | **PRONTO** com texto ilegível | `converterEntradaLocalAsync` | **Não há portão de qualidade de texto**: lixo de OCR passa como PDF digital. Precisa de score (palavras de dicionário, proporção de símbolos) → abaixo do limiar = PENDENTE |
| Página de cabeça para baixo | C | não detecta | — | detectar orientação (ou marcar página ilegível) |
| Um PDF com ~10 documentos | A, B, C | 1 `DocumentoBruto` com páginas | `montarDocumento` | **Não há classificador por página** (ficha, guia, encaminhamento, AP, IHQ, TC, RM, EDA, histeroscopia, USG, identidade, conta de luz) |
| Páginas de RG/cartão SUS/conta de luz | A, B, C | entram como texto | — | excluir da extração e do payload de LLM (G-02); marcar NÃO CLÍNICO |
| Página n/N faltando, seção vazia | B (TC 1/2), C (impressão RM) | não detecta | — | parser "Página n/N" / "1/2" + seção com título e sem corpo → PENDENTE |
| Duplicatas (AP ×4, USG ×2, mesma lesão em 2 laudos) | A, C | não detecta | `hash` só do arquivo inteiro | dedupe por (tipo, nº exame, data do exame, similaridade de texto) |

### 2.2 Extração de fatos (`extratorDeterministico.extrair`, linha a linha)
| Informação | Caso | Pega? | Onde / por quê |
|---|---|---|---|
| Histologia no formato "CONCLUSÃO / Órgão: / texto" (multilinha) | A, B, C | **não** | só casa `histologia:` ou `diagnóstico histológico:` na mesma linha |
| Menção "carcinoma de células escamosas" | A, B, C | **não** | regex de menção pega 1 palavra após "de" ("células") → `normalizarSitioAnatomico` = null |
| "Neoplasia de esôfago" | B | sim | menção + `normalizarSitioAnatomico("esofago")` |
| "Neoplasia de colo (uterino)" | C | **errado** | captura "colo" → `ALIAS_ORGAO_LOCAL.colo = "colon"` → **cólon** (bug; `ALIAS_ORGAO` tem "colo uterino" mas a regex só passa uma palavra) |
| Pele/face/malar/zigomático/pré-auricular | A | **não** | fora da tabela de órgãos |
| Grau/diferenciação, profundidade, invasão LV/PN, margens | A, B, C | **não** | sem domínio nem regex (margem comprometida do caso A some) |
| Painel IHQ em tabela (anticorpo · clone · interpretação) | B | **não** | só HER2 (0/1+/2+/3+), RE/RP/Ki-67 com %, PD-L1 TPS/CPS; p40/CDX2/CK7/sinaptofisina/p16 ignorados; "Negativo na neoplasia" não casa |
| HER2 escore + ISH/FISH, Gleason/ISUP | (exemplo) | parcial / **não** | HER2 sem ISH; Gleason inexistente |
| TNM sem prefixo, FIGO | — | **não** | regex exige c/p/yp; FIGO não existe |
| Estádio derivado de descritores de imagem (invade bexiga, hidronefrose) | C | **não** | não há regra de derivação (deve ser código + confirmação, nunca LLM) |
| CID (guia e encaminhamento) | A, B | **não** | nada emite `value.cid`; `conflitoCid` nunca dispara; falta guarda RAC-02 em código |
| ECOG/PS, peso, altura, perda ponderal | B | **não** | sem `FactDomain` para performance/antropometria → ECOG 1 × PS 2 invisível |
| Comorbidades, alergias, hábitos, medicações | B | **não** | sem domínio |
| Sintomas (disfagia, sangramento) | B, C | parcial | `symptom` só para dormência/formigamento/náusea/dor |
| Achado de imagem com medida | A, C | parcial | regex exige "lesão/nódulo/foco … N mm/cm" na mesma linha; 3D vira só o 1º número; "linfonodomegalia", "espessamento", "invade/compromete <estrutura>" não entram |
| Lateralidade "direito/esquerdo" (masculino), "esq" | A | **não** | regex do extrator só tem "esquerda/direita"; `normalizarLateralidade` aceita, mas nunca recebe |
| Lateralidade por lesão (2 primários, lados opostos) | A | **falso conflito** | `conflitoLateralidade` compara por fonte, sem identidade de lesão |
| Negação sem acento ("Sem evidencia de doença") | B | **não** | regex de negação exige "evidência" com acento → risco de achado positivo falso |
| Ressalva "não há evidências **definitivas**" | B | perde nuance | vira negação simples; falta nível SUSPEITO/INDETERMINADO |
| Datas: exame × entrada × assinatura × emissão × extração | A, B, C | **não** | `date` = primeira dd/mm/aaaa da linha |
| Datas relativas ("há 10 meses", "há 2 meses") | A, B, C | **não** | sem âncora na data do documento |
| Conduta de outro serviço ("CD: …") | B | não capturada (ok) | falta rótulo "conduta de terceiro"; nunca vira plano deste serviço |
| Endoscopia/histeroscopia (distância da arcada, % circunferência) | B, C | **não** | sem `FactSourceType` (`endoscopy`); `sourceType` só tem pathology/imaging_report/prescription/medical_note/nursing/plaud/administration |
| Guia de regulação / encaminhamento | A, B, C | — | sem `sourceType` `referral`/`regulation` (hierarquia precisa saber que vale menos que AP) |
| Labs, série de PSA/CEA | (nenhum kit tinha) | parcial | `lab` só Hb/creatinina/PSA/CEA com unidade na mesma linha; sem série/tendência |
| Biomarcadores exigidos por tumor | B, C | `[VERIFICAR]` | `requiredBiomarkers` só tem pulmão adeno IV e mama; esôfago, útero, pele em `TUMORES_SEM_TABELA` |
| Recidiva × primário; histológico × clínico | A | **não** | sem domínio de status de doença |
| Identidade com variações de nome / documento de terceiro | B, C | parcial | `rankearPacientes` ordena; não há regra para "conta em nome de terceiro = ignorar" |

### 2.3 Lacunas que viram trabalho (ordem sugerida)
1. **L-01 Portão de qualidade de OCR** em `converterEntradaLocalAsync` (texto ilegível = PENDENTE). Bloqueia falso PRONTO do caso B.
2. **L-02 Classificador de página/documento** (tipos acima + NÃO CLÍNICO) e `FactSourceType` novos: `referral`, `regulation`, `endoscopy`, `lab_report`, `registration`.
3. **L-03 Datas tipadas** por documento: `examDate`, `receivedDate`, `signedDate`, `printedDate`; linha do tempo usa `examDate`; resolução de "há N meses" contra a data do documento (DERIVADO com regra).
4. **L-04 Dedupe** de laudos (nº exame + data + similaridade) e de achados repetidos em laudos do mesmo dia.
5. **L-05 Parser de AP em blocos** (CONCLUSÃO → órgão → histologia multilinha; grau; dimensão; profundidade; LV/PN; margens livre/comprometida).
6. **L-06 Parser de IHQ em tabela** (anticorpo, clone, interpretação, %); HER2 com ISH; p16; Gleason/ISUP; PD-L1 com anticorpo e CPS/TPS.
7. **L-07 Corrigir normalização de sítio**: "colo do útero/colo uterino" antes de "colo" (bug), adicionar pele/face/subsítios de cabeça e pescoço; regex de lateralidade masculina/abreviada no extrator.
8. **L-08 Lesão como entidade** (sítio + subsítio + lado + data) antes de `conflitoLateralidade`/`conflitoSitio`.
9. **L-09 CID**: extrair com fonte; regra RAC-02 em código (CID de guia nunca vai a diagnóstico/APAC); `conflitoCid` passa a ter entrada.
10. **L-10 Domínios clínicos**: `performance_status` (com fonte/data/avaliador), `anthropometry` (peso, altura, perda), `comorbidity`, `allergy`, `habit`, `medication`, `disease_status` (primário/recidiva; histológico/clínico).
11. **L-11 Imagem**: medidas 3D, linfonodo, "invade/compromete <estrutura>", nível de certeza (definitivo/sugestivo/indeterminado), negação sem acento.
12. **L-12 Página faltando / seção vazia** → PENDENTE explícito.
13. **L-13 Estadiamento derivado por código** (FIGO/TNM a partir de descritores) sempre DERIVADO/SUSPEITO + confirmação; tabela por tumor curada.
14. **L-14 Curadoria `REQUISITOS_BIOMARCADORES`** para esôfago, colo uterino, pele CEC [VERIFICAR com o Dr. Silas].
15. **L-15 Conduta de terceiro**: rótulo de origem; nunca entra no Bloco 4.

---

## 3. MODELO DE RESUMO DE PRIMEIRA CONSULTA

### 3.1 Regras
1. **Cada linha tem fonte e data:** `… · [STATUS] · DOC-nn p.X · dd/mm/aa (data do exame)`. Data de assinatura/emissão só aparece se for a única disponível, marcada `(data de emissão)`.
2. **Status obrigatório em todo dado clínico:** `CONFIRMADO` (literal em documento primário) · `DERIVADO` (calculado por regra nomeada a partir de CONFIRMADO; mostrar a regra) · `SUSPEITO` (sugerido pela fonte ou fonte secundária) · `AUSENTE`. Proveniência interna: CONFIRMADO→EXTRACTED/DOCUMENT_CONFIRMED, DERIVADO→INFERRED+regra, SUSPEITO→UNCERTAIN, AUSENTE→NOT_FOUND.
3. **Ausente = `NÃO SEI` (dado) ou `PENDENTE` (documento ilegível/ausente).** Nunca "nega", "sem alergias", "negativo" sem documento (RAC-03; invariante 1). Equivale ao "campo vazio" do W1: vazio visível com o rótulo.
4. **Hierarquia:** AP/IHQ > laudo de imagem/endoscopia > evolução médica > encaminhamento > guia de regulação. CID de guia **nunca** vai ao TÍTULO nem ao diagnóstico (RAC-02).
5. **Sem conduta escrita pela IA.** Bloco CONDUTA é vazio. Plano de outro serviço aparece em HISTÓRIA como `Plano registrado por outro serviço (fonte, data)`.
6. **CONFLITOS** listam os dois valores, as duas fontes e o dado que resolve; nada é escolhido em silêncio. Hipótese superada por exame posterior fica no histórico (ex.: "hipótese de adeno antes da IHQ").
7. **DADOS FALTANTES** só lista o que muda conduta, com impacto e documento que resolve.
8. **Lateralidade e medidas por lesão;** a mesma lesão em dois laudos do mesmo dia é uma lesão.
9. **Imagem não confirma histologia nem M1** ("sem M1 identificável nos exames apresentados" ≠ M0). Componente T/N/M sem método adequado = `SUSPEITO` com nota ⚠ (W1 Bloco 0).
10. **Duplicatas e páginas não clínicas** aparecem só no inventário de FONTES, nunca como fato.
11. **Copiável** (W1 5-D) só com dados CONFIRMADO/DERIVADO revisados; sem rótulos, sem menção a IA (RAC-09).
12. **Alerta catastrófico:** no máximo 2, só com os 3 critérios do W1 (5-B).

### 3.2 Mapa de compatibilidade
| Bloco deste modelo | W1 (SILAS NEGRÃO) | Prompt longitudinal (D-W9-42) |
|---|---|---|
| 0 TÍTULO | Bloco 0 | TÍTULO/IDENTIFICAÇÃO |
| 1 FONTES | inventário do MOTOBOY | FONTES |
| 2 ENCAMINHAMENTO | (Bloco 2, evento inicial) | HISTÓRIA |
| 3 DADOS CLÍNICOS | Bloco 1 | DADOS ESTRUTURADOS |
| 4 DIAGNÓSTICO ONCOLÓGICO | Bloco 2 (caixa PATOLOGIA) | DIAGNÓSTICO ONCOLÓGICO |
| 5 HISTÓRIA CRONOLÓGICA | Bloco 2 (eixo temporal) | HISTÓRIA CRONOLÓGICA |
| 6 TRATAMENTOS PRÉVIOS | Bloco 2 | TRATAMENTOS |
| 7 EXAMES DE IMAGEM/ENDOSCOPIA | Bloco 2 (caixa RADS) | EXAMES/RESPOSTA |
| 8 LABS + MARCADORES | Bloco 3 | EXAMES |
| 9 SITUAÇÃO ATUAL | 5-D (base) | SITUAÇÃO ATUAL |
| 10 CONDUTA | Bloco 4 (vazio) | CONDUTA (médico) |
| 11 CONFLITOS/ALERTAS | 5-B | CONFLITOS/ALERTAS |
| 12 DADOS FALTANTES | 5-A | DADOS FALTANTES |
| 13 COPIÁVEL | 5-D | — |

### 3.3 Molde
```
0 · TÍTULO
**{{histologia_do_AP}} | {{sitio}} {{lateralidade}} | {{estadio_ou "estadiamento INDETERMINADO"}} | {{subtipo_se_muda_linha}}**
{{⚠ componente SUSPEITO por método — método confirmatório PENDENTE}}        ← uma linha por componente
{{sexo}}, {{idade}} anos · 1ª consulta {{data_consulta}} · {{motivo_curto}}
Sem AP → "Avaliação oncológica — diagnóstico PENDENTE"

1 · FONTES (inventário)
DOC-{{nn}} · {{tipo}} · exame {{data_exame}} · assinado {{data_assinatura}} · p.{{x–y}} · {{LIDO | PENDENTE (motivo) | DUPLICATA de DOC-mm | NÃO CLÍNICO | INCOMPLETO (falta p.n/N)}}

2 · ENCAMINHAMENTO
Origem: {{especialidade de origem}} · {{data}} · DOC-{{nn}}
Motivo registrado: {{motivo}} · [CONFIRMADO como texto do encaminhamento]
CID da guia/encaminhamento: {{cid}} — administrativo, não é diagnóstico{{; difere do AP se for o caso}}

3 · DADOS CLÍNICOS (W1 Bloco 1)
AP:        {{comorbidade que muda elegibilidade}} · [STATUS] · fonte · data | NÃO SEI
MUC:       {{droga dose via freq}} · fonte | NÃO SEI
ALERGIAS:  ⚠ {{droga + reação}} · fonte | "nega (SIC, fonte, data)" | NÃO SEI
CX PRÉVIA: {{procedimento · data · fonte}} | NÃO SEI
HF:        {{neoplasia + parentesco}} · fonte | NÃO SEI
HÁBITOS:   {{tabagismo (maço-ano) · etilismo · ocupação}} · fonte | NÃO SEI
ECOG/PS:   {{valor}} · {{fonte}} · {{data}} · {{avaliador}}      ← divergência entre fontes vai a CONFLITOS
PESO/ALT:  {{peso}} kg · {{altura}} cm · IMC {{DERIVADO}} · perda {{x kg / y meses}} ({{%}} DERIVADO) · fonte

4 · DIAGNÓSTICO ONCOLÓGICO (W1 Bloco 2 · caixa PATOLOGIA)
Primário:       {{sítio · subsítio · lateralidade}} · [STATUS] · fonte · data
Histologia:     {{cópia controlada do AP}} · [CONFIRMADO] · DOC · data do exame
Grau/fatores:   {{grau · dimensão · profundidade · LV · PN · margens}} · DOC
IHQ/molecular:  {{marcador: resultado (clone, escore/%)}} · DOC · data | PENDENTE (solicitado em DOC-nn) | NÃO SEI
Estadiamento:   T {{valor}} [STATUS, método] · N {{valor}} [STATUS, método] · M {{valor}} [STATUS, método]
                Sistema: {{TNM 8ª/FIGO}} · {{c|p|yp — só se a fonte disser}} · DERIVADO exige regra nomeada
Doença:         {{primário | recidiva local | recidiva regional | metastática}} · {{histológica | clínico-radiológica}}

5 · HISTÓRIA CRONOLÓGICA (uma linha por evento, data do exame)
{{dd/mm/aa}} | {{TIPO}} | {{sede + tamanho + achado principal}} · DOC-nn
   ↳ hipótese/plano de outro serviço: {{texto curto}} · DOC-nn (não é conduta deste serviço)
HDA pré-biópsia não documentada → "HDA pré-biópsia: NÃO SEI"

6 · TRATAMENTOS PRÉVIOS
{{modalidade}} · {{PROPOSTO | PRESCRITO | ADMINISTRADO | SUSPENSO | CONCLUÍDO}} · {{datas}} · fonte | nenhum documentado (NÃO SEI)

7 · EXAMES DE IMAGEM / ENDOSCOPIA (W1 caixa RADS · por compartimento)
Local:        {{achado + medida}} · DOC · data
Linfonodal:   {{achado}} · [SUSPEITO por imagem] · DOC · data
À distância:  {{"sem M1 identificável em <exames listados>"}} | {{achado SUSPEITO → exame dirigido PENDENTE}}
Incidental relevante: {{achado curto}} · DOC     ← só se tem repercussão
Não estudado: {{compartimento}} → NÃO SEI

8 · LABS + MARCADORES (W1 Bloco 3)
{{data}} | Hb | Leuco | Plaq | Cr | ClCr (DERIVADO, fórmula) | TGO | TGP | {{marcador principal}} · fonte
Nenhum lab no kit → "Labs: NÃO SEI" · ⚠ {{marcador principal}} não encontrado

9 · SITUAÇÃO ATUAL (fatos, sem interpretação)
{{1–3 linhas: estado documentado mais recente com fonte/data}}

10 · CONDUTA (W1 Bloco 4)
[CAMPO VAZIO — ato médico exclusivo — IA não preenche]

11 · CONFLITOS / ALERTAS
CONFLITO · {{campo}}: {{valor A}} (DOC, data) × {{valor B}} (DOC, data) → resolve com: {{dado/documento}}
🔴 {{achado}} → risco de {{desfecho}} · janela: {{quando}}        ← máx. 2, só 3×SIM

12 · DADOS FALTANTES QUE MUDAM CONDUTA (W1 5-A)
⚠ {{campo}} — NÃO SEI/PENDENTE
  → Impacto: {{decisão que bloqueia}}
  → Obter: {{exame/documento}}

13 · COPIÁVEL (W1 5-D) — só após revisão médica
{{3–5 linhas em prosa, sem rótulos}}
```

### 3.4 Checklist de faltantes por sítio (proposta `[VERIFICAR]` com o Dr. Silas)
- **Esôfago:** histologia + IHQ; EUS ou PET-CT para T/N; broncoscopia se terço médio/proximal ao nível da carina; HER2 e PD-L1 [VERIFICAR curadoria]; estado nutricional e via alimentar; ECOG; função renal.
- **Colo uterino:** p16/HPV quando o AP pedir; RM pélvica; imagem de tórax; cistoscopia/retoscopia se suspeita de invasão; creatinina (hidronefrose); HIV; ECOG.
- **CEC cutâneo cabeça e pescoço:** histologia da recidiva; descrição cirúrgica e margens finais; RT prévia; imunossupressão; imagem de pescoço e tórax.
- **Mama:** RE, RP, HER2 (escore + ISH se 2+), Ki-67; lateralidade conferida; estadiamento sistêmico conforme estádio; FEVE se anti-HER2/antraciclina.
- **Próstata:** Gleason/ISUP, nº fragmentos positivos, PSA (série), imagem óssea/PSMA (ver modelo 03).

---

## 4. Exemplo SINTÉTICO preenchido — Paciente Teste 11
> Inventado; não corresponde a nenhum caso real. Datas fictícias.

```
0 · TÍTULO
**Carcinoma invasivo de tipo não especial | Mama esquerda | estadiamento INDETERMINADO | HER2 2+ (ISH PENDENTE)**
⚠ N suspeito por USG (linfonodo axilar 1,8 cm, cortical espessada) — punção/biópsia confirmatória PENDENTE
⚠ M indeterminado — nódulo pulmonar 6 mm por TC, inespecífico; cintilografia óssea PENDENTE
Feminino, 58 anos · 1ª consulta 05/03/2030 · nódulo palpável em mama

1 · FONTES
DOC-01 · Ficha de recepção · 05/03/30 · p.1 · NÃO CLÍNICO
DOC-02 · Guia de regulação · aprovada 20/02/30 · p.2 · LIDO
DOC-03 · Encaminhamento da UBS · 10/02/30 · p.3 · LIDO
DOC-04 · Documentos pessoais · p.4 · NÃO CLÍNICO
DOC-05 · AP core biopsy · exame 15/01/30 · assinado 24/01/30 · p.5 · LIDO
DOC-06 · AP core biopsy · p.6 · DUPLICATA de DOC-05
DOC-07 · IHQ · material de DOC-05 · assinado 07/02/30 · p.7 · LIDO
DOC-08 · Mamografia · exame 02/01/30 · p.8 · LIDO
DOC-09 · USG mamas/axilas · exame 05/01/30 · p.9 · LIDO
DOC-10 · TC tórax · exame 18/02/30 · p.10 (página 1/2) · INCOMPLETO (falta 2/2)
DOC-11 · Hemograma + bioquímica · coleta 20/02/30 · p.11 · LIDO

2 · ENCAMINHAMENTO
Origem: atenção primária · 10/02/30 · DOC-03
Motivo registrado: "nódulo em mama direita com biópsia positiva" · texto do encaminhamento
CID da guia: N63 (nódulo mamário) — administrativo, não é diagnóstico; AP define neoplasia (DOC-05)

3 · DADOS CLÍNICOS
AP:        HAS · [CONFIRMADO] · DOC-03 · 10/02/30
MUC:       losartana 50 mg VO 1×/dia · DOC-03
ALERGIAS:  ⚠ dipirona — urticária · DOC-03
CX PRÉVIA: NÃO SEI
HF:        mãe com câncer de mama · DOC-03 (idade ao diagnóstico NÃO SEI)
HÁBITOS:   não tabagista · DOC-03 | etilismo NÃO SEI
ECOG/PS:   1 · DOC-03 · 10/02/30 · médico da UBS
PESO/ALT:  NÃO SEI

4 · DIAGNÓSTICO ONCOLÓGICO
Primário:       mama esquerda, QSE · [CONFIRMADO] · DOC-05 · 15/01/30
Histologia:     carcinoma invasivo de tipo não especial · [CONFIRMADO] · DOC-05
Grau/fatores:   grau histológico 2 · 3/4 fragmentos com neoplasia · invasão LV não avaliável em core · DOC-05
IHQ:            RE 90% · RP 20% · HER2 2+ (clone 4B5) · Ki-67 30% · DOC-07 · 07/02/30 (data de emissão)
                HER2 ISH: PENDENTE (não solicitado em nenhum documento)
Estadiamento:   T 2,6 cm na USG → cT2 [DERIVADO, regra TNM8-mama-T por maior medida de imagem] · DOC-09
                N axilar suspeito [SUSPEITO por USG] · DOC-09
                M indeterminado [SUSPEITO/NÃO SEI] · DOC-10 incompleto; cintilografia NÃO SEI
                Sistema: TNM 8ª · clínico · estádio NÃO calculado (N e M incompletos)
Doença:         primário · histológica

5 · HISTÓRIA CRONOLÓGICA
02/01/30 | MMG | mama esquerda QSE, nódulo espiculado 2,4 cm, BI-RADS 5 · DOC-08
05/01/30 | USG | mama esquerda QSE 2,6 × 2,1 × 1,9 cm; axila esquerda linfonodo 1,8 cm cortical espessada · DOC-09
15/01/30 | Core biopsy | carcinoma invasivo de tipo não especial, G2 · DOC-05
07/02/30 | IHQ | RE 90%, RP 20%, HER2 2+, Ki-67 30% (data de emissão) · DOC-07
18/02/30 | TC tórax | nódulo 6 mm no LID, inespecífico; página 2/2 ausente · DOC-10
HDA pré-biópsia: nódulo palpável há ~3 meses antes de 10/02/30 [DERIVADO de "há 3 meses" em DOC-03] → ~11/29?

6 · TRATAMENTOS PRÉVIOS
Nenhum documentado (NÃO SEI)

7 · EXAMES DE IMAGEM
Local:        mama esquerda QSE 2,6 cm (USG) / 2,4 cm (MMG) · DOC-09, DOC-08
Linfonodal:   axila esquerda 1,8 cm [SUSPEITO por imagem] · DOC-09
À distância:  tórax: nódulo 6 mm inespecífico [SUSPEITO de baixa especificidade]; abdome e ossos não estudados
Não estudado: abdome, esqueleto → NÃO SEI

8 · LABS + MARCADORES
20/02/30 | Hb 12,1 g/dL | Leuco 6,4 ×10³/µL | Plaq 245 ×10³/µL | Cr 0,8 mg/dL | ClCr NÃO calculado (peso NÃO SEI) | TGO 22 U/L | TGP 19 U/L · DOC-11
⚠ CA 15-3 não encontrado nos documentos

9 · SITUAÇÃO ATUAL
Carcinoma invasivo de mama esquerda, RE+/RP+, HER2 2+ sem ISH, com axila suspeita por USG e estadiamento sistêmico incompleto (DOC-05, 07, 09, 10).

10 · CONDUTA
[CAMPO VAZIO — ato médico exclusivo — IA não preenche]

11 · CONFLITOS / ALERTAS
CONFLITO · lateralidade: "mama direita" (DOC-03, 10/02/30) × mama esquerda (DOC-05, 08, 09) → resolve com: exame físico na consulta; documentos primários indicam esquerda
CONFLITO · data da IHQ: só data de emissão disponível (DOC-07) → linha do tempo marca "(data de emissão)"
Sem alerta catastrófico (nenhum achado cumpre os 3 critérios).

12 · DADOS FALTANTES QUE MUDAM CONDUTA
⚠ HER2 ISH — PENDENTE
  → Impacto: define HER2 positivo × negativo/HER2-low e elegibilidade a anti-HER2
  → Obter: ISH no bloco de DOC-05
⚠ Axila — SUSPEITO sem comprovação
  → Impacto: cN e sequência de tratamento
  → Obter: punção/biópsia guiada do linfonodo
⚠ Estadiamento sistêmico — INCOMPLETO
  → Impacto: intenção do tratamento
  → Obter: TC tórax página 2/2, imagem de abdome e ósseo conforme protocolo do serviço
⚠ Peso/altura — NÃO SEI
  → Impacto: superfície corporal e ClCr
  → Obter: medir na consulta

13 · COPIÁVEL (após revisão médica)
Paciente de 58 anos com carcinoma invasivo de tipo não especial de mama esquerda, grau 2, RE 90%, RP 20%, HER2 2+ e Ki-67 30%, diagnosticado por core biopsy em 01/2030. USG com lesão de 2,6 cm em QSE e linfonodo axilar esquerdo de 1,8 cm com cortical espessada. TC de tórax com nódulo inespecífico de 6 mm. HAS em uso de losartana; alergia a dipirona. Pendentes: ISH para HER2, avaliação axilar e estadiamento sistêmico.
```

**Expectativas de teste (fixture sintética):** título nunca usa N63; conflito de lateralidade gerado (DOC-03 × DOC-05/08/09) e não resolvido em silêncio; DOC-06 não gera fatos; HER2 2+ sem ISH gera PENDENTE, nunca "HER2 negativo"; cT2 aparece como DERIVADO com regra; N e M não viram valores confirmados; ClCr não calculado sem peso; Bloco 10 vazio; COPIÁVEL sem rótulos.
