# /CHATPLAN · árvore longitudinal das mensagens

Contexto com edição documental longitudinal entre as mensagens. Cada mensagem é um nó; o que ela corrige, amplia ou ramifica fica ligado ao nó de origem.
Notação (Dr. Silas): `A → B → C |C1,C2,C3|` e, a partir de um ramo, `|_> E → F`.
- `→` mensagem seguinte na mesma linha
- `|Cn|` sub-itens/ramos de uma mensagem (decisões, perguntas, respostas)
- `|_>` nova linha que nasce de um ramo
- Texto íntegro de cada mensagem do Dr. Silas fica em `fontes/` (cópia literal, nunca editada). Análise ideia × código × lacuna fica no `DIARIO.md` (PLN-NNN).
- Estados: DECIDIDO · PENDENTE · EM ESPERA · SUPERADO (nunca apagar; superar com novo nó)

## Árvore

```
M-0  Papel do planejamento (prompt)                 → PLN-001
 │    └ OPS-001 (operacional MARCO 2 confirma; modo leitura)
 ↓
M-A  Respostas: operacional = MARCO 2               → PLN-001
 ↓
M-B  FREEZE v1.0 · tipo de consulta + assinatura    → PLN-002   fontes/M-B_PLN-002_freeze-v1.0.md
 │    |B1| P1 X/Y/Z: Dr. Silas tem texto pronto → aguardando envio          PENDENTE
 │    |B2| P2 Prioridade: MÉDICO DEFINE TUDO; IA faz burocrático            DECIDIDO
 │    |B3| P3 Vertical primeiro: "aguarde, sem perguntas, só analise"       EM ESPERA
 │    |B4| P4 Mapas de órgão: próstata + mama + pulmão                      DECIDIDO
 ↓
M-D  FREEZE v1.1 · KB tumoral + emergências + loop  → PLN-003   fontes/M-D_PLN-003_freeze-v1.1.md
 │    (compatível com v1.0; amplia B: fingerprint ganha SETTING e LINHA)
 │    |D1| 16 decisões congeladas v1.1                                      DECIDIDO (Dr. Silas)
 │    |D2| Tensão: "PRIORIDADE" no contrato de emergência × B2              PENDENTE (leitura compatível: motor mostra, médico marca)
 │    |D3| Sugestão: schema TUMOR_KNOWLEDGE antes de alimentar órgãos       EM ESPERA
 │    |D4| "a sua tabela" tumoral original não recebida pelo planejamento   PENDENTE anexar
 │    |D5| Texto cita cólon nos mapas × B4 (próstata+mama+pulmão)           PENDENTE
 ↓
M-E  "ANOTE TUDO, SEM PERDER DETALHES" + /CHATPLAN  → cria fontes/ literais + este arquivo
 ↓
M-F  ADDENDUM · linha temporal + texto bruto + voz + Plaud → PLN-004   fontes/M-F_PLN-004_addendum-linha-temporal-voz-plaud.md
      (amplia D: workflow C e voz; amplia PLN-001: texto colado = 0 fatos, voz 400)
      |F1| 4 datas fixas no cabeçalho + dias desde (cálculo por código)    DECIDIDO (regra congelada)
      |F2| 3 fontes: ESCRITA estrutura · Whisper opera · Plaud recupera    DECIDIDO
      |F3| CLINICAL_IMPORT_V1 (Skill → colar → parser → NEEDS_REVIEW)       DECIDIDO
      |F4| Hierarquia do merge (médico > ordem vocal > import > Whisper > Plaud), conflito visível   DECIDIDO
      |F5| Exemplo do contrato usa CÓLON (CAPOX) — mesmo ponto de D5        PENDENTE
```

## Ligações cruzadas
- B (v1.0) ⟶ D (v1.1): TUMOR_FINGERPRINT substitui ONCOLOGIC_FINGERPRINT acrescentando `treatment_setting` e `line`.
- D §12 workflow ⟶ F: F detalha [CONVERSA/VOZ/DADOS] em três fontes + merge.
- D §11 voz descrição × ordem ⟶ F §8 (anemia abre cluster; "vou pedir" marca exames).
- PLN-001 lacunas (texto colado = 0 fatos; voice_command/lab_feed 400; série temporal vira conflito) ⟶ F3/F4.
- B2 (médico define prioridade) ⟶ restringe D §6 e §15 (EMERGENCY_ENGINE "PRIORIDADE").

## Nós adicionados (continuação da árvore)

