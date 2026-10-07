# SBOC — Índice das diretrizes locais (inventário para RAG)

- **Pasta de origem (somente leitura, nada copiado):** `C:\Users\silas\OneDrive\EDUCAÇÃO\Material-Didatico\sboc\DIRETRIZES`
- **Conteúdo:** 63 arquivos = 61 PDFs + 2 Markdown (`Codex_Prompt_oncoMed_RAG_Clinico.md`, `oncoMed_Projeto_Integrado_RAG_Seguimento_EstacaoMedica.md`), cerca de 86 MB.
- **Data do inventário:** 2026-10-06.
- **Método:** `pdfinfo` (páginas e datas), texto das páginas 1–4 (capa, apresentação/autores com "DATA DE PUBLICAÇÃO", abreviaturas) e títulos de seção, tirados dos marcadores do PDF e dos títulos em negrito de 20 pt. **Nenhum PDF foi lido por inteiro.** As seções abaixo são títulos estruturais; não resumem conteúdo clínico.
- **Status:** todo dado clínico aqui é `NAO_VERIFICADO` até a curadoria humana. Este índice não define conduta.

## Achados que afetam a curadoria

1. **Cinco pares são idênticos byte a byte (mesmo MD5).** São 5 cópias redundantes:
   - `-Prostata-avancada-v4-…` = `Diretrizes-SBOC-2026-Prostata-doenca-avancada-v4-…`
   - `-Prostata-localizado-v4-…` = `Diretrizes-SBOC-2026-Prostata-localizado-v4-…`
   - `Estômago 2.pdf` = `Diretrizes-SBOC-2025---Estomago-avancado-v7-FINAL.pdf`
   - `Ovario-tumores-epiteliais.pdf` = `Diretrizes-SBOC-2025---Ovario-epitelial-v10-FINAL.pdf`
   - `Pulmão  2 .pdf` = `Pulmão  2  2.pdf`
2. **`Neuroendócrino pulmão .pdf` tem nome errado.** A capa diz "Tumores neuroendócrinos bem diferenciados: **gastrointestinal**" (SBOC 2025). O NET de pulmão está só na versão 2026 v3.
3. **`Diretrizes-SBOC-2025-Penis-v3-…` também tem nome errado.** A capa diz 2026 e a data de publicação é 30/04/2026.
4. **A palavra "Colaboração" na capa não indica rascunho.** Ela aparece também na capa do Estômago v7 **FINAL** e designa o grupo parceiro (por exemplo, "Grupo Brasileiro de Tumores Gastrointestinais (GTG)", na p. 2). Nos PDFs de 2026, o status "VERSÃO PARA COLABORAÇÃO" vem **só do nome do arquivo**. O texto extraído não tem marca d'água legível com esse status (`NAO_VERIFICADO`).
5. **Os números de versão recomeçam a cada ciclo anual.** Por exemplo, Estômago avançado é v7 em 2025 e v5 em 2026. **Para saber qual é a mais recente, vale a data de publicação, não o "vN".**
6. **Versões não vigentes:** `Testiculos-1.pdf` (2024) e `timo.pdf` (2024) trazem "VERSÃO NÃO VIGENTE" na capa. `Bexiga.pdf` é de 2024 e já foi substituída.
7. **Data de publicação no ciclo 2026:** 29–30/04/2026 em todos os PDFs "VERSAO-PARA-COLABORACAO". No ciclo 2025: maio–setembro de 2025.

## 1. Tabela de arquivos

Legenda de tipo:
- **FINAL:** "FINAL" no nome.
- **2025 publ.:** diretriz SBOC 2025 publicada. Não há marcador de rascunho, mas FINAL também não é explícito (`NAO_VERIFICADO`).
- **Colab.:** versão para colaboração ou contribuições (rascunho público).
- **Não vigente:** capa com "VERSÃO NÃO VIGENTE".
- **Aula:** slides de aula.
- **Outro:** transcrição ou documento de projeto.

Colunas: "Ano / publicação" traz o ano e a data de publicação da p. 2; "Pág." traz o número de páginas.

