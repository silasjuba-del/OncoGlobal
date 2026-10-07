# Fonte M-N · PLN-010 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal. Não editar. (O texto cita o `PROGRAMA_FASE_A.md` como "Texto colado" — o documento está em `docs/referencias/governanca-qt-hbem/`.)

Agora temos o documento primário da governança, não apenas lembranças. Ele esclarece vários pontos que estávamos reconstruindo.
1. Hierarquia original documentada
O `PROGRAMA_FASE_A` estabelece explicitamente:

```
Dr. Silas
    ↑
OncoAssist = OncoAgent
    ↑
síntese
    │
Maestro
    │
grafo / roteamento
    ├── ORK-1 → supervisão da execução técnica
    └── ORK-2 → supervisão da completude clínica
            │
      executores especializados
            │
         Harness
```

O documento diz literalmente que “Maestro roteia; ORK-1 supervisiona execução técnica; ORK-2 supervisiona completude clínica” e que os papéis não implicam necessariamente processos ou chamadas LLM separadas. Texto colado
Portanto, eu retiro a hipótese recente de `ORK-1=computacional / ORK-2=médico` como se fossem dois cérebros independentes. A formulação original é mais precisa: são supervisores do grafo, técnico e clínico.
2. OncoAssist está definido no próprio documento
A definição canônica encontrada é forte:
OncoAssist é o nome de produto do OncoAgent oncológico transversal: um agente, não dois cadastros.
Ele informa, pesquisa, prepara rascunhos, sugere direção, alerta e organiza pendências. Maestro fornece caminhos, sites e playbooks e roteia tarefas. Texto colado
Com a evolução que fizemos agora, eu manteria:

```
OncoAgent = CLASSE
     ↓ instancia
OncoAssist = IDENTIDADE/PRODUTO
```

Isso é uma extensão compatível, não uma contradição do documento de setembro.
3. Determinismo também ficou resolvido
O documento confirma exatamente sua correção:

```
DETERMINÍSTICO
├─ roteamento
├─ permissões
├─ validação estrutural
├─ idempotência
└─ merge

NÃO DETERMINÍSTICO
└─ raciocínio/resposta da LLM
```

E ainda afirma que schema válido não prova correção clínica. Texto colado
Portanto, aqueles `if/else` terapêuticos do protótipo Kimi ficam definitivamente fora da constituição arquitetural.
4. Harness não é detalhe: é componente estrutural
O documento define:

```
pedido
→ Maestro/grafo
→ MEMORY_OS / BRAIN_OS
→ executor
→ Harness proporcional ao risco
→ resultado/minuta
→ revisão
→ registro
```

E o Harness verifica identidade, proveniência, contratos, conflitos/negações, fronteiras de dados, efeitos repetidos e falhas de ferramentas. Texto colado
Isso precisa voltar para nossa planta atual.
5. OncoBoard original
Também está documentado:

```
ONCOBOARD
├─ Oncologia Clínica
├─ Cirurgia Oncológica
├─ Radioterapia
└─ opcional: segunda persona oncológica crítica
```

Máximo padrão proposto: duas rodadas; divergências preservadas; OncoAssist produz síntese única; consenso entre personas não aumenta evidência nem decide conduta. Texto colado
Isso coincide praticamente integralmente com o que você vinha descrevendo.
6. O grafo correto é econômico
Outra decisão importante recuperada:

```
STANDBY
READY
RUNNING
WAITING_INPUT
DONE
FAILED
```

Só acorda quem é necessário. Nada de “sociedade de agentes” permanentemente ativa. Executor recebe contexto mínimo, limites de ferramentas/chamadas/tokens/destinos e `stop_conditions`. Texto colado
Isso é essencial para a Suite solo.
Planta reconstruída v0
Combinando fonte original + decisões novas já explicitamente feitas por você, eu reconstruiria provisoriamente:

```
                    LLM CONSTITUINTE
                     "OMBRO AMIGO"
                           │
                           ▼
                 ┌──────────────────┐
                 │ CLASS: ONCOAGENT │
                 │ capabilities     │
                 │ permissions      │
                 │ territories      │
                 │ boundaries       │
                 └────────┬─────────┘
                          │ instancia
                          ▼
                    ┌───────────┐
DR. SILAS  ◄───────►│ ONCOASSIST │◄──────► LLMs/AGENTES EXTERNOS
                    └─────┬─────┘          ChatGPT/Claude/Grok/...
                          │
                 somente chefias
                  ┌───────┴────────┐
                  ▼                ▼
               MAESTRO         ONCOCHIEF
                  │
                  ▼
              GRAFO FINITO
                  │
          ┌───────┴────────┐
          ▼                ▼
        ORK-1            ORK-2
     supervisão        supervisão
      técnica            clínica
          └───────┬────────┘
                  ▼
             EXECUTORES
        skills/tools/MCP/API
        LAB/RAD/PATH/CTCAE...
                  │
                  ▼
               HARNESS
                  │
          PASS / WARN / FAIL
                  │
                  ▼
         MAESTRO / ONCOCHIEF
                  │
                  ▼
              ONCOASSIST
                  │
                  ▼
              DR. SILAS
```

MEMORY_OS e BRAIN_OS são infraestrutura transversal do grafo, não subordinados cognitivos conversacionais. O documento define Memory como fontes/documentos/versões e Brain como conhecimento operacional revisado, skills, falhas e melhorias. Texto colado
Há, porém, uma lacuna documental real: neste `PROGRAMA_FASE_A.md` não aparece `OncoChief`. Logo, `OncoChief` vem de uma evolução posterior/arquivo diferente. Não vou encaixá-lo definitivamente ao lado ou acima do Maestro até recuperarmos essa fonte.
Próximo movimento correto: procurar no projeto Governança especificamente `ONCOCHIEF`, `ORK-1`, `ORK-2`, `OMBRO AMIGO` e `OncoAgent`. Aí reconstruímos a árvore com evidência documental, em vez de continuar pela memória.
