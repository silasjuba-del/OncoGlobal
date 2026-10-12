# F1 · Entrega final da documentação do corpus (11/10/2026)

Ordem do Dr. Silas (/goal): levar até o fim a documentação (catálogo, receitas, laudos, interações, CTCAE-ação, tumor-packs, orientações, encaminhamentos), conferindo nas pastas SBOC e Onco PRO 2026. Esta entrega cumpre isso como **biblioteca RASCUNHO**: tudo `consultavel: true`, `alerta: false`, nada promovido a VERIFICADO sem a aprovação clínica do Dr. Silas (D-F1-05).

## Fontes usadas

- **SBOC:** `C:\Users\silas\OneDrive\ONCO-DOCS ((TUDOAQUI)\SBOC\sboc\diretrizes`. Foram 65 PDFs, com texto extraído página a página, e todas as doses dos packs citam arquivo, página e trecho.
- **Onco PRO 2026:** `C:\Users\silas\OneDrive\ONCO-DOCS ((TUDOAQUI)\slides-pro-2026`, com 96 aulas em 10 módulos. Serviu de apoio. Número que só aparece no curso entra como `CURSO / INFERIDO`.
- **Complementos:** bulas FDA (openFDA/DailyMed) onde a SBOC não dá posologia, PCDT/DDT do Ministério da Saúde (hematologia, rim), CONITEC/portarias, AEMPS e ClinicalTrials.gov (API v2) para os NCT.
- **Bula ANVISA:** não foi aberta, porque o bulário bloqueia o acesso automatizado. Toda regra de bula é FDA e está marcada assim.

## Validação

- `node scripts/validate-corpus.mjs`: **corpus ok (209 arquivos)**.
- `vitest tests/corpus`: **98 de 98** testes passando.
- Verificador de integração: zero id duplicado, zero `catalogoId` inválido, zero `alerta: true`, todos os encaminhamentos apontando para packs que existem, e todos os packs v2 com `substitui` ligado ao id novo do v1.

## O que existe agora, por pilar

| Pilar | Arquivos | Conteúdo | Situação |
|---|---|---|---|
| 1 · Exames | catálogo v1.1, labs-por-esquema, solicitação por ciclo, pedido de imagem com resumo do caso, campos de patologia e de endoscopia | **164 exames SIGTAP**, 23 a mais que a v1.0: patologia de colo e mama, citologia, molecular (PCR de mutação 0202100081, sequenciamento por amplicon 0202100111, FISH de mieloma 0202100243), colposcopia, linfocintilografia | Completo como RASCUNHO |
| 2 · Receitas | suporte oncológico v1, especiais v2, classes, modelo de receita do serviço | **65 itens**, 48 com dose e fonte. Antiemese por risco, escada da dor e opioides, laxativos, loperamida, G-CSF, neutropenia febril ambulatorial, HBV, osteoproteção, TEV, megestrol, antifúngico e antiviral, cardio, nefro, infecciosas e endócrino | 9 itens sem dose (SEM_FONTE) |
| 3 · Laudos | 10 laudos do GLM + modelo pericial do serviço | INSS, afastamento, LOAS, transporte, judicialização, fraldas, FGTS, nutrição, oxigênio, incapacidade. Todos com bloco de assinatura comum, validade pendente e portas | FGTS corrigido (HS-1) |
| 4 · Interações e contraindicações | interações v2, contraindicações v2, risco de neutropenia febril v1 | **47 interações** (CYP3A4 por molécula, metotrexato, brivudina, fluoropirimidinas) e **27 contraindicações** (gestação, renal, hepática, FEVE). Regra de risco de neutropenia febril ≥ 20% → G-CSF | Tamoxifeno × CYP2D6 sem alerta até haver bula ANVISA |
| 5 · CTCAE-ação | ctcae-acao v2, ctcae-graus | **132 condutas**, 124 com fonte de bula. Percentual reduzido e percentual administrado em campos separados (HS-2 corrigido) | 8 sem fonte |
| 6 · Tumor-pack | **29 packs v2** | tabela abaixo | Todos RASCUNHO |
| 7 · Orientações | dieta geral, por tumor e por toxicidade; atividade física; sinais de alarme consolidado; 2 modelos do serviço | Cada arquivo com gatilho (termo CTCAE, peso, pack) e portas; os órfãos foram ligados | Sinais de alarme fora do par SAMU/PS = proposta pendente (HS-3) |
| 8 · Encaminhamentos | radioterapia, cirurgia oncológica, mastologia + **cuidados paliativos, nutrição, oncogenética, psico-oncologia** | Cada um ligado aos ids dos packs | Critérios de motivo pendentes de aprovação |

