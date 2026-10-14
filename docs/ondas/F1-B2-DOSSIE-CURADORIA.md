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

**Aprovações de conteúdo:** concessão por ficha item a item (templateId/versão/hash em F1-B2-QUADROS.md). Aprovar a lista ≠ aprovar doses; aprovação técnica ≠ aprovação clínica (D-F1-49).

## 4. Lacunas que impedem ativação (resumo executivo)

1. **Cisplatina+vinorelbina (CUP):** sem fonte direta — ficha-dossiê.
2. **P1577/P1512:** doses de 5-FU/folinato null (variantes externas não casam com a identidade local).
3. **Idade 25 (osteo), variantes CUP/vulva, extrapolações CEC:** decisões pendentes (tabela acima).
4. **Ewing 17 ciclos SOnHe:** desenho sem corroboração externa.
5. **CCO:** inacessível (Azure WAF 403) em todas as buscas — limitação registrada.
6. **Bulas Anvisa oficiais (dipirona/cimetidina):** portal bloqueado por JS/Turnstile — espelhos de bulas obtidos (Medley/EMS) com limitação registrada.

## 5. Proveniência e reprodutibilidade

- Manifesto: `corpus/manifesto/b2-fichas.v1.json` — 38 fontes externas (URL+versão+SHA-256 integral+data de acesso 2026-10-14) + 2 materiais locais (SBOC ósseos v5, SOnHe 2024, com hash do inventário da auditoria).
- Validador: `npm run check:corpus` → `scripts/corpus-b2.mjs` (hash, RASCUNHO, cobertura por campo, fontes existentes, NAO_LOCALIZADO=null, fichaId dos packs resolve, fichas soltas).
- Regeneração determinística: `node tests/corpus-fichas/gerar-fichas-b2.mjs` e `node scripts/gerar-packs-b2.mjs`; apresentação: `node scripts/gerar-dossie-fichas.mjs`.
- O gerador histórico `gerar-fichas.mjs` está congelado (executá-lo apagaria as edições B1 — verificado e restaurado durante o trabalho; guard documentado no gerador B2).