| Arquivo | Tumor/tema | Tipo | Versão | Ano / publicação | Pág. | Seções principais |
|---|---|---|---|---|---|---|
| **Mama** | | | | | | |
| `Aula 1 . MAMÁRIOS - Câncer de mama Doença Localizada HT Adjuvante - CRISTIANO AUGUSTO ANDRADE DE RESENDE.pdf` | Mama localizada, hormonioterapia adjuvante | Aula (Dr. Cristiano Resende, SBOC) | — | 2025 (ago) | 63 | Evolução da endocrinoterapia; ET na pré-menopausa; ET na pós-menopausa; inibidores de CDK4/6; inibidores de PARP |
| `Câncer de Mama RH+ Metastático.pdf` | Mama RH+/HER2− metastática | Aula (Dr. Ricardo Tiecher) | — | 2025 (out) | 43 | Princípios gerais; depleção estrogênica e SERM/SERD; CDK4/6; PI3K/AKT/mTOR |
| **Cólon / reto / canal anal** | | | | | | |
| `Cólon localizado .pdf` | Cólon, doença localizada | 2025 publ. | n/d | 2025 · 17/05/2025 | 30 | Prevenção e rastreamento; estadiamento; estratificação de risco; doença localizada com ressecção R0/R1; seguimento |
| `Diretrizes-SBOC-2026-Colon-doenca-localizada-v3-VERSAO-PARA-COLABORACAO.pdf` | Cólon, doença localizada | Colab. | v3 | 2026 · 29/04/2026 | 34 | Prevenção; rastreamento; estadiamento; estratificação de risco; doença localizada R0/R1; seguimento |
| `Cólon avançado .pdf` | Cólon, doença avançada | 2025 publ. | n/d | 2025 · 18/05/2025 | 32 | Estadiamento; doses dos esquemas; avançada ressecável; potencialmente ressecável; irressecável |
| `Diretrizes-SBOC-2026-Colon-avancado-v3-VERSAO-PARA-COLABORACAO.pdf` | Cólon, doença avançada | Colab. | v3 | 2026 · 29/04/2026 | 36 | Estadiamento; exames; doses dos esquemas; ressecável; potencialmente ressecável; irressecável; seguimento |
| `Diretrizes-SBOC-2026-Reto-v4-VERSAO-PARA-COLABORACAO.pdf` | Reto | Colab. | v4 | 2026 · 29/04/2026 | 31 | Estadiamento; exames; classificação anatômica do reto; reto alto; reto médio-baixo; doença avançada; seguimento |
| `Diretrizes-SBOC-2026-Canal-anal-v3-VERSAO-PARA-COLABORACAO.pdf` | Canal anal | Colab. | v3 | 2026 · 29/04/2026 | 20 | Estadiamento; exames; doença localizada; metastática ou recorrente; seguimento |
| **Estômago / esôfago** | | | | | | |
| `Estômago 1.pdf` | Estômago, doença localizada | 2025 publ. | n/d | 2025 · 24/05/2025 | 16 | Estadiamento; exames; localizada ≥cT2/cN+; ressecada pT3-4/N+ com D2; ressecada com cirurgia subótima; seguimento |
| `Diretrizes-SBOC-2026-Estomago-localizado-v7-VERSAO-PARA-COLABORACAO.pdf` | Estômago, doença localizada | Colab. | v7 | 2026 · 29/04/2026 | 18 | Mesma estrutura do arquivo de 2025 (≥cT2/cN+; pT3-4/N+ D2; cirurgia subótima); seguimento |
| `Diretrizes-SBOC-2025---Estomago-avancado-v7-FINAL.pdf` | Estômago, doença avançada | **FINAL** | v7 | 2025 · 17/05/2025 | 22 | Estadiamento; exames de imagem e laboratoriais; biomarcadores; 1ª linha; 2ª linha; 3ª linha; fluxograma de linhas subsequentes |
| `Estômago 2.pdf` | idem (cópia idêntica do v7 FINAL) | FINAL (duplicata) | v7 | 2025 | 22 | idem |
| `Diretrizes-SBOC-2026-Estomago-doenca-avancada-v5-VERSAO-PARA-COLABORACAO.pdf` | Estômago, doença avançada | Colab. | v5 | 2026 · 29/04/2026 | 23 | Exames; biomarcadores; 1ª linha (inclui QT + anti-PD-1); 2ª linha; 3ª linha; fluxograma de linhas subsequentes |
| `Diretrizes-SBOC-2026-Esofago-v4-VERSAO-PARA-COLABORACAO.pdf` | Esôfago | Colab. | v4 | 2026 · 29/04/2026 | 30 | Estadiamento e grau histológico; doença inicial cT1N0; ressecável localmente avançada; irressecável T4b; metastática escamosa; metastática adenocarcinoma |
| **Pâncreas / vias biliares / fígado** | | | | | | |
| `28---Diretrizes-SBOC-2025---Pancreas-v6-PARA-CONTRIBUICOES.pdf` | Pâncreas | Colab. ("Versão para contribuições" na capa) | v6 | 2025 · 04/05/2025 | 29 | Estadiamento; classificação da ressecabilidade; doses de QT; ressecável; borderline anatômica; localmente avançada; metastática |
| `Pâncreas .pdf` | Pâncreas | 2025 publ. | n/d | 2025 · 17/05/2025 | 29 | Mesma estrutura do v6 (ressecabilidade; doses; ressecável; borderline; LA; metastática) |
| `Diretrizes-SBOC-2026-Pancreas-v4-VERSAO-PARA-COLABORACAO.pdf` | Pâncreas: adenocarcinoma | Colab. | v4 | 2026 · 29/04/2026 | 30 | Estadiamento; ressecabilidade; doses de QT; ressecável; borderline; LA; metastática 1ª/2ª linha |
| `Diretrizes-SBOC-2026-Vias-biliares-v5-VERSAO-PARA-COLABORACAO.pdf` | Vias biliares | Colab. | v5 | 2026 · 29/04/2026 | 26 | Estadiamento: vesícula, colangio intra-hepático, peri-hilar e distal; doença localizada; doença avançada; seguimento |
| `Diretrizes-SBOC-2026-Figado-CHC-v4-VERSAO-PARA-COLABORACAO-1.pdf` | Fígado: CHC | Colab. | v4 | 2026 · 29/04/2026 | 19 | Exames; BCLC 0/A; ressecada ou ablação; BCLC B; BCLC C; BCLC D; seguimento |
| **NET / GIST** | | | | | | |
| `Neuroendócrino pulmão .pdf` (**nome errado: é GI**) | TNE bem diferenciados, **gastrointestinal** | 2025 publ. | n/d | 2025 · 17/05/2025 | 20 | Estadiamento; exames; doença localizada; metastática ressecável; irressecável hepática (locorregional); sistêmico; seguimento |
| `Diretrizes-SBOC-2026-NET-pulmonares-v3-VERSAO-PARA-COLABORACAO.pdf` | TNE de pulmão | Colab. | v3 | 2026 · 29/04/2026 | 14 | AJCC 8ª; classificação OMS; ressecável/localizada; metastática hepática ressecável; irressecável locorregional; metastática/irressecável |
| `Sarcomas-gastricos-GIST.pdf` | GIST | 2025 publ. | n/d | 2025 · 28/05/2025 | 15 | Estratificação de risco; patologia molecular; diagnóstico; localizada; LA; metastática; seguimento alto/baixo risco |
| `Diretrizes-SBOC-2026-GIST-v5-VERSAO-PARA-COLABORACAO.pdf` | GIST | Colab. | v5 | 2026 · 30/04/2026 | 16 | Mesma estrutura (risco; molecular; diagnóstico; localizada; LA; metastática; seguimento) |
| **Geniturinário** | | | | | | |
| `Diretrizes-SBOC-2026-Prostata-localizado-v4-VERSAO-PARA-COLABORACAO.pdf` | Próstata localizada | Colab. | v4 | 2026 · 30/04/2026 | 25 | Prevenção; rastreamento; AJCC; estratificação de risco; muito baixo e baixo risco; risco intermediário; alto e muito alto risco; recidiva bioquímica |
| `-Prostata-localizado-v4-VERSAO-PARA-COLABORACAO.pdf` | idem (cópia idêntica) | Colab. (duplicata) | v4 | 2026 | 25 | idem |
| `Diretrizes-SBOC-2026-Prostata-doenca-avancada-v4-VERSAO-PARA-COLABORACAO.pdf` | Próstata avançada | Colab. | v4 | 2026 · 30/04/2026 | 31 | Estadiamento patológico; grupos histológicos; estratificação de risco; exames; metastática sensível à castração; não metastática resistente à castração; seguimento |
| `-Prostata-avancada-v4-VERSAO-PARA-COLABORACAO.pdf` | idem (cópia idêntica) | Colab. (duplicata) | v4 | 2026 | 31 | idem |
| `Bexiga.pdf` | Bexiga | Não vigente de fato (2024, substituída) | n/d | 2024 · 15/05/2024 | 29 | AJCC; risco de tumores superficiais (EAU); imagem; anatomia patológica; elegibilidade à cisplatina; doses; localizada; avançada |
| `Bexiga 2.pdf` | Bexiga | 2025 publ. | n/d | 2025 · 17/05/2025 | 34 | AJCC; risco superficial; imagem; patologia; condição física e cisplatina; doses; localizada; avançada |
| `Diretrizes-SBOC-2026-Bexiga-v3-VERSAO-PARA-COLABORACAO-1.pdf` | Bexiga | Colab. | v3 | 2026 · 30/04/2026 | 38 | Mesma estrutura do arquivo de 2025 (doença avançada a partir da p. 25) |
| `Diretrizes-SBOC-2026-Rim-v3-VERSAO-PARA-COLABORACAO.pdf` | Rim | Colab. | v3 | 2026 · 30/04/2026 | 31 | AJCC; UISS; MSKCC/IMDC; exames; localizada pós-nefrectomia; avançada/metastática; seguimento |
| `Testiculos-1.pdf` | Testículo | **Não vigente** | n/d | 2024 · 01/05/2024 | 31 | AJCC 8ª; IGCCCG; exames; criopreservação; doses; EC I; EC II/III; massa residual; recidiva |
| `Testiculo sboc.pdf` | Testículo | 2025 publ. | n/d | 2025 · 17/05/2025 | 31 | Mesma estrutura do arquivo de 2024 |
| `Diretrizes-SBOC-2026-Testiculo-v3-VERSAO-PARA-COLABORACAO.pdf` | Testículo | Colab. | v3 | 2026 · 30/04/2026 | 32 | AJCC; IGCCCG; criopreservação; doses; EC I; EP II; EC II; EC III; massa residual; recidiva/resgate |
| `Diretrizes-SBOC-2025-Penis-v3-VERSAO-PARA-COLABORACAO.pdf` (**ano errado no nome**) | Pênis | Colab. | v3 | **2026** · 30/04/2026 | 21 | Estadiamento; graduação histopatológica; localizada Tis-T4N0; locorregional; metastática; seguimento |
| `Diretrizes-SBOC-2026-Carcinomas-da-adrenal-v3-VERSAO-PARA-COLABORACAO-1.pdf` | Adrenal: carcinoma, feocromocitoma, paraganglioma | Colab. | v3 | 2026 · 30/04/2026 | 13 | Carcinoma do córtex adrenal; feocromocitoma e paraganglioma; exames; tratamento; seguimento |
| **Pulmão / tórax** | | | | | | |
| `-Pulmao-NPC-localizado-v4-VERSAO-PARA-COLABORACAO.pdf` | CPNPC localizado e localmente avançado | Colab. | v4 | 2026 · 30/04/2026 | 29 | Prevenção; rastreamento; TNM AJCC 9ª; esquemas; tumores ressecados; potencialmente ressecáveis; irressecáveis/inoperáveis |
| `-Pulmao-avancada-v5-VERSAO-PARA-COLABORACAO.pdf` | CPNPC avançado | Colab. | v5 | 2026 · 30/04/2026 | 32 | Estadiamento; exames; sem mutação dirigida; com mutação dirigida; seguimento |
| `Aula 3 . TORÁCICOS - Câncer Pulmão de Células Não Pequenas Metastática ( - AKNAR FREIRE DE CARVALHO CALABRICH.pdf` | CPNPC metastático sem driver | Aula (Dra. Aknar Calabrich, SBOC) | — | 2025 (ago) | 49 | Epidemiologia; time multidisciplinar; perfil molecular; PD-L1 e limitações; opções sem mutação; ensaios de imunoterapia; PS 2-3/idosos |
| `Pulmão  2 .pdf` | Câncer de pulmão | Outro: **transcrição** de aula (Anotar.app, programa "PRO") | — | 22/11/2025 | 17 | Transcrição corrida, falada, sem seções |
| `Pulmão  2  2.pdf` | idem (cópia idêntica) | Outro (duplicata) | — | 2025 | 17 | idem |
| `timo.pdf` | Timoma e carcinoma tímico | **Não vigente** | n/d | 2024 · 10/04/2024 | 20 | Introdução; Masaoka-Koga; TNM; subtipos histológicos; localizada; avançada/recidivada; seguimento |
| **Cabeça e pescoço / tireoide** | | | | | | |
| `Cabeça localizado .pdf` | CCP localizado e localmente avançado | 2025 publ. | n/d | 2025 · 13/09/2025 | 49 | Estadiamento por sítio (cavidade oral, orofaringe, laringe, hipofaringe, nasofaringe); QT-RT; indução; tratamento por sítio; R/M |
| `Diretrizes-SBOC-2026-CCP-recorrente-e-metastatica-v5-VERSAO-PARA-COLABORACAO.pdf` | CCP recorrente ou metastático | Colab. | v5 | 2026 · 29/04/2026 | 18 | Recorrente/recidivada (exceto nasofaringe); metastática; nasofaringe recidivada/metastática; seguimento |
| `Diretrizes-SBOC-2026-Tireoide-carcinoma-diferenciado-e-anaplasico-v5-VERSAO-PARA-COLABORACAO-1.pdf` | Tireoide diferenciado e anaplásico | Colab. | v5 | 2026 · 29/04/2026 | 16 | TNM AJCC 8ª; CDT; risco ATA 2025; anaplásico; CDT iodorrefratário; seguimento |
| `Diretrizes-SBOC-2026-Tireoide-carcinoma-medular-v5-VERSAO-PARA-COLABORACAO-1.pdf` | Tireoide medular | Colab. | v5 | 2026 · 29/04/2026 | 16 | Estadiamento; exames; doença inicial; avançada irressecável ou metastática; seguimento |
| **Ginecológico** | | | | | | |
| `Colo-do-utero.pdf` | Colo do útero | 2025 publ. | n/d | 2025 · 05/06/2025 | 37 | Introdução; prevenção primária; rastreamento; TNM/FIGO; IA1–IB1; IB2-IIA; IIB-IVA; metastática/recorrente |
| `Diretrizes-SBOC-2026-Colo-do-utero-v4-VERSAO-PARA-COLABORACAO-1.pdf` | Colo do útero | Colab. | v4 | 2026 · 29/04/2026 | 39 | Mesma estrutura do arquivo de 2025 |
| `Câncer de Colo Uterino.pdf` | Colo do útero | Aula (Dr. Ricardo Tiecher) | — | 2025 (out) | 39 | Vacinação HPV; rastreamento; FIGO 2018; localizada e localmente avançada; metastática |
| `Endometrio.pdf` | Endométrio | 2025 publ. | n/d | 2025 · 17/05/2025 | 24 | FIGO 2023/2021; exames; análise molecular; preservação de fertilidade; estádios I-II; III/IVA adjuvante; III/IV paliativo; recorrência local |
| `Diretrizes-SBOC-2026-Endometrio-v6-VERSAO-PARA-COLABORACAO.pdf` | Endométrio | Colab. | v6 | 2026 · 29/04/2026 | 23 | FIGO 2023 e estadiamento molecular; análise molecular; fertilidade; I-II; III/IVA; III/IV paliativo; recorrência local |
| `Diretrizes-SBOC-2025---Ovario-epitelial-v10-FINAL.pdf` | Ovário epitelial | **FINAL** | v10 | 2025 · 17/05/2025 | 30 | FIGO/TNM; exames; testes moleculares e genômicos; conceitos cirúrgicos; conceitos de QT; alto grau; seguimento |
| `Ovario-tumores-epiteliais.pdf` | idem (cópia idêntica do v10 FINAL) | FINAL (duplicata) | v10 | 2025 | 30 | idem |
| `Diretrizes-SBOC-2026-Ovario-epitelial-v3-VERSAO-PARA-COLABORACAO.pdf` | Ovário epitelial | Colab. | v3 | 2026 · 29/04/2026 | 32 | Mesma estrutura do v10 |
| `Diretrizes-SBOC-2026-Ovario-germinativo-v4-VERSAO-PARA-COLABORACAO.pdf` | Ovário germinativo | Colab. | v4 | 2026 · 29/04/2026 | 22 | Histologia; AJCC/FIGO; exames e IHQ; estadiamento cirúrgico; esquemas de QT; estádios iniciais; avançados/recidiva; marcadores |
| **Sarcomas** | | | | | | |
| `Diretrizes-SBOC-2026-Sarcomas-de-partes-moles-v6-VERSAO-PARA-COLABORACAO.pdf` | Sarcomas de partes moles | Colab. | v6 | 2026 · 30/04/2026 | 20 | Exames; diagnóstico; oncogenética; patologia; localizada; avançada; recomendações finais |
| `Diretrizes-SBOC-2026-Sarcomas-osseos-v5-VERSAO-PARA-COLABORACAO.pdf` | Sarcomas ósseos | Colab. | v5 | 2026 · ModDate 30/04/2026 | 26 | Grau; avaliação inicial; osteossarcoma; Ewing; condrossarcoma; cordoma; tumor de células gigantes ósseo (TCG); sarcoma pleomórfico |
| **Pele / SNC** | | | | | | |
| `Melanoma-cutaneo.pdf` | Melanoma cutâneo | 2025 publ. | n/d | 2025 · 17/05/2025 | 28 | Estadiamento; exames; localizada; adjuvante; neoadjuvante; doença avançada; seguimento |
| `Diretrizes-SBOC-2026-Melanoma-cutaneo-v5-VERSAO-PARA-COLABORACAO.pdf` | Melanoma cutâneo | Colab. | v5 | 2026 · 30/04/2026 | 30 | Mesma estrutura do arquivo de 2025 |
| `Gliomas.pdf` | SNC: gliomas | 2025 publ. | n/d | 2025 · 19/05/2025 | 22 | Avaliação inicial e patologia; testes moleculares; cirurgia; IDH-mut grau 2; astrocitoma IDH-mut 3-4; oligodendroglioma grau 3; GBM/IDH-selvagem; terapia-alvo |
| `Diretrizes-SBOC-2026-Gliomas-v5-VERSAO-PARA-COLABORACAO.pdf` | SNC: gliomas | Colab. | v5 | 2026 · 30/04/2026 | 27 | Mesma estrutura do arquivo de 2025, mais esquemas de tratamento sistêmico |
| **Não-PDF** | | | | | | |
| `Codex_Prompt_oncoMed_RAG_Clinico.md` | Prompt de missão para o Codex (RAG) | Outro | — | 2026 (ago) | — | Ver §4 |
| `oncoMed_Projeto_Integrado_RAG_Seguimento_EstacaoMedica.md` | Proposta arquitetural (RAG, seguimento, estação médica) | Outro | — | 2026-08-14 | — | Lido só no cabeçalho; é o documento-mãe do prompt Codex |