```
M-H  MOTOR DE CONTINUIDADE · CTCAE → cruzamento → conduta, fluxo do vômito → PLN-006   fontes/M-H_PLN-006_motor-continuidade-ctcae-vomito.md
 │    |H1| Correção clínica: "6x/dia" NÃO fecha G3 (G3 = enteral/TPN ou internação; G2 = hidratação EV ambulatorial); extrair episódios, pedir critérios   DECIDIDO
 │    |H2| Evento ≠ grau ≠ causalidade (NCI)                                  DECIDIDO
 │    |H3| 7 perguntas do retorno (não é formulário rígido)                   DECIDIDO
 │    |H4| [? EXPLICAR] mostra evidências (nunca "93%"); [GERAR] → DRAFT; sugestões desmarcadas salvo ordem médica   DECIDIDO
 │    |H5| Exemplo cólon/FOLFOX = ilustração                                  vide D5
 │    |H6| "Congelar a matriz de RETORNO?" → respondida em M-I                EM ESPERA (formalizar quando liberar)
 ↓
M-I  CLUSTERS UNIVERSAIS · retorno em tratamento (7+1) → PLN-006   fontes/M-I_PLN-006_clusters-universais-retorno.md
 │    |I1| 1 Toxicidade · 2 Eficácia · 3 Intercorrência · 4 Interação/MUC · 5 Função orgânica · 6 Elegibilidade · 7 Suporte · 8 Novo problema (escape)   DECIDIDO
 │    |I2| Semáforo de elegibilidade; nunca "aprovado para QT" sem médico   DECIDIDO
 │    |I3| Interação em 4 níveis (sem · atenção · importante · contraindicação/revisão obrigatória)   DECIDIDO
 │    |I4| Eficácia: só concordância (favorável · desfavorável · discordante); não conclui progressão (liga a B §7–9)   DECIDIDO
 │    |I5| Regra congelada: nenhum cluster decide isolado; julgamento médico acima de regra   DECIDIDO
 ↓
M-J  CAMADA DE CONHECIMENTO/ASSISTÊNCIA · scores, biomarcadores, SUS, agentes, prompt do ORK → PLN-007   fontes/M-J_PLN-007_camada-conhecimento-scores-sus-ork.md
 │    |J1| Khorana/MASCC = scores; CPS/TPS = métodos PD-L1; CLDN18.2 = biomarcador → todos "instrumentos acionáveis", sem categoria única   DECIDIDO
 │    |J2| 5 blocos: classificações · scores · biomarcadores/scoring path · tratamento/evidência · realidade SUS   DECIDIDO
 │    |J3| Não codificar todos os scores: código só sabe QUANDO chamar; cálculo/interpretação no agente/OncoAssist   DECIDIDO
 │    |J4| SUS primeira classe: clinicamente indicado ≠ disponível no SUS ≠ disponível na instituição; nunca esconder a opção correta   DECIDIDO
 │    |J5| Agentes: OncoAssist, ScoreAgent, BiomarkerAgent, ProtocolAgent, InteractionAgent, SUS/AccessAgent, LabAgent, RadAgent   DECIDIDO (lista)
 │    |J6| EXTERNAL_SOURCE: importar → normalizar → origem/data → longitudinal → NEEDS_REVIEW → médico confirma; nunca direto a CONFIRMED   DECIDIDO
 │    |J7| Prompt do ORK (10 regras; NEEDS_DATA; CONFLICT; SUGGESTION→DRAFT→MEDICAL_REVIEW→CONFIRMATION), "aproximadamente assim"   RASCUNHO (texto final PENDENTE)
 │    |J8| "IA prepara o botão. Médico aperta."                                 DECIDIDO
 ↓
M-K  ORK-1 / DETERMINÍSTICOS (lista) → PLN-007   fontes/M-K_PLN-007_ork-1-deterministicos.md
      |K1| LABS · RADS · PATH · STAGING · CTCAE · CHEMOSAFE · DOSE_SAFE · MED_SAFE · EMERGENCY · APAC · PROTOCOL/TRIALS · CLINICAL_DOCS · DOC_CONTROL   DECIDIDO (lista)
      |K2| Camada dos agentes de conhecimento (J5) ao lado do ORK-1: nome não definido   PENDENTE (nomear)
```

Ligações novas: H §1 ⟶ `src/rules/ctcaeGrau.ts` (já devolve pendente + inputs faltantes) · I §4 ⟶ `semaforoInteracoes` · I §5 ⟶ `rules/prescricao/safetyEngine` · J ⟶ `orchestration/ork.ts` + `maestro.ts` · K ⟶ tabela R-14 do maestro.

