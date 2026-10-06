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


## Decisões da onda W5 (2026-10-05, Dr. Silas, via chat)
- **D-W5-01 · Fuso do serviço = −03:00 (Brasília).** Conversão instante → data civil usa offset injetado; produção = `-03:00`.
- **D-W5-02 · Aviso APAC adiantado em até 1 dia é aceitável.** Atrasar o aviso não é.
- **D-W5-03 · Cabeçalho institucional configurável.** Sem layout fixo de hospital. Valor inicial "Hospital do Bem - Unidade Oncológica, Patos/PB" só como exemplo, marcado para troca (o Dr. Silas não trabalha mais lá). A linha do médico (nome, CRM-PB, RQEs) é do perfil do médico, não do hospital.
- **D-W5-04 · Impressora escolhida pelo médico.** O app não fala com a impressora: usa as impressoras instaladas no sistema (rede, Wi-Fi ou Bluetooth) e o médico seleciona o modelo; a escolha fica salva nas preferências locais.
- **D-W5-05 · Kit de documentos do Dr. Silas é fonte DECISAO_MEDICA.** `docs/referencias/kit-oncologia-2026-05.pdf`: orientação nutricional, sinais de alarme, receita de sintomáticos (VO e EV), requisição de exames por ciclo, relatório médico pericial. Texto usado como está; mudança só pelo médico.
- **D-W5-06 · Laudo APAC oficial.** `docs/referencias/apac-laudo-solicitacao-autorizacao.pdf` é o layout de impressão do laudo de solicitação/autorização. O app preenche só a parte SOLICITAÇÃO; a parte AUTORIZAÇÃO fica em branco. O arquivo de exportação para o SIA continua `[VERIFICAR]`.
- **D-W5-07 · Modelo visual da UI.** `docs/referencias/ui-modelo-consulta.webp` é a referência de layout da consulta (barra lateral, cabeçalho clínico com diagnóstico/estádio/CID/TNM, abas Evolução·Prescrição·Exames, alertas e pendências, painel OncoAssist, visualizador de imagem). Vale a aparência; as regras do app prevalecem sobre o desenho.
- **D-W5-08 · Saída externa autorizada pelo ledger (CP-001, tech lead).** `/acao` só executa se o servidor achar artefato ASSINADO, vigente, do mesmo paciente/encontro/versão. Envio (WhatsApp/e-mail/agenda) fica desabilitado até existir contato vinculado + consentimento persistidos (A10). Exportar APAC fica desabilitado até a validação de emissão ser persistida (CP-001b). Destino livre vindo do cliente é recusado.
- **D-W5-09 · Verificador de fronteiras endurecido (CP-002, tech lead).** Rede computada (`globalThis["fetch"]`), WebSocket, XHR, EventSource, `import()`/`require` dinâmicos e `node:tls/http2/dgram` reprovam fora de gateway/llm; `import("x").Tipo` (só tipo) continua permitido.
- **D-W5-10 · Lote APAC (AMB-001/002, Dr. Silas 2026-10-06).** No fim do dia o lote vai ao faturamento com APACs de **vários pacientes**, cada uma validada individualmente; **uma competência por lote** (outro mês vai para o lote dele; competência ausente fica fora).
- **D-W8-01 · `DECISAO_TECNICA` não entra no contrato (tech lead).** Mantém-se o padrão híbrido do GLM: header do ruleset `DECISAO_MEDICA` com referência à origem técnica; itens com `DECISAO_TECNICA` e trecho. `dedupe-exame`, `identificadores` e `patologia-agregacao` seguem `ativo:false` até haver consumidor (Antigravity AG-04/AG-01/AG-07) e, no caso da agregação e da fonte do CNS, decisão do Dr. Silas.

