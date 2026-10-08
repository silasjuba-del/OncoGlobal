# APAC · mapa de caixas (para o agente) · PLN-027 · 2026-10-07

> Pedido do Dr. Silas: "MODELO DE APAC = IMPORTANTE = SEPARE CADA CAIXA E ORIENTE O AGENTE ONDE ALOCAR".
> Fonte: laudo APAC real (2 páginas) lido no PC do Dr. Silas, **sem copiar nenhum dado identificável** (nome, CNS, CPF, endereço, telefone, mãe, prontuário, documentos do médico). Só a estrutura e as anomalias, em linguagem de "Paciente Teste". Mesmo critério de `docs/referencias/CASO-REAL-01-LICOES.md`.
> Numeração = a impressa no laudo. Código = `src/apac/laudo.ts` (só **página 1**). Origem do dado usa as seções do modelo PRONTUÁRIO DRIVE (PLN-025/026): S1 anagráficos · S2 clínicos · S3 oncológicos (inclui HISTÓRICO DE TRATAMENTO, exames, labs).
> Regras gerais (valem para todas as caixas): dado ausente = **vazio** no papel e **PENDENTE** no estado interno; só dado **confirmado** preenche; finalidade é **escolha do médico** (D-W9-12/33), nunca deduzida; AUTORIZAÇÃO é do órgão autorizador (em branco); o médico assina e carimba (o sistema não assina); documento final **sem menção a IA** (PLN-023).

## PÁGINA 1 — LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO

### A. Estabelecimento solicitante
| Caixa | Rótulo | Onde alocar (origem) | Regra |
|---|---|---|---|
| 1 | Nome do estabelecimento de saúde (solicitante) | configuração do serviço (fixo) | texto fixo, versionado |
| 2 | CNES | configuração do serviço (fixo) | 7 dígitos |

### B. Identificação do paciente
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| 3 | Nome do paciente | S1 Nome completo | idêntico ao cadastro; diverge → conflito |
| 4 | Nº do prontuário | cadastro do hospital (**não está em S1**) | adicionar a S1 |
| 5 | CNS | S1 CNS | 15 dígitos, valida dígito (`apac/cns.ts`) |
| 6 | Data de nascimento | S1 | dd/mm/aaaa |
| 7 | Sexo | S1 Sexo | coerência com topografia (próstata em mulher = alerta) |
| 8 | Raça/cor | cadastro (**não está em S1**) | adicionar a S1; sem inventar |
| (etnia) | Etnia | cadastro (só se indígena) | em branco se não indígena |
| 9 | Filiação | S1 Nome da mãe (formato mãe/pai) | ausente = "SEM INFORMACAO" é do próprio laudo SUS; no sistema fica PENDENTE |
| 10 | Telefone de contato (DDD + nº) | S1 Telefone | pode ter 2 números |
| 11 | Nome do responsável | cadastro (**não está em S1**) | só se paciente depende de responsável |
| 12 | Telefone do responsável | cadastro | idem |
| 13 | Endereço (rua, nº, bairro) | S1 Endereço | |
| 14/15 | Município de residência / UF | S1 Município (+ UF) | UF **não está em S1** |
| 16 | Cód. IBGE do município | tabela de municípios (derivar do município+UF) | cálculo por código |
| 17 | CEP | cadastro (**não está em S1**) | 8 dígitos |

### C. Procedimento solicitado
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| (principal) cód. | Código do procedimento principal | tabela SIGTAP (`docs/referencias/onco-referencia/01-sigtap.csv`) escolhida pelo médico a partir da S3 (tumor + finalidade + linha) | **conferir o código contra a tabela vigente** (ver anomalia 8) |
| (principal) nome | Nome do procedimento principal | derivado do código (SIGTAP) | não digitar livre |
| (principal) qtde | Quantidade | 1 | |
| (sec.) | Procedimentos secundários (até 5: código, nome, qtde) | só se o médico escolher | em oncologia costuma ficar vazio; `MAX_SECUNDARIOS = 5` |
| (justif.) | Justificativa do(s) procedimento(s) secundário(s) | texto do médico | só se houver secundário |

### D. Diagnóstico
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| 36 | Descrição do diagnóstico | S3 Topografia + Histologia (título diagnóstico) | **tem que bater** com 37 e 56/57/63 |
| 37 | CID-10 principal | S3 CID-10 | coerente com a topografia e o sexo (ex.: próstata = C61) |
| 38 | CID secundário | vazio, salvo decisão do médico | |
| 39 | CID causas associadas | vazio, salvo decisão do médico | |
| 40 | Observação | texto livre do médico para o autorizador | **não** colar as pendências internas (S3 Observações) |

