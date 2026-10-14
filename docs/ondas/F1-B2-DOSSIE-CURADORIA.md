# F1-B2 · Dossiê central de curadoria — fichas institucionais sem SISAC (D-F1-49)

**Estado:** RASCUNHO de curadoria (2026-10-14) · **Decisão-mãe:** D-F1-49 (docs/DECISOES.md) · **Aprovação clínica:** nenhuma (todas as fichas RASCUNHO; aprovação item a item por versão/hash)
**Artefatos:** `corpus/fichas/**` (22 fichas novas + 6 alteradas), `corpus/manifesto/b2-fichas.v1.json` (proveniência por campo), `corpus/6-pack-tumor/{ewing,osteossarcoma,cec-pele,ntg,vulva,cup}/` (packs v2 RASCUNHO), `docs/ondas/F1-B2-QUADROS.md` (quadros legíveis GERADOS).
**Evidência em bytes (fora do Git):** `C:\Users\silas\Documents\Codex\2026-10-14\f1-b2-fontes-externas\{legado,sarcomas,cec-ntg-vulva,cup}` (relatórios campo→valor→sourceId→localizador + arquivos capturados com SHA-256) e `C:\Users\silas\Documents\Codex\2026-10-14\f1-auditoria-fontes` (auditoria prévia + hashes dos PDFs locais).

---

## 1. Inventário de entrega (ETAPA 1 — congelado antes da implementação)

| Item | Identidade clínica | Código local | Ação | Estado |
|---|---|---|---|---|
| P1577 | Folinato 20 mg/m² + 5-FU semanal D1–D36 (D-F1-26) | P1577 (identidade comprovada por decisão) | Ficha nova | RASCUNHO — 5-FU **null** |
| P1512/FLOX | 5-FU + folinato D1 **e** D2, sem oxaliplatina (D-F1-27) | P1512 | Ficha nova | RASCUNHO — doses **null** |
| P1397 / 051 | Paclitaxel semanal (D-F1-28: SF 0,9% 500 mL) | mapeamento **não comprovado** | Fontes externas acrescentadas às 6 fichas existentes | 6 fichas com fontes; mapeamento legado aberto |
| P1399 | Dipirona + cimetidina "se necessário" (D-F1-43); esquema de origem desconhecido | P1399 | Regra já vive na ficha P1426; bulas obtidas | Sem ficha própria — aguarda definição |
| 053 | Numeração INT-MED duplicada (D-F1-44) | 053 | Corrigir na biblioteca externa | Sem ficha (correto) |
| Pack Ewing | 1ª linha VDC/IE dose-denso; recidivas | — | Pack + 2 fichas + 3 protocolos-dossiê | RASCUNHO |
| Pack osteossarcoma | MAP C1–4/C5–6, AP; recidivas | — | Pack + 3 fichas + 4 protocolos | RASCUNHO |
| Pack CEC de pele | Cemiplimabe preferencial; QT por extrapolação | — | Pack + 3 fichas (+paclitaxel semanal no pack) | RASCUNHO |
| Pack NTG | Baixo risco MTX/Act-D; alto risco EMA-CO; EMA/EP; EP indução | — | Pack + 5 fichas | RASCUNHO |
| Pack vulva | D-F1-35: cisplatina semanal+RT; carbo/paclitaxel q21d | — | Pack + 2 fichas | RASCUNHO |
| Pack CUP | D-F1-36: 5 duplas | — | Pack + 5 fichas (1 dossiê) | RASCUNHO |

**Fora do escopo (mantidos fora):** vagina, apêndice, PPGL (D-F1-34). Visão computacional de TC/RM não ativada.

## 2. Ambiguidades conhecidas (ETAPA 3 — registro com localizadores)