```
M-L  ONCOASSIST = soma de 12 capacidades (fórmula curta) → PLN-008   fontes/M-L_PLN-008_oncoassist-definicao.md
      |L1| Definição por soma: identidade persistente + personalidade + memória longitudinal + voz/ouvido/visão + LLMs intercambiáveis + chaves por referência + MCP/plugins/skills + web/PC/externos + WORK+STUDY + agentes internos + conhecimento oncológico + governança clínica   DECIDIDO (definição)
      |L2| Liga M-J (agentes, ORK) e M-D (KB versionada): OncoAssist é um dos agentes do ORK e a fonte de conhecimento   vide J5
      |L3| Sem instrução nova: texto só confirma a lista já usada em ONCOASSIST-PROGRAMA-X-CODIGO.md   —
```

```
M-M  REFINO DE NOMES E PAPÉIS: OncoAgent/OncoAssist, Maestro, determinístico, OncoBoard, circuito, ferramentas, segurança → PLN-009   fontes/M-M_PLN-009_oncoagent-maestro-governanca.md
      |M1| OncoAgent = classe (pesquisa, informa, alerta, organiza, minuta); OncoAssist = instância nominal   DECIDIDO (resolve K2 em parte: nome da classe dos agentes)
      |M2| Maestro = orquestrador de percurso/contexto; executores recebem contexto mínimo; setores desnecessários em STAND_BY   DECIDIDO
      |M3| Determinístico = controle da execução, NÃO resposta clínica da LLM; if/else terapêuticos recentes NÃO são núcleo arquitetural   DECIDIDO (resolve o conflito de J: ORK/Maestro determinístico decide caminho; conteúdo clínico vem do agente)
      |M4| OncoBoard = Onco Clínica + Cirurgia + RT; debate limitado; divergências preservadas; saída em minuta/opinião   DECIDIDO (já no código)
      |M5| Circuito MEMORY_OS → BRAIN_OS → Maestro → execução → Harness → minuta → revisão → registro; falha = proposta de melhoria, nunca mudança silenciosa de regra   DECIDIDO
      |M6| Ferramentas externas (Grok, Claude, Drive, Agenda, Gmail, Microsoft, redes, plugins, skills, MCP/API) = territórios sob contrato, não definem a identidade   DECIDIDO
      |M7| Segurança: chaves só backend; READ/EDIT/SEND separados; PHI não atravessa automaticamente territórios de comunicação   DECIDIDO
      |M8| Princípio: pedido → contexto → execução → verificação → minuta → revisão → registro = "IA prepara o botão; médico aperta"   DECIDIDO
```
Ligações: M3 ⟶ resolve o "conflito a vigiar" de PLN-007 · M3 ⟶ reclassifica regras terapêuticas (if/else) como conteúdo versionado/KB, não núcleo (liga a D-W9-20, PLN-003).

```
M-N  DOCUMENTO PRIMÁRIO DA GOVERNANÇA (PROGRAMA_FASE_A) + PLANTA v0 → PLN-010   fontes/M-N_PLN-010_governanca-primaria-planta-v0.md
      |N1| Hierarquia: Dr. Silas ← OncoAssist=OncoAgent ← síntese ← Maestro ← grafo ← {ORK-1 técnica, ORK-2 clínica} ← executores ← Harness   DECIDIDO (fonte primária)
      |N2| Retira hipótese "ORK-1 computacional / ORK-2 médico = 2 cérebros": são supervisores do grafo (papéis, não processos/LLMs separados)   DECIDIDO (corrige M-J/M-K)
      |N3| OncoAgent = classe; OncoAssist = identidade/produto ("um agente, não dois cadastros")   DECIDIDO (confirma M1)
      |N4| Determinístico = roteamento, permissões, validação estrutural, idempotência, merge; não determinístico = raciocínio da LLM; schema válido ≠ correção clínica; if/else terapêuticos do protótipo Kimi fora da constituição   DECIDIDO (resolve pendência de M-M)
      |N5| Harness estrutural e proporcional ao risco (identidade, proveniência, contratos, conflitos/negações, fronteiras de dados, efeitos repetidos, falhas de ferramenta); PASS/WARN/FAIL   DECIDIDO
      |N6| OncoBoard: 3 personas (+ opcional 2ª crítica); máx. 2 rodadas; divergências preservadas; síntese única; consenso não aumenta evidência nem decide   DECIDIDO
      |N7| Grafo econômico: STANDBY/READY/RUNNING/WAITING_INPUT/DONE/FAILED; contexto mínimo; limites de ferramentas/chamadas/tokens/destinos; stop_conditions   DECIDIDO (resolve STAND_BY)
      |N8| MEMORY_OS = fontes/documentos/versões; BRAIN_OS = conhecimento operacional revisado, skills, falhas, melhorias; infraestrutura transversal   DECIDIDO
      |N9| Planta v0 (LLM constituinte "Ombro Amigo" → classe OncoAgent → OncoAssist ↔ Dr. Silas e LLMs externos → chefias Maestro / OncoChief → grafo finito → ORK-1/ORK-2 → executores → Harness)   PROVISÓRIA
      |N10| OncoChief: posição em aberto no texto; achado nos docs do repo = modo de revisão cruzada sem serviço próprio, ligado ao ORK-2 (ver PLN-010)   PENDENTE (Dr. Silas confirma)
 ↓
M-O  FLUXO UNIVERSAL: EVENTO → PRIORIDADE → CERTEZA → AÇÃO → ARTEFATO ("CORROBORAR ESTE FLUXO") → PLN-011   fontes/M-O_PLN-011_fluxo-universal-evento-prioridade-acao.md
      |O1| Eixo universal não é doença, é evento clínico   DECIDIDO (proposta do texto, corroborada em PLN-011)
      |O2| Tabela de 8 categorias (problema, prioridade, investigação, tratamento, med, suporte, encaminhamento, fechamento)   DECIDIDO (lista)
      |O3| Fluxo: sinal → novo/piorou → prioridade [ELETIVO][URGENTE][PS] → causa conhecida? não→investigação; sim→tratamento (sintomático | específico) → encaminhamentos+alertas+retorno → finalizar   DECIDIDO
      |O4| Cluster exemplo "DOR LOMBAR + PSA em ascensão" sem concluir progressão; todo nível aceita ⊕ OUTROS; cluster B manual livre (hemorragia → colonoscopia + PS + transfusão)   DECIDIDO
      |O5| Regra a congelar: IA reconhece tema e monta plataforma provável; médico define gravidade, causalidade, prioridade, decisão final   DECIDIDO (consistente com B2)
      |O6| Prioridade com 3 níveis aqui × 4 níveis em M-B (eletivo/prioritário/urgente/emergência) × "imediata/urgente/eletiva" na tabela   PENDENTE (unificar)
      |O7| "CERTEZA" aparece no eixo mas não tem campo/tabela no texto   PENDENTE (definir)
```