## Os 29 packs de tumor (esquema único v2: `docs/ondas/F1-PACK-ESQUEMA-V2.md`)

Cada pack traz: diagnóstico (imagem, endoscópicos, patológico com método H&E/IHQ/FISH/PCR/NGS, alvo, consequência e disponibilidade no SUS), estadiamento (sistema e edição, exames por cenário, marcadores), tratamento (cenários, protocolos com dose, unidade, via, dias e ciclo, RT, cirurgia, biomarcador × tratamento, suporte, ensaios com NCT, seguimento) e ligações (exames por id, interações, CTCAE-ação, receitas, orientações, encaminhamentos, laudos e fórmulas X + Y = Z).

| Pack | Protocolos | Com dose e fonte | NCT verificados | Fórmulas X+Y=Z | Pendências | Conflitos |
|---|---|---|---|---|---|---|
| adrenal | 4 | 4 | 2 | 4 | 7 | 2 |
| bexiga | 37 | 29 | 8 | 8 | 14 | 11 |
| cabeca-pescoco | 22 | 21 | 3 | 4 | 6 | 2 |
| canal-anal | 12 | 10 | 3 | 6 | 6 | 3 |
| chc | 8 | 6 | 10 | 4 | 8 | 1 |
| colo-utero | 19 | 19 | 5 | 5 | 7 | 2 |
| colorretal | 47 | 41 | 16 | 9 | 10 | 6 |
| endometrio | 14 | 14 | 4 | 4 | 8 | 2 |
| esofago | 20 | 17 | 8 | 4 | 11 | 5 |
| gastrico | 37 | 34 | 12 | 4 | 10 | 7 |
| gist | 10 | 10 | 7 | 7 | 5 | 3 |
| gliomas | 10 | 10 | 4 | 5 | 7 | 1 |
| ldgcb | 3 | 3 | 1 | 4 | 8 | 3 |
| linfoma-folicular | 4 | 4 | 3 | 4 | 6 | 3 |
| linfoma-hodgkin | 4 | 4 | 1 | 4 | 7 | 3 |
| mama | 34 | 34 | 9 | 6 | 9 | 3 |
| melanoma | 18 | 18 | 4 | 4 | 6 | 1 |
| mieloma | 5 | 5 | 1 | 5 | 9 | 3 |
| neuroendocrinos | 12 | 7 | 9 | 7 | 6 | 5 |
| ovario | 31 | 31 | 6 | 5 | 9 | 3 |
| pancreas | 19 | 15 | 8 | 4 | 10 | 3 |
| penis | 9 | 4 | 1 | 7 | 14 | 4 |
| prostata | 43 | 40 | 8 | 8 | 13 | 7 |
| pulmao | 61 | 57 | 8 | 7 | 12 | 7 |
| rim | 26 | 24 | 8 | 7 | 11 | 5 |
| sarcomas | 26 | 26 | 3 | 4 | 7 | 3 |
| testiculo | 23 | 17 | 3 | 14 | 13 | 7 |
| tireoide | 14 | 14 | 3 | 4 | 8 | 2 |
| vias-biliares | 15 | 13 | 8 | 4 | 10 | 2 |
| **Total (29)** | **587** | **531** | **166** | **162** | **257** | **109** |

Os 5 packs v1 do GLM (mama, colorretal, próstata, pulmão, gástrico) continuam no repositório como histórico, com id `pack-<slug>-v1-glm` e `supersededBy`. O lote 1 do Mistral (Markdown) foi refeito do zero a partir da SBOC local, e os 4 erros graves dele estão corrigidos nos packs v2 (esôfago 41,4 × 50,4 Gy; FOLFIRINOX com oxaliplatina; população do INTERLACE; brivudina).

## Alertas para o Dr. Silas (erros nas fontes e nas fichas do serviço)

