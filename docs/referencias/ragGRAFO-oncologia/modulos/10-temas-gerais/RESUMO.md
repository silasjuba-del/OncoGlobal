# Módulo 10 · Temas Gerais (PRO 2026)

Fontes (13 PDFs): aulas 83–95 (oncogenética, oncologia de precisão, oncogeriatria, emergências 1 e 2, NVIQ/diarreia/fadiga, dispneia/sedação, dor, toxicidades imunomediadas, epidemiologia, legislação, interpretação de estudos, pesquisa clínica).
Extração por `pdftotext -layout`. As páginas que só têm imagem foram lidas visualmente: 83 p.21, 29–30, 40–41, 50; 84 p.47–48, 53–54; 87 p.12; 88 p.12–14, 25–26; 91 p.17–18, 24–29. Todo nó **NAO_VERIFICADO**.

## Extensão do esquema usada (pedida para este módulo)
- **`tema.<slug>`** (tipo `tema`), com extras `categoria`, `criterios`/`manejo`/`pontos_chave` (lista de `{texto, pagina}` com limiares literais) e `observacao`.
- **`ach.<slug>`** (tipo `achado`): red flag ou limiar que dispara conduta. Extras: `limiar`/`criterio`.
- Arestas: **MANEJA** (tema→regime|fármaco; attrs `papel`, `dose_literal`, `condicao`, `pagina`), **ALERTA** (tema→achado; attr `pagina`), **FONTE** (todo nó→src, com página).
- Regimes de suporte usam `reg.<tema>.<slug>`, por exemplo `reg.nviq.alto-potencial-ac` e `reg.neutropenia-febril.baixo-risco-oral`. Doses entram só quando são literais da aula (`dose_literal`).
- Fármacos usam `far.<slug>` com underscore, alinhados ao ragGRAFO/prescricao (`far.amox_clav`, `far.ciprofloxacino`, `far.haloperidol`, `far.prednisona`, `far.paracetamol`…).

## Temas extraídos
Oncogenética: conceitos, indicações de teste (red flags + testagem universal), Li-Fraumeni (critérios clássicos e de Chompret, rastreamento, R337H), Lynch (Amsterdam II, colonoscopia por gene, aspirina 600 mg), HBOC, CDH1, poliposes · Precisão: conceitos, biópsia líquida, NGS somático → germinativo (regras de VAF), terapia agnóstica (9 aprovações FDA modeladas como `tum.tumor-solido-agnostico` → cenário → regimes com `condicao_biomarcador`) · Geriatria: G8 ≤14/AGA, CARG/CRASH, perioperatório · Emergências: hipercalcemia (faixas clínicas e CTCAE), OIM, SVCS, compressão medular, neutropenia febril (definição, MASCC, ATB ≤1 h, G-CSF ≥20%), TEV (Khorana, API-CAT), lise tumoral (Cairo-Bishop) · Suporte: NVIQ (esquemas ASCO 2020 com doses), diarreia (loperamida, DPD/uridina, irinotecano/atropina), colite imunomediada, fadiga, dispneia, sedação paliativa (midazolam), dor (degraus, resgate 10–20%, coanalgésicos, rotação) · Imuno: irAE por grau, SLC e ICANS (tarlatamabe) · Saúde pública: epidemiologia, prevenção, rastreamento (colo DNA-HPV, mama, CCR, próstata, pulmão/CHC), SUS, CONITEC, ANS/Rol, Lei dos 60/30 dias · Métodos: leitura de curvas/HR/vieses, fases de pesquisa e regulação.

## Trials
API-CAT (HR e IC literais), Mohile e Li (AGA), Burn 2020 (aspirina/Lynch), 2 estudos de olanzapina (o slide cita Saito 2025 e Bajpai 2024 sem dizer qual é qual), tarlatamabe/Ahn NEJM 2023 (taxas de SLC e ICANS literais; fase e nome do estudo não aparecem no slide).

## Ressalvas
- A aula 88 tem "Caquexia" no nome do arquivo, mas o conteúdo é NVIQ, diarreia e fadiga. Não há conteúdo de caquexia.
- Epidemiologia p.8: a tabela saía desalinhada no texto extraído; os valores foram conferidos visualmente na página.
- O conteúdo de câncer de próstata hereditário (aula 83 p.57–61) está só em questões sem gabarito marcado, por isso não foi extraído como conduta.
- Nos trials, o campo `status` (positivo/negativo/NS) do esquema virou `status_resultado`, porque `status` já é usado pelo NAO_VERIFICADO obrigatório.
- `bio.msi-dmmr` e `ach.tp53-r337h` têm a página de origem na aula 84 e são reutilizados pelos temas de Lynch e Li-Fraumeni.