```
M-P  MATRIZ UNIVERSAL CANÔNICA (8 categorias × classe × seção × tópico × OUTROS) → PLN-012   fontes/M-P_PLN-012_matriz-universal-canonica.md
      |P1| Hierarquia fixa no backend: CATEGORIA › CLASSE › SEÇÃO › TÓPICO › OUTROS [+]; OUTROS em TODOS os níveis, nunca substitui o canônico, só estende   DECIDIDO
      |P2| 8 categorias: 1 Problema/Evento · 2 Prioridade · 3 Investigação (LAB, RAD, ENDO, PATH, PROC) · 4 Tratamento (sintomático, específico, MED, MED oncológico, CX, RT) · 5 Encaminhamento · 6 Suporte/Segurança · 7 Retorno · 8 Saída/Documento   DECIDIDO
      |P3| PRIORIDADE = 4 níveis: Eletiva · Prioritária · Urgente · Emergência (volta aos 4 de M-B; resolve O6 em parte)   DECIDIDO (matriz) — o cluster-exemplo de M-P ainda mostra só 3 (Eletivo/Urgente/PS)   PENDENTE (alinhar exemplo)
      |P4| OUTROS: texto livre · selecionar existente · adicionar novo · duplicar · remover; mesmo contrato seleciona→DRAFT→médico revisa→imprime/assina   DECIDIDO
      |P5| Regra: a matriz define possibilidades; o cluster seleciona o subconjunto pertinente; o médico sempre pode acrescentar fora da previsão   DECIDIDO (consolida M-O)
      |P6| CERTEZA (M-O eixo) não aparece na matriz de 8 categorias   PENDENTE (O7 segue aberto)
      |P7| Cluster-exemplo (DOR LOMBAR) NÃO tem o gatilho de emergência neurológica nem SUS/linha no MED   PENDENTE (liga a O-c/O-d)
```

