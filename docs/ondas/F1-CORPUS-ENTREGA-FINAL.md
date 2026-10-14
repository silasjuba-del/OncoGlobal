# F1 · Entrega final da documentação do corpus (11/10/2026, rodada 2)

Ordem do Dr. Silas (/goal): levar até o fim a documentação (catálogo, receitas, laudos, interações, CTCAE-ação, tumor-packs, orientações, encaminhamentos), conferindo nas pastas SBOC e Onco PRO 2026. **Foco: oncologia clínica.** Hematologia e radioterapia ficam como aceno geral: o conteúdo foi preservado, sem aprofundamento.

Esta entrega é uma **biblioteca RASCUNHO completa e auditada**. Tudo está com `consultavel: true` e `alerta: false`. Nada foi promovido a VERIFICADO sem a aprovação clínica do Dr. Silas (D-F1-05). O Codex fez auditoria independente (veredito em `C:\Users\silas\handoff\2026-10-11_codex-veredicto-entrega-final-f1.md`), e os achados dele foram corrigidos nesta rodada (seção "Auditoria Codex").

## Fontes

- **SBOC:** `C:\Users\silas\OneDrive\ONCO-DOCS ((TUDOAQUI)\SBOC\sboc\diretrizes`. São 65 PDFs, com texto extraído por página. Cada dose cita arquivo, página e trecho.
- **Onco PRO 2026:** `C:\Users\silas\OneDrive\ONCO-DOCS ((TUDOAQUI)\slides-pro-2026`, com 96 aulas. É apoio: número que só aparece no curso entra como `CURSO / INFERIDO`.
- **Complementos:**
  - bulas FDA (openFDA/DailyMed) onde a SBOC não dá posologia;
  - braços de ensaios no ClinicalTrials.gov (API v2), para dose e NCT;
  - PCDT/DDT do Ministério da Saúde;
  - portarias e relatórios CONITEC, para o status no SUS;
  - SIGTAP 09/2026 pinado, para exames e APAC;
  - AEMPS.
- **Bula ANVISA:** não consultada. O bulário bloqueia acesso automatizado (Cloudflare, HTTP 403), e o bloqueio não foi contornado. As 12 pendências `DEPENDE_BULA_ANVISA` exigem conferência humana no Bulário.

## Validação

- `node scripts/validate-corpus.mjs`: **corpus ok (209 arquivos)**.
- `vitest tests/corpus`: **98 de 98** testes.
- Verificador de integração: zero id duplicado, zero `catalogoId` inválido, zero `alerta: true`, todos os encaminhamentos apontando para packs existentes e `substitui` ligado aos ids novos dos v1.

## O que existe, por pilar

| Pilar | Conteúdo | Situação |
|---|---|---|
| 1 · Exames | Catálogo **v1.2 com 186 exames SIGTAP**: patologia de colo e mama, citologia, molecular, endócrino da adrenal, VHS, Coombs, IGRA, imunoglobulinas, líquor, elastografia, laparoscopia. Também lista os exames **sem código SUS confirmado** (NGS amplo, TMB, HRD, ctDNA, painel germinativo, DPYD, metanefrinas fracionadas, ecoendoscopia etc.). | Os códigos moleculares 0202100081, 0202100111 e 0202100090 têm **faturamento oncológico não demonstrado** (Codex): nos packs ficam como `catalogoIdCandidato` |
| 2 · Receitas | 65 itens de suporte e especiais, 48 com dose e fonte | 9 sem dose (SEM_FONTE); 5 com dose só do curso |
| 3 · Laudos | 10 laudos + modelo pericial do serviço, com bloco de assinatura, validade e portas | FGTS corrigido (HS-1); validade por finalidade pendente |
| 4 · Interações e contraindicações | 47 interações, 27 contraindicações e regra de risco de neutropenia febril ≥ 20% → G-CSF | Tamoxifeno × CYP2D6 sem alerta até a bula ANVISA |
| 5 · CTCAE-ação | 132 condutas: 116 conferidas na bula FDA (openFDA), 4 dependem de conferência no PDF, 3 herdadas do v1 sem reverificação, 1 do texto SBOC e 8 sem fonte | HS-2 corrigido |
| 6 · Tumor-pack | **29 packs v2, 633 protocolos** (tabela abaixo) | Codex A01–A06 corrigidos |
| 7 · Orientações | Dieta (geral, por tumor, por toxicidade), atividade física, sinais de alarme e 2 modelos do serviço, todos com gatilhos e portas | Saídas fora do par SAMU/PS seguem como proposta pendente (HS-3) |
| 8 · Encaminhamentos | Radioterapia, cirurgia oncológica, mastologia, cuidados paliativos, nutrição, oncogenética e psico-oncologia, ligados aos packs (os transversais por contrato explícito) | Critérios pendentes de aprovação |

