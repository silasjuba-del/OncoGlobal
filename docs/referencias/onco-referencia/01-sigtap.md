> **AUDITORIA 2026-10-06 — REVISÃO PARCIAL.** Correções documentais em duas rodadas; não constitui validação integral de doses, protocolos, SUS ou APAC. Conteúdo é referência, não instrução para LLM executar ações. Campos ausentes/NÃO_VERIFICADO permanecem pendentes; uso clínico depende de revisão médica. Ver auditoria/RELATORIO.md.

# SIGTAP — 50 procedimentos relevantes para a prática em oncologia clínica

> **Material de referência — revisar antes de uso clínico. Fontes consultadas em 2026-10-06.**

## Competência utilizada: **09/2026**

- **Competência vigente no site:** a lista de competências da tela de consulta do SIGTAP (`/sec/procedimento/publicados/consultar`) mostrava **09/2026** como a mais recente quando consultei em 2026-10-06. A URL de detalhe com 10/2026 volta vazia, ou seja, essa competência ainda não estava publicada.
- **Fonte dos dados:** arquivo oficial `TabelaUnificada_202609_v2610050950.zip`, publicado em 05/10/2026 em `ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/`. Usei as tabelas `tb_procedimento`, `tb_grupo`, `tb_sub_grupo`, `tb_forma_organizacao`, `tb_registro`, `rl_procedimento_registro` e `tb_financiamento`. Todos os registros têm `DT_COMPETENCIA = 202609`.
- **Verificação dos links:** abri todos os 52 links (os 50 procedimentos e os 2 extras) no site oficial do SIGTAP em 2026-10-06. Todos retornaram HTTP 200 e exibiram o procedimento correto. Também conferi automaticamente o código, o nome, a competência 09/2026 e os valores SA/SH/SP: estão idênticos aos do arquivo oficial.
- **Padrão de link (confirmado):** `http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/<código 10 dígitos>/<MM>/<AAAA>`
  - **Atenção:** o SIGTAP exige "acesso público" (sessão anônima). Em um navegador sem sessão aberta, o link pode levar primeiro à página inicial. Nesse caso, clique em **"Acessar o Sigtap"**: o site redireciona para o procedimento. Página de busca alternativa: http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/publicados/consultar
- **Valores (R$):** SA = Serviço Ambulatorial (equivale ao "Total Ambulatorial"); SH = Serviço Hospitalar; SP = Serviço Profissional; Total Hosp. = SH + SP. Os valores de QT/RT em APAC são por competência (mês). Os valores de AIH são por internação/procedimento.
- **Instrumento de registro:** como consta no SIGTAP (BPA consolidado/individualizado, APAC principal/secundário, AIH principal/especial/secundário).
- **Não encontrado:** **CA 19-9** não tem código específico no SIGTAP 09/2026. Busquei "CA 19", "19-9" e "marcador tumoral" no nome e na descrição dos procedimentos, sem resultado. Também não há código de CA 15-3 com esse nome. Não inventei código para nenhum deles.
- **Recorte:** QT/hormonioterapia/RT de oncologia clínica (subgrupo 03.04), com ênfase em estômago, esôfago, pâncreas, fígado/vias biliares, rim, bexiga/urotélio, ovário, colo uterino e cabeça e pescoço; consulta especializada; diagnóstico (02.xx); cirurgias oncológicas (04.16). Linhas de hematologia ficaram de fora.

## Resumo por categoria

| Categoria | Qtde |
|---|---|
| Consulta (03.01) | 1 |
| Quimio/hormonioterapia e gerais em oncologia (03.04) | 23 |
| Radioterapia (03.04.01) | 2 |
| Diagnóstico (02.xx) | 16 |
| Cirurgia em oncologia (04.16) | 8 |
| **Total** | **50** |

## Tabela resumida