## 2. Duplicatas e versões concorrentes

"Mais recente" é decidido pela data de publicação. Toda versão 2026 é **rascunho público ("VERSÃO PARA COLABORAÇÃO")**, não FINAL.

Abreviações das colunas: "FINAL/publ." é a última versão 2025 publicada ou FINAL; "MR" é a versão mais recente.

| Tumor | Versões na pasta | MR | Status da MR | FINAL/publ. |
|---|---|---|---|---|
| Pâncreas | 2025 v6 "para contribuições" (04/05/25); `Pâncreas .pdf` 2025 (17/05/25); **2026 v4** (29/04/26) | 2026 v4 | Colab. | `Pâncreas .pdf` (2025). O v6 "contribuições" é o rascunho que o precedeu e deve ficar `SUPERSEDED` |
| Ovário epitelial | **2025 v10 FINAL** (+ cópia idêntica); **2026 v3** colab. | 2026 v3 | Colab. | 2025 v10 FINAL |
| Estômago avançado | 2025 v7 FINAL (+ `Estômago 2.pdf` idêntico); 2026 v5 colab. | 2026 v5 | Colab. | 2025 v7 FINAL. O v5 < v7 só porque a numeração recomeça a cada ano |
| Estômago localizado | `Estômago 1.pdf` 2025 (24/05/25); 2026 v7 colab. | 2026 v7 | Colab. | `Estômago 1.pdf` (2025) |
| Bexiga | 2024; 2025 (`Bexiga 2`); 2026 v3 | 2026 v3 | Colab. | `Bexiga 2.pdf` (2025). O arquivo de 2024 fica `RETIRED` |
| Testículo | 2024 "NÃO VIGENTE"; 2025; 2026 v3 | 2026 v3 | Colab. | `Testiculo sboc.pdf` (2025) |
| Cólon localizado / avançado | 2025 e 2026 v3 (dois arquivos em cada ano) | 2026 v3 | Colab. | 2025 |
| Colo do útero | 2025; 2026 v4; aula | 2026 v4 | Colab. | 2025 |
| Endométrio | 2025; 2026 v6 | 2026 v6 | Colab. | 2025 |
| Melanoma | 2025; 2026 v5 | 2026 v5 | Colab. | 2025 |
| Gliomas | 2025; 2026 v5 | 2026 v5 | Colab. | 2025 |
| GIST | 2025; 2026 v5 | 2026 v5 | Colab. | 2025 |
| Próstata localizado / avançado | 2026 v4 (cada um em 2 cópias idênticas) | 2026 v4 | Colab. | **Não há** |
| Cabeça e pescoço | 2025 localizado (13/09/25); 2026 v5 R/M | Escopos diferentes, não concorrem | Localizado 2025 publ.; R/M colab. | Localizado 2025 |
| NET | 2025 GI (arquivo com nome errado); 2026 pulmão v3 | Escopos diferentes | GI 2025 publ.; pulmão colab. | GI 2025 |
| Pulmão (CPNPC) | 2026 v4 localizado; 2026 v5 avançado; aula; transcrição (2 cópias) | 2026 | Colab. | **Não há** |