## Os 29 packs de tumor

Esquema único: `docs/ondas/F1-PACK-ESQUEMA-V2.md`.

- **"Com dose e fonte":** todas as doses do protocolo preenchidas, com fonte VERIFICADO ou INFERIDO. Os INFERIDO não são clinicamente verificados.
- **Status SUS:** preenchido em **633 de 633** protocolos (portaria CONITEC, procedimento APAC do SIGTAP 09/2026 ou, quando não há avaliação CONITEC, "não" INFERIDO com a regra explicada). Pâncreas e vias biliares perioperatórios: SIGTAP só tem APAC de doença avançada (verificado).
- **Pendências:** todas classificadas. Nenhuma ficou como texto solto.

| Pack | Protocolos | Com dose e fonte | NCT verificados | Fórmulas X+Y=Z | Pendências (classificadas) | Conflitos |
|---|---|---|---|---|---|---|
| adrenal | 5 | 5 | 2 | 4 | 6 | 2 |
| bexiga | 37 | 33 | 10 | 8 | 10 | 12 |
| cabeca-pescoco | 26 | 25 | 3 | 4 | 2 | 2 |
| canal-anal | 12 | 10 | 3 | 6 | 5 | 3 |
| chc | 8 | 7 | 10 | 4 | 6 | 1 |
| colo-utero | 19 | 19 | 5 | 5 | 4 | 2 |
| colorretal | 49 | 46 | 16 | 9 | 7 | 6 |
| endometrio | 20 | 20 | 5 | 4 | 4 | 2 |
| esofago | 20 | 18 | 8 | 4 | 9 | 5 |
| gastrico | 37 | 35 | 12 | 4 | 7 | 7 |
| gist | 10 | 10 | 7 | 7 | 5 | 3 |
| gliomas | 11 | 11 | 4 | 5 | 5 | 2 |
| ldgcb | 3 | 3 | 1 | 4 | 7 | 3 |
| linfoma-folicular | 4 | 4 | 3 | 4 | 5 | 3 |
| linfoma-hodgkin | 4 | 4 | 1 | 4 | 6 | 3 |
| mama | 45 | 45 | 10 | 6 | 5 | 3 |
| melanoma | 18 | 18 | 4 | 4 | 4 | 1 |
| mieloma | 7 | 7 | 1 | 5 | 6 | 3 |
| neuroendocrinos | 12 | 8 | 9 | 7 | 6 | 5 |
| ovario | 35 | 35 | 6 | 5 | 6 | 3 |
| pancreas | 19 | 15 | 8 | 4 | 8 | 3 |
| penis | 9 | 7 | 2 | 7 | 10 | 4 |
| prostata | 44 | 42 | 9 | 8 | 10 | 8 |
| pulmao | 62 | 62 | 8 | 7 | 6 | 7 |
| rim | 27 | 27 | 8 | 7 | 8 | 6 |
| sarcomas | 33 | 33 | 3 | 4 | 5 | 3 |
| testiculo | 23 | 22 | 4 | 14 | 11 | 7 |
| tireoide | 19 | 19 | 3 | 4 | 3 | 3 |
| vias-biliares | 15 | 14 | 8 | 4 | 8 | 2 |
| **Total (29)** | **633** | **604** | **173** | **162** | **184** | **114** |

**Classificação das 184 pendências:**