| Tema | Resolução | Evidência |
|---|---|---|
| **EMA/EP — D2** (slides × diretriz) | **RESOLVIDO:** D2 tem SOMENTE leucovorina 15 mg 2×/dia ×4 (24 h pós-MTX); sem etoposídeo/dactinomicina | Lok 2025 Tabela A5 (p. 24) + Figura A4 ("day 2 EA should be omitted"), dupla cópia (ORBi+Radboud), dupla leitura; eviQ 1378 (EP-EMA) compatível |
| **Ewing — G-CSF por braço** | **RESOLVIDO:** pegfilgrastim 6 mg D3 no VDC (quimio D1–2) e D6 no IE (quimio D1–5) | eviQ 1916/3465 (EXT-SARC-002/003); BC usa filgrastim a partir do D8 |
| **Ewing — citação do q2sem** | **CORRIGIDO:** base é Womer 2012 (AEWS0031, PMID 23091096); "Whelan JCO 2018;36(31)" é Euro-E.W.I.N.G. 99 (BuMel×VAI) | abstracts PubMed verificados |
| **Ewing — desenho SOnHe 17 ciclos com dactinomicina C11–C17** | **NAO_LOCALIZADO** após busca (eviQ/BC/PubMed): externo usa VC (sem doxo) após teto 375; dactinomicina 1,25 só se cardiotoxicidade | relatório sarcomas §2.3 — pendência aberta no pack |
| **Osteossarcoma — idade 25** | **DIVERGÊNCIA ABERTA:** SBOC/SOnHe usam ≤25/>25; NENHUMA fonte externa usa 25 (eviQ nota >40; BC <40; EURAMOS ≤40) | relatório sarcomas §3.3 — decisão do Dr. Silas |
| **Osteossarcoma — cisplatina** | SBOC 60×2 = eviQ 1901 (adotado); BC 50×2 (60×2 excepcional); ensaios 120/ciclo; **SOnHe 80: NAO_LOCALIZADO** | relatório sarcomas §3.1 |
| **CUP — variantes** | Greco 75/75 (adotado; Mukai 60/80 variante); PUCAT/HeCOG 200+AUC6 (adotado; SOnHe 175+AUC5 variante); doc+gem = **Pouessel 2004** (gem 1000 D1/D8, doc 75 D8 — corrige mapa local) | relatório CUP |
| **CUP — cisplatina+vinorelbina** | **NAO_LOCALIZADO** após 6 estratégias documentadas (PubMed, ClinicalTrials.gov, eviQ, BC, CCO-403, NCI PDQ); tripla Palmeri NÃO derivável | relatório CUP — ficha-dossiê |
| **CUP — cisplatina+5-FU** | Khansur 1995 (cis 100 + 5-FU 1000/m²/d ×4 d CI): **só escamoso** com investigação H&N negativa — ficha restrita ao cenário | relatório CUP |
| **Vulva — estudo de referência** | **CORRIGIDO:** GOG 205 = Moore 2012 (PMID 22079361); "Gill 2015" do material local não confere | relatório CEC-NTG-vulva §C1 |
| **CEC — QT citotóxica** | Sem protocolo dedicado de CEC cutâneo: fichas de QT marcadas **EXTRAPOLAÇÃO** de CECP; cisplatina 100 mono: NAO_LOCALIZADO | relatório CEC-NTG-vulva §A2 |
| **P1577 — variante de folinato** | Nenhuma fonte vigente casa folinato 20 semanal (QUASAR/Roswell mod. usam 50 fixa; BC GIAVFL traz LV 20 como opção): 5-FU fica null | relatório legado |
| **APENDO 2026-10-14 (sociedades A–H) — CUP ESMO íntegra** | **LOCALIZADO:** Krämer 2023 Ann Oncol **34(3):228-246** (corrige "34(2):190-203"); platina-dupla+taxano/gem padrão, sem doses; sem dados escamoso vs adeno; vinorelbina só em gem+vin | RELATORIO-BLOCO-A-CUP §2-A5; `sociedades/esmo/kramer-2023-esmo-cup-ann-oncol.pdf` SHA 9e7fc4c6… |
| **APENDO 2026-10-14 — Osteo 40 / doxo / folínico / C5-6** | Corte 40 corroborado (AAOC p.3; Onkopedia §6.1.1.3.1); doxo 37,5×2 no MAP (AAOC Tab.1); leucovorina 15 mg/m² 24h→<0,1 (AAOC); arquitetura C5-6 sem cisplatina (AAOC + Onkopedia "2 MAP + 2 MA"); 80 e RT-dose seguem NAO | RELATORIO-BLOCO-B §§2-B1–B6 |
| **APENDO 2026-10-14 — Ewing q3sem / C3 / RT** | q3sem LOCALIZADO (AAOC Tab.5 esquema completo + SBOC p15 + eviQ + BC); <30/LVEF<45/CrCl<60 LOCALIZADO externo, ausente no serviço; RT 45–60 (SBOC) / 45–70 Gy (AAOC [II,A]); C11 segue NAO | RELATORIO-BLOCO-C §§3–5 |
| **APENDO 2026-10-14 — Vulva AUC / GOG 205** | AUC 5–7 (AAOC Tab.4, não desempata 5×6); PTX 175 confirmado; ensaio GOG 205 = 57,6 Gy + CDDP 40/sem (PubMed legítimo); AAOC recomenda 64–70 Gy EQD2; CDDP 40 convergência total | RELATORIO-BLOCO-D §§PEND-D1/D2 |
| **APENDO 2026-10-14 — CEC fundamento / pembro / cosi** | Extrapolação CECP→CEC **endossada** (AWMF S3 p.234); pembro LOCALIZADO (FDA 200 q3w/400 q6w ≤24m; EMA-negativo); cosibelimabe só como 3º anti-PD-(L)1 FDA (1200 q3w), sem sequência; cis-100 NAO externo | RELATORIO-BLOCO-E §§3–6 |
| **APENDO 2026-10-14 — Legado TNCD/Onkopedia** | P1577/P1512: nenhum semanal/bolus-D1–D2 nas sociedades (TNCD só infusional LV5FU2 q14d); nulls mantidos; P1397/051 e 053 REGISTRADOS | RELATORIO-BLOCO-F §§2–6 |
| **APENDO 2026-10-14 — NTG NCCN×AWMF** | Cortes: NCCN <7 / indução >12 (=≥13); AWMF triplo <5 / 5–6 interm / ≥7; MTX 1 mg/kg (NCCN cat.1) × 50 fixa (AWMF); folínico 30h (NCCN); VCR 1 mg/m² (NCCN); hCG-12m + ACO oral (NCCN+AWMF). NCCN = v2.2019 arquivada | RELATORIO-BLOCO-G §§1–5 |
| **APENDO 2026-10-14 — H1–H4** | CCO 403 (sem CCO); RENAME 2024 2ed item a item + SIGTAP 2026-09 por tumor (36 VERIFICAR decidíveis); eixo N lote 2 verificado (PMID ASCO 41740078 corrigido); curadoria exames/suporte pronta | RELATORIO-BLOCO-H §§PEND-H1–H4 |

