# Avaliação — "Análise e avaliação de consultas.pdf" + "oncoMed_CONSOLIDADO_2026-08-23_2.xlsx"

Avaliação somente leitura, feita em 2026-10-07. Os arquivos originais **não** foram copiados para o repositório.
Este documento não contém nenhum dado identificável de paciente: nomes, prontuários e idades ligadas a pessoas foram omitidos de propósito.

| | Arquivo | Local de origem (fora do repo) |
|---|---|---|
| A | `Análise e avaliação de consultas.pdf` (5 páginas, LibreOffice, 26/09/2026) | `OneDrive\PESSOAL\` |
| B | `oncoMed_CONSOLIDADO_2026-08-23_2.xlsx` (11 abas) | `Downloads\02_Protocolos_e_Tabelas_Oncologia\` |

---

## 1. Varredura de PHI (sem reproduzir dados)

### A — PDF
- **Contém PHI parcial.** São 2 primeiros nomes de pacientes, usados como rótulo das consultas na tabela de métricas e ao longo do texto, junto com o diagnóstico de uma delas e detalhes clínicos (exames, sintomas, conduta).
- Há também o nome da instituição (hospital) e o primeiro nome de uma colega de outra especialidade.
- O arquivo não tem CPF, CNS, número de prontuário, data de nascimento, telefone nem endereço.
- **Veredito:** o PDF fica fora do repositório. Só os critérios genéricos (seção 3) são aproveitáveis.

### B — XLSX
| Aba | Linhas de dados | PHI? |
|---|---|---|
| LEIA-ME | 46 linhas de texto | Não. Cita só o nome do médico autor. |
| METODO_ID_CANONICO | 42 linhas de texto | Não |
| INDICE_MESTRE | 22 linhas (contagens) | Não |
| POOL_A_114_HISTORICO | 114 casos × 32 colunas | **Desidentificado.** Não tem coluna de nome e a heurística de nomes em texto livre deu 0 ocorrências. Tem datas de registro (não de nascimento), e o texto livre traz idade e peso esporádicos. Risco baixo, mas convém uma revisão humana antes de qualquer uso. |
| POOL_B_26_ARQUETIPOS | 26 × 25 | **Sim.** A coluna `Paciente` tem nomes completos de pacientes em 8 linhas; as outras 18 são "Caso Órfão". Há também as colunas `Idade`, `Sexo` e CID. |
| POOL_C_55_SESSAO_EST | 55 × 18 | **Sim.** A coluna `Paciente/Identificação` tem nomes de pacientes em 22 linhas. Em pelo menos 1 linha aparece também **número de prontuário**, com menção a diferenças de data de nascimento e idade entre homônimos. Há ainda as colunas `Idade` e `Sexo`. |
| FARMACOS_POR_CASO_POOL_B | 57 | **Sim.** A coluna `Paciente` tem nomes de pacientes em 17 linhas; as outras 40 são "órfão". |
| PROTOCOLOS_AUDITORIA_DOSE | 22 itens | Não tem nome. Cita Caso# do Pool A, idade (1 vez), peso (1 vez) e comorbidade. Risco baixo. |
| TRIALS_EVIDENCIA | 7 itens | Não tem PHI. |

- O arquivo não tem CPF nem CNS no padrão de 15 dígitos, e também não tem telefone nem endereço. As ocorrências de "CEP/rua" eram falsos positivos, como "Herceptin".
- **Veredito:** o arquivo B, inteiro, fica fora do repo, porque as abas de Pool B, Pool C e FARMACOS têm PHI real. O destino correto dessas abas é o `ONCOMED_PHI_VAULT`.

---

## 2. O que é cada arquivo

### A — "Análise e avaliação de consultas" (PDF)
É uma saída de chat com IA exportada para PDF: uma crítica operacional de 2 consultas gravadas (Plaud). Uma foi primeiro atendimento oncológico (~17 min 42 s) e a outra um retorno administrativo (~2 min 52 s).

O texto propõe:
- um diagnóstico de onde se perde tempo;
- um "score" por dimensão (competência clínica 8,5; eficiência 5,5; estrutura 6; comunicação 8; coordenação MDT 9; geral 6,8);
- um checklist de consulta com tempo-alvo;
- um esboço de interface TypeScript (`ConsultaTask`).

Não é um instrumento validado. É uma opinião gerada por IA, com n = 2.

**Uso para o app:** módulo de **consulta** (roteiro e checklist), **plano de saída** e uma futura **métrica de qualidade e eficiência de consulta**, como feedback opcional ao médico, nunca como nota punitiva.

### B — "oncoMed CONSOLIDADO 2026-08-23" (XLSX)
É a consolidação de 6 planilhas "Registro Estatístico" em 3 pools distintos (A 114 + B 26 + C 55 = 195 linhas, que **não** correspondem a 195 pacientes únicos), mais 2 abas de auditoria e a especificação de um método de ID canônico.

- **Colunas do Pool A:** legacy_pool, legacy_id, pac_id, enc_id, Nº, Data reg., Sítio primário, Topografia, Lateralidade, Histologia, Grau, Estádio, TNM, Linfonodos, Sítios de metástase, MMR, RAS, BRAF, HER2, Marcador, Valor, ECOG, Comorbidades, Linha, Esquema QT, Alvo/Biológico, Ciclos plan., Ciclos feitos, Intercorrências, Status, Observações.
- **Colunas do Pool B:** acrescenta CID informado versus "CID correto (nota)", cT/pT, cN/pN, cM, subtipo molecular, protocolo atual, ciclo, fármacos atuais e prévios, e fonte.
- **Colunas do Pool C:** acrescenta "Alerta clínico levantado" e CID.
- **Distribuição do Pool A por sítio:** mama 41, próstata 18, cólon 5, reto 5, colo do útero 5, gástrico 4, pulmão 3 e mais ~20 sítios raros. Pelo estádio, IV é o mais frequente (26). O ECOG está como "NI" em 83/114 casos (73%).

**Uso para o app:**
- **estatística/registro** (modelo de colunas);
- **identidade PAC/ENC**;
- **auditoria de prescrição** (regras de checagem de dose e BSA);
- **auditoria de evidência** (trials);
- **APAC**, pela divergência entre o CID informado e o correto.

---

## 3. Aproveitável SEM PHI

### 3.1 Critérios de avaliação de consulta (extraídos de A)
1. **Roteiro fixo** com checkbox: Dados → Queixa + exame focado → Labs (só as mudanças) → Explicação oncológica → Coordenação com especialista → Prescrição → Plano de saída.
2. **Tempo-alvo por bloco** (sugestão do PDF, a calibrar): dados 60 s, queixa/exame 180 s, labs 120 s, explicação 120 s, coordenação 60 s, saída 30 s. Total ~10,5 min para o primeiro atendimento SUS. A referência citada é ~12 min por slot no SUS hospitalar, contra ~45 min no consultório privado.
3. **Labs: só o que mudou.** Labs estáveis cabem numa frase única ("estáveis, sem ação"), sem repetir valores já normalizados.
4. **Sem digressão fora do caso:** conteúdo não relacionado ao diagnóstico do paciente vai para a lista "estudar depois".
5. **Explicação para leigo:** decisão SIM/NÃO + porquê em 2 frases. O apoio pode ser visual, como um slide padrão por tumor (mama, colo, linfoma).
6. **Plano de saída obrigatório (30 s)**, verbal e escrito, com o modelo: "Plano hoje: [ação]. Labs em [dias]. Voltar em [data]. Dúvidas? Procure se [sinais de alarme]."
7. **Alarmes de segurança no checklist**, por exemplo Hb < 10.
8. **Anamnese pré-consulta capturada** (Plaud/voz) e validada pelo médico, em vez de coletada do zero.
9. **Dimensões de score:** competência clínica, eficiência temporal, estrutura, comunicação com o paciente e coordenação MDT.
10. **Pontos fortes a preservar como critério:** interpretação dos labs no contexto do TNM e da medicação, bloqueio explícito de suplementos de risco, coordenação ativa com a radioterapia e validação de sintomas sem minimizar.

**Ressalva:** n = 2, sem validação e com viés de "eficiência a qualquer custo". O tempo-alvo deve ser parâmetro configurável e servir de feedback privado; não deve ser regra dura.

### 3.2 Regras de identidade (extraídas de B, aba METODO_ID_CANONICO)
- Dois níveis: **PAC-ID** (paciente, permanente) `PAC-{AAAA}-{NNN}` e **ENC-ID** (encontro) `{PAC-ID}-E{NN}`.
- `encounter_type ∈ {CASO_NOVO, RETORNO_QT, SEGUIMENTO}`.
- O próximo PAC-ID sequencial pode ser automático quando não há correspondência por nome, CPF ou CNS. O próximo ENC-ID também pode ser automático quando o PAC-ID já está confirmado.
- **Reconciliação de identidade NUNCA é automática:** um match sugerido fica marcado como INFERRED até confirmação humana com ator registrado.
- IDs legados não são renomeados; ganham `legacy_pool` + `legacy_id`. Registro sem nome fica `SEM_IDENTIDADE`, para não fabricar identidade (RAC-01).
- Os pools não são fundidos por semelhança clínica, pois isso seria inferência de identidade.

### 3.3 Regras de auditoria de prescrição (extraídas de B, aba PROTOCOLOS_AUDITORIA_DOSE)
Candidatas a checagens automáticas do motor de prescrição e da fila do salão:
1. **BSA implícita por droga** = dose prescrita ÷ dose do protocolo. A BSA implícita deve ser a mesma em todas as drogas do mesmo ciclo. Tolerância proposta: ≤ 3% é arredondamento de frasco; 5–6% pede verificação; ≥ 10% é erro (casos reais na planilha com 13% e 27%).
2. **Peso versus BSA:** se o peso documentado não for compatível com a BSA usada, alertar risco de peso desatualizado.
3. **Carboplatina por Calvert:** bloquear ou alertar quando não houver ClCr medido ou quando a função renal estiver "pendente".
4. **Nome do esquema versus composição:** o rótulo precisa bater com as drogas e doses. Exemplo da planilha: um esquema rotulado "FLOX" sem oxaliplatina e com folinato em dose de Mayo.
5. **Campo "dose de protocolo" vazio ou 0:** marcar como incompleto, mesmo quando a dose reconstruída parece correta.
6. **Mesna:** cobertura nos 3 tempos (0 h / 4 h / 8 h) quando houver ifosfamida.
7. **Pré-medicação de paclitaxel:** o antialérgico VO precisa de antecedência maior (30–60 min) que o bloco EV.
8. **Consistência interna do item:** o tempo de infusão do texto precisa bater com o da coluna, e a sequência (Y/concomitante) não pode ser contraditória.
9. **Variante institucional deliberada** (ex.: FOLFIRI sem bolus de 5-FU): registrar como desvio local documentado, não como erro.
10. **Status de auditoria** em vocabulário fechado: CORRETO, OK (rounding), DIVERGÊNCIA BSA, A CONFIRMAR, ATENÇÃO, CAMPO INCOMPLETO, ERRO.

### 3.4 Auditoria de evidência (aba TRIALS_EVIDENCIA)
- Modelo de colunas: patologia, trial, braços, desfecho primário, HR, SG, SLP e status de verificação (✅ VERIFICADO com referência / ⚠ NÃO VERIFICADO).
- Trials registrados: PRODIGE-7, MINDACT, RxPONDER, CREATE-X, KEYNOTE-522 (há 2 linhas, uma verificada e uma não, com números divergentes) e I-SPY2.
- **A lição do registro é a regra:** a IA citou números errados várias vezes (PRODIGE-7 com benefício inexistente, percentuais de CREATE-X e KEYNOTE-522). Toda cifra de trial no app precisa de fonte verificada; se não tiver, aparece como "não verificado".

### 3.5 Modelo de registro estatístico
- As colunas do Pool A servem de base para o esquema de registro desidentificado do app (sítio, histologia, estádio/TNM, biomarcadores MMR/RAS/BRAF/HER2, ECOG, linha, esquema, ciclos planejados/feitos, intercorrências, status).
- **Achados de qualidade de dado:** ECOG não informado em 73% dos casos; estádio, linha e status em texto livre heterogêneo. Esses campos precisam de **vocabulário controlado** (ECOG 0–4/NI; linha 1L/2L/…; cenário neo/adj/paliativo; status em lista fechada), com observação livre em campo separado.
- Para APAC, guardar o par "CID informado" / "CID correto", já que a divergência é recorrente.

---

## 4. Comparação com `docs/referencias/protocolos/` e `corpus/fichas/`
A fonte de comparação é `protocolos-citotoxicos-revisado-silas.csv` (60 protocolos, 9 tumores) e as fichas derivadas. Os dados de B vêm de prescrições reais auditadas, não de uma tabela-mestre de protocolos. Por isso as divergências abaixo pedem decisão clínica e **não** devem ser aplicadas automaticamente.

| Esquema | Repo (CSV/ficha) | Consolidado B | Situação |
|---|---|---|---|
| AC (mama) | Doxo 60 / Ciclo 600 mg/m², infusão 10 / 30 min | 60 / 600, infusão 15 / 60 min | Dose igual; tempo de infusão diverge |
| Paclitaxel semanal (carbotaxol) | Pacli 80 mg/m² + Carbo AUC 2 | Pacli 80; carbo AUC 2 (Pool A) e **AUC 1,5** num caso de cabeça e pescoço | AUC 1,5 não existe no repo |
| Carbotaxol semanal **cabeça e pescoço** | Não existe (CP só tem 21/21: pacli 175 + AUC 5) | Usado (pacli 80 + carbo AUC 1,5) | **Esquema novo** |
| FOLFIRI | Irino 180, FA 400, 5-FU 1200 mg/m² D1 e D2 em 8 h sem bomba (desvio local) | Irino 180, FA 400, 5-FU 2400 mg/m² em 46 h com infusor elastomérico, sem bolus | Dose total igual; **modo de infusão diverge** (46 h com infusor versus 8 h D1/D2). Os dois omitem o bolus. |
| XELOX/CAPOX | Oxali 130 mg/m² | Oxali 130 + cape 2000 mg/m²/dia D1–14 | Igual |
| Mayo (5-FU+LV) | FA 20 + 5-FU **425** mg/m² D1–5 | Rotulado "FLOX": FA 20 + 5-FU **500** mg/m², sem oxaliplatina | **Divergência:** não corresponde nem ao Mayo do repo nem ao FLOX. O repo já tem a pendência "Mayo: manter ou marcar obsoleto". |
| FLOX | Não existe | Rótulo usado de forma incorreta | Não criar ficha sem decisão |
| GEMOX (oxali ~100 + gem ~1000) | Não existe | Usado | **Esquema novo** |
| Ifosfamida + Mesna (+ gencitabina, topotecana) | Não existe | Usado (ifo 1800 mg/m², mesna 2×900) | **Esquema novo** (o repo não cobre sarcoma, ovário ou ginecológico) |
| AC-TH / AC→T + trastuzumabe | Não existe ficha anti-HER2 | Usado | Novo (anti-HER2 fora do escopo citotóxico atual) |
| FOLFIRI + bevacizumabe; temozolomida; cisplatina semanal + RT (colo) | Não existe | Usado | Novos |
| Antiemese sem NK1 em AC | Pendência aberta no LEIA-ME | Registrado como "regra institucional, não erro" | **Confirma** a pendência; o Dr. Silas precisa ratificar |

**Sítios do Pool A sem cobertura no repo:** colo do útero (5), ovário, útero, rim, tireoide, SNC, melanoma, canal anal, fígado, GIST, CUP e cabeça e pescoço neuroendócrino.

---

## 5. O que fica FORA do repositório
- O PDF A inteiro, porque tem primeiros nomes de pacientes, o nome da instituição e detalhes clínicos.
- O XLSX B inteiro e qualquer exportação das abas POOL_B_26_ARQUETIPOS, POOL_C_55_SESSAO_EST e FARMACOS_POR_CASO_POOL_B, que contêm nomes, prontuário, idade e sexo. Destino: `ONCOMED_PHI_VAULT`.
- O POOL_A e as abas de auditoria **só** entram no repo depois de revisão humana do texto livre, porque têm idade, peso e datas esporádicos. Mesmo assim, entram como agregado ou regra, nunca como linha de caso.
- Os 30 PAC-IDs propostos (8 do B + 22 do C) aguardam confirmação médica e não devem aparecer no repo.

## 6. Próximos passos sugeridos (decisão do Dr. Silas)
1. Ratificar as regras 3.3 (BSA, Calvert, mesna, nome × composição) como validações do motor de prescrição e do salão.
2. Decidir sobre FOLFIRI (46 h com infusor versus 8 h D1/D2), Mayo (425 versus 500, ou obsoleto) e AUC 1,5 versus 2 no carbotaxol semanal.
3. Decidir se GEMOX, carbotaxol semanal de cabeça e pescoço, ifosfamida/mesna e os regimes ginecológicos entram na biblioteca de fichas.
4. Adotar PAC-ID/ENC-ID + `encounter_type` como esquema canônico, verificando a compatibilidade com a spec v1.1.
5. Transformar os critérios 3.1 em checklist de consulta configurável, com plano de saída obrigatório.