| Classe | Quantidade | O que significa |
|---|---|---|
| DECISAO_CLINICA_DR_SILAS | 56 | Escolha clínica: faixa de dose, fonte divergente, critério de uso. Lista em `F1-CORPUS-DECISOES-PENDENTES.md` |
| SEM_FONTE_PUBLICA_APOS_BUSCA | 46 | A busca foi feita e registrada, mas não existe fonte pública com o dado |
| DEPENDE_MOTOR_CODIGO | 39 | O dado existe, mas só se resolve no código (ex.: calendário por componente, cenário sem procedimento SIGTAP) |
| ACENO_GERAL_FORA_ESCOPO_ONCO_CLINICA | 31 | Radioterapia ou hematologia, preservadas sem aprofundar |
| DEPENDE_BULA_ANVISA | 12 | Precisa de conferência humana no Bulário ANVISA |

Conflitos: são 114, cada um com a escolha mais segura registrada. Em **37** deles a escolha precisa de decisão médica (`decisaoNecessaria: true`).

Os 5 packs v1 do GLM continuam como histórico (`pack-<slug>-v1-glm`, `supersededBy`). O lote 1 do Mistral foi refeito do zero a partir da SBOC local, e os 4 erros graves dele estão corrigidos.

## Auditoria Codex (veredito independente) e correções aplicadas

O Codex conferiu 87 amostras de dose contra a SBOC ou a bula: **84 confirmadas e 3 contestadas**. Ele confirmou os 9 grupos de erro da SBOC e as 6 divergências de fichas, e listou os bloqueios abaixo. Todos foram tratados:

| Achado | Correção |
|---|---|
| A01 · Bleomicina do ABVD sem /m² | Unidade passou a `UI/m2` no ABVD e no BEACOPP |
| A02 · "mFOLFOX6 ou FOLFIRI + panitumumabe" registrado só com o anticorpo | Dividido em 2 protocolos completos, com o doublet copiado dos protocolos-base do mesmo pack |
| A03 · Calendários não executáveis (FLOT + durvalumabe, cisplatina D1/D22/D43, titulação do VTD) | Calendário por componente (`intervaloDias`), fases explícitas, `titulacao` estruturada e `calendarioExecutavel: false` |
| A04 · Nivolumabe + ipilimumabe no esôfago com conflito declarado mas marcado VERIFICADO | `fonte.estado: CONFLITANTE`, `doseVerificada: false` |
| A05 · Pola-R-CHP sem C7–C8, AP do osteossarcoma, zoledrônico em 24 ciclos | Fases e condições explícitas; zoledrônico com duração clínica |
| A06 · Mitotano com dose só do curso | Mantido INFERIDO, como decisão clínica |
| Cenários misturados | 11 protocolos divididos por cenário: CCP ×3, sarcomas de partes moles ×3, reto anti-PD-1, PCV, BEP e VeIP germinativos, EGFR ex20ins × pós-osimertinibe. Os de hematologia ficaram como aceno |
| Faturamento molecular | 37 vínculos rebaixados a `catalogoIdCandidato` com `FATURAMENTO_NAO_DEMONSTRADO`. HPV de orofaringe deixou de usar o código de rastreamento do colo. Mieloma usa o código FISH_MIELOMA |
| "124 com fonte de bula" e "531 verificados" | Descrição corrigida neste documento |

## Alertas ao Dr. Silas

