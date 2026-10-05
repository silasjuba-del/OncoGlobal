# DECISÕES DO DR. SILAS — Q01–Q59 + A1–A11 (2026-10-05)

> Fonte: Q/A clicável e decisões pós-auditoria. Autoridade máxima do projeto (Q4). Não reabrir sem ordem dele.


Q/A clicável de 59 perguntas, 2026-10-05, COMPLETO. Respostas = DECIDIDO (autoridade do Dr. Silas).

Plano executável: `docs/PLANO-FINAL-ONCOGLOBAL-v1.1.md` (a Parte 0 é normativa).

## Bloco 1 — Fundação
1. Repositório: **OncoGlobal** (repo silasjuba-del/OncoGlobal, hoje só README). Não o consultorio-docs.
2. Writer: **Claude comanda e orquestra** Cursor, Fugu, DeepSeek, GLM (Claude = tech lead; executores variados).
3. CANONICA (SSOT/GOV): atualizar **ao fim do Q/A**, com as regras antigas marcadas SUPERADO.
4. Precedência: **Dr. Silas > BASE (plataforma M001 ratificada) > deltas > LLMs**.

## Bloco 2 — Stack
5. Banco: **SQLite (node:sqlite)**.
6. Contrato: **Zod**, compartilhado front + back + agentes.
7. Backend: **monólito modular Node/TS**.
8. PHI: **local-first**; a nuvem só recebe dado desidentificado.

## Bloco 3 — Estados e governança
9. Estados: **tabela v2, teto de 5 por dimensão** (Semáforo 3 · Revisão 5 RAW→ASSINADO · Campo 5 · Destino 3 · APAC 5 · Artefato 3 · Delta 5 · Conversa 5 · Farmácia 4).
10. Semáforo: **VERDE · VERMELHO · PENDENTE** (sem amarelo; ausente nunca verde; verde ≠ liberado).
11. **Maestro = tabela de planos fixos** (LLM só em pergunta livre); **ORK executa, entrega microprompt e supervisiona** agentes; ORK-1 ≡ ORK; ORK-2 ≡ Harness clínico + OncoChief.
12. BRAIN_OS = **conhecimento + método + trabalho, associados** (packs, playbooks, prompts, rulesets, guidelines e o "como trabalhar"/preferências).

## Bloco 4 — Identidade e entrada
13. Identidade: **identificador exato liga sozinho** (CNS/CPF/prontuário/telefone cadastrado); demográfico exato → candidato para revisão; **nome nunca liga**.
14. Caixa universal: **classifica e roteia sozinha** (demográfico → secretaria; clínico → médico como rascunho; documento → extrator; comando → intenção; desconhecido → revisar). Campo vazio não trava.
15. Voz: **NOVA-3 = lazy = comando vocal**; **PLAUD = fundo = consulta inteira**; ambos se fundem (merge). O app só importa o transcrito via LLM, **pela mesma porta**.
16. Áudio: **apagado após a transcrição validada** (guarda texto + hash).

## Bloco 5 — Consulta
17. Fechamento: **1 clique por bloco + atalho "validar tudo"** (quando não há vermelho).
18. Meta: **≤ 5 cliques** no retorno de rotina.
19. Pré-consulta: montado **na véspera + atualizado no check-in** e quando chega exame/mensagem.
20. Bundles: **todos** (fim da 1ª consulta, retorno de QT, avaliação de resposta, renovação de APAC). **APAC vence em 90 dias → app avisa no DIA 85** (substitui o D80 anterior).

## Bloco 6 — Salão (regras clínicas locais)
21. PA: **sistólica >160 ou <90 mmHg** corta (igual passa).
22. Grau 4: **corta (grau ≥3 → fila) E dispara alerta de emergência E1**. **Triagem comunica via chat; TODOS os setores têm chat.**
23. Hemograma: **validade de 7 dias** (mais antigo → PENDENTE, nunca verde).
24. Peso vermelho: **perda >5 kg em 60 dias** (exatamente 5 kg passa).