### E. Solicitação (profissional)
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| 41 | Nome do profissional executante/solicitante | cadastro do médico | |
| 42 | Data da solicitação | **data em que o médico gerou a APAC no app** (decisão 34) | dali contam os 90 dias |
| 43 | Tipo de documento (CNS/CPF) | cadastro do médico | o laudo real imprime o rótulo "44" duas vezes (43 e 44) — erro de impressão do modelo |
| 44 | Nº do documento do profissional | cadastro do médico (CNS) | |
| 45 | Assinatura e carimbo (nº reg. do conselho) | **médico** | `EM_BRANCO`; o sistema não assina |

### F. Autorização (em branco, do órgão autorizador)
46 nome do autorizador · 47 cód. do órgão emissor · 48 documento · 49 nº do doc. do autorizador · 50 data da autorização · 51 ass. e carimbo do autorizador · 52 nº da autorização (APAC) · 53 período de validade. **Sempre em branco** (`CAMPOS_AUTORIZACAO`).

### G. Estabelecimento executante
54 nome fantasia do executante · 55 CNES. **Código:** em branco (grupo AUTORIZAÇÃO). **Laudo real:** preenchido com o serviço executante. → PENDENTE (decisão do Dr. Silas: o executante vem da configuração do serviço ou fica em branco?).

## PÁGINA 2 — DADOS COMPLEMENTARES (**não implementada no código**)

### 1 · ONCOLOGIA — identificação patológica do caso
| Caixa | Rótulo | Origem (S3) | Regra |
|---|---|---|---|
| 56 | Localização do tumor primário | Topografia | texto (órgão/sítio) |
| 57 | CID-10 topografia | CID-10 | **igual à 37** (se diferir, alerta) |
| 58 | Linfonodos regionais invadidos | N do TNM + exames | Sim/Não; vazio se não definido |
| 59 | Localização de metástase(s) | M do TNM + exames | lista de sítios; vazio se M0 não confirmado |
| 60 | Estádio (UICC) | Estádio clínico | confirmar TNM (c ou p) |
| 61 | Estádio (outro sistema) | Gleason/ISUP, FIGO, Ann Arbor… | só se existir |
| 62 | Grau histopatológico | anatomopatológico | G1–G4 como no laudo |
| 63 | Diagnóstico cito/histopatológico | anatomopatológico (histologia) | texto do laudo; **não** do CID |
| 64 | Data (do diagnóstico cito/histopatológico) | data do laudo AP (= `biopsy_date`, PLN-004) | |

### 1.1 · QUIMIOTERAPIA
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| 65 | Tratamento(s) anterior(es) Sim/Não | HISTÓRICO DE TRATAMENTO (S3) | Sim se houve QT prévia |
| (1º/2º/3º) | Descrição + data de início | HISTÓRICO: **uma linha por esquema/linha anterior**, com a data de início **do esquema** | **não** listar cada ciclo como um tratamento (anomalia 4) |
| 68 | Continuidade do tratamento Sim/Não | decisão do médico (renovação herda a finalidade, decisão 33) | marcar; vazio = pendência |
| 69 | Data de início do tratamento solicitado | data prevista do ciclo 1 do esquema | |
| 70 | Esquema | Protocolo (S3) | nome do protocolo; **igual à ficha** (ver anomalia 5) |
| 71 | Nº de meses planejados | decisão do médico | |
| 72 | Nº de meses autorizados | **autorizador** | em branco |

### 2 · RADIOTERAPIA (**só se for solicitada**; senão tudo vazio)
| Caixa | Rótulo | Origem | Regra |
|---|---|---|---|
| 73 | Tratamento(s) anterior(es) Sim/Não | HISTÓRICO (RT prévia) | |
| 74/75 | Descrição / data de início (1º, 2º, 3º) | HISTÓRICO: período, sítio, dose | |
| 76 | Continuidade Sim/Não | médico | só se RT solicitada |
| 77 | Data de início do tratamento solicitado | médico | só se RT solicitada |
| 78 | Finalidade | **escolha do médico** | não deduzir; só se RT solicitada |
| 79 | CID topográfico | CID da topografia irradiada | só se RT solicitada |
| 80 | Descrição da área irradiada | médico/planejamento RT | |
| 81 | Nº de campos/inserções | planejamento RT | |
| 82/83 | Data de início / término | planejamento RT | |