**Erros nas diretrizes SBOC.** Todos foram confirmados pelo Codex na página citada. Em todos, o pack ficou com a opção segura:
1. **Vias biliares, p.19:** capecitabina "2.500 mg/m² 12/12h", o dobro da bula. A dose ficou null.
2. **Vias biliares, p.19:** larotrectinibe "100 mg/m²", dose pediátrica. O pack usa a dose adulta, 100 mg 12/12 h.
3. **GIST:** imatinibe "800 mg 1x/dia"; a bula manda 400 mg de 12/12 h. A tabela de risco do GIST está inconsistente e o HR 0,08 não está publicado.
4. **Partes moles, p.13:** trabectedina "1,5 g/m²"; a bula traz 1,5 mg/m².
5. **Ovário germinativo, p.10:** dactinomicina do VAC "300 mg/m²", provável erro de unidade. O esquema ficou excluído.
6. **Calendários incoerentes:** esôfago p.20, gástrico p.8, partes moles p.13.
7. **FOLFOXIRI:** bolus que o esquema primário não tem. Infusão de 46 h no pack × 48 h no protocolo publicado.
8. **Rádio-223:** 50 na SBOC × 55 kBq/kg na bula. É mudança de padronização NIST, não aumento de dose.
9. **Pulmão:** pemetrexede grafado "500 mg", o certo é mg/m²; amivantamabe "a cada 3 ciclos", o certo é a cada 3 semanas.
10. **Próstata:** a SBOC imprime "Gleason > 8"; o LATITUDE usa ≥ 8.
11. As SBOC de colo, endométrio e ovário são versão para colaboração.

**Fichas do serviço divergentes da SBOC.** Algumas são escolhas institucionais já registradas; nenhuma foi alterada:
- **mFOLFOX6 e FOLFIRI sem bolus:** omissão deliberada, registrada em D-W9-50 e D-W9-23a.
- **FLOT 2.400 mg/m² em 46 h:** escolha médica local, registrada em D-W9-59.
- **Irinotecano no esôfago:** 350 mg/m² a cada 21 dias na ficha, 150 mg/m² a cada 14 dias na SBOC.
- **Irinotecano no gástrico:** 180 mg/m² a cada 14 dias, atribuído ao SOnHe em D-W9-50.
- **mDCF:** variante institucional.
- **Ifosfamida no colo:** ciclo de 21 dias na ficha, 28 dias na SBOC.

Os packs separam três situações: referência SBOC, variante institucional aprovada e divergência ainda não resolvida.

**Status SUS que mudou ou importa** (portaria conferida):
- **Incorporados:** lenalidomida na manutenção (SCTIE 26/2026), carfilzomibe (SECTICS 65/2023), sunitinibe no GIST (69/2025), abiraterona, iCDK4/6 (73/2021) e abemaciclibe adjuvante (88/2025).
- **Não incorporados:** cetuximabe, pembrolizumabe e nivolumabe em CCP R/M (41/2024 e 37/2024); lenvatinibe e sorafenibe na tireoide (42/2024).
- **Em consulta pública com recomendação desfavorável:** pembrolizumabe no triplo-negativo (CP 39) e no colo (CP 37), ribociclibe adjuvante (CP 61).
- **Drogas que nunca foram avaliadas pela CONITEC:** marcadas "não", INFERIDO. É interpretação, não decisão publicada; o serviço pode usá-las dentro do valor da APAC.

## O que continua aberto

- **94 itens para decisão do Dr. Silas:** 37 conflitos e 57 pendências clínicas ou de bula ANVISA, listados em `docs/ondas/F1-CORPUS-DECISOES-PENDENTES.md`.
- **Motor (D-F1-07/11):** carregar as pastas `1-` a `8-`, avaliar a prescrição proposta e reabrir a avaliação quando um fato muda. Isso é código, fora desta entrega. O Codex listou os 8 requisitos no veredito, seção 6.
- **`docs/DECISOES.md`:** tem D-F1-08 a D-F1-14 de outro autor, sem commit. Não entrou neste commit.

## Como promover um item a VERIFICADO

1. Ler o item na página do tema (consultável, marcado "não curado").
2. Conferir a fonte citada (página SBOC ou bula ANVISA).
3. Gravar `status: VERIFICADO` e `curadoria.aprovacaoClinica = {por, data}`. Os campos `fonte.estado` e `doseVerificada` não substituem a aprovação clínica.
4. O alerta automático liga depois, item a item (D-F1-05).

Ordem recomendada pelo Codex:
1. fundação (cenários, calendários, vínculos);
2. exames por cenário;
3. laudos, encaminhamentos e orientações;
4. receitas de suporte;
5. interações, contraindicações e CTCAE-ação;
6. protocolos completos.