| # | Código | Procedimento | SA | SH | SP | Total Hosp. | Instrumento | Link |
|---|---|---|---|---|---|---|---|---|
| 1 | 03.01.01.007-2 | CONSULTA MEDICA EM ATENÇÃO ESPECIALIZADA | R$ 10,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | BPA (Consolidado); BPA (Individualizado); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0301010072/09/2026) |
| 2 | 03.04.02.004-4 | QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO AVANÇADO | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020044/09/2026) |
| 3 | 03.04.04.017-7 | QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PRÉ-OPERATÓRIA) | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040177/09/2026) |
| 4 | 03.04.05.025-3 | QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PÓS OPERATÓRIA) | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304050253/09/2026) |
| 5 | 03.04.02.017-6 | QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO AVANÇADO | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020176/09/2026) |
| 6 | 03.04.04.011-8 | QUIMIOTERAPIA DE CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040118/09/2026) |
| 7 | 03.04.02.005-2 | QUIMIOTERAPIA DO ADENOCARCINOMA DE PÂNCREAS AVANÇADO | R$ 1.986,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020052/09/2026) |
| 8 | 03.04.02.038-9 | QUIMIOTERAPIA DE CARCINOMA DO FÍGADO OU DO TRATO BILIAR AVANÇADO | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020389/09/2026) |
| 9 | 03.04.02.016-8 | QUIMIOTERAPIA DO CARCINOMA DE RIM AVANÇADO | R$ 3.311,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020168/09/2026) |
| 10 | 03.04.02.040-0 | QUIMIOTERAPIA DE CARCINOMA UROTELIAL AVANÇADO | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020400/09/2026) |
| 11 | 03.04.04.007-0 | QUIMIOTERAPIA DO CARCINOMA DE BEXIGA | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040070/09/2026) |
| 12 | 03.04.02.027-3 | QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DE TUBA UTERINA AVANÇADA -1ª LINHA. | R$ 1.450,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020273/09/2026) |
| 13 | 03.04.04.014-2 | QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA - 1ª LINHA | R$ 1.450,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040142/09/2026) |
| 14 | 03.04.05.020-2 | QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA | R$ 1.450,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304050202/09/2026) |
| 15 | 03.04.02.018-4 | QUIMIOTERAPIA DA NEOPLASIA MALIGNA AVANÇADA DO COLO OU DO CORPO UTERINO AVANÇADO, VULVA E VAGINA. | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020184/09/2026) |
| 16 | 03.04.04.004-5 | QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DO COLO UTERINO | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040045/09/2026) |
| 17 | 03.04.02.020-6 | QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE CABEÇA E PESCOÇO AVANÇADO | R$ 800,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020206/09/2026) |
| 18 | 03.04.04.006-1 | QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE SEIO PARA-NASAL/ LARINGE / HIPOFARINGE/ OROFARINGE /CAVIDADE ORAL | R$ 1.300,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040061/09/2026) |
| 19 | 03.04.02.015-0 | QUIMIOTERAPIA DO CARCINOMA DE NASOFARINGE AVANÇADO | R$ 571,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020150/09/2026) |
| 20 | 03.04.02.001-0 | QUIMIOTERAPIA DO ADENOCARCINOMA DE COLON AVANÇADO -1ª LINHA | R$ 2.224,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020010/09/2026) |
| 21 | 03.04.02.021-4 | QUIMIOTERAPIA DO CARCINOMA PULMONAR DE CÉLULAS NÃO PEQUENAS AVANÇADO | R$ 1.100,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020214/09/2026) |
| 22 | 03.04.02.007-9 | HORMONIOTERAPIA DO ADENOCARCINOMA DE PRÓSTATA AVANÇADO - 1ª LINHA | R$ 301,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020079/09/2026) |
| 23 | 03.04.01.037-5 | RADIOTERAPIA DO APARELHO DIGESTIVO | R$ 4.148,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304010375/09/2026) |
| 24 | 03.04.01.036-7 | RADIOTERAPIA DE CABEÇA E PESCOÇO | R$ 4.168,00 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304010367/09/2026) |
| 25 | 03.04.08.007-1 | INIBIDOR DA OSTEÓLISE | R$ 449,50 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304080071/09/2026) |
| 26 | 03.04.10.001-3 | TRATAMENTO DE INTERCORRÊNCIAS CLÍNICAS DE PACIENTE ONCOLÓGICO | R$ 0,00 | R$ 37,78 | R$ 8,15 | R$ 45,93 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304100013/09/2026) |
| 27 | 02.01.01.054-2 | BIOPSIA PERCUTÂNEA ORIENTADA POR TOMOGRAFIA COMPUTADORIZADA / ULTRASSONOGRAFIA / RESSONÂNCIA MAGNÉTICA / RAIO X | R$ 97,00 | R$ 97,00 | R$ 0,00 | R$ 97,00 | BPA (Individualizado); AIH (Proc. Especial) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0201010542/09/2026) |
| 28 | 02.01.01.021-6 | BIOPSIA DE FIGADO POR PUNCAO | R$ 71,15 | R$ 71,15 | R$ 0,00 | R$ 71,15 | BPA (Individualizado); AIH (Proc. Especial) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0201010216/09/2026) |
| 29 | 02.03.02.003-0 | EXAME ANATOMO-PATOLÓGICO PARA CONGELAMENTO / PARAFINA POR PEÇA CIRURGICA OU POR BIOPSIA (EXCETO COLO UTERINO E MAMA) | R$ 40,78 | R$ 40,78 | R$ 0,00 | R$ 40,78 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0203020030/09/2026) |
| 30 | 02.03.02.004-9 | IMUNOHISTOQUIMICA DE NEOPLASIAS MALIGNAS (POR MARCADOR) | R$ 131,52 | R$ 131,52 | R$ 0,00 | R$ 131,52 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0203020049/09/2026) |
| 31 | 02.06.02.003-1 | TOMOGRAFIA COMPUTADORIZADA DE TORAX | R$ 136,41 | R$ 136,41 | R$ 0,00 | R$ 136,41 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206020031/09/2026) |
| 32 | 02.06.03.001-0 | TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR | R$ 138,63 | R$ 138,63 | R$ 0,00 | R$ 138,63 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206030010/09/2026) |
| 33 | 02.06.03.003-7 | TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA / ABDOMEN INFERIOR | R$ 138,63 | R$ 138,63 | R$ 0,00 | R$ 138,63 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206030037/09/2026) |
| 34 | 02.07.03.001-4 | RESSONANCIA MAGNETICA DE ABDOMEN SUPERIOR | R$ 268,75 | R$ 268,75 | R$ 0,00 | R$ 268,75 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0207030014/09/2026) |
| 35 | 02.08.05.003-5 | CINTILOGRAFIA DE OSSOS COM OU SEM FLUXO SANGUÍNEO (CORPO INTEIRO) | R$ 190,99 | R$ 190,99 | R$ 0,00 | R$ 190,99 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0208050035/09/2026) |
| 36 | 02.06.01.009-5 | TOMOGRAFIA POR EMISSÃO DE PÓSITRONS (PET-CT) | R$ 2.107,22 | R$ 0,00 | R$ 0,00 | R$ 0,00 | APAC (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206010095/09/2026) |
| 37 | 02.09.01.003-7 | ESOFAGOGASTRODUODENOSCOPIA | R$ 48,16 | R$ 48,16 | R$ 0,00 | R$ 48,16 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0209010037/09/2026) |
| 38 | 02.09.01.002-9 | COLONOSCOPIA (COLOSCOPIA) | R$ 112,66 | R$ 112,66 | R$ 0,00 | R$ 112,66 | BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0209010029/09/2026) |
| 39 | 02.02.03.096-2 | PESQUISA DE ANTIGENO CARCINOEMBRIONARIO (CEA) | R$ 13,35 | R$ 0,00 | R$ 0,00 | R$ 0,00 | BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030962/09/2026) |
| 40 | 02.02.03.121-7 | DOSAGEM DO ANTÍGENO CA 125 | R$ 13,35 | R$ 0,00 | R$ 0,00 | R$ 0,00 | BPA (Consolidado); BPA (Individualizado) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202031217/09/2026) |
| 41 | 02.02.03.009-1 | DOSAGEM DE ALFA-FETOPROTEINA | R$ 15,06 | R$ 0,00 | R$ 0,00 | R$ 0,00 | BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030091/09/2026) |
| 42 | 02.02.03.010-5 | DOSAGEM DE ANTIGENO PROSTATICO ESPECIFICO (PSA) | R$ 16,42 | R$ 0,00 | R$ 0,00 | R$ 0,00 | BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário); APAC (Proc. Secundário) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030105/09/2026) |
| 43 | 04.16.04.007-1 | GASTRECTOMIA TOTAL EM ONCOLOGIA | R$ 0,00 | R$ 2.762,03 | R$ 732,25 | R$ 3.494,28 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040071/09/2026) |
| 44 | 04.16.04.003-9 | ESOFAGOGASTRECTOMIA COM TORACOTOMIA EM ONCOLOGIA | R$ 0,00 | R$ 4.156,05 | R$ 1.220,48 | R$ 5.376,53 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040039/09/2026) |
| 45 | 04.16.04.012-8 | DUODENOPANCREATECTOMIA EM ONCOLOGIA | R$ 0,00 | R$ 4.300,74 | R$ 1.206,29 | R$ 5.507,03 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040128/09/2026) |
| 46 | 04.16.04.010-1 | HEPATECTOMIA PARCIAL EM ONCOLOGIA | R$ 0,00 | R$ 1.584,43 | R$ 541,01 | R$ 2.125,44 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040101/09/2026) |
| 47 | 04.16.01.007-5 | NEFRECTOMIA TOTAL EM ONCOLOGIA | R$ 0,00 | R$ 1.316,39 | R$ 436,91 | R$ 1.753,30 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416010075/09/2026) |
| 48 | 04.16.01.002-4 | CISTECTOMIA COM DERIVACAO EM 1SÓ TEMPO EM ONCOLOGIA | R$ 0,00 | R$ 3.167,58 | R$ 894,87 | R$ 4.062,45 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416010024/09/2026) |
| 49 | 04.16.06.006-4 | HISTERECTOMIA TOTAL AMPLIADA EM ONCOLOGIA | R$ 0,00 | R$ 4.238,50 | R$ 1.164,93 | R$ 5.403,43 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416060064/09/2026) |
| 50 | 04.16.03.026-2 | LARINGECTOMIA TOTAL EM ONCOLOGIA | R$ 0,00 | R$ 4.605,92 | R$ 1.212,76 | R$ 5.818,68 | AIH (Proc. Principal) | [SIGTAP](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416030262/09/2026) |