## Decisões da onda W9 (2026-10-06, Dr. Silas, via chat)
- **D-W9-01 · Break-glass (vermelho) só para risco de vida iminente (paciente passando mal) e salão de QT.** O vermelho do botão é exceção de segurança à regra "vermelho só clínico".
- **D-W9-02 · Atalhos:** `Ctrl+Enter` = "validar tudo" e `Ctrl+P` = "imprimir", ambos sobre os botões já exibidos e com confirmação.
- **D-W9-03 · Idade pode ficar PENDENTE.** Liberada a exceção ao contrato congelado: idade em branco na triagem nunca vira `0` (tech lead aplica no contrato, com teste).
- **D-W9-04 · Kit de documentos: corrigir a acentuação.** Só ortografia; nenhuma palavra, dose ou orientação muda (substitui a parte "texto sem acentos" de D-W5-05).
- **D-W9-05 · Lateralidade obrigatória (G-07)** em: mama, cólon, pulmão, membros, adenopatia cervical, cavidade nasal/oral, olhos, hemisfério cerebral. Valores: DIREITO e ESQUERDO; cólon: DIREITO, TRANSVERSO, ESQUERDO (confirmado pelo Dr. Silas).
- **D-W9-06 · Anatomia × sexo cadastral (G-08)** em: próstata, útero, ovário, pênis, vagina e vulva, testículo. Divergência = conferir cadastro, nunca veto. Mama fica fora da tabela (existe nos dois sexos; confirmado).
- **D-W9-07 · pTNM (G-09) só com peça de ressecção; biópsia dá só cT.** A peça é reconhecida por: tamanho/dimensões, peso, margens e linfonodos descritos no laudo, mais a identificação de peça cirúrgica.
- **D-W9-08 · "Grau do caso" na biópsia com vários sítios** usa os critérios: grau histológico, linfonodos acometidos, margens comprometidas, anaplasia, invasão angiolinfática, invasão perineural, índice mitótico. **Os mais importantes: grau histológico, margens, linfonodos.** 3 critérios juntos corroboram o grau do caso; podem ser mais de 3. Vale o pior sítio. Ruleset `patologia-agregacao` continua inativo até virar teste aprovado.
- **D-W9-09 · Foto ilegível não gera pedido de nova foto.** O dado fica PENDENTE para o médico; sem limiar de confiança.
- **D-W9-10 · CNES inicial `2605473`** (Complexo Hospitalar Dep. Janduhy Carneiro, Patos/PB, habilitação 1706 UNACON) só como **exemplo editável**, igual a D-W5-03 (o Dr. Silas não trabalha mais lá). Nome e CNES configuráveis.
- **D-W9-11 · SIGTAP** importado do pacote oficial por competência (SIGTAP/DATASUS, Download → Competências): preservar competência, atributos, relacionamentos e compatibilidades; código sempre texto (zeros à esquerda).
- **D-W9-12 · Finalidades APAC.** QT: Paliativa, Para Controle Temporário, Prévia, Adjuvante, Curativa (Portaria SAES/MS 470/2021, Anexo II). RT: Radical, Adjuvante, Antiálgica, Paliativa, Prévia, Anti-hemorrágica. **Não deduzir finalidade da intenção clínica** (PC SAES/MS 1/2022, art. 385): o médico escolhe. Exportação SIA segue `Layout_Exportacao_APAC.pdf` (rev. 08/07/2026; TXT posicional, registros 01/14/13/07/08, CRLF); o arquivo deve entrar em `docs/referencias/` antes da implementação.
- **D-W9-13 · CNS.** Validação pelo algoritmo e-SUS/LEDI "Validar CNS" (início 1/2 e 7/8/9, 15 dígitos); base normativa Portaria GM/MS 940/2011 (consolidada). Portaria 711/2004 descartada como fonte. DV válido não prova que o número é do paciente.
- **D-W9-14 · Impressão continua com a janela do sistema.** Impressão silenciosa não liberada.
- **D-W9-15 · Provider LLM (fecha Q52): OpenAI, modelo Luna GPT-6.1**, via Responses API com saída estruturada (JSON Schema), `store:false`, desidentificação local antes do envio e revisão médica. `store:false` não é retenção zero; ZDR `[VERIFICAR]`. Continua desligado até os gates G-02/G-27 e os testes adversariais passarem.
- **D-W9-16 · Configurações (uma tela).** Editáveis pelo médico: telefone, CRM, hospital, CNES, CNS, sites externos, sincronizar telefone, rede/Wi-Fi da impressora, skills, plugins, MCP, layout da UI (DIA | NOITE | PERSONALIZAR). Toda conexão externa nasce desligada e passa pelo Action Gateway.
- **D-W9-17 · Tudo editável, nada fixo; cada caixa tem um número.** Existe um **glossário** (nº da caixa → nome → significado → onde aparece → valor atual). Em Configurações há **uma caixa única**: digita o número + o dado e salva. Toda mudança é versionada no ledger (quem, quando, antes/depois); regra clínica alterada vale como DECISAO_MEDICA.
- **D-W9-18 · Caixa única de entrada.** O médico cola texto ou solta PDF/Word numa só caixa; o app converte e distribui nas caixas numeradas. PDF digital e Word convertidos localmente; PDF escaneado/ilegível fica PENDENTE (D-W9-09), nada vai a serviço externo com PHI.
- **D-W9-19 · APAC automática com antiglosa.** Backend linear: dados do paciente → agente extrai e preenche o laudo APAC no modelo real (D-W5-06) → **antiglosa** (checagem antes do faturamento) → médico valida → lote do faturamento (D-W5-10). Extração é proposta da IA; regras de antiglosa são código (SIGTAP, CID × procedimento, idade, sexo, finalidade, competência, CNS, CNES, campos obrigatórios, duplicidade).
- **D-W9-20 · Código leve, conhecimento na RAG.** No código ficam só regras e dados mínimos; mensagens de red flag, interações, fichas e textos longos ficam na base de conhecimento aprovada (RAG), versionada e editável. Frontend é extensão do backend: a tela só mostra e coleta.
- **D-W9-21 · Referência de intake: skill SILAS NEGRÃO (6 papéis → W1 de 5 blocos).** O AUDITOR vira validador **determinístico** (código, não a mesma LLM); alerta catastrófico mantém os 3 critérios sem teto numérico.
- **D-W9-22 · Uso da onco-referência (auditorias ADV-01…12 e loop 2; regras do Dr. Silas reafirmadas).**
  (a) Porta de ciclo = **limiar de bula** (neutrófilos, plaquetas, clearance, FEVE), nunca grau CTCAE; grau CTCAE serve só para toxicidade.
  (b) Protocolo é identificado por **nome + tumor + cenário + estudo/versão** (ex.: Gem+Cis bexiga ≠ vias biliares; TAX 323 ≠ 324); nunca só pelo nome.
  (c) NÃO_VERIFICADO nunca é preenchido em silêncio por outra fonte (planilha, pack, LLM); conflito entre fontes aparece, nunca some.
  (d) "Impeditiva/absoluta/não iniciar" do material vira **alerta**; ECOG 3–4 vai à fila do médico; só a exportação/financeiro bloqueia.
  (e) Dois dutos sem merge: prescrição ≠ APAC (APAC deriva da conduta assinada e só alerta).
  (f) Bula FDA/EMA ≠ ANVISA: fonte sempre rotulada, nunca fundida.
  (g) Triagem do ciclo e corte do salão são portões distintos.
  (h) Fonte de verdade do material = `.md` (o docx perdeu fluxograma 10 e tabela QT-RT de cabeça e pescoço).
  (i) Esquemas da planilha com dose de estudo (TPF, ddMVAC, capecitabina em mg/m² "1 cp", FOLFOX/FOLFIRI 8 h, IFL/Mayo, antiemese sem NK1, docetaxel sem dexa 3 d, zoledrônico q84d, hidratação de cisplatina) **não entram como ficha** até revisão do Dr. Silas.