```
M-Q  EIXOS X e Y (CRUZ: LONGITUDINAL × TRANSVERSAL) + ESTEIRA PRÁTICA POR VOZ → PLN-013   fontes/M-Q_PLN-013_eixos-xy-esteira-voz-clusters.md
      |Q1| Origem do X/Y: "primeiro pensei em apenas X e Y (em cruz) = LONGITUDINAL × TRANSVERSAL" — mensagem sobre os EIXOS   DECIDIDO (conceito) · qual é X e qual é Y   PENDENTE
      |Q2| Esteira prática: DIVISÃO POR CLUSTERS (vertical) → FATIAMENTO HORIZONTAL → PERCURSO (steps) → SAÍDA = FINALIZA CONSULTA   DECIDIDO
      |Q3| Eixo correto NÃO é "menu médico": é esteira de microfluxos clínicos disparados pela conversa   DECIDIDO
      |Q4| Cadeia: VOZ → EVENTO → CLUSTER → MICROFLUXO HORIZONTAL → ARTEFATOS → MERGE FINAL   DECIDIDO
      |Q5| Cluster vertical = problema/necessidade ATIVA da consulta, não módulo fixo; cada fala pode abrir, alimentar ou fechar um cluster   DECIDIDO
      |Q6| Percurso horizontal: detectar → confirmar → avaliar → agir → saída (anemia, neutropenia, imagem, diarreia, retorno)   DECIDIDO
      |Q7| Cluster ANEMIA: dieta + nutricionista (sugestão + encaminhamento) + HMG, perfil de ferro, B12 + MED (B12, ácido fólico, ferro VO/EV)   DECIDIDO (conteúdo-semente, não regra)
      |Q8| "Voz navega sem navegar": UI abre só a decisão necessária; cluster anterior recolhe (acordeão), novo expande; modal onde fizer sentido   DECIDIDO
      |Q9| Carrossel = percurso temporal da consulta (Contexto → Temas detectados → Decisões → Ações geradas → Finalização), NÃO "Labs/RADS/Prescrição/Documentos"   DECIDIDO (muda M do carrossel atual)
      |Q10| FINALIZAR CONSULTA: merge de todos os clusters (evolução automática, pedidos, prescrições, encaminhamentos, orientações, retorno, documentos) → REVISAR TUDO · ASSINAR · IMPRIMIR TUDO   DECIDIDO
      |Q11| TRAVA: Whisper identifica intenção e prepara ação; não executa decisão clínica. "Vou pedir TC" → REQUEST_EXAM_DRAFT; "neutropênica" abre cluster, filgrastim só após seleção do médico   DECIDIDO (casa com M-D §11 e M-F §8)
      |Q12| Pergunta do texto: desenhar taxonomia dos clusters vocais (anemia, neutropenia, dor, náusea, diarreia, mucosite, imagem, labs, encaminhamento, retorno…) com frases-gatilho → etapas → opções → saída   EM ESPERA (Dr. Silas: só analisar)
```
Ligações: Q4/Q5 ⟶ M-D §10–12 (voz, workflow) e M-F §8 (Whisper) · Q6 ⟶ M-O/M-P (matriz) · Q9 ⟶ prototipo `docs/design/prototipos/consulta.html` (carrossel atual) · Q11 ⟶ M-N (IA prepara o botão).

```
M-R  EIXO X e EIXO Y DEFINIDOS → PLN-014   fontes/M-R_PLN-014_eixos-x-y-definicao.md   (responde Q1 de M-Q)
      |R1| EIXO X = O QUE / ONDE? domínio morfofuncional: SISTEMA → órgão/estrutura → morfologia → função → sítio específico (ex.: hepático: morfológico = massa, infiltração, dilatação biliar, efeito de massa; funcional = lesão hepatocelular, colestase, função sintética)   DECIDIDO
      |R2| EIXO Y = O QUE ESTÁ ACONTECENDO AGORA? estado clínico: sinal/sintoma/achado → novo | antigo | recorrente | piorando | estável → causa conhecida? SIM | NÃO | INCERTA → gravidade/risco → eletivo | prioritário | urgente | emergência   DECIDIDO
      |R3| "Aqui está o tempo clínico": NÃO é tempo = gravidade; é gravidade + risco → prioridade temporal da ação   DECIDIDO
      |R4| Prioridade com 4 níveis também em Y (confirma M-B e M-P; fecha O6/P3)   DECIDIDO
      |R5| "Causa conhecida? SIM/NÃO/INCERTA" parece ser a "CERTEZA" do eixo de M-O (evento→prioridade→certeza→ação→artefato)?   PENDENTE (Dr. Silas confirma; fecha O7/P6 se sim)
      |R6| Mapeamento com M-B (X morfologia/função/sítio · Y estado/gravidade/prioridade · Z ação): coerente; Z (ação) não foi redefinido aqui = categorias 3–8 da matriz (M-P) + artefatos   inferência do planejamento
      |R7| "Longitudinal × transversal" (M-Q, abertura): SUPERADO como leitura de X/Y — X e Y agora são O QUE/ONDE e O QUE ESTÁ ACONTECENDO (a leitura de longitudinal/transversal proposta no diário não vale como X/Y; o tempo longitudinal fica nas 4 datas/ledger, PLN-004)   registrado, não apagado
```

