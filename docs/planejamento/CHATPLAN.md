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