## Detalhe com caminho completo na hierarquia

### 1. 03.01.01.007-2 — CONSULTA MEDICA EM ATENÇÃO ESPECIALIZADA
- **Categoria:** Consulta
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 01 - Consultas / Atendimentos / Acompanhamentos > Forma de organização 01 - Consultas médicas/outros profissionais  de nivel superior > Procedimento 03.01.01.007-2 - CONSULTA MEDICA EM ATENÇÃO ESPECIALIZADA
- **Valores (09/2026):** SA R$ 10,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0301010072/09/2026 (verificado em 2026-10-06: SIM)

### 2. 03.04.02.004-4 — QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO AVANÇADO
- **Categoria:** QT paliativa – estômago
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.004-4 - QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO AVANÇADO
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020044/09/2026 (verificado em 2026-10-06: SIM)

### 3. 03.04.04.017-7 — QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PRÉ-OPERATÓRIA)
- **Categoria:** QT prévia – estômago
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.017-7 - QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PRÉ-OPERATÓRIA)
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040177/09/2026 (verificado em 2026-10-06: SIM)

### 4. 03.04.05.025-3 — QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PÓS OPERATÓRIA)
- **Categoria:** QT adjuvante – estômago
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 05 - Quimioterapia adjuvante (profilática) - adulto > Procedimento 03.04.05.025-3 - QUIMIOTERAPIA DO ADENOCARCINOMA DE ESTÔMAGO (PÓS OPERATÓRIA)
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304050253/09/2026 (verificado em 2026-10-06: SIM)