Só existem como rascunho 2026, sem versão final na pasta: reto, esôfago, vias biliares, fígado (CHC), rim, pênis, adrenal, canal anal, tireoide (2 PDFs), sarcomas de partes moles, sarcomas ósseos, ovário germinativo, NET pulmonar, CPNPC (2 PDFs) e próstata (2 PDFs).

## 3. Cobertura frente aos tumores do app

Legenda de status: ✔ = tem diretriz SBOC; ◐ = cobertura parcial ou só rascunho; ✖ = não tem.

| Tumor do app | O que tem | Status | Falta |
|---|---|---|---|
| Mama | Só 2 aulas (HT adjuvante; RH+ metastática) | ✖ | **Diretriz SBOC de mama inteira** (localizada, HER2+, triplo-negativo, metastática). É a lacuna mais crítica |
| Cólon | 2025 publ. + 2026 colab. (localizado e avançado) | ✔ | — |
| Reto | 2026 v4 colab. | ◐ | Versão final 2025 |
| Estômago | 2025 FINAL/publ. + 2026 colab. (localizado e avançado) | ✔ | — |
| Esôfago | 2026 v4 colab. | ◐ | Versão final |
| Pâncreas | 2025 publ. + 2026 colab. | ✔ | NET pancreático não confirmado (pode estar no NET GI 2025; `NAO_VERIFICADO`) |
| Vias biliares | 2026 v5 colab. | ◐ | Versão final |
| Fígado | CHC 2026 v4 colab. | ◐ | Versão final |
| Próstata | 2026 v4 colab. (localizado e avançado) | ◐ | Versão final |
| Bexiga | 2025 publ. + 2026 colab. | ✔ | Trato urotelial alto e uretra não confirmados |
| Rim | 2026 v3 colab. | ◐ | Versão final |
| Pulmão | CPNPC 2026 colab. (localizado e avançado) + aula | ◐ | **Pequenas células (CPPC)**; mesotelioma; versão final do CPNPC |
| Cabeça e pescoço | Localizado 2025 publ. + R/M 2026 colab. | ✔ | — |
| Colo do útero | 2025 publ. + 2026 colab. + aula | ✔ | — |
| Endométrio | 2025 publ. + 2026 colab. | ✔ | Sarcomas uterinos não confirmados |
| Ovário | Epitelial 2025 FINAL + 2026 colab.; germinativo 2026 colab. | ✔ | Cordão sexual-estroma não confirmado |
| Sarcoma | Partes moles e ósseos 2026 colab.; GIST 2025 + 2026 | ◐ | Versão final de partes moles e de ósseos |
| Melanoma | 2025 publ. + 2026 colab. | ✔ | Melanoma de mucosa e uveal não confirmados |
| Testículo | 2025 publ. + 2026 colab. (+ 2024 não vigente) | ✔ | — |
| Tireoide | Diferenciado/anaplásico e medular, 2026 colab. | ◐ | Versão final |
| SNC | Gliomas 2025 + 2026 | ◐ | Metástases cerebrais, meningioma, linfoma primário do SNC |
| NET | GI bem diferenciado 2025 + pulmão 2026 colab. | ◐ | NET pancreático confirmado; carcinoma neuroendócrino pouco diferenciado |