**Erros encontrados nas diretrizes SBOC.** Em todos, o pack ficou com a opção segura e o caso está registrado em `conflitos`:
1. **Vias biliares, p.19:** capecitabina "2.500 mg/m² 12/12h", o dobro da bula. A dose ficou null.
2. **Vias biliares, p.19:** larotrectinibe "100 mg/m²", que é dose pediátrica. O pack usa a dose adulta da bula, 100 mg 2x/dia.
3. **GIST:** imatinibe 800 mg "1x por dia"; a bula manda 400 mg de 12/12 h. A tabela de risco do GIST está inconsistente e não foi automatizada.
4. **Partes moles, p.13:** trabectedina "1,5 g/m²", provável erro de unidade. Ficou fora do pack.
5. **Ovário germinativo v4, p.10:** dactinomicina do VAC "300 mg/m²", provável erro de unidade. Ficou fora do pack.
6. **Ciclos incoerentes:** nivolumabe D1/D15 "a cada 3 semanas" (esôfago); FOLFOX + zolbetuximabe "a cada 21 dias" (estômago); gencitabina + DTIC "D1 e D15 a cada 2 semanas" (partes moles).
7. **FOLFOXIRI (cólon avançado):** bolus de 5-FU que o esquema clássico não tem. O bolus foi retirado.
8. **Rádio-223:** a SBOC traz 50 kBq/kg e a bula 55 kBq/kg. O pack usa a bula, marcado CONFLITANTE.
9. As SBOC 2026 de colo, endométrio e ovário são "versão para colaboração", não a final.

**Fichas do serviço (`corpus/fichas`) que divergem da SBOC.** Não editei nenhuma; precisam da sua revisão:
- mFOLFOX6 e FOLFIRI paliativos: **sem o bolus de 5-FU de 400 mg/m²**.
- FLOT: 5-FU 2.400 na ficha × 2.600 mg/m² na SBOC.
- Irinotecano no esôfago: 350 mg/m² a cada 21 dias na ficha × 150 mg/m² a cada 14 dias na SBOC. Irinotecano no gástrico: 180 mg/m² a cada 14 dias, dose que não consta na SBOC.
- mDCF institucional: 5-FU 600 D1–D2 × 400 em bolus + 1.000 mg/m²/dia.
- Ifosfamida no colo: a ficha usa ciclo de 21 dias e a SBOC de 28.

**Decisões clínicas que ficaram com o senhor:**
- Doxorrubicina com bilirrubina de 3,1 a 5 mg/dL: redução de 75% (administrar 25%), lido da bula Pfizer.
- Ondansetrona no risco moderado: a bula manda manter 1–2 dias, a MASCC manda parar no D1. Foi usada a MASCC.
- Morfina inicial: 5 mg (aula) × 15–30 mg (bula).
- SMX-TMP na profilaxia: a RENAME só tem o comprimido de 400/80, então são 2 comprimidos por dia.
- Saídas de sinais de alarme fora do par SAMU/PS, com prazo máximo de 24 h.
- Serviço e CRM oficiais dos documentos (SP × PB).

## O que continua aberto (não é redação, é fonte ou motor)

- **257 pendências e 109 conflitos** distribuídos nos packs. Os mais comuns:
  - doses de RT sem fracionamento na SBOC;
  - status SUS das imunoterapias e terapias-alvo (CONITEC);
  - CPPC sem diretriz SBOC na pasta;
  - resgate em linfomas;
  - NGS amplo e germinativo sem código SIGTAP (42 exames sem id).
- **Bula ANVISA:** não consultada (bloqueio automatizado). A promoção a VERIFICADO exige conferência no Bulário.
- **Motor (D-F1-07, D-F1-11):** o corpus está ligado por ids e portas, mas o código ainda não carrega as pastas `1-` a `8-`, não avalia a prescrição proposta e não reabre a avaliação quando um fato muda. Isso é tarefa de código (Codex), fora desta entrega.
- **`docs/DECISOES.md`:** tem alterações de outro autor (D-F1-08 a D-F1-14, sem commit). Não foram incluídas no commit desta entrega.

## Como promover um item a VERIFICADO

1. O Dr. Silas lê o item na página do tema (consultável, marcado "não curado").
2. Confere a fonte citada (arquivo SBOC + página, ou bula ANVISA).
3. Aprova: `status: VERIFICADO`, `curadoria.aprovacaoClinica = {por, data}`. O alerta automático só liga depois, item a item (D-F1-05).