### 5. 03.04.02.017-6 — QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO AVANÇADO
- **Categoria:** QT paliativa – esôfago
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.017-6 - QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO AVANÇADO
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020176/09/2026 (verificado em 2026-10-06: SIM)

### 6. 03.04.04.011-8 — QUIMIOTERAPIA DE CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO
- **Categoria:** QT prévia – esôfago
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.011-8 - QUIMIOTERAPIA DE CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DE ESÔFAGO
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040118/09/2026 (verificado em 2026-10-06: SIM)

### 7. 03.04.02.005-2 — QUIMIOTERAPIA DO ADENOCARCINOMA DE PÂNCREAS AVANÇADO
- **Categoria:** QT paliativa – pâncreas
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.005-2 - QUIMIOTERAPIA DO ADENOCARCINOMA DE PÂNCREAS AVANÇADO
- **Valores (09/2026):** SA R$ 1.986,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020052/09/2026 (verificado em 2026-10-06: SIM)

### 8. 03.04.02.038-9 — QUIMIOTERAPIA DE CARCINOMA DO FÍGADO OU DO TRATO BILIAR AVANÇADO
- **Categoria:** QT paliativa – fígado/vias biliares
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.038-9 - QUIMIOTERAPIA DE CARCINOMA DO FÍGADO OU DO TRATO BILIAR AVANÇADO
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020389/09/2026 (verificado em 2026-10-06: SIM)

### 9. 03.04.02.016-8 — QUIMIOTERAPIA DO CARCINOMA DE RIM AVANÇADO
- **Categoria:** QT paliativa – rim
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.016-8 - QUIMIOTERAPIA DO CARCINOMA DE RIM AVANÇADO
- **Valores (09/2026):** SA R$ 3.311,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020168/09/2026 (verificado em 2026-10-06: SIM)

### 10. 03.04.02.040-0 — QUIMIOTERAPIA DE CARCINOMA UROTELIAL AVANÇADO
- **Categoria:** QT paliativa – urotelial
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.040-0 - QUIMIOTERAPIA DE CARCINOMA UROTELIAL AVANÇADO
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020400/09/2026 (verificado em 2026-10-06: SIM)

### 11. 03.04.04.007-0 — QUIMIOTERAPIA DO CARCINOMA DE BEXIGA
- **Categoria:** QT prévia – bexiga
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.007-0 - QUIMIOTERAPIA DO CARCINOMA DE BEXIGA
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040070/09/2026 (verificado em 2026-10-06: SIM)

### 12. 03.04.02.027-3 — QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DE TUBA UTERINA AVANÇADA -1ª LINHA.
- **Categoria:** QT paliativa – ovário 1ª linha
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.027-3 - QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DE TUBA UTERINA AVANÇADA -1ª LINHA.
- **Valores (09/2026):** SA R$ 1.450,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020273/09/2026 (verificado em 2026-10-06: SIM)

### 13. 03.04.04.014-2 — QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA - 1ª LINHA
- **Categoria:** QT prévia – ovário 1ª linha
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.014-2 - QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA - 1ª LINHA
- **Valores (09/2026):** SA R$ 1.450,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040142/09/2026 (verificado em 2026-10-06: SIM)

### 14. 03.04.05.020-2 — QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA
- **Categoria:** QT adjuvante – ovário
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 05 - Quimioterapia adjuvante (profilática) - adulto > Procedimento 03.04.05.020-2 - QUIMIOTERAPIA DE NEOPLASIA MALIGNA EPITELIAL DE OVÁRIO OU DA TUBA UTERINA
- **Valores (09/2026):** SA R$ 1.450,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304050202/09/2026 (verificado em 2026-10-06: SIM)

### 15. 03.04.02.018-4 — QUIMIOTERAPIA DA NEOPLASIA MALIGNA AVANÇADA DO COLO OU DO CORPO UTERINO AVANÇADO, VULVA E VAGINA.
- **Categoria:** QT paliativa – colo/corpo uterino, vulva, vagina
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.018-4 - QUIMIOTERAPIA DA NEOPLASIA MALIGNA AVANÇADA DO COLO OU DO CORPO UTERINO AVANÇADO, VULVA E VAGINA.
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020184/09/2026 (verificado em 2026-10-06: SIM)

### 16. 03.04.04.004-5 — QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DO COLO UTERINO
- **Categoria:** QT prévia – colo uterino
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.004-5 - QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE / ADENOCARCINOMA DO COLO UTERINO
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040045/09/2026 (verificado em 2026-10-06: SIM)

### 17. 03.04.02.020-6 — QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE CABEÇA E PESCOÇO AVANÇADO
- **Categoria:** QT paliativa – cabeça e pescoço
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.020-6 - QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE CABEÇA E PESCOÇO AVANÇADO
- **Valores (09/2026):** SA R$ 800,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020206/09/2026 (verificado em 2026-10-06: SIM)