## 3. Decisões humanas indispensáveis (ETAPA 8 — para o Dr. Silas)

| # | Pergunta | Opção A (preparada) | Opção B (documentada) | Recomendação |
|---|---|---|---|---|
| 1 | CUP cis+docetaxel: variante de dose | Greco 75/75 q3sem (ficha atual) | Mukai doc 60 + cis 80 | Manter 75/75 (CUP-específico clássico) |
| 2 | CUP carbo+paclitaxel: variante | PUCAT/HeCOG: pac 200 3h primeiro + AUC 6 (ficha atual) | SOnHe p. 379: 175 + AUC 5 | Definir; protocolo institucional específico de CUP favorece A |
| 3 | CUP cis+vinorelbina: destino | Manter ficha-dossiê com doses null até fonte direta | Substituir por outro esquema da lista (exige nova decisão tipo D-F1-36) | A (proibir derivação da tripla) |
| 4 | Osteossarcoma: corte de idade | SBOC 25 anos (local) | Externo 40 anos | Decisão local; registrar explicitamente |
| 5 | Osteossarcoma MAP: fracionamento doxo | SBOC 25×3 (ficha atual) | eviQ/BC/EURAMOS 37,5×2 | Mesmo total/ciclo; escolher |
| 6 | Ewing: desenho institucional 17 ciclos SOnHe | Não implementar (NAO_LOCALIZADO); usar VDC/IE eviQ | Adotar 17 ciclos AEWS1031 (VC sem doxo após teto) | B se quiser 17 ciclos; nunca a sobreposição C11 |
| 7 | Vulva: AUC da carboplatina | GOCXCAT AUC 6 (5 se RT prévia) — ficha atual | SOnHe AUC 5 | Definir |
| 8 | CEC: extrapolações de CECP para QT | Aceitar fichas EXTRAPOLAÇÃO | Recusar e deixar só cemiplimabe | Cenário a cenário com o Dr. Silas |
| 9 | P1397/051: destinação dos códigos | Deixar mapeamento "não comprovado" documentado | Atribuir a fichas específicas (exige memória institucional) | A |
| 10 | P1577/P1512: doses nulas | Definir doses (encerra as lacunas) | Manter dossiê até fonte/decisão | Qualquer dose nova = decisão registrada em DECISOES.md |
| 11 | NTG cortes (G1): ≤6/≥13 × 0–4/≥12 × triplo AWMF | Manter ficha (≤6; indução ≥13 — NCCN+Lok) | Adotar BC/eviQ-1347 (0–4; ≥12) ou triplo AWMF (<5/5–6/≥7) | A; alternativa C (AWMF) documentada no consolidado |
| 12 | NTG MTX/folínico/VCR (G2–G4) | Manter 50 fixa + 24h + VCR 1 (ficha; AWMF+eviQ) | Trocar p/ 1 mg/kg e/ou 30h e/ou 0,8 (NCCN cat.1/BC/Lok) | Manter 50 fixa e VCR 1; avaliar 30h (BC+NCCN); resolver conflito v2 antes de trocar MTX |
| 13 | Ewing variante q3sem (C2) | Manter só q14 dose-denso | Preparar ficha alternativa q3sem (AAOC esquema completo) | B (intolerância ao q14); registrar divergências VCR/G-CSF |
| 14 | Ewing elegibilidade/cautelas (C3) | Adotar <30 (alvo) + LVEF<45 + CrCl<60 nas fichas | Manter só documental | A (segurança, dupla fonte BC+eviQ) |
| 15 | Ewing RT (C4): faixa no pack | Ancorar 45–60 Gy (interseção SBOC+AAOC) | Ancorar 45–70 Gy (AAOC, inclui definitiva) | A |
| 16 | CEC pembrolizumabe (E3): criar ficha | Criar (FDA 200 q3w/400 q6w ≤24m + KEYNOTE-629) | Não criar | A; disponibilidade SUS em H2 |
| 17 | CEC cosibelimabe (E4): criar ficha | Não criar (sem endosso de sequência) | Criar (FDA 1200 q3w) | A |
| 18 | Vulva RT (D2): ancorar dose | Ancorar 57,6 Gy (ensaio GOG 205) | Ancorar 64–70 Gy EQD2 (AAOC 2026) | A (coerência ensaio↔ficha) |
| 19 | H2: 36 sus VERIFICAR | Reclassificar item a item (RENAME/SIGTAP + trecho) | Manter VERIFICAR | A (todos decidíveis; RENAME ≠ cobertura oncológica) |
| 20 | H3: eixo N lote 2 | Aplicar lote 2 + re-gate (dono do conversor) | Manter lote 1 | A |
| 21 | H4: propostas exames/suporte | Aplicar item a item (MAP, PUCAT, β-hCG, ECO) | Manter packs | A |
| 22 | Osteo RT (B6): dose | Manter sem dose (só indicação) | Ancorar faixas v2 após verificação | A até verificação da v2 |