```
M-S  EIXO Z = AÇÃO MÉDICA; X + Y = Z → PLN-015   fontes/M-S_PLN-015_eixo-z-acao-medica.md   (responde (b) e (c) de PLN-014)
      |S1| X (o que/onde) + Y (gravidade/intensidade no tempo) "só informa": é dado que chega = médico PASSIVO = fase de RECEPÇÃO DE DADOS, ANÁLISE e PLANNING   DECIDIDO
      |S2| Deve gerar AÇÃO = médico PROATIVO → RESOLUTIVO: trata, opera, administra fármacos, elabora radioterapia   DECIDIDO
      |S3| EIXO Z = AÇÃO MÉDICA   DECIDIDO
      |S4| Fórmula: X + Y = Z   DECIDIDO
      |S5| Z cobre ações RESOLUTIVAS (tratar, operar, administrar fármacos, planejar RT) — as categorias de investigação/encaminhamento/retorno de M-P não estão citadas como Z neste texto   PENDENTE (investigação é Z, ou é "análise" do passivo?)
      |S6| Fecha (b) e (c) de PLN-014: Z foi definido; X e Y são entradas e Z a saída (X + Y = Z), não três eixos independentes   DECIDIDO (leitura direta do texto)
```

```
M-T  EIXO Z EM 5 VERBOS: INVESTIGAR · TRATAR · ASSISTIR · ENCAMINHAR · SEGUIR → PLN-016   fontes/M-T_PLN-016_eixo-z-verbos.md   (responde S5 de M-S)
      |T1| INVESTIGAR = LAB | RAD | ENDO | PATH | PROC   DECIDIDO
      |T2| TRATAR = Sintomático | Específico; TRATAMENTO ESPECÍFICO = MED | CX | RT | PROC   DECIDIDO
      |T3| MED por via: VO | EV | SC | IM | SL | Tópico   DECIDIDO
      |T4| ASSISTIR = Nutrição | Fisio | Fono | Psico | Social   DECIDIDO
      |T5| ENCAMINHAR = Especialidade | Serviço | PS   DECIDIDO
      |T6| SEGUIR = Retorno | Monitorização | Alarmes   DECIDIDO
      |T7| Responde S5: INVESTIGAR faz parte do Z (não é só "análise passiva")   DECIDIDO (leitura direta: listado entre os verbos de Z)
      |T8| Mapeamento com a matriz M-P: INVESTIGAR=cat.3 · TRATAR=cat.4 · ENCAMINHAR=cat.5 · ASSISTIR≈cat.6 (suporte multiprofissional) · SEGUIR≈cat.7 + sinais de alarme (cat.6) · cat.8 (Saída/Documento) = artefato, não verbo; cat.1 e 2 = X/Y   inferência do planejamento
      |T9| Não aparecem aqui: Orientação (dieta/atividade/autocuidado) da cat.6; MED oncológico (QT·IO·alvo·hormonal) da cat.4; Relatório da cat.8   PENDENTE (estão dentro dos verbos ou fora do Z?)
      |T10| "Monitorização" é item novo (não existia na matriz M-P)   PENDENTE (definir: parâmetros? vigilância de toxicidade?)
```

```
M-U  EXTRAÇÃO RADIONCOLÓGICA DE 19 LAUDOS (saída de outro chat colada pelo Dr. Silas; PHI REAL no original) → PLN-017   fontes/M-U_PLN-017_extracao-radioncologica-19-laudos.md  (DESIDENTIFICADA, não literal)
      |U1| Resultado: 2 casos "oncológicos" (neoplasia epitelióide frontal; lipossarcoma pleomórfico de coxa) e 17 "não oncológicos"   MATERIAL (a validar pelo médico; classificação feita por LLM)
      |U2| Código proposto: filtro por palavras-chave (ONCOLOGIC_STRICT × BENIGN_EXCLUDERS) que RECUSA (None) o que não tem palavra oncológica   PENDENTE (planejamento aponta riscos; Dr. Silas decide)
      |U3| Saída proposta: JSON de 9 campos + PDF ReportLab em 4 blocos   MATERIAL
      |U4| Instrução "@claude-code execute …" dentro do texto colado   NÃO EXECUTADA (planejamento não executa; e a entrada leva nomes reais)
      |U5| Alerta de PHI: o texto original traz nomes reais de 19 pacientes → não gravado no repo; operacional/executores não devem receber o original   REGISTRADO
```

