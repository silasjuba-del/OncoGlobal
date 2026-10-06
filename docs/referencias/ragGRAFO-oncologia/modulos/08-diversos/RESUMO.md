# Módulo 8: Tumores Diversos (PRO 2026, aulas 72 a 79 e 96)

Extração feita conforme `oncologia/ESQUEMA.md`. **Todos os nós estão com status `NAO_VERIFICADO`**, porque são resumo de aula e não evidência primária. Os PDFs não foram copiados.

- **Fonte:** 9 PDFs, extraídos com `pdftotext -layout`. Os slides de melanoma em imagem foram lidos com Read (pages): aula 72 p.25-27 e 30-31, aula 73 p.16-18. Tabelas ambíguas (GIST, osteossarcoma, Kaposi) foram conferidas com `-layout` por página.
- **Contagem:** 326 nós (11 tumores, 37 cenários, 15 diagnósticos, 12 estadiamentos, 11 biomarcadores, 79 regimes, 56 fármacos, 96 trials, 9 fontes) e 813 arestas.
- **Validação:** passou. O JSON é válido, os ids são únicos e seguem os prefixos, todas as arestas resolvem, todo nó tem página válida e aresta `FONTE`, e não há nó órfão.
- **Desvio de esquema:** igual ao do módulo 7. O resultado do trial fica em `status_estudo`, porque `status` é sempre `NAO_VERIFICADO`.

## Cobertura
| Tumor | Cenários | Destaques |
|---|---|---|
| Melanoma cutâneo (aulas 72-73) | localizado; adjuvante; neoadjuvante; M1 1ª linha; pós-progressão; metástase cerebral | ABCDE, laudo, AJCC 8, BRAF V600. MSLT-I/II. Adjuvância: CM-238, KN-054, S1404, COMBI-AD, KN-716, CM-76K. Neoadjuvância: NADINA, S1801. Doença avançada: CM-067 (10 anos), RELATIVITY-047, CM-204, COMBI-d/v, coBRIM, COLUMBUS, COMBI-MD. Manejo de irAE |
| Melanoma uveal (aula 72) | localizado; metastático | HLA-A*02:01 e tebentafuspe (SG em 1 ano 73% vs 59%); ipi + nivo se HLA negativo |
| CBC, CEC e Merkel (aula 74) | localizado e avançado para cada um; quimioprevenção | Vismodegibe (STEVIE), cemiplimabe (CBC 2ª linha e EMPOWER-CSCC-1), KN-629, nicotinamida, avelumabe (JAVELIN Merkel 200) |
| Gliomas (aulas 75-76) | GBM IDH-selvagem; astrocitoma grau 3; oligodendroglioma grau 3; grau 2; recorrência | OMS 2021, IDH, 1p/19q, MGMT, CDKN2A/B, H3K27M, BRAF/NTRK. Stupp, Perry, NOA-08, EF-14 (TTF), CATNON, EORTC 26951/RTOG 9402, NOA-04, EORTC 22845, RTOG 9802, INDIGO (vorasidenibe), BELOB, EORTC 26101 |
| GIST (aula 77) | adjuvante; neoadjuvante; 1ª linha; pós-imatinibe | KIT/PDGFRA, risco AFIP/NIH. Z9001, SSG XVIII, IMADGIST, B2222, EORTC 62005, MetaGIST, sunitinibe, GRID, RIGHT, INVICTUS, INTRIGUE, NAVIGATOR (D842V) |
| Sarcoma de partes moles (aula 78) | perioperatório; retroperitônio; 1ª linha; linhas subsequentes | FNCLCC, Sarculator. SMAC, Frustaci, ISG-STS 1001, GeDDiS, LMS-04, PALETTE, eribulina, atezolizumabe no ASPS, ANGIOTAX, STRASS, SARC028/TLS |
| Osteossarcoma e Ewing (aula 79) | osteossarcoma localizado, metastático de novo e recidivado; Ewing localizado, metastático e recorrente | Huvos, MAP, EURAMOS-1, INT-0133, REGOBONE. EWSR1-FLI1, INT-0091, AEWS0031, Euro Ewing 2012 |
| Sarcoma de Kaposi (aula 96) | baixo volume; HIV; alto volume | LANA1, TARV, doxorrubicina lipossomal, paclitaxel, pomalidomida e imunoterapia (TRO 40-87%) |

**Temas sem aula neste módulo:** tireoide, NET e CUP não constam nos PDFs, por isso não foram incluídos. O CSV de desfechos cobre apenas GI/GU, então não houve comparação para este módulo.

## Ressalvas de leitura (registradas em `obs` ou no próprio texto)
- **CM-067:** as medianas de SG (71,9 / 36,9 / 19,9 m) foram lidas do gráfico do slide.
- **SSG XVIII:** a SG 5 anos de "92% vs 87,1%" é leitura de um layout ambíguo do slide.
- **REGOBONE:** o slide diz "mSLP 16,4 meses", o que provavelmente significa semanas.
- **Ilegíveis:** CheckMate 066, KEYNOTE-006, KEYNOTE-629, SECOMBIT/DREAMseq, EORTC 26951/RTOG 9402, CODEL e NADINA estão como imagem ou só com o desenho do estudo. Por isso não têm resultado numérico.
- **Estadiamentos em imagem:** AJCC de melanoma, uveal e Merkel aparecem só como referência, sem a tabela transcrita.