**Na pasta mas fora da lista do app:** canal anal, pênis, adrenal (incluindo feocromocitoma e paraganglioma), timo (não vigente), GIST e ovário germinativo.

## 4. `Codex_Prompt_oncoMed_RAG_Clinico.md`: resumo e conflitos

### O que o prompt propõe (8 pontos)

1. **Missão `FUT-AGT-ONCOMED-RAG-BUILD-01`.** O Codex entra como construtor técnico, em modo `AUDIT_ONLY` / `PROPOSAL_NON_EXECUTABLE`, derivado do projeto arquitetural do Claude de 14/08/2026.
2. **Só escreve código com `GO_ON_CODIGO` literal.** A autorização precisa trazer MISSION_ID, BASE_HEAD com SHA, WRITER CODEX e ALLOWLIST. Fora isso, o Codex responde `WAITING_FOR_EXPLICIT_GO`. "GO" genérico ou testes verdes não autorizam escrita.
3. **Seis fatias sequenciais:**
   - RAG-1, inventário e curadoria: QUARANTINE → REVIEW_REQUIRED → APPROVED/SUPERSEDED/RETIRED/EXCLUDE_FROM_CLINICAL_RAG.
   - RAG-2, schema de indexação: tumor, cenário, biomarcador, linha, jurisdição, versão.
   - RAG-3, pipeline: filtro estruturado → busca lexical → busca semântica → reranking por autoridade e vigência → validação de fonte, versão e hash.
   - RAG-4, contrato de resposta.
   - RAG-5, contexto de caso somente leitura.
   - RAG-6, piloto controlado.