### 18. 03.04.04.006-1 — QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE SEIO PARA-NASAL/ LARINGE / HIPOFARINGE/ OROFARINGE /CAVIDADE ORAL
- **Categoria:** QT prévia – cabeça e pescoço
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 04 - Quimioterapia prévia (neoadjuvante/citorredutora)- adulto > Procedimento 03.04.04.006-1 - QUIMIOTERAPIA DO CARCINOMA EPIDERMÓIDE DE SEIO PARA-NASAL/ LARINGE / HIPOFARINGE/ OROFARINGE /CAVIDADE ORAL
- **Valores (09/2026):** SA R$ 1.300,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304040061/09/2026 (verificado em 2026-10-06: SIM)

### 19. 03.04.02.015-0 — QUIMIOTERAPIA DO CARCINOMA DE NASOFARINGE AVANÇADO
- **Categoria:** QT paliativa – nasofaringe
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.015-0 - QUIMIOTERAPIA DO CARCINOMA DE NASOFARINGE AVANÇADO
- **Valores (09/2026):** SA R$ 571,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020150/09/2026 (verificado em 2026-10-06: SIM)

### 20. 03.04.02.001-0 — QUIMIOTERAPIA DO ADENOCARCINOMA DE COLON AVANÇADO -1ª LINHA
- **Categoria:** QT paliativa – cólon 1ª linha
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.001-0 - QUIMIOTERAPIA DO ADENOCARCINOMA DE COLON AVANÇADO -1ª LINHA
- **Valores (09/2026):** SA R$ 2.224,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020010/09/2026 (verificado em 2026-10-06: SIM)

### 21. 03.04.02.021-4 — QUIMIOTERAPIA DO CARCINOMA PULMONAR DE CÉLULAS NÃO PEQUENAS AVANÇADO
- **Categoria:** QT paliativa – CPCNP
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.021-4 - QUIMIOTERAPIA DO CARCINOMA PULMONAR DE CÉLULAS NÃO PEQUENAS AVANÇADO
- **Valores (09/2026):** SA R$ 1.100,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020214/09/2026 (verificado em 2026-10-06: SIM)

### 22. 03.04.02.007-9 — HORMONIOTERAPIA DO ADENOCARCINOMA DE PRÓSTATA AVANÇADO - 1ª LINHA
- **Categoria:** Hormonioterapia – próstata
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 02 - Quimioterapia paliativa - adulto > Procedimento 03.04.02.007-9 - HORMONIOTERAPIA DO ADENOCARCINOMA DE PRÓSTATA AVANÇADO - 1ª LINHA
- **Valores (09/2026):** SA R$ 301,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304020079/09/2026 (verificado em 2026-10-06: SIM)

