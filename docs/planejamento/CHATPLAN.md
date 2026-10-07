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