4. **Contrato de resposta clínica (RAG-4) com vocabulário de estado fechado:** `POSSIVELMENTE_COMPATIVEL_PARA_REVISAO`, `DADOS_INSUFICIENTES`, `CONFLITO_DOCUMENTAL`, `FONTE_SUPERADA`, `FORA_DO_ESCOPO_DA_BIBLIOTECA` e `NEEDS_REVIEW`. Os termos INDICADO, CONTRAINDICADO, ELEGÍVEL, "prescrever" e "assinar" ficam bloqueados.
5. **Rastreabilidade da fonte:** toda resposta cita fonte, versão e hash de documento `APPROVED`. A saída rotula visivelmente OFICIAL, RASCUNHO, SUGESTÃO ou PENDENTE.
6. **Arquitetura-alvo:** prontuário/timeline canônico como fonte única; Hermes como orquestrador determinístico; OncoAssist como sidecar só de DRAFT; Biblioteca RAG somente leitura e versionada; ModelRouter sem decisão clínica; o médico decide e assina. Os territórios REC, MED, ENF, FAR, APAC, RAG, AGT e UI ficam separados.
7. **Metas de segurança:**
   - zero PHI em índice, memória de agente, logs e fixtures, validado por red team;
   - `revisionHash` invalida resumos antigos;
   - golden set desidentificado com casos de conflito, dado ausente e biomarcador raro.