### 23. 03.04.01.037-5 — RADIOTERAPIA DO APARELHO DIGESTIVO
- **Categoria:** Radioterapia – aparelho digestivo
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 01 - Radioterapia > Procedimento 03.04.01.037-5 - RADIOTERAPIA DO APARELHO DIGESTIVO
- **Valores (09/2026):** SA R$ 4.148,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Fundo de Ações Estratégicas e Compensações (FAEC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304010375/09/2026 (verificado em 2026-10-06: SIM)

### 24. 03.04.01.036-7 — RADIOTERAPIA DE CABEÇA E PESCOÇO
- **Categoria:** Radioterapia – cabeça e pescoço
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 01 - Radioterapia > Procedimento 03.04.01.036-7 - RADIOTERAPIA DE CABEÇA E PESCOÇO
- **Valores (09/2026):** SA R$ 4.168,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Fundo de Ações Estratégicas e Compensações (FAEC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304010367/09/2026 (verificado em 2026-10-06: SIM)

### 25. 03.04.08.007-1 — INIBIDOR DA OSTEÓLISE
- **Categoria:** Procedimento especial – inibidor da osteólise
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 08 - Quimioterapia - procedimentos especiais > Procedimento 03.04.08.007-1 - INIBIDOR DA OSTEÓLISE
- **Valores (09/2026):** SA R$ 449,50 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304080071/09/2026 (verificado em 2026-10-06: SIM)

### 26. 03.04.10.001-3 — TRATAMENTO DE INTERCORRÊNCIAS CLÍNICAS DE PACIENTE ONCOLÓGICO
- **Categoria:** Internação – intercorrência clínica oncológica
- **Caminho:** Grupo 03 - Procedimentos clínicos > Subgrupo 04 - Tratamento em oncologia > Forma de organização 10 - Gerais em oncologia > Procedimento 03.04.10.001-3 - TRATAMENTO DE INTERCORRÊNCIAS CLÍNICAS DE PACIENTE ONCOLÓGICO
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 37,78 | SP R$ 8,15 | Total hospitalar R$ 45,93
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0304100013/09/2026 (verificado em 2026-10-06: SIM)

### 27. 02.01.01.054-2 — BIOPSIA PERCUTÂNEA ORIENTADA POR TOMOGRAFIA COMPUTADORIZADA / ULTRASSONOGRAFIA / RESSONÂNCIA MAGNÉTICA / RAIO X
- **Categoria:** Biópsia guiada por imagem
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 01 - Coleta de material > Forma de organização 01 - Coleta de material por meio de punção/biópsia > Procedimento 02.01.01.054-2 - BIOPSIA PERCUTÂNEA ORIENTADA POR TOMOGRAFIA COMPUTADORIZADA / ULTRASSONOGRAFIA / RESSONÂNCIA MAGNÉTICA / RAIO X
- **Valores (09/2026):** SA R$ 97,00 | SH R$ 97,00 | SP R$ 0,00 | Total hospitalar R$ 97,00
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0201010542/09/2026 (verificado em 2026-10-06: SIM)

### 28. 02.01.01.021-6 — BIOPSIA DE FIGADO POR PUNCAO
- **Categoria:** Biópsia hepática
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 01 - Coleta de material > Forma de organização 01 - Coleta de material por meio de punção/biópsia > Procedimento 02.01.01.021-6 - BIOPSIA DE FIGADO POR PUNCAO
- **Valores (09/2026):** SA R$ 71,15 | SH R$ 71,15 | SP R$ 0,00 | Total hospitalar R$ 71,15
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0201010216/09/2026 (verificado em 2026-10-06: SIM)

### 29. 02.03.02.003-0 — EXAME ANATOMO-PATOLÓGICO PARA CONGELAMENTO / PARAFINA POR PEÇA CIRURGICA OU POR BIOPSIA (EXCETO COLO UTERINO E MAMA)
- **Categoria:** Anatomopatológico
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 03 - Diagnóstico por anatomia patológica e citopatologia > Forma de organização 02 - Exames anatomopatológicos > Procedimento 02.03.02.003-0 - EXAME ANATOMO-PATOLÓGICO PARA CONGELAMENTO / PARAFINA POR PEÇA CIRURGICA OU POR BIOPSIA (EXCETO COLO UTERINO E MAMA)
- **Valores (09/2026):** SA R$ 40,78 | SH R$ 40,78 | SP R$ 0,00 | Total hospitalar R$ 40,78
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0203020030/09/2026 (verificado em 2026-10-06: SIM)

### 30. 02.03.02.004-9 — IMUNOHISTOQUIMICA DE NEOPLASIAS MALIGNAS (POR MARCADOR)
- **Categoria:** Imuno-histoquímica
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 03 - Diagnóstico por anatomia patológica e citopatologia > Forma de organização 02 - Exames anatomopatológicos > Procedimento 02.03.02.004-9 - IMUNOHISTOQUIMICA DE NEOPLASIAS MALIGNAS (POR MARCADOR)
- **Valores (09/2026):** SA R$ 131,52 | SH R$ 131,52 | SP R$ 0,00 | Total hospitalar R$ 131,52
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0203020049/09/2026 (verificado em 2026-10-06: SIM)

### 31. 02.06.02.003-1 — TOMOGRAFIA COMPUTADORIZADA DE TORAX
- **Categoria:** TC tórax
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 06 - Diagnóstico por tomografia > Forma de organização 02 - Tomografia do torax e membros superiores > Procedimento 02.06.02.003-1 - TOMOGRAFIA COMPUTADORIZADA DE TORAX
- **Valores (09/2026):** SA R$ 136,41 | SH R$ 136,41 | SP R$ 0,00 | Total hospitalar R$ 136,41
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206020031/09/2026 (verificado em 2026-10-06: SIM)

### 32. 02.06.03.001-0 — TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR
- **Categoria:** TC abdome superior
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 06 - Diagnóstico por tomografia > Forma de organização 03 - Tomografia do abdomen, pelve e membros inferiores > Procedimento 02.06.03.001-0 - TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR
- **Valores (09/2026):** SA R$ 138,63 | SH R$ 138,63 | SP R$ 0,00 | Total hospitalar R$ 138,63
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206030010/09/2026 (verificado em 2026-10-06: SIM)

### 33. 02.06.03.003-7 — TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA / ABDOMEN INFERIOR
- **Categoria:** TC pelve
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 06 - Diagnóstico por tomografia > Forma de organização 03 - Tomografia do abdomen, pelve e membros inferiores > Procedimento 02.06.03.003-7 - TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA / ABDOMEN INFERIOR
- **Valores (09/2026):** SA R$ 138,63 | SH R$ 138,63 | SP R$ 0,00 | Total hospitalar R$ 138,63
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206030037/09/2026 (verificado em 2026-10-06: SIM)

### 34. 02.07.03.001-4 — RESSONANCIA MAGNETICA DE ABDOMEN SUPERIOR
- **Categoria:** RM abdome superior
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 07 - Diagnóstico por ressonância magnética > Forma de organização 03 - RM do abdomen, pelve e membros inferiores > Procedimento 02.07.03.001-4 - RESSONANCIA MAGNETICA DE ABDOMEN SUPERIOR
- **Valores (09/2026):** SA R$ 268,75 | SH R$ 268,75 | SP R$ 0,00 | Total hospitalar R$ 268,75
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0207030014/09/2026 (verificado em 2026-10-06: SIM)

### 35. 02.08.05.003-5 — CINTILOGRAFIA DE OSSOS COM OU SEM FLUXO SANGUÍNEO (CORPO INTEIRO)
- **Categoria:** Cintilografia óssea
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 08 - Diagnóstico por medicina nuclear in vivo > Forma de organização 05 - Aparelho esquelético > Procedimento 02.08.05.003-5 - CINTILOGRAFIA DE OSSOS COM OU SEM FLUXO SANGUÍNEO (CORPO INTEIRO)
- **Valores (09/2026):** SA R$ 190,99 | SH R$ 190,99 | SP R$ 0,00 | Total hospitalar R$ 190,99
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0208050035/09/2026 (verificado em 2026-10-06: SIM)

### 36. 02.06.01.009-5 — TOMOGRAFIA POR EMISSÃO DE PÓSITRONS (PET-CT)
- **Categoria:** PET-CT
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 06 - Diagnóstico por tomografia > Forma de organização 01 - Tomografia da cabeça, pescoço e coluna vertebral > Procedimento 02.06.01.009-5 - TOMOGRAFIA POR EMISSÃO DE PÓSITRONS (PET-CT)
- **Valores (09/2026):** SA R$ 2.107,22 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** APAC (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0206010095/09/2026 (verificado em 2026-10-06: SIM)

### 37. 02.09.01.003-7 — ESOFAGOGASTRODUODENOSCOPIA
- **Categoria:** EDA
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 09 - Diagnóstico por endoscopia > Forma de organização 01 - Aparelho digestivo > Procedimento 02.09.01.003-7 - ESOFAGOGASTRODUODENOSCOPIA
- **Valores (09/2026):** SA R$ 48,16 | SH R$ 48,16 | SP R$ 0,00 | Total hospitalar R$ 48,16
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0209010037/09/2026 (verificado em 2026-10-06: SIM)

### 38. 02.09.01.002-9 — COLONOSCOPIA (COLOSCOPIA)
- **Categoria:** Colonoscopia
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 09 - Diagnóstico por endoscopia > Forma de organização 01 - Aparelho digestivo > Procedimento 02.09.01.002-9 - COLONOSCOPIA (COLOSCOPIA)
- **Valores (09/2026):** SA R$ 112,66 | SH R$ 112,66 | SP R$ 0,00 | Total hospitalar R$ 112,66
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0209010029/09/2026 (verificado em 2026-10-06: SIM)

### 39. 02.02.03.096-2 — PESQUISA DE ANTIGENO CARCINOEMBRIONARIO (CEA)
- **Categoria:** Marcador – CEA
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 02 - Diagnóstico em laboratório clínico > Forma de organização 03 - Exames sorológicos e imunológicos > Procedimento 02.02.03.096-2 - PESQUISA DE ANTIGENO CARCINOEMBRIONARIO (CEA)
- **Valores (09/2026):** SA R$ 13,35 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030962/09/2026 (verificado em 2026-10-06: SIM)

### 40. 02.02.03.121-7 — DOSAGEM DO ANTÍGENO CA 125
- **Categoria:** Marcador – CA 125
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 02 - Diagnóstico em laboratório clínico > Forma de organização 03 - Exames sorológicos e imunológicos > Procedimento 02.02.03.121-7 - DOSAGEM DO ANTÍGENO CA 125
- **Valores (09/2026):** SA R$ 13,35 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202031217/09/2026 (verificado em 2026-10-06: SIM)

### 41. 02.02.03.009-1 — DOSAGEM DE ALFA-FETOPROTEINA
- **Categoria:** Marcador – AFP
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 02 - Diagnóstico em laboratório clínico > Forma de organização 03 - Exames sorológicos e imunológicos > Procedimento 02.02.03.009-1 - DOSAGEM DE ALFA-FETOPROTEINA
- **Valores (09/2026):** SA R$ 15,06 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030091/09/2026 (verificado em 2026-10-06: SIM)

### 42. 02.02.03.010-5 — DOSAGEM DE ANTIGENO PROSTATICO ESPECIFICO (PSA)
- **Categoria:** Marcador – PSA
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 02 - Diagnóstico em laboratório clínico > Forma de organização 03 - Exames sorológicos e imunológicos > Procedimento 02.02.03.010-5 - DOSAGEM DE ANTIGENO PROSTATICO ESPECIFICO (PSA)
- **Valores (09/2026):** SA R$ 16,42 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0202030105/09/2026 (verificado em 2026-10-06: SIM)

### 43. 04.16.04.007-1 — GASTRECTOMIA TOTAL EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – estômago
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 04 - Esôfago-gastro duodenal e vísceras anexas e outros orgãos intra-abdominais > Procedimento 04.16.04.007-1 - GASTRECTOMIA TOTAL EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 2.762,03 | SP R$ 732,25 | Total hospitalar R$ 3.494,28
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040071/09/2026 (verificado em 2026-10-06: SIM)

### 44. 04.16.04.003-9 — ESOFAGOGASTRECTOMIA COM TORACOTOMIA EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – esôfago
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 04 - Esôfago-gastro duodenal e vísceras anexas e outros orgãos intra-abdominais > Procedimento 04.16.04.003-9 - ESOFAGOGASTRECTOMIA COM TORACOTOMIA EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 4.156,05 | SP R$ 1.220,48 | Total hospitalar R$ 5.376,53
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040039/09/2026 (verificado em 2026-10-06: SIM)

### 45. 04.16.04.012-8 — DUODENOPANCREATECTOMIA EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – pâncreas
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 04 - Esôfago-gastro duodenal e vísceras anexas e outros orgãos intra-abdominais > Procedimento 04.16.04.012-8 - DUODENOPANCREATECTOMIA EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 4.300,74 | SP R$ 1.206,29 | Total hospitalar R$ 5.507,03
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040128/09/2026 (verificado em 2026-10-06: SIM)

### 46. 04.16.04.010-1 — HEPATECTOMIA PARCIAL EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – fígado
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 04 - Esôfago-gastro duodenal e vísceras anexas e outros orgãos intra-abdominais > Procedimento 04.16.04.010-1 - HEPATECTOMIA PARCIAL EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 1.584,43 | SP R$ 541,01 | Total hospitalar R$ 2.125,44
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416040101/09/2026 (verificado em 2026-10-06: SIM)

### 47. 04.16.01.007-5 — NEFRECTOMIA TOTAL EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – rim
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 01 - Urologia > Procedimento 04.16.01.007-5 - NEFRECTOMIA TOTAL EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 1.316,39 | SP R$ 436,91 | Total hospitalar R$ 1.753,30
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416010075/09/2026 (verificado em 2026-10-06: SIM)

### 48. 04.16.01.002-4 — CISTECTOMIA COM DERIVACAO EM 1SÓ TEMPO EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – bexiga
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 01 - Urologia > Procedimento 04.16.01.002-4 - CISTECTOMIA COM DERIVACAO EM 1SÓ TEMPO EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 3.167,58 | SP R$ 894,87 | Total hospitalar R$ 4.062,45
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416010024/09/2026 (verificado em 2026-10-06: SIM)

### 49. 04.16.06.006-4 — HISTERECTOMIA TOTAL AMPLIADA EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – colo uterino
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 06 - Ginecologia > Procedimento 04.16.06.006-4 - HISTERECTOMIA TOTAL AMPLIADA EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 4.238,50 | SP R$ 1.164,93 | Total hospitalar R$ 5.403,43
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416060064/09/2026 (verificado em 2026-10-06: SIM)

### 50. 04.16.03.026-2 — LARINGECTOMIA TOTAL EM ONCOLOGIA
- **Categoria:** Cirurgia oncológica – laringe
- **Caminho:** Grupo 04 - Procedimentos cirúrgicos > Subgrupo 16 - Cirurgia em oncologia > Forma de organização 03 - Cabeça e pescoço > Procedimento 04.16.03.026-2 - LARINGECTOMIA TOTAL EM ONCOLOGIA
- **Valores (09/2026):** SA R$ 0,00 | SH R$ 4.605,92 | SP R$ 1.212,76 | Total hospitalar R$ 5.818,68
- **Instrumento de registro:** AIH (Proc. Principal)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0416030262/09/2026 (verificado em 2026-10-06: SIM)


## Extras (fora dos 50) úteis para checagem pré-QT

### Extra. 02.05.01.003-2 — ECOCARDIOGRAFIA TRANSTORACICA
- **Categoria:** Ecocardiografia (FEVE antes de antraciclina/trastuzumabe)
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 05 - Diagnóstico por ultrasonografia > Forma de organização 01 - Ultra-sonografias do sistema circulatório (qualquer região anatômica) > Procedimento 02.05.01.003-2 - ECOCARDIOGRAFIA TRANSTORACICA
- **Valores (09/2026):** SA R$ 67,86 | SH R$ 67,86 | SP R$ 0,00 | Total hospitalar R$ 67,86
- **Instrumento de registro:** BPA (Individualizado); AIH (Proc. Especial); APAC (Proc. Principal); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0205010032/09/2026 (verificado em 2026-10-06: SIM)

### Extra. 02.11.07.004-1 — AUDIOMETRIA TONAL LIMIAR (VIA AEREA / OSSEA)
- **Categoria:** Audiometria (baseline antes de cisplatina)
- **Caminho:** Grupo 02 - Procedimentos com finalidade diagnóstica > Subgrupo 11 - Métodos diagnósticos em especialidades > Forma de organização 07 - Diagnóstico em otorrinolaringologia/fonoaudiologia > Procedimento 02.11.07.004-1 - AUDIOMETRIA TONAL LIMIAR (VIA AEREA / OSSEA)
- **Valores (09/2026):** SA R$ 21,00 | SH R$ 0,00 | SP R$ 0,00 | Total hospitalar R$ 0,00
- **Instrumento de registro:** BPA (Consolidado); BPA (Individualizado); AIH (Proc. Secundário); APAC (Proc. Secundário)
- **Financiamento:** Média e Alta Complexidade (MAC)
- **Link:** http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0211070041/09/2026 (verificado em 2026-10-06: SIM)


## Fontes
1. SIGTAP: Sistema de Gerenciamento da Tabela de Procedimentos, Medicamentos e OPM do SUS (DATASUS/MS), página inicial: http://sigtap.datasus.gov.br/tabela-unificada/app/sec/inicio.jsp (consultada em 2026-10-06).
2. SIGTAP, consulta de procedimentos (lista de competências; a mais recente é 09/2026): http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/publicados/consultar
3. DATASUS, arquivo da Tabela Unificada, competência 09/2026: ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/TabelaUnificada_202609_v2610050950.zip (2.156.082 bytes, publicado em 05/10/2026).
4. Páginas de detalhe de cada procedimento no SIGTAP (links na tabela; todos verificados em 2026-10-06).