### 2 · NEFROLOGIA (84–85) — **não se aplica à oncologia**
Primeiro atendimento (data da 1ª diálise, altura, peso, IMC, diurese, glicose, albumina, acesso vascular, anti-HIV, anti-HCV, HBsAg, USG abdominal) e seguimento (TRU, lista CNCDO, HB, albumina, sorologias, intervenção na fístula). **Deixar em branco** na APAC de oncologia.

### Rodapé
86 assinatura e carimbo do profissional solicitante (nome impresso + registro; **assinatura do médico**) · 87 assinatura e carimbo do executante/autorizador (**em branco**).

## Anomalias observadas no laudo real (como lições; sem dado identificável)
1. **Topografia × CID × sexo inconsistentes.** Paciente masculino com tumor primário "próstata" e adenocarcinoma acinar, mas **caixas 36, 37 e 57 trazem descrição e CID de mama** (C50.4). Provável **resíduo de modelo/pré-preenchimento**. O correto para próstata seria C61. → **gate:** 37, 57 e (se RT) 79 iguais entre si e compatíveis com 36, 56, 63, sexo e procedimento.
2. **Bloco de radioterapia parcialmente preenchido sem RT solicitada** (CID topográfico da mama e finalidade "paliativa") enquanto o procedimento é quimioterapia → o bloco de RT deve ficar **vazio** se não houver RT; preencher a finalidade é decisão do médico e só quando RT é solicitada.
3. **Caixas de continuidade (68 e 76) sem marcação.**
4. **Três "tratamentos anteriores" com a mesma data de início** (ciclo 1, 2, 3 do mesmo esquema, mesma data). A caixa 65 pede **tratamentos/esquemas anteriores**, não ciclos; a data de início é a do esquema. Provável cópia da data do primeiro ciclo.
5. **Esquema × ficha:** o esquema impresso é carboplatina + paclitaxel com **AUC 1,5**, enquanto a decisão **D-W9-61** manteve a ficha "carboplatina + paclitaxel semanal **AUC 2**". Possível dose reduzida (80% de AUC 2 daria 1,6, não 1,5) → **conferir** com o Dr. Silas antes de transportar para a APAC.
6. **Quimioterapia de próstata com carboplatina/paclitaxel** (esquema e procedimento coerentes com o texto do procedimento, mas fora do padrão da hormonioterapia/ADT de 1ª linha): fica para o médico; o app só alerta incoerência de tumor × esquema, não decide.
7. **Rótulo duplicado "44"** (documento e nº do documento): erro de impressão do formulário (43/44).
8. **Código do procedimento principal (030402008-7, "QT do adenocarcinoma de próstata resistente a hormonioterapia") não foi encontrado** na tabela SIGTAP local (`01-sigtap.csv`, que só lista a hormonioterapia de próstata 1ª linha, 0304020079). Verificar o código na tabela SIGTAP **vigente** antes de aceitar.
9. **Executante preenchido** no laudo real, mas em branco no código (D-W5-06).
10. **Dados anagráficos faltando em S1** do modelo PRONTUÁRIO DRIVE: nº do prontuário, raça/cor, etnia, UF, CEP, nome/telefone do responsável, cód. IBGE (derivável).

## Como o agente deve agir (orientação)
1. Preencher **somente** caixas com origem confirmada; todas as outras: vazio no papel + PENDENTE no estado.
2. Rodar os **gates de coerência** antes de gerar: (a) 36/37/56/57/63 batem entre si e com o sexo; (b) 37 = 57 (= 79 se RT); (c) tumor × esquema × procedimento; (d) RT vazia se não solicitada; (e) datas coerentes (diagnóstico ≤ início do tratamento anterior ≤ solicitação); (f) esquema = ficha vigente; (g) código SIGTAP existe na tabela vigente.
3. Pendências administrativas (glosa) vão para a lista de pendências do prontuário (S3 Observações), **não** para a caixa 40.
4. A APAC sai **como rascunho** com marca "RASCUNHO — NÃO VÁLIDO" até o médico assinar (`apacLaudo.ts`).
5. O documento impresso não menciona IA/sistema (PLN-023).
6. Nenhum dado real no repositório ou nos testes: casos sintéticos.
