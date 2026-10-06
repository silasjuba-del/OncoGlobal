# Notas do chat "Arquitetura OncoMind Work" (ChatGPT, 05/10/2026) · não inserido

Arquivo original fica em `Downloads\onco-referencia\` (12.978 linhas). Avaliado em 2026-10-06; **não vira fonte** porque conflita com decisões vigentes:
OncoAssist minutando dose/conduta (proibido), grau CTCAE como porta de ciclo (D-W9-22a), CTCAE v5 (Q45: v6), Prisma/Postgres/Redis (Q5/Q7), aviso APAC no D80 (D85), anatomia×sexo como bloqueio (D-W9-06), PA "≤160/90 passa" sem hipotensão (Q21), Plaud por API e áudio 90 dias (A5/A8), prazos 15/45 dias (A4), estatística na v1 (Bloco 15).

## Ideias NOVAS aproveitáveis (aguardam decisão do Dr. Silas)
1. Catálogo de emergências radiológicas (compressão medular, VCS, TEP, obstrução, perfuração, tamponamento, hidronefrose bilateral, fratura patológica, pneumonite) → alerta vermelho com trecho do laudo.
2. Limiares de laboratório "revisar": Cr ≥1,5× basal, INR >1,5, TGP >3× LSN, Ca >12, Na <130, K >5,5 ou <3,0, glicemia >250, proteinúria ≥2+ (conflita com o silêncio de lab: Hb >8, TGO <70, Cr <1,6).
3. RECIST/iRECIST/Choi calculado por código, médico confirma lesões-alvo.
4. PD-L1 só válido com escore + anticorpo + valor; sem anticorpo = PENDENTE.
5. Escores de risco: MASCC, Khorana, IMDC.
6. SPECIMEN_ROLE com NOT_APPLICABLE × NOT_REPORTED.
7. Cirurgia fatura por AIH (não APAC).
8. Separação dura memória clínica por paciente × memória de conhecimento.
Outros materiais avaliados e não inseridos: "SECOND BRAIN - GENSPARK.pdf" (blueprint de RAG; parâmetros já rejeitados), "Extração de padrões radioncológicos para skill.pdf" (na verdade governança do OncoAssist v1.0; ROE-6 pendente), "00-SURGICAL-PROMPTS.md" (inspiração de microinterações; D-W5-07 prevalece).