## Bloco 7 — Salão (operação)
25. Peso vermelho: **nutrição + QT adiada, MAS o paciente passa em consulta** (o médico checa se a perda é real ou erro de medida).
26. Frente: **frente só sem corte** (cama/cadeira/>80 passam à frente no salão). Com corte → fila ECOG4 → ECOG3 → cama → cadeira → >80; empate = ECOG maior, depois chegada.
27. Dado ausente na triagem (ex.: sem hemograma válido): **PENDENTE → fila do médico**.
28. Enfermagem **aplica sem ver o médico no dia se não há corte + prescrição assinada vigente** (2 ciclos liberados). Alergia para na hora; vômito difícil para e espera.

## Bloco 8 — Dose
29. Os botões −20/−30/−40% incidem sobre a **dose aplicada no ciclo anterior** (pode acumular).
30. Sem peso: **dose anterior + sinal; 2º ciclo seguido sem peso = VERMELHO**. Nunca inventa peso.
31. Ciclo 1 sem peso medido: usa o **peso informado pelo paciente** (registrado com origem = INFORMADO_PACIENTE).
32. AC: ciclo 3 **salta o médico só se não houver corte nem pendência**.

## Bloco 9 — APAC
33. Finalidade: **campo separado** da intenção clínica; o médico escolhe 1× por tratamento e a renovação herda o valor visível; **nenhum mapa automático**.
34. Data única: **o dia em que o médico gerou a APAC no app** (data do próprio app). Daí contam os 90 dias; aviso no D85.
35. Dia 90: **o faturamento não emite; a consulta segue**.
36. Lotes: **os dois** — TumorLot por paciente (cada neoplasia com linhas, ciclos e APACs) + ApacBatch operacional (gera, renova e imprime em bloco).

## Bloco 10 — Administração mínima e setores
37. Farmácia: **recebe a prescrição assinada e devolve "correção pedida" no chat**; nunca edita; o médico aceita ou recusa com 1 clique.
38. Estoque: **só informa disponível/indisponível** (chip; não trava; não sugere troca).
39. Chat: **por paciente + por setor**; alertas e correções vivem no chat, nunca no prontuário.
40. Visão: **cada setor vê só a sua fatia**; o médico vê tudo; permissão aplicada no servidor.

## Bloco 11 — Canal paciente
41. WhatsApp: **comunicação + anamnese agora; ato médico (teleconsulta assíncrona com registro e assinatura) depois**, após checar CFM/LGPD.
42. Número: **os dois** — número do serviço (Business API, canal oficial) + o pessoal lido só para aviso.
43. **OncoAssist fala com o paciente, com limites**: anamnese por roteiro, pede exame/foto, lembra retorno; red flag = resposta FIXA ("procure a emergência") + alerta ao médico; nunca orienta tratamento, dose ou diagnóstico. **SUPERA o veto do SSOT §3** ("não fala com pacientes").
44. **Lê e-mail e WhatsApp (só leitura) e avisa contato no painel**; vínculo por telefone/e-mail exato; desconhecido → fila de vínculo; entra no pré-consulta.

## Bloco 12 — Conhecimento
45. CTCAE: **v6 desde já** (campo ctcae_version obrigatório).
46. Packs lote 1: **pulmão, mama, colorretal, próstata**; SIGTAP [VERIFICAR] até haver fonte.
47. Curadoria: **LLM rascunha; médico corrige, edita, valida e grava**; o app tem API-LLM própria. Sem fonte não vira regra ativa.
48. Trials: **fora da v1; depois só POSSIBLE_MATCH** (referência + oportunidade, nunca "elegível"). NOVA CAPACIDADE: **laudo para judicialização** — usa o caso, busca fontes e cruza com os dados do paciente → relatório de solicitação com desfechos + receita + histórico (minuta; o médico assina).