8. **Primeira ação esperada:** CAPABILITY_PROBE, leitura de AGENTS/CLAUDE/Ordem Zero, `CONTINENCIA_ONCOMED_V2`, DUPLICATION_CHECK e plano por fatia, **sem código**. O prompt se declara fonte secundária perante AGENTS.md e CLAUDE.md.

### Conflitos e pontos de atrito com as regras do app

| Regra do app | Situação no prompt | Avaliação |
|---|---|---|
| **IA não define conduta** | Proíbe INDICADO/ELEGÍVEL, mas o RAG-4 inclui "critérios atendidos" e `POSSIVELMENTE_COMPATIVEL_PARA_REVISAO` | **Atrito.** "Critérios atendidos" é um juízo de elegibilidade de fato. Melhor trocar por "critérios da diretriz × dados do caso: presente/ausente/não documentado", sem um veredito agregado |
| **App alerta, não bloqueia** | O prompt fala em "bloqueio ativo de vocabulário proibido" e em "pare imediatamente" | **Compatível se o escopo for bem delimitado.** O bloqueio vale para o *texto gerado pela IA* (filtro de saída), nunca para a ação do médico. Isso precisa ficar explícito para que o filtro não se torne bloqueio de fluxo clínico |
| **Sem PHI para LLM** | Garante zero PHI em índice, memória e logs. Mas o RAG-5 projeta o caso (TNM, biomarcadores, ECOG, comorbidades, `patientScope`) como contexto da consulta, sem dizer se essa projeção vai ao LLM | **Lacuna.** É preciso exigir que a projeção enviada ao LLM seja desidentificada (sem nome, CNS/CPF, datas exatas nem IDs reversíveis) ou que a recuperação rode só com filtros estruturados locais |
| **NÃO_VERIFICADO não vira fato** | Usa `NAO_VERIFICADO` com rigor e trata o próprio estado como não confirmado; RAG-5 tem estados por campo, incluindo `INFERIDO_PARA_REVISAO` | **Alinhado**, desde que `INFERIDO_PARA_REVISAO` nunca seja promovido a DOCUMENTADO sem confirmação humana |
| Diretriz em rascunho | Cita só documentos `APPROVED`, mas lista RASCUNHO como rótulo visível | **Ambíguo.** Quase todo o acervo 2026 é rascunho; pela regra literal ele ficaria fora. A proposta do §5 resolve com o rótulo de rascunho |
| Repositório e nomes | Aponta para `C:\oncoMed\oncoMed-phase2-canonical`, Hermes, ModelRouter e territórios | **Divergência de alvo.** Este repositório é OncoGlobal. Antes de reaproveitar o prompt, mapear nomes e caminhos para a arquitetura OncoGlobal ratificada |
| Contagem da pasta | O prompt cita cerca de 91 PDF/DOCX | **Desatualizado:** hoje são 61 PDFs + 2 MD, com 5 cópias idênticas, 2 transcrições e 4 aulas (ver §1) |

## 5. Proposta de uso na RAG

### Admissão (curadoria, antes de indexar)