**Aprovações de conteúdo:** concessão por ficha item a item (templateId/versão/hash em F1-B2-QUADROS.md). Aprovar a lista ≠ aprovar doses; aprovação técnica ≠ aprovação clínica (D-F1-49).

## 4. Lacunas que impedem ativação (resumo executivo)

1. **Cisplatina+vinorelbina (CUP):** sem fonte direta — ficha-dossiê.
2. **P1577/P1512:** doses de 5-FU/folinato null (variantes externas não casam com a identidade local).
3. **Idade 25 (osteo), variantes CUP/vulva, extrapolações CEC:** decisões pendentes (tabela acima).
4. **Ewing 17 ciclos SOnHe:** desenho sem corroboração externa.
5. **CCO:** inacessível (Azure WAF 403) em todas as buscas — limitação registrada.
6. **Bulas Anvisa oficiais (dipirona/cimetidina):** portal bloqueado por JS/Turnstile — espelhos de bulas obtidos (Medley/EMS) com limitação registrada.

## 5-A. APENDO 2026-10-14 — pesquisa direcionada das pendências (blocos A–H)

Evidência completa: `C:\Users\silas\Documents\Codex\2026-10-14\f1-b2-fontes-externas\sociedades\RELATORIO-F1-B2-PENDENCIAS-V2.md`
(+ `sociedades\esmo\kramer-2023-esmo-cup-ann-oncol.pdf`, SHA-256
9e7fc4c6…41b7f4, íntegra ESMO CUP 2023 via espelho legítimo — resolve PEND-A5).

Atualizações de estado (sem reescrever §2):