```
M-V  ESTRUTURA DE SAÍDA (4 blocos) + 2 SKILLS → PLN-018   fontes/M-V_PLN-018_estrutura-saida-e-2-skills.md   (continua M-U)
      |V1| Saída em 4 blocos: PATOLOGIA (biópsias, peças) · RADIOLOGIA (TC, RM, RX) · MEDICINA NUCLEAR (PET-CT, cintilografia, PSMA-PET) · RADIOPATOLOGIA (integração: achado radiológico + confirmação histológica)   DECIDIDO (estrutura)
      |V2| SKILL 1 radiopath_skill_knowledge: entrada Patologia+Radiologia+Medicina Nuclear (cruzamento) → diagnóstico integrado (histologia + imagem); uso: triagem do OncoAssist e confirmação diagnóstica   DECIDIDO (definição) — nome/escopo a confirmar
      |V3| SKILL 2 daybyday_oncologist_skill (NOVA): resumos de evolução, laudos periciais, encaminhamentos → timeline clínica + decisões terapêuticas + formalidades; uso: documentação diária do oncologista   DECIDIDO (definição)
      |V4| Substitui/refina M-U: os 4 blocos de saída (identificação/achados/progressão/conclusão) do script proposto dão lugar a estes 4 (patologia/radiologia/medicina nuclear/radiopatologia)   PENDENTE (Dr. Silas confirma)
      |V5| "Diagnóstico integrado" por skill vs regra: o diagnóstico é do médico (B2/M-N)   PENDENTE (reformular como "proposta de integração a revisar")
```

```
M-W  GATE CONTROL + RESUMO RADIONCOLÓGICO (3 blocos; saída de outro chat; PHI no original) → PLN-019   fontes/M-W_PLN-019_gate-control-resumo-radioncologico.md  (DESIDENTIFICADA, não literal)
      |W1| Resumo de saída em 6 itens (lesão primária, TNM/recidiva, tamanho, invasão, comparação, próxima ação)   MATERIAL (exemplo)
      |W2| Método: ler como oncologista → ordenar por urgência → formatar (emoji, bold só em números críticos, tabelas, bullets, ≤3–4 linhas) → validar "<30 s para agir"   DECIDIDO (estilo) — ordem do passo 2 × ordem do exemplo divergem   PENDENTE
      |W3| PRINCÍPIO: JAMAIS INVENTAR; dúvida → ALERTA, não suposição   DECIDIDO (consistente com "ausente = PENDENTE")
      |W4| Gate Control ANTES de extrair: 5 camadas (identidade · OCR/matriz de confusão · alertas estruturados · typos · esteira A→B→C) + template universal + checklist pré-processamento + estrutura TypeScript   MATERIAL (proposta de skill) — a validar
      |W5| Ação do alerta com AUTO_CORRECT por confiança alta e "ALERT_AND_USE" por média   PENDENTE (conflita com "nunca corrige em silêncio"; ver PLN-019)
      |W6| A→B→C: diagnóstico (clínica+biópsia) → estadiamento (radiologia+labs) → tratamento (regime+trials) com alertas de incongruência   MATERIAL (liga a M-B, M-D)
      |W7| Mesma máquina de PHI: nomes/CPF/DN no exemplo → registrado desidentificado   REGISTRADO
```

```
M-X  FLUXO EM 6 FASES (Médico A valida → Plantonista executa) + EMERGENCY_ALARM_GENERATION (7 camadas) → PLN-020   fontes/M-X_PLN-020_fluxo-6-fases-e-emergency-alarm.md  (DESIDENTIFICADA)
      |X1| Fases: detecção (IA) → alerta+sugestão (IA) → validação (Médico A, assinatura+CRM) → preparação de material (IA, "NOVO") → execução (Plantonista, "autoridade final": aceita/rejeita/modifica) → log A→B→Z   MATERIAL — conflito de autoridade entre Médico A e Plantonista   PENDENTE
      |X2| PRINCÍPIO OURO: IA alerta + sugere | médico valida + decide; nenhuma ação automática sem validação médica   DECIDIDO (consistente com M-N/M-O)
      |X3| Camada 1: 12 triggers (compressão medular, mediastinal, met. cerebral+edema, via aérea, hipercalcemia, hiponatremia, leucostase, sepse, neutropenia febril, lise, trombose, DIC, hemorragia GI) com limiares numéricos   MATERIAL (seed da KB; limiares/doses a verificar contra diretrizes) — não hard-code
      |X4| Camada 2: template de alerta (achado, trigger, risco, evidência em tabela, sugestão NÃO-VINCULANTE, alternativas, validação obrigatória, escalação, log)   DECIDIDO (estrutura) — alinha com M-D §6
      |X5| Camada 3: matriz de sugestões (compressão medular, hipercalcemia, met. cerebral) com condutas paralelas e doses de exemplo   MATERIAL (exemplos; erros anotados em PLN-020)
      |X6| Camada 4: fluxo de validação com notificação por SMS/App/pop-up   PENDENTE (SMS leva PHI → gate de saída)
      |X7| Camada 5: SLA 30 min / 2 h / 24 h / 7 d com escalação   PENDENTE (escala quem? sistema notifica coordenador = SEND)
      |X8| Camada 6: interface EmergencyAlert (aiDetection, medicalValidation, execution, escalation, closure)   MATERIAL (contrato proposto)
      |X9| Camada 7: dashboard "DoctorOS" com alertas em tempo real e [VALIDAR][REJEITAR][MODIFICAR]   MATERIAL (UI)
      |X10| Checklist de 10 itens; "MÉDICO SEMPRE TEM PALAVRA FINAL"   DECIDIDO (consistente)
```