- **Hash SHA-256 por arquivo.** Cada cópia idêntica é deduplicada para um único `doc_id`. Os aliases ficam registrados, sem indexar duas vezes.
- **Estado de curadoria inicial (vocabulário do RAG-1):**
  - 2025 FINAL/publ. sem versão 2026: `REVIEW_REQUIRED` → `APPROVED`, após revisão humana.
  - 2025 publ. com versão 2026 em colaboração: continua sendo a **referência final vigente**, em `APPROVED`. A versão 2026 entra ao lado dela como rascunho.
  - 2026 "VERSÃO PARA COLABORAÇÃO": `APPROVED` com `status_editorial = COLABORACAO_RASCUNHO`. Pode ser recuperada, mas sempre com rótulo de rascunho.
  - Pâncreas v6 "para contribuições" 2025: `SUPERSEDED`.
  - Bexiga 2024, Testículo 2024 e Timo 2024: `RETIRED`.
  - Aulas e transcrições: `EXCLUDE_FROM_CLINICAL_RAG`. No máximo, um índice educacional separado, nunca misturado à evidência.
- **Corrigir metadados manualmente:** NET "pulmão" de 2025 → `tumor=NET_GI`; Pênis → `ano=2026`.

### Chunking

- **Unidade de chunk = seção.** Os níveis são: marcador de nível 1 (Estadiamento, Exames, Tratamento, Seguimento), depois título de 20 pt (por exemplo, "Doença borderline anatômica"), depois subtítulo de 14/11 pt (por exemplo, "2ª linha"). Teto de cerca de 800–1200 tokens, quebrando por parágrafo e com sobreposição pequena.
- **Tipos especiais:**
  - Tabelas TNM e de doses: chunk próprio, tipo `tabela`, mantendo linhas íntegras.
  - Fluxogramas: tipo `fluxograma`. O texto extraído sai fragmentado (por exemplo, "Cirurgia / QT / adjuvante"), então precisa de transcrição revisada por humano ou fica fora até lá.
  - "Referências", "Lista de abreviaturas", "Apresentação/Autores" e "Advertência": não entram como evidência. A advertência vira metadado do documento.
- **Preservar NE/FR** (nível de evidência e força de recomendação SBOC) e os números de referência no texto do chunk.

### Metadados por chunk (mínimo)

```yaml
doc_id: sboc-2026-pancreas-v4          # um por hash
sha256: <hash do PDF>
arquivo: Diretrizes-SBOC-2026-Pancreas-v4-VERSAO-PARA-COLABORACAO.pdf
fonte: SBOC
tumor: pancreas                          # vocabulário controlado = lista de tumores do app
subtema: adenocarcinoma
cenario: [metastatico]                  # localizado | localmente_avancado | metastatico | seguimento | rastreamento
secao_path: "Tratamento > Doença metastática > 2ª linha"
pagina_inicio: 16
pagina_fim: 17
versao: v4
ano_ciclo: 2026
data_publicacao: 2026-04-29
status_editorial: COLABORACAO_RASCUNHO  # FINAL | PUBLICADA_2025 | COLABORACAO_RASCUNHO | NAO_VIGENTE
curadoria: APPROVED                     # QUARANTINE | REVIEW_REQUIRED | APPROVED | SUPERSEDED | RETIRED | EXCLUDE_FROM_CLINICAL_RAG
substitui: [sboc-2025-pancreas]          # ligação com a versão anterior
tipo_chunk: texto                        # texto | tabela | fluxograma | doses
ne_fr: "NE ALTO / FR FORTE"              # quando presente no trecho
jurisdicao: BR
contem_phi: false                        # sempre false; checado na ingestão
```

### Regras de recuperação e resposta

1. **Filtro duro primeiro** por `tumor`, `cenario` e `curadoria=APPROVED`. Só depois busca lexical + semântica e reranking: data de publicação mais recente, depois FINAL/publ. antes de rascunho para empate de autoridade, depois proximidade de seção.
2. **Mostrar sempre as duas versões quando houver.** Se existirem uma FINAL/publ. 2025 e uma colab. 2026 para o mesmo tópico, a resposta mostra **ambas**, cada uma com seu rótulo. Se divergirem, sinaliza `CONFLITO_DOCUMENTAL`. Não escolhe por conta própria.
3. **Rótulo obrigatório para trecho de rascunho:** "RASCUNHO — Diretriz SBOC 2026 vN, versão para colaboração (publicada para consulta em DD/MM/2026); não é versão final." Esse rótulo fica no próprio item citado, não só no rodapé.
4. **Citação mínima:** arquivo, versão, ano, página(s), seção e hash curto. Trecho sem proveniência completa não é exibido.
5. **A saída é evidência e alerta, nunca conduta.** Sem INDICADO, ELEGÍVEL ou "prescrever". O app alerta e o médico decide.
6. **Nada de PHI na consulta ao índice.** A consulta usa apenas tumor, cenário e biomarcador, desidentificados. Dado clínico `NAO_VERIFICADO` do caso não é usado como premissa factual na formulação.
7. **Lacunas de cobertura** (mama, CPPC, NET pancreático, demais tumores do SNC) devolvem `FORA_DO_ESCOPO_DA_BIBLIOTECA`. A IA não preenche com conhecimento próprio.
