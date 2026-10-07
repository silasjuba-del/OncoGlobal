# OncoAssist e "Programa Fase A" × o que existe no código (2026-10-07)

> Textos colados pelo Dr. Silas (chat do projeto GOVERNANÇA). Documentos originais copiados para `docs/referencias/governanca-qt-hbem/` (PROGRAMA_FASE_A, REVISAO_DAS_ABAS, CONTRATO_CLI_CODEX_CLAUDE, GOVERNANCA_VERTICAL_CHATS, ESTADO_SUITE…, README). Legenda: ✅ existe · 🟡 parcial · ❌ não existe · ⏸ decidido não ligar na v1.

## OncoAssist = soma de capacidades
| Capacidade | No código | Onde / observação |
|---|---|---|
| Identidade persistente | 🟡 | Definida na RAIZ CANÔNICA §3; no app é rótulo/painel ("Capacidade IA não habilitada") |
| Personalidade | ❌ | Sem prompt de sistema/persona do OncoAssist no código |
| Memória longitudinal | 🟡 | Ledger + projeções + timeline (Fugu) existem; memória de preferências do médico, não |
| Voz / ouvido / visão | 🟡 | Comando de voz curto (Deepgram, gate G-23) e Plaud manual; visão de imagem desligada (D-W9-40) |
| LLMs intercambiáveis | ❌ | Provider único decidido (D-W9-15), desligado; sem model router (RAIZ §6) |
| API keys por referência segura | 🟡 | Regra registrada (só backend, nunca em código/front/log); sem cofre de chaves implementado |
| MCP / plugins / skills | ⏸ | Listados em Configurações, nascem desligados (D-W9-16); sem tool orchestrator |
| Web / PC / sistemas externos | ⏸ | Gateway só com 6 efeitos (imprimir, WhatsApp, e-mail, agenda, exportar APAC, backup); leitura externa (READ) não modelada |
| WORK + STUDY | 🟡 | WORK no OncoGlobal; STUDY (OncoMind) fora do repositório |
| Agentes internos | ✅ | 18 AG-xx com dono por objeto, Maestro + ORK, pipeline de extração |
| Conhecimento oncológico profundo | 🟡 | Corpus + 72 fichas + ragGRAFO (2.971 nós) + diretrizes SBOC; sem RAG ligado ao OncoAssist |
| Governança clínica | ✅ | Harness (gates G-02…G-28), red team, CANONICA, DECISOES |

## Programa Fase A
| Frente | No código | Onde / observação |
|---|---|---|
| Agentes/skills sob demanda, limites de chamada/tempo/saída | 🟡 | Capabilities por agente; sem limites de chamada/tempo/custo |
| Pesquisa externa (Grok bot) delimitada | ❌ | Sem conector; `src/app/pesquisa` é pesquisa clínica (trials) local |
| OncoBoard (oncologia, cirurgia, radioterapia) | 🟡 | `src/app/oncoboard` com 3 personas e desidentificação; provider desligado |
| Clínica longitudinal (ID_PATIENT, resumo único, comorbidades, medicamentos, interações, pendências) | 🟡 | Timeline, interações (inativas), 4 classes de medicação; resumo único = Modelo 11 (não implementado) |
| FLASH (`/flash agora`, card de opinião, nada automático) | 🟡 | Botão "Consulta Flash" no estúdio e no OncoChart; sem `/flash` por voz/texto |
| Documentos (laudos, encaminhamentos, receitas, APAC–SIGTAP) | 🟡 | Modelos 01–11, kit, APAC com antiglosa, prescrição em 4 camadas; geração de minuta por modelo ainda não ligada |
| Voz e WhatsApp (avatar, ElevenLabs, entrevista) | ❌ | Avatar visual no OncoChart; sem ElevenLabs; WhatsApp desligado até vínculo + consentimento |
| Frontend (cards, nota editável, painel; shadcn/ui, 21st.dev) | 🟡 | OncoChart em porte (Cursor); sem shadcn (dependência não aprovada) |
| Integrações Google Drive/Agenda/Gmail, Microsoft | ❌ | Só previstas em Configurações → Conexões, desligadas |
| BRAIN_OS + Harness no grafo; circuito pedido → contexto → execução → verificação → minuta → revisão → registro | 🟡 | Harness e ledger existem; "falhas viram propostas de melhoria" (Optimizer REPORT_ONLY) não implementado |
| Redes sociais (Facebook, Instagram) | ❌ | Não previsto no WORK; conteúdo educativo sem dado de paciente seria outro território |
| Setores em stand-by | ❌ | Sem conceito de ativação/desativação de setor |
| Custos (tokens, chamadas, retries, latência por tarefa) | ❌ | Sem medição de custo |
| Grok bot orquestrado pelo Maestro; Claude audita; Dr. Silas decide | 🟡 | Papéis registrados (D-W9-54); Maestro do app não chama LLM externa |

## O que vale virar trabalho (proposta)
1. **Model router + task contract** (LLMs intercambiáveis) e **cofre de chaves por referência** — pré-requisito do OncoAssist real.
2. **Gateway READ** (leitura de Drive, PubMed, web) separado de WORLD_EFFECT, com G-02.
3. **Persona/prompt de sistema do OncoAssist** versionado no BRAIN_OS (oncologista crítico, nunca conduta).
4. **Medição de custo** por tarefa (tokens, chamadas, latência).
5. **Conexões** (Drive/Agenda/Gmail) como adaptadores desligados por padrão.
Itens 1–2 dependem da exceção de envio do kit (D-W9-66) e dos gates G-02/G-27.