| Pendência | Estado após pesquisa v2 |
|---|---|
| A5 ESMO CUP 2023 íntegra | **LOCALIZADO** (espelho worldcupawareness.org; sem cis+vin nem cis+5-FU empíricos; dupla platino [III,B]) |
| A1 cis+doc | NCCN OCC-B v2.2025 traz doc 60–75 + cis 75 q3sem (cobre Greco e Mukai) |
| A2 carbo+pac | NCCN OCC-B v2.2025: pac 175–200 + AUC 5–6 (cobre PUCAT e SOnHe) |
| A3 cis+vinorelbina CUP | mantém **NAO_LOCALIZADO** (7ª estratégia: ESMO íntegra, NCCN, AAOC, AIOM) |
| A4 cis+5-FU | ganha 2ª fonte NCCN OCC-B (cis 20×5 + 5-FU 700 CI, q4sem, CUP escamoso) — doses ≠ Khansur; decisão |
| B1 idade 25 | consenso externo 40 (NCCN, SWAG, EURAMOS); Euroboss usa 25 só como nó de escolha de regime |
| B3 cisplatina 80 | mantém **NAO_LOCALIZADO** (externo: 60×2, 50×2, 120 total, 100×1, 90×1) |
| B6 RT osteo | faixas: 60–68 Gy irressecável; 20/5 ou 30/10 paliativo — decisão local |
| C1 Ewing 17 ciclos | **PARCIAL**: esqueleto 17 ciclos q3sem com dactino após teto existe (INT-0091 VACA/IE; série adulta 14–17); sobreposição do C11 segue NAO_LOCALIZADO; slides locais sem arquivo "ewing" |
| C2 q3sem Ewing | LOCALIZADO (série adulta VDC/IE q3sem 14–17 ciclos) |
| C4 RT Ewing | 45–54 Gy Europa; 55,8 Gy EUA; WLI 15–18 Gy |
| D1 AUC vulva | paclitaxel 175/3h universal; AUC 5 mais frequente (GOG cervix/NHS), AUC 6 com redução p/ 5 se RT prévia (GOG 0209) |
| D2 Moore 2012 | LOCALIZADO: 57,6 Gy (1,8×32) + cisplatina 40 semanal (máx 70 mg) |
| E1 extrapolações CEC | NCCN CSCC v1.2026 cita carbo+pac e cis+RT diretamente (peso novo); paclitaxel semanal 80 segue extrapolação |
| E3 pembrolizumabe CEC | LOCALIZADO: NCCN CSCC preferido (2A); KEYNOTE-629; FDA/ANVISA sim, EMA não |
| E4 pós-PD-1 | sem 2º ICI aprovado; NCCN: carbo+pac/cetuximabe/EGFR-i/capecitabina/cis/cis+5-FU |
| F1 P1577 | **LOCALIZADO**: NHS Northern CA CR004 — folinato 20 mg/m² + 5-FU 425 (ou 370) semanal ×30; 5-FU null pode ser preenchido com decisão |
| F2 P1512 | fonte D1–D2 vigente = LV5FU2 (de Gramont, 200/400+600 q2sem); FLOX/mFLOX levam oxaliplatina (não casam) |
| G2 MTX NTG | 50 mg fixa D1,3,5,7 LOCALIZADO (Charing Cross); "1 mg/kg" NAO_LOCALIZADO (variante: 0,4 mg/kg máx 25 mg ×5d) |
| G3 folínico | 24 h (regimento formal) e 30 h (tabela Seckl/Medscape) ambas fonteadas; dose 7,5 × 15 mg |
| G4 vincristina EMA-CO | 1 mg/m² (Ngan 2021) e 0,8–1,0 (Bower) ambas fonteadas |
| H1 CCO | nova tentativa → 403; mantém bloqueio |

---

## 5. Proveniência e reprodutibilidade

- Manifesto: `corpus/manifesto/b2-fichas.v1.json` — 38 fontes externas (URL+versão+SHA-256 integral+data de acesso 2026-10-14) + 2 materiais locais (SBOC ósseos v5, SOnHe 2024, com hash do inventário da auditoria).
- Validador: `npm run check:corpus` → `scripts/corpus-b2.mjs` (hash, RASCUNHO, cobertura por campo, fontes existentes, NAO_LOCALIZADO=null, fichaId dos packs resolve, fichas soltas).
- Regeneração determinística: `node tests/corpus-fichas/gerar-fichas-b2.mjs` e `node scripts/gerar-packs-b2.mjs`; apresentação: `node scripts/gerar-dossie-fichas.mjs`.
- O gerador histórico `gerar-fichas.mjs` está congelado (executá-lo apagaria as edições B1 — verificado e restaurado durante o trabalho; guard documentado no gerador B2).