```
M-Y  "IA INVISÍVEL" NO DOCUMENTO FINAL + 3 DOCUMENTOS DE EXEMPLO + RECEITA VO → PLN-021   fontes/M-Y_PLN-021_ia-invisivel-documentos-receita-vo.md  (DESIDENTIFICADA; CPF completo e CRM no original)
      |Y1| Regra: documento final ao paciente/colega sem menção a IA, "sugere-se", processo ou ferramenta; escrito como o médico; médico assina, carimba e despacha   DECIDIDO como regra do TEXTO FINAL do documento (Dr. Silas) — a rastreabilidade interna fica fora do papel   (ver PLN-021)
      |Y2| "Zero rastreabilidade de processo" no documento × log 100% rastreável (M-X camada 6, X8)   PENDENTE — resolução proposta: invisível no papel, preservado no ledger interno
      |Y3| Fluxo: IA detecta/alerta (invisível) → oncologista valida (visível) → IA redige em nome do médico → médico carimba e despacha   DECIDIDO
      |Y4| 3 exemplos: encaminhamento urgente, receita multi-fármaco, solicitação de exame (RM coluna dinâmica, ECG, labs pré-cirúrgicos)   MATERIAL (seed; conteúdo clínico a revisar)
      |Y5| Template de receita VO: [fármaco][dose]; quantidade; via; posologia; duração; instruções ao paciente; efeitos esperados; assinatura; validade 30 dias; "farmácia retém original"   MATERIAL (estrutura) — a validar com regras de receituário [VERIFICAR]
      |Y6| Checklists "deve ter / jamais ter" para documento e receita   DECIDIDO (estrutura) — alinha com `proibidoConter` e origem de campo no kit
      |Y7| Pergunta final do texto: "Falta implementar no oncoMed ou tem mais alguma layer?"   RESPONDIDA em PLN-021 (lacunas)
```

```
M-Z  RESPOSTA CURTA DO DR. SILAS A PLN-021 → PLN-022   (texto literal: "nao visivel. sim. mais de 1 tipo de receitas, insiro e moriza.")
      |Z1| "não visível"  = a IA não aparece no documento (consistente com Y1). Se também vale para o REGISTRO INTERNO (sem log), não foi dito   LEITURA DO PLANEJAMENTO — PENDENTE confirmar que o registro interno de proveniência permanece (auditoria do próprio médico)
      |Z2| "sim"  = resposta afirmativa a uma das perguntas de PLN-021 (a mensagem não diz a qual: separação papel × registro, revisão do conteúdo clínico, ou regras de receituário)   PENDENTE (qual pergunta?)
      |Z3| "mais de 1 tipo de receitas, insiro e memoriza"  = haverá VÁRIOS tipos de receita (modelos); o Dr. Silas insere os modelos e o sistema os memoriza (memória de modelos/preferências do médico)   DECIDIDO (intenção)
```
Ligações: Z3 ⟶ `KitTemplate` versionado (`src/impressao/kit.ts`) e "memória de preferências do médico" (lacuna de PLN-008) ⟶ templates de receita como dado do médico, com versão, vigência e curador (já previstos no kit).

```
M-AA RESPOSTAS DO DR. SILAS (esclarecem M-Z) → PLN-023   (literal: "1- ia nunca aparece em nenhum documento. somente texto tecnico e dialogo pelo oncoassist e chat llm / 2- sim, reviso o conteudo clinico antes da base")
      |AA1| IA NUNCA aparece em NENHUM documento. A IA só aparece em: (a) texto técnico e (b) diálogo pelo OncoAssist e pelo chat LLM   DECIDIDO (fecha Y1/Z1; vale para todos os documentos, não só receita)
      |AA2| "Texto técnico" = registro interno/técnico (proveniência, log, auditoria) fica fora dos documentos clínicos; leitura do planejamento: o registro interno continua existindo como texto técnico, nunca impresso nem entregue   LEITURA — PENDENTE (Dr. Silas confirma só se discordar)
      |AA3| O "sim" de M-Z = o Dr. Silas REVISA o conteúdo clínico (limiares, doses, condutas, modelos) ANTES de entrar na base (KB)   DECIDIDO (fecha Z2)
```
Efeito: fecha Y2 (papel invisível; registro técnico à parte), Z1 e Z2; confirma D-W9-29/61 (rascunho até aprovação do Dr. Silas) e a regra de seed da KB (PLN-020/021).