- **D-W9-23 · Protocolos citotóxicos (planilha revisada, `docs/referencias/protocolos/`).**
  (a) FOLFOX, FOLFIRI, FOLFIRINOX, FOLFOXIRI e FLOT: 5-FU em **infusão contínua de 46 h** (com bomba); o "D1 e D2, 8 h, sem bomba" da planilha **não** vira ficha. A conversão de cada linha é feita na ficha e conferida pelo Dr. Silas antes de ativar (dose total do ciclo nunca é recalculada em silêncio).
  (b) **5-FU + leucovorina (Mayo) permanece** na biblioteca.
  (c) **Antiemese padrão do serviço: ondansetrona + dexametasona + difenidramina, sem aprepitanto** (decisão local, inclusive em esquemas de alto risco emetogênico).
- **D-W9-24 · Patch do prompt mestre: prescrição real + UI longitudinal** (`docs/specs/PATCH-PRESCRICAO-UI-LONGITUDINAL.md`). Médico define o workflow, regulação define o documento, protocolo define as dependências, IA não define conduta. Receita em 4 camadas (ClinicalOrder → MedicationOrder → ValidationEngine → Renderer); modo rápido de uma linha com parser; documento pela classificação regulatória versionada; QT em entidade própria; validação por protocolo/droga (`NOT_EVALUABLE` = PENDENTE); dado reutilizado mostra fonte e idade; protocolo ≠ prescrição, template versionado; diluição/infusão herdadas do protocolo com override motivado. `BLOCK` do SafetyEngine = bloqueio do artefato, nunca do clínico.
- **D-W9-25 · Material público pode ser copiado e minerado.** Tudo que o Dr. Silas enviar vira extração de ideias registrada (`docs/referencias/externos/`), sem dado de paciente.
- **D-W9-26 · Ajuste de dose só pelos botões −20/−30/−40** (reafirma Q29; o `doseAdjustment.percent` do patch D-W9-24 aceita só esses valores).
- **D-W9-27 · Resumo de trial em uma frase** no molde de `docs/referencias/modelos/02-resumo-trial.md` (exemplo KEYNOTE-522).
- **D-W9-28 · Red flags do paciente: adotados os 25 sinais** de `docs/referencias/externos/IDEIAS-MANUAIS-PACIENTE.md` §2. Ação padrão do paciente = **ir ao PS**. Febre **≥37,8 °C** → PS → hemograma → antibiótico se neutropênico. **Diarreia >24 h → suspender anti-hipertensivo; vômito + diarreia → PS para hidratação venosa.**
- **D-W9-29 · Orientação por toxicidade = prescrição-modelo por efeito** (náusea, mucosite, diarreia, constipação etc.), pesquisada em fonte pública, em rascunho até aprovação do Dr. Silas; antiemese segue D-W9-23c. **Diário de sintomas e checklist pré-sessão** entram no app (W10).
- **D-W9-30 · Adotados pelo Dr. Silas:** Modelo 03 (resumo de alta RT), tabelas de evidência com etiquetas (`docs/referencias/evidencias/`) e a regra de registrar tudo. Modelo 04 (BPC/LOAS) registrado.
- **D-W9-31 · Nódulo < 1 cm = INDETERMINADO** (nunca metástase confirmada); conduta-padrão: **TC em 4 meses comparando**. O app sugere "cM0 com nódulos indeterminados" em vez de "Mx" (Dr. Silas: SIM).
- **D-W9-32 · Layout de prescrição de QT** = modelo institucional real (`docs/referencias/modelos/05-prescricao-qt-institucional.md`): cabeçalho com protocolo `P####`, ciclo, dia, alergias; tabela Dose Prot × Dose Presc × Diluente × Via × Intervalo (PRE-QT/QT/POS-QT) × Tempo × Dias.
- **D-W9-33 · Pipeline de extração multimodal** (`docs/specs/PIPELINE-EXTRACAO-MULTIMODAL.md`): segmentação → paciente → fatos atômicos → normalização → reconciliação multifonte → anti-alucinação → conflitos → timeline → médico só nas exceções. Hierarquia de evidência por domínio; 7 invariantes anti-alucinação; Plaud não é fonte primária de histologia/TNM/dose/IHQ/fármaco/medida; Biomarker Requirement Engine em código.
- **Ainda abertos:** texto final das mensagens de red flag (base aprovada em D-W9-28), ativação de interações medicamentosas (com fonte), biblioteca das ~50 fichas.