## Bloco 13 — Roadmap e execução
49. Roadmap: **F0 kernel (contratos + regras do salão em testes) → F1 consulta (pré-consulta, delta, bundles, ≤5 cliques) → F2 canal (leitura WhatsApp/e-mail + aviso) → F3 salão → F4 APAC + farmácia + estoque → F5 anamnese OncoAssist + voz**.
50. Prova por fase: **testes positivo/negativo/borda (todos passando de verdade) + PR revisado + demo no app**.
51. Executores — **Claude pensa, arquiteta, integra e também codifica**. Escolhidos: **Codex** (revisa, testa, audita, codifica) · **Cursor** (código pesado) · **Grok** (código pesado) · **GLM** (código) · **Kimi** (código) · **Fugu** (fatias longas, orquestra). Citados: MUSE (só testes/UI), Antigravity (testes adversariais). Multi-task + multi-fatias: Claude orquestra **sem conflito** (escopo de arquivos fechado por executor) e usa várias LLMs **juntas** (code + testes + auditoria + correção).
52. PHI: **SEM PHI para LLM**; a LLM é escolhida depois; **os dados rodam apenas no PC do Dr. Silas**.

## Bloco 14 — Escopo final
53. Fases: **F0..Fn única** (M-P0..P7 e o F0..F6 antigo → SUPERADOS).
54. STUDY/OncoMind: **fora do OncoGlobal** (outro projeto).
55. Telas: médico desktop + celular; enfermagem/salão tablet; secretaria/farmácia/faturamento desktop (alvo futuro, ver 57).
56. Intervalos: **simplificado: 30 dias (1 mês)** após a última QT, para cirurgia e QT+RT (aviso, nunca trava). Substitui 15/45.
57. Topologia v1: **monousuário — só o Dr. Silas usa, no PC dele**. Setores, tablet e celular entram depois.
58. Backup: **automático diário, criptografado** (HD externo ou nuvem; a nuvem só vê arquivo cifrado).
59. WhatsApp: a mensagem **chega e vai direto para o PC** (túnel seguro; nenhum servidor intermediário guarda nada).

## Bloco 15 — Pós-auditoria Codex (2026-10-05)
A Codex auditou o PLANO v1.0 sem nenhum achado que mude decisão; o grosso entra como correção técnica na v1.1 (drafts persistentes, conflito representável, operação atômica + expectedRevision, TreatmentAdministration separada da prescrição, APAC validada só na emissão, FRENTE exige zero pendência, E1 na tela/chat e não na evolução, delta com direção só por regra, run/jornada como campo/marco (teto 5), AG-09/10/12/17/18 → funções, sem camadas/grafo/estatística na v1, manifesto W0 com hashes, logs allowlist).
A1. "Validar tudo" = **confirma e assina o que está selecionado no bundle** (escopo e versões visíveis; nunca assina o que não foi exibido).
A2. Peso informado × medido: **diferença mostrada como incerta; o médico confirma** (informado não dispara peso vermelho sozinho).
A3. Estadiamento: **avaliações coexistem** (sistema, edição, prefixo, data); a tela mostra qual está em uso e para quê.
A4. 30 dias = **da última administração de QT até cirurgia ou início de RT sequencial** (não se aplica a QT+RT concomitante planejada).
A5. Áudio é apagado depois que **o médico valida os trechos usados clinicamente**.
A6. NOVA-3 = **motor Deepgram Nova-3, obrigatório**.
A7. E1 **não altera a ordem da fila**; aciona escalonamento separado.
A8. Plaud: **o Plaud transcreve na nuvem dele; o médico copia a transcrição desidentificada e importa** (o app ainda roda o desidentificador na importação).
A9. **Exceção expressa a Q52: só o comando curto de voz vai à Deepgram** (sem nome na fala; retenção [VERIFICAR]).
A10. **Exceção expressa a Q52 para o canal WhatsApp** (Meta é o meio; o app guarda só local; consentimento registrado; nunca reenvia PHI a LLM).
A11. Backup: **só HD externo local, cifrado**; chave de recuperação fora do PC (substitui "ou nuvem" de Q58).

