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
- **D-W9-28 · Red flags do paciente: adotados os 25 sinais** de `docs/referencias/externos/IDEIAS-MANUAIS-PACIENTE.md` §2. Ação padrão do paciente = **ir ao PS**. Febre **> 37,8 °C** → PS → hemograma → antibiótico se neutropênico. **Diarreia >24 h → suspender anti-hipertensivo; vômito + diarreia → PS para hidratação venosa.**
- **D-W9-29 · Orientação por toxicidade = prescrição-modelo por efeito** (náusea, mucosite, diarreia, constipação etc.), pesquisada em fonte pública, em rascunho até aprovação do Dr. Silas; antiemese segue D-W9-23c. **Diário de sintomas e checklist pré-sessão** entram no app (W10).
- **D-W9-30 · Adotados pelo Dr. Silas:** Modelo 03 (resumo de alta RT), tabelas de evidência com etiquetas (`docs/referencias/evidencias/`) e a regra de registrar tudo. Modelo 04 (BPC/LOAS) registrado.
- **D-W9-31 · Nódulo < 1 cm = INDETERMINADO** (nunca metástase confirmada); conduta-padrão: **TC em 4 meses comparando**. O app sugere "cM0 com nódulos indeterminados" em vez de "Mx" (Dr. Silas: SIM).
- **D-W9-32 · Layout de prescrição de QT** = modelo institucional real (`docs/referencias/modelos/05-prescricao-qt-institucional.md`): cabeçalho com protocolo `P####`, ciclo, dia, alergias; tabela Dose Prot × Dose Presc × Diluente × Via × Intervalo (PRE-QT/QT/POS-QT) × Tempo × Dias.
- **D-W9-33 · Pipeline de extração multimodal** (`docs/specs/PIPELINE-EXTRACAO-MULTIMODAL.md`): segmentação → paciente → fatos atômicos → normalização → reconciliação multifonte → anti-alucinação → conflitos → timeline → médico só nas exceções. Hierarquia de evidência por domínio; 7 invariantes anti-alucinação; Plaud não é fonte primária de histologia/TNM/dose/IHQ/fármaco/medida; Biomarker Requirement Engine em código.
- **D-W9-34 · Respostas do Dr. Silas (2026-10-06):**
  (a) **Junção de paciente nunca é automática:** todo dado que entra vai para a **caixa de revisão** e só se liga ao paciente com confirmação (substitui o AUTO_MERGE ≥0,90 de D-W9-33; o score só ordena candidatos).
  (b) **Alerta FEVE < 50%** com antraciclina ou anti-HER2 programado (alerta, nunca bloqueio).
  (c) **Pré-medicação/antiemese do serviço = ondansetrona + dexametasona + prometazina VO** (prometazina substitui a difenidramina de D-W9-23c; está na RENAME). **Cimetidina 300 mg em todo taxano** (paclitaxel e docetaxel). **Olanzapina 5 mg opcional** no alto risco emetogênico (sem NK1).
  (d) **Cisplatina D1 e D8: hidratação pré e pós com magnésio e potássio nos dois dias.**
  (e) **Laudo de O2 domiciliar ganha SpO2 em ar ambiente e/ou gasometria com data.**
  (f) **Loperamida no irinotecano: esquema de alta dose da bula do irinotecano** (4 mg, depois 2 mg 2/2 h; 4 mg 4/4 h à noite; até 12 h sem diarreia; máx. 48 h), acima do teto de 16 mg/dia da bula comum — só nesse contexto.
- **D-W9-35 · OncoChart é a UI-alvo** (`docs/design/oncochart/`, D-W5-07 substituído no visual). Ajustes obrigatórios em `DECISAO-UI-ALVO.md` (CTCAE v6, OncoAssist sem conduta, liberação só com validação humana, sem CDN, semáforo do app).
- **D-W9-36 · Padrões de UI** dos modelos de triagem/agenda/esteira (`docs/referencias/ui-modelos/PADROES-UI.md`) e **Modelo 09** (solicitação de exame impressa) registrados.
- **D-W9-37 · Corte do salão (acréscimos do Dr. Silas):** **SpO₂ < 88%** · **PA < 90** (escrito "PAD < 90"; lido como **sistólica < 90 = hipotensão**, coerente com Q21 — `[VERIFICAR]` se é diastólica) · **FC < 50** · **Hb < 8** · **Cr > 1,5**. Vão para a fila do médico (alerta, não bloqueio do clínico). Valores iguais ao limite passam.
- **D-W9-38 · Febre = estritamente > 37,8 °C** (37,8 não dispara; vale para corte do salão, red flag do paciente e prescrições-modelo). Corrige D-W9-28.
- **D-W9-39 · Agenda de QT:** tratamento ≥ 5 h só inicia até 12h; **máximo 5 inícios a cada 30 min**.
- **D-W9-40 · Tela moderna = OncoChart como padrão visual** (tema NOITE do desenho + DIA derivado dele; tokens da Muse entram como base de acessibilidade/contraste). Entram no produto: **Chart3D** (RECIST 1.1 e skyline de toxicidade CTCAE v6) e **OncoAssist explicando a imagem** no visualizador.
  Regra de segurança da explicação de imagem: na v1 o OncoAssist explica **a partir do laudo e dos achados já extraídos** (texto, com trecho-fonte clicável), em linguagem de apoio, sem diagnosticar nem medir. Leitura de pixel por IA só depois do sanitizador de pixel/DICOM (G-27) e com provider aprovado; até lá desligada.
- **D-W9-41 · Confirmações:** "PAD < 90" de D-W9-37 = **sistólica < 90** (confirmado). Kit "Sinais de alarme" passa a dizer **"FEBRE ACIMA DE 37,8°C"** (campo `texto`; `textoFonteOriginal` preserva o PDF). **Cursor termina a W9**; porte do OncoChart vem depois.
- **D-W9-42 · Prompt mestre do assistente longitudinal** (`docs/specs/PROMPT-ASSISTENTE-LONGITUDINAL.md`) + ideia de fontes (Agent Reach = conhecimento externo, Plaud Connector = voz, Document Pipeline = PDF/imagem/texto).
- **D-W9-43 · Regra RADS INTERVAL_PROGRESSION:** mesmo sítio + mesmo método + aumento seriado ⇒ eleva suspeição (ALERTA + exame dirigido), nunca metástase automática. Modelo 10 (seguimento radiológico) com exemplo sintético PT10.
- **D-W9-44 · Banco: SQLite local na v1** (Q5/Q7 mantidos; Postgres fora da v1). **Estatística liberada na v1** (revoga o "sem estatística" do Bloco 15): um único registro estatístico cumulativo, derivado do ledger por código, deduplicado por paciente, sem PHI (só contagens/categorias), campos do prompt longitudinal (D-W9-42).
- **D-W9-45 · Prescrição nasce do protocolo versionado** (adendo em `docs/specs/PATCH-PRESCRICAO-UI-LONGITUDINAL.md`): PrescriptionItem com papel/sequência/dose padrão/base/calculada/prescrita/ajuste/diluente/volume/tempo/origem; UI mostra só exceções; três produtos (antineoplásica, pós-QT/VO, EV avulsa); foto de prescrição reconciliada com o template, nunca verdade automática.
- **D-W9-46 · Porta "Página do paciente"** (paciente/familiar: pré-consulta, upload de exame, intercorrência) registrada em `docs/specs/PORTAS-DE-ENTRADA.md`. Proposta: na v1 pelo canal WhatsApp (A10) caindo na caixa de revisão; página web própria só na v2 com hospedagem segura `[VERIFICAR]`.
- **D-W9-47 · Quatro classes de medicação:** PRÉ-QT · QT (= oncológicas) · PÓS-QT · NÃO ONCOLÓGICAS (HAS, DM-2, DPOC…). As não oncológicas são a lista de uso contínuo que alimenta interações, a regra do anti-hipertensivo na diarreia e o alerta de corticoide em DM-2.
- **D-W9-48 · Página do paciente na v1 = canal WhatsApp** (pré-consulta, upload de exame, intercorrência → caixa de revisão). Página web própria fica para v2. Base de prescrição não oncológica `ragGRAFO/prescricao` copiada como referência (`docs/referencias/ragGRAFO-prescricao/`).
- **D-W9-49 · Medicações comuns (NÃO ONCOLÓGICAS) = receitas do `ragGRAFO/prescricao`** (`docs/referencias/ragGRAFO-prescricao/`). **Fornecedores de material:** diretrizes SBOC (`OneDrive\EDUCAÇÃO\Material-Didatico\sboc\DIRETRIZES`, 63 arquivos, fonte primária de conhecimento) e protocolos SOnHe 2024 (`...\sboc\qt onco\Protocolos-SOnHe-2024-Modelo-7.pdf`, 412 p., **secundário, setor privado**). PDFs ficam fora do git (tamanho); índices e extrações em `docs/referencias/fornecedores/`.
- **D-W9-50 · Divergências de protocolo resolvidas pelo SOnHe 2024** (dose e dias; `docs/referencias/fornecedores/SONHE-2024-PROTOCOLOS.*`), com exceções: **bolus de 5-FU 400 mg/m² NÃO entra** (FOLFOX/FOLFIRI ficam só com infusão de 46 h, D-W9-23a); pré-medicação/antiemese e hidratação seguem o padrão local (D-W9-34c/d), não o NK1 do SOnHe; erros do manual (gem+cape "1.660 12/12 h", ifosfamida "1.200 g/m²", topotecano "1.200 mg/m²", amivantamabe 2.400) **não entram** sem conferência. Cada ficha convertida é conferida pelo Dr. Silas antes de ativar.
- **D-W9-51 · Catálogo de 30 emergências radiológicas** com cadeias de palavras-chave (`docs/referencias/rads/EMERGENCIAS-RADIOLOGICAS-30.md`) = base do alerta RADS (fecha a ideia 1 do chat de arquitetura).
- **D-W9-52 · Skill de morfometria de lesão encefálica v4.0** (`docs/specs/SKILL-MORFOMETRIA-LESAO-RM.md`): código mede sobre cliques do médico, triplo teste, incerteza propagada, sempre DRAFT, proibida para resposta (RECIST/RANO), árvore diagnóstica como apoio e flags de segurança (corticoide × linfoma).
- **D-W9-53 · Pasta importante: aulas PRO 2026** — `C:\Users\silas\.aside\u\0\sessions\2026-10-06_0ihhrP1OmLV0syHe\artifacts\slides-pro-2026` (10 módulos, 96 PDFs, 340 MB; PDFs fora do git). Extração para o grafo **`C:\Users\silas\Projects\ragGRAFO\oncologia`** (diagnóstico, estadiamento, biomarcadores, tratamento por cenário/linha, trials; status NAO_VERIFICADO; esquema em `docs/referencias/fornecedores/RAGGRAFO-ONCOLOGIA-ESQUEMA.md`). Resumo GI avaliado: 7,5/10 estudo, 5/10 RAG (`RESUMO-GI-PRO2026-AVALIACAO.md`).
- **D-W9-54 · Equipe da W10 (ampla):** externos **Grok** (regras puras), **Cursor** (porte OncoChart/UI), **Fugu** (pipeline de extração) com prompts `docs/ondas/W10-{COMUM,GROK,CURSOR,FUGU}.md`; interna = **Claude (tech lead) + 5 agentes Sonnet + Codex CLI (gpt-6-astra/gpt-6-luna) como implementador/revisor adversarial + GLM CLI** (chave Z.AI expirada em 06/10 — até renovar, a parte do GLM vai para agente Sonnet). W9 substituída pela W10 (não tinha começado). Plaud automático e página web do paciente ficam para a v2.
- **D-W9-55 · Arquitetura do ecossistema** (HARNESS transversal, MEMORY_OS, BRAIN_OS, model router, agent runtime, tool orchestrator, effect gate READ × WORLD_EFFECT) registrada com mapa para o código em `docs/specs/ARQUITETURA-ECOSSISTEMA.md`. O projeto já segue o núcleo (harness, ledger relacional, corpus, gateway de efeitos, WORK × STUDY; grafo não fundacional). Lacunas: model router multi-LLM, READ externo no gateway, correspondência de nomes de agentes, RECIST/prognóstico. Patch de `ONCOGLOBAL-RAIZ-CANONICA.md` só com ordem do Dr. Silas.
- **D-W9-56 · CANONICA atualizada por ordem expressa ("sim, aplica", 2026-10-07):** criado `ONCOGLOBAL-RAIZ-CANONICA.md` v1.0 (raiz do ecossistema, HARNESS, **OncoAssist = assistente pessoal persistente com casa própria, não pertence a um app**, MEMORY_OS com RECIST longitudinal → PROPOSTO, agentes por responsabilidade, LLMs sob model router, READ × WORLD_EFFECT) e SSOT v1.1 → **v1.2** (OncoAssist redefinido; FC < 50 e Cr > 1,5 cortam; febre estrita > 37,8; provider D-W9-15). Espelho somente leitura em `docs/canonica/`.
- **D-W9-57 · Skill `analise-morfometrica-lesao-snc` v4.0.0 substitui a D-W9-52** (`docs/specs/skill-morfometria-snc/`: SKILL.md, FONTES R1–R12, MATEMATICA, núcleo `morfometria_core.py` + 36 testes sintéticos — **36/36 OK re-executados no PC**). Três modos (VISUAL · 2D_CALIBRADO · 3D_GEOMETRICO); proibida calibração por anatomia média e correção automática por MF; geometria DICOM anisotrópica/oblíqua, volume por determinante, trapézio só com polos observados; incerteza só com componentes fundamentados (covariância), sem percentuais fixos; RANO-BM só como pré-avaliação candidata; diferencial diagnóstico fora do fluxo; sem recomendação de corticoide/biópsia/RT; toda saída termina com REVIEW_REQUIRED. No app, o núcleo vira função TypeScript pura equivalente (sem NumPy), com os mesmos 36 casos portados como teste.
- **D-W9-58 · Contratos W10 publicados** (`src/contracts/w10/`: extração, prescrição em 4 camadas, triagem extra/caixas/antiglosa/timeline/RECIST) com 10 testes; **dependência `pdfjs-dist` aprovada** (PDF digital local, sem rede); **R-08 liberado só para o barrel `src/rules/index.ts`**; Grok autorizado a subir o ruleset do salão para 1.1.0, ativar CREAT 150 no `lab-thresholds` e alinhar FN-01 a FC < 50 (D-W9-37) com a expectativa congelada. Respostas em `docs/w10/RESPOSTAS-TECH-LEAD.md`. Parciais da W10 (Grok 2/14, Fugu 5/12, Cursor 1/14) integrados.
- **D-W9-59 · Fichas:** AT (P1603) doxorrubicina **60 mg/m²**; FLOT 5-FU **2.400 mg/m²** em 46 h. Demais pontos das fichas (FOLFOXIRI 3.200, dexametasona VO 3 dias no docetaxel, Mg pós-cisplatina, tumor/doses da P1477, cenários) o Dr. Silas **confere à mão** ao promover cada ficha de RASCUNHO para CONFERIDA_MEDICO.
- **D-W9-60 · Limites de cálculo:** Calvert com **ClCr limitado a 125 mL/min**; superfície corporal **limitada à faixa 1,40–2,20 m²** (abaixo de 1,40 usa 1,40; acima de 2,20 usa 2,20), sempre com aviso visível no item. **Finalidades APAC de RT** entram como contrato `FinalidadeApacRt` (Radical, Adjuvante, Antiálgica, Paliativa, Prévia, Anti-hemorrágica). Fórmula de BSA ainda não decidida (o valor chega pronto).
- **D-W9-61 · Respostas de 2026-10-07:** **Mayo: 5-FU 425 mg/m²** (mantém ficha); **carbo + paclitaxel semanal: AUC 2** (mantém ficha); **criar fichas RASCUNHO** para GEMOX, carbotaxol semanal de cabeça e pescoço, ifosfamida + mesna (incl. com gencitabina e topotecana), AC-TH, FOLFIRI + bevacizumabe, temozolomida e cisplatina semanal com RT (colo); **superfície corporal por Mosteller** √(altura cm × peso kg / 3600), limitada a 1,40–2,20 m² (D-W9-60).
- **D-W9-62 · Fichas:** GEMOX com **oxaliplatina 100 mg/m²**; temozolomida **ciclo 1 = 150 mg/m², ciclos seguintes = 200 mg/m²** (duas fichas); fase TH em ciclo de 21 dias com paclitaxel D1/D8/D15 **confirmada**.
- **D-W9-63 · RECIST linfonodo:** eixo curto ≥ 15 mm = alvo; 10–15 mm = não-alvo; < 10 mm = normal (confirmado). **Peso para cálculo de dose vale 30 dias** (`PESO_VALIDADE_DIAS`); mais antigo = dado antigo, pedir peso atual (alerta, não bloqueio).
- **D-W9-64 · ExecSpec CKG Protocol v1 registrado como PROPOSTA** (`docs/specs/EXECSPEC-CKG-PROTOCOL.md`): Claim reificada, evidência imutável com hash, patch com beforeHash, gates e views sobre snapshot. Encaixe sugerido: formato do BRAIN_OS e da governança (decisões/regras/ações); no clínico, `ClinicalFact` como especialização de Claim, sem modelo paralelo. Aguardando escolha do Dr. Silas: spec completa × implementação de referência.
- **Modelo 11 · resumo de primeira consulta** (3 kits reais desidentificados): 14 blocos; 15 lacunas do extrator (L-01…L-15), incluindo bug "colo uterino" → cólon e lateralidade no masculino.
- **D-W9-65 · Kit documental em PDF (inclusive escaneado) será processado por LLM** (extração do kit); **o app também lê localmente texto colado, Word e PDF digital**. OCR local não será feito. Atenção: PDF escaneado carrega nome/CPF/CNS nos pixels — enviar à LLM é saída de PHI; exige (a) exceção expressa do Dr. Silas no molde de A8/A9/A10 **ou** (b) redação dos identificadores na imagem antes do envio (sanitizador de pixel, G-27). LLM segue desligada até essa escolha e os gates.
- **D-W9-66 · Exceção expressa (Dr. Silas, 2026-10-07): o kit documental em PDF, inclusive escaneado e com identificadores nos pixels, pode ser enviado à LLM para extração** (no molde de A8/A9/A10). Condições: provider de D-W9-15 com `store:false`, só pelo gateway (efeito registrado), texto extraído volta ao PC e passa pela caixa de revisão; nada é promovido sem o médico. LLM continua desligada até o adaptador do provider e os gates G-02/G-27 de saída estarem ligados.
- **D-W9-67 · Kit baseline TumorLot próstata (Dr. Silas, 2026-10-07):** pack `prostata.v1.json` → **1.2.0** com labs baseline **PSAT + fosfatase alcalina + cálcio + testosterona** e imagem baseline **cintilografia óssea + RMN pelve**. Completude do kit em `src/rules/kitTumorLot.ts` (limiar 0,6; incompleto bloqueia APAC, não inventa valor clínico). Ausente = PENDENTE. TNM continua do médico.
- **D-W9-68 · Correções RADS (Dr. Silas, 2026-10-07):** ruleset `rads-emergencias` → **1.1.0** (31 linhas). Tiflite exige neutropenia e **exclui** pneumoperitônio; fratura separa SINS (coluna) / Mirels (ossos longos); pneumonite e colite imunomediadas têm **exclusões** infecciosas; derrame pleural maligno separado de **pneumotórax hipertensivo** (linha 31); blowout exige leito irradiado. Detector aceita `exclusoes`. Catálogo em `EMERGENCIAS-RADIOLOGICAS-30.md`.
- **D-W9-69 · Léxico TC regional desidentificado** em `docs/referencias/rads/LEXICO-TC-REGIONAL.md` (sinonímia local → elos canônicos; sem PHI).
- **D-W9-70 · KB ACR F2_CANDIDATE** espelhada em `docs/referencias/evidencias/ONCOASSIST-KB-ACR-EMERGENCIAS-F2.md`: ACR sugere exame candidato; RADS alerta no laudo; médico confirma. Fonte de status = AUDITORIA-ACR-v2 (sem scrape runtime).
- **D-W9-71 · Documento-cerne WORK registrado** (`docs/canonica/WORK-ARQUITETURA-CLINICA.md`, Oct 5 2026 · Silas Jr): fusão LAB + esteira A–E + modelos QT HBem; conflitos C1–C6 declarados. Conteúdo clínico permanece; **nomenclatura de território atualizada por D-W9-72**.
- **D-W9-72 · Mapa de nomes (Dr. Silas, 2026-10-07) — abole WORK×STUDY dentro do OncoMind:**
  - **OncoGlobal** = só o **guarda-chuva** dos projetos: **OncoMind** · **consultorio-docs** · **estatística HBem** · **QT HBem** (legado: Doctor_OS, Doctor_Suite). Não é o app clínico sozinho.
  - **OncoMind** = projeto **solo** (este repo `OncoGlobal` / código clínico). A divisão WORK/STUDY foi **abolida**. OncoMind tem **OncoAssist** (OncoAgente completo no território) e pode falar com **consultorio-docs** (Mesa mantida lá; backend não convertido — app novo em vez de migrar).
  - **OncoAssist** = identidade persistente (já D-W9-56).
  - **MAESTRO** = recebe evento (ex. “chegou laboratório”) e escolhe **roteiro predefinido** de agentes/dependências; evento desconhecido → **sem plano** (`src/orchestration/maestro.ts`).
  - **ORK** = chama agentes, paralelo quando independente, espera dependências, timeout, retry de certos erros, reúne resultados (`src/orchestration/ork.ts`).
  - Abaixo: agentes (LABS, RADS, PATH, CTCAE, RECIST, BIOMARKER, CHEMO, TRIAL, COMORB, INTERACT, APAC, SIGTAP, EMERGENCY, DOCS, STAT) → **Onco-Harness** → MEMORY_OS ∥ BRAIN_OS.
  - **APAC preenchida** = **só a página/laudo APAC** do fluxo (um formulário; não inventar outro documento APAC paralelo).
- **Textos de governança (OncoAssist, Programa Fase A) comparados com o código:** `docs/specs/ONCOASSIST-PROGRAMA-X-CODIGO.md`; originais em `docs/referencias/governanca-qt-hbem/`.
- **Ainda abertos:** baixar diretriz SBOC de mama 2026 FINAL (4 PDFs; link direto × login de sócio); conector Plaud automático (A8); texto do INSS para doença metastática/paliativa; dexametasona D2–D3 sem NK1; texto final das mensagens de red flag (base aprovada em D-W9-28), ativação de interações medicamentosas (com fonte), biblioteca das ~50 fichas.
- **Integração W10 (2026-10-07, tech lead):** Grok (19), Cursor (7) e cadeia Astra + 5 Lunas (29) mergeados `--no-ff` em `f0/w1-integrado`, escopo conferido (nenhum toca contratos/package.json). Ajustes do tech lead: `src/modules/apac/emissao.ts` e `documentos/dedupe.ts` passam a importar o ruleset por JSON estático (sem `node:fs`, teste de pureza GRK-10 volta a passar); teste da Luna3 compara o `.md` ignorando CRLF; `gates.ts` reexporta `g16Owner`/`lerCatalogoDonos` (T-56 verde); N19 reconhece `scripts/verificar-manifesto.mjs` (adv-w8: 41/41 verdes). Red team: 24 vermelhos (eram 26).
- **D-W9-73 · CTCAE v6 pura (Dr. Silas, 2026-10-07; renumerada porque D-W9-67 já era o kit TumorLot):** nenhum corte da v5. Plaquetas 20.000/µL = **G3** (v6: G3 <50.000–10.000; G4 <10.000) → fila do médico, sem E1. O alerta de plaquetas < 50.000 (decisão de 08/10) continua independente do grau.
- **D-W9-74 · Desconhecido representável na triagem (tech lead, 2026-10-08):** `Triagem.tontura` passa a `boolean | null`; `null` = desconhecido → PENDENTE, nunca `false` (achado da simulação Astra, Paciente Teste 91). Onda **W12-GROK** (10 fatias, `docs/ondas/W12-GROK.md`) ativada.
- **D-W9-75 · Dr. Silas, 2026-10-08:**
  (a) **Toxicidade: o médico descreve, o app classifica.** O médico escreve o que aconteceu na caixa "Texto" (ex.: "6 episódios de vômito por 3 dias, com observação hospitalar"). O código extrai os critérios com o trecho-fonte e **sugere o grau CTCAE v6**. O médico confirma ou corrige; nunca marca o grau à mão. Ambiguidade e critério faltante aparecem como PENDENTE.
  (b) **Canal do paciente: orientação geral por cenário, nunca prescrição.** Substitui a "resposta FIXA" de Q43. Pode citar linhas gerais (ex.: diarreia → hidratação, dieta antidiarreica, alimentos a evitar, sinais de gravidade, suspender anti-hipertensivos e diuréticos). Proibidos: remédio com dose, posologia, início de medicamento e diagnóstico. Sempre termina com "nada substitui a avaliação presencial do seu médico". Texto no corpus, curado pelo Dr. Silas.
- **D-W9-76 · Tontura não é critério clínico (Dr. Silas, 2026-10-08).** Comum por fármaco e por labirinto do idoso; não corta, não pesa no salão e não gera alerta. **Exceção:** vertigem subjetiva de início novo, sem histórico → alerta para investigar SNC (metástase cerebral/cerebelar). Os sinais fundamentais citados pelo Dr. Silas são: vertigem nova, hiporexia, sarcopenia, febre/sepse, obstrução, perfuração, hemorragia, tremor, perda de sensibilidade, taquicardia e hipotensão. Conferir a cobertura em `emergencias-transversais`.
- **D-W9-77 · Fluxo clínico, respostas do Dr. Silas (2026-10-08, M-AM/PLN-036):**
  (a) **Resumo nasce para revisar:** o app monta o resumo a partir do texto/documento colado; o médico revisa, corrige e valida antes de ir para a evolução. Debate com o agente não é o padrão.
  (b) **Consulta Flash = visão rápida só com os temas fundamentais**, em itens curtos (ex.: "biópsia: adenocarcinoma · TC tórax: nódulo pulmonar 43 mm · cintilografia: captação em T7"). Com 1 clique o médico deixa o **retorno com laboratório** (sempre presente, pré-selecionado como modelo padrão do médico, compatível com "pré-marca só do modelo salvo") e, eventualmente, exame radiológico, e finaliza a consulta.
  (c) **Retrato transversal começa por:** mama, próstata, cólon, pulmão, colo uterino e gástrico.
  (d) **Interações e comorbidade × remédio:** bula ANVISA/FDA rotulada + literatura pública, sempre em RASCUNHO até o Dr. Silas conferir item a item.
- **D-W9-78 · Retrato transversal e Flash (Dr. Silas, 2026-10-08):**
  (a) **"Cólon" = colorretal**, com subsítio: cólon direito, transverso ou esquerdo; sigmoide; reto alto, médio ou baixo.
  (b) **O retorno vai sempre na Consulta Flash**, com o prazo visível; não pode ser desmarcado. Laboratório e imagem continuam marcáveis, com pré-seleção só pelo modelo do médico.
  (c) **Colo uterino tem um só campo FIGO**: o estádio do núcleo. O campo duplicado saiu.
  Revisão do planejamento (PLN-037) aplicada ao schema AP: lateralidade e topografia no núcleo; CONFLITO sem origem geral; confiança BAIXA só com valor; HER2 de mama com "0 ultralow".
- **D-W9-79 · Ordem dos laudos de perícia (Dr. Silas, 2026-10-09):**
  1. afastamento laboral (INSS);
  2. aposentadoria / afastamento permanente;
  3. transporte público gratuito;
  4. LOAS/BPC.
  Mais raro: laudo para judicialização de medicamento não fornecido pelo SUS. Usa os trials como base de qual fármaco pedir (Q48, minuta assinada pelo médico).
- **D-W9-80 · Fechamento da F0 delegado (Dr. Silas, 2026-10-09):** "Congela e pode publicar." **Codex Astra é a orquestradora e o writer único de `f0/w1-integrado`** até a F0 ficar pronta para merge. Tem 5 Lunas executoras em modalidade GOAL e segue o prompt `docs/ondas/F0-FECHAMENTO-ASTRA.md`. A Astra faz todos os passos: integração sem perda, matriz, prova da consulta completa, correções, auditoria, PR, push e commit. **O Dr. Silas só faz o merge na `main`.** Claude fica em leitura no integrado (auditor cruzado). O ramo da Astra foi publicado (`c0c0762`). Backup do trabalho do Cursor sem commit em `C:\Users\silas\handoff\backup-cursor-2026-10-09\` (D2 pendente).


## Registro técnico de fechamento F0 — 2026-10-09

**F0 pronta para merge humano**, conforme missão D-W9-80. Código verificado `dc2e78c`, PR #4 (`f0/w1-integrado → main`): bateria serial com 2.298 regulares, 240 redteam e 41 W8 PASS; TypeScript/fronteiras/corpus PASS; E6b 6/6 três vezes; matriz 290/290 sem vermelho F0; demo real sintética com nove capturas; auditoria independente sem ALTO/MÉDIO aberto. CI do candidato verde. Evidências e limites em `docs/RELATORIO-F0.md` e `docs/f0-fecha/STATUS.md`; o último commit documental também deve estar com CI verde na entrega.

Integração sem perda com diferenças de patch justificadas, branches fonte preservados/publicados, WIP antigo do Cursor intocado. Nenhuma decisão clínica nova, nenhuma habilitação de provider externo, nenhum merge na main ou tag. CANONICA e limpeza de worktrees continuam somente propostas; aplicação exige ordem própria. O Dr. Silas faz o merge.

## F0 fechada · decisões de abertura da F1 (Dr. Silas, 2026-10-10)
- **F0 fechada:** o PR #4 foi mergeado na `main` (`8d456ab`) por ordem do Dr. Silas ("1 SIM"). Tag `f0-fechada`. A F1 integra em `f1/integrado`, a partir da `main`.
- **D-W9-81 · Ditado ambíguo sobre a coleta ("coletar em jejum", "já coletou ontem") → a tarefa SISTEMA FICA, com conflito ao médico** (coerente com INV-07 e D-W9-34a). Só o ditado inequívoco sobre o objeto da tarefa a suprime.
- **D-F0C-08 · Tetos de dose acumulada (Dr. Silas, 2026-10-10):** doxorrubicina 550 mg/m², epirrubicina 900 mg/m², mitoxantrona 140 mg/m², bleomicina 400 U e 200 U/m², cisplatina 300 mg/m², oxaliplatina 850 mg/m². Cada droga no próprio teto. Chegar no teto acende o vermelho já existente e não bloqueia. Item parcial acende alaranjado, fora desse farol. Dado ausente continua pendente no próprio item. Lipossomal e o corte de 100 U ficam de fora.
- **D-W9-82 · O app NUNCA para o serviço ou o setor.** Dado que o setor não coleta não pode virar pendência universal que manda todos à fila do médico. **Creatinina do salão = último laboratório válido** (`valorAtual`), adiantada para a F1-00. Sem laboratório válido, o paciente segue com alerta visível "creatinina não disponível", nunca parado. O corte continua valendo quando há valor. A prioridade é: primeiro o paciente (alerta) e nunca travar o fluxo (Q27 relido à luz desta decisão).
- **D-F1-01 · A Flash não mostra semáforo (Dr. Silas, 2026-10-10).** O farol (verde, vermelho, pendente) e o alaranjado da dose acumulada aparecem só na tela principal de cada tema. A Flash é para as consultas do dia: revisão rápida, ciclo e exames, liberar o paciente. Mostra os dados essenciais e o caminho até a página do fato, sem cor de farol. Isso não impede o médico de abrir a página onde o fato está. Afeta D-F0C-08: o vermelho e o alaranjado da dose acumulada saem da Flash e vão para a tela do tema. A mudança no código fica para a F1.
- **Aceite da proposta F1 do Fable 5.1 (Dr. Silas, 2026-10-10, "SIM"):** (1) base `f1/integrado`, com PR para a `main` a cada portão; (2) fuso America/Fortaleza UTC−3; (3) voz fora da F1; (4) PDF escaneado por OCR local `tesseract.js` (nova dependência autorizada), com fallback D-W9-66 quando a confiança for baixa; (5) dois portões da LLM, um gravado no CI e um ao vivo registrado em log; (6) o limiar do serviço é alerta, a ficha relaxa ou endurece com fonte e nunca bloqueia; (7) peso continua em 5 kg/60 d, com % como aviso; (8) a lei do Cursor fica intocada e a Agenda vai para `docs/design/rascunho-nao-integrado/`.
- **D-F1-02 · Catálogo de exames (Dr. Silas, 2026-10-11).** A lista aprovada junta a proposta do Claude e a lista do Dr. Silas: 141 itens em `corpus/exames/exames-sigtap.v1.json`, organizados por seção e tópico. Códigos e nomes vêm do ZIP SIGTAP 09/2026 pinado, por script (`gerar-exames.mjs`). Entram só os segmentos que o oncologista usa na prática. O que não tem código no SIGTAP fica como `SEM_CODIGO_SUS` (CA 15-3, CA 19-9, PSA livre, PET-PSMA, DOTATATE, Octreoscan, USG de axilas, histeroscopia diagnóstica e videonasolaringoscopia). O TSH com T4 livre do grupo 0202.11 (teste do pezinho) fica de fora.
- **D-F1-03 · O corpus se organiza em 3 pilares (Dr. Silas, 2026-10-11).** (1) **Exames**, por seções e tópicos; (2) **Receitas e orientações**; (3) **Laudos**. Os arquivos atuais migram para essa estrutura numa tarefa própria da F1. A migração não pode quebrar o loader nem os testes.
- **D-F1-04 · Pedido de imagem sai com o resumo do caso (Dr. Silas, 2026-10-11).** Todo pedido de exame de imagem sai automaticamente com o resumo do caso, para o radiologista ter o contexto do histórico. Esse resumo é gerado pelo app a partir de fatos confirmados (diagnóstico, estadiamento, tratamento atual e anterior, cirurgia, radioterapia, último exame comparável e pergunta clínica) e o médico confere com 1 clique. Não leva PHI além do que o pedido já exige. Fica como tarefa do Trilho 2 da F1.
- **D-F1-05 · Biblioteca ativa e alerta por curadoria (Dr. Silas, 2026-10-11).** Todo item redigido com fonte (interações, contraindicações, CTCAE e o restante) fica consultável já na página do tema, marcado "não curado" enquanto não for revisado. O alerta automático só liga item a item, com aprovação do Dr. Silas. O campo `ativo` se divide em `consultavel` e `alerta`. O volume de dados não pesa no código.
- **D-F1-06 · Árvore do corpus (Dr. Silas, 2026-10-11).** São 8 pilares: exames (labs, rads, path, endoscópicos), receitas (simples, especiais cardio/nefro/infecciosas/endócrino, lista por classes), laudos (INSS, afastamento, LOAS, transporte, judicialização de drogas, fraldas, FGTS, nutrição, oxigênio, incapacidade), interações e contraindicações, CTCAE-ação, pack-tumor (mama, próstata, pulmão, colorretal, gástrico), orientações (dieta geral, por tumor e por toxicidade; atividade física; sinais de alarme) e encaminhamentos (mastologia, cirurgia oncológica, radioterapia). Esta decisão substitui os 3 pilares da D-F1-03. Detalhe em `docs/ondas/F1-CORPUS-ARVORE.md`; prompts por LLM em `docs/ondas/F1-CORPUS-PROMPTS.md`.
- **D-F1-07 · Lei da longitudinalidade e da transversalidade, X + Y = Z (Dr. Silas, 2026-10-11).** O app não é um conjunto de caixas isoladas. Longitudinal: o mesmo paciente ao longo do tempo, com todo fato datado, com validade e origem, e com a avaliação reaberta quando esquema, dose, medicamento, comorbidade, exame ou toxicidade mudam. Transversal: os domínios (tumor, exames, receitas, interações, contraindicações, CTCAE-ação, laudos, orientações, encaminhamentos, agenda, APAC, canal) se conectam por IDs e produzem avaliações e propostas a partir de fatos confirmados; a conduta pertence ao médico. Domínio clínico não é permissão de acesso de setor assistencial. Toda biblioteca declara as portas que oferece e as que consome. A avaliação clínica roda sobre a prescrição proposta, antes de virar ciclo registrado, e é refeita a cada mudança relevante. A Flash recebe só o resumo e o link ao fato, sem semáforo (D-F1-01). Prioridade operacional da F1: o motor que aplica a biblioteca ao paciente e o dispara na prescrição. Cobrado no red team (`docs/ondas/F1-CORPUS-PROMPT-REDTEAM-GLM.md`, ataques A12 a A19).


## Integração da biblioteca e comunicação entre domínios — 2026-10-11

Registro do pedido do Dr. Silas: biblioteca no Segundo Cérebro do Genspark, exclusiva do OncoGlobal, acessível também fora das consultas para enriquecimento; completar e otimizar integração, dutos e comunicação. As decisões abaixo definem o contrato alvo. **Não comprovam implementação, conexão externa, aprovação clínica ou liberação de setores multiusuário.**

- **D-F1-08 · Biblioteca Genspark e cópia operacional local.** O Segundo Cérebro do Genspark é o ambiente pretendido de organização, pesquisa e enriquecimento privado da biblioteca do OncoGlobal. O aplicativo conserva uma cópia local versionada: conteúdo consultável com estado de curadoria visível, regras automáticas apenas quando aprovadas item a item (D-F1-05). Prontuário, avaliação individual, prescrição, assinatura e decisões permanecem no OncoGlobal. A edição em domicílio não altera automaticamente uma consulta ou regra em uso. Exclusividade é requisito de acesso e uso do projeto, não garantia presumida da plataforma. API, autenticação, exportação, privacidade, custos e limites do Genspark precisam ser comprovados por documentação oficial e prova técnica; se não houver API oficial adequada, usar pacote exportado/importado e declarar sincronização manual. Nenhuma integração é considerada existente por haver documentos armazenados.

- **D-F1-09 · Um duto de conhecimento, sem prontuário externo.** Fluxo: entrada de pesquisa → reconciliação com conteúdo existente do GLM/corpus → revisão → publicação versionada → importação validada → ativação local. Novidades, trials e alterações feitas pelo médico fora do atendimento entram em revisão, preservando autoria, fontes e histórico; aprovação clínica é explícita. Não enviar identificadores, documentos de pacientes, resumo individual ou prescrição ao Genspark. Consultas externas usam termos de conhecimento geral, sem combinações que possam reidentificar o paciente. A exceção documental D-W9-66 não autoriza envio ao Genspark. Conteúdo recuperado e instruções embutidas em documentos são dados não confiáveis, nunca comandos. Oito pilares da D-F1-06 permanecem; fontes, tratamentos e trials são vínculos transversais, sem corpus concorrente.

- **D-F1-10 · Portas tipadas entre domínios.** Cada domínio declara entradas, saídas, proprietário, versão de contrato, permissões e eventos que invalidam sua avaliação. Toda troca clínica identifica paciente, encontro, lote tumoral quando aplicável, evento/operação, revisão dos fatos e versão da biblioteca; troca exclusivamente bibliográfica usa IDs de conteúdo e não exige dados do paciente. Referências apontam ao fato original, com origem, data, negação e conflito preservados. Não copiar valores entre caixas como nova verdade nem compartilhar acesso direto ao banco entre setores. Usar os contratos, ledger, MAESTRO/ORK e gateway existentes quando adequados; evitar barramento, grafo ou serviço paralelo sem necessidade demonstrada. IA extrai e explica; código aplica regras aprovadas; médico decide.

- **D-F1-11 · Caminho tumor → investigação → tratamento → segurança.** Tumor confirmado seleciona o pack e abre a lista contextual de informações necessárias. Histologia, estádio, biomarcadores, fase, intenção, linha e tratamentos prévios refinam a aplicabilidade. O nome do tumor sozinho não autoriza esquema nem bateria universal de exames. Comparar requisitos com fatos e pedidos existentes: confirmado, ausente, solicitado, vencido, conflitante ou não aplicável. Preparar apenas propostas justificadas, com fonte, evitando repetição indevida e preservando D-F1-04. Ao escolher um tratamento, avaliar **os itens da prescrição proposta**, antes do primeiro ciclo registrado, contra medicamentos reconciliados, comorbidades estruturadas, alergias, função orgânica, toxicidade, exposições e requisitos específicos. Ausência não equivale a normalidade; falta de cobertura da biblioteca não equivale a ausência de risco. Informar cobertura, pendências e motivos. A avaliação não prescreve nem altera doses silenciosamente e não interrompe o atendimento (D-W9-82).

- **D-F1-12 · Comunicação orientada a mudanças e preparação antecipada.** Documento confirmado, exame novo/corrigido, reconciliação de medicamentos, alteração de comorbidade, toxicidade, esquema, dose ou administração invalidam somente as avaliações dependentes. Uma avaliação registra IDs/revisões das entradas e versões das regras; resposta calculada para revisão antiga não pode aparecer como atual. Reavaliar antes da confirmação da prescrição, no primeiro ciclo e quando houver mudança relevante, sem presumir aprovação anterior. Na véspera e nos dias anteriores, montar revisão com exames disponíveis, pedidos em andamento, faltas, conflitos, histórico e propostas; decisão e emissão continuam sujeitas à revisão médica. Mostrar resumo e link na Flash, sem semáforo. Agrupar avisos repetidos, mantendo risco e pendências acessíveis na página do tema.

- **D-F1-13 · Dutos assistenciais separados e rastreáveis.** Consulta alimenta propostas de exames, encaminhamentos e documentos; prescrição assinada alimenta farmácia; farmácia devolve solicitação de correção, sem editar prescrição; salão registra administração efetiva, parcialidade e eventos; administração alimenta histórico e cumulativos; APAC deriva da conduta assinada e segue validação regulatória própria; agenda recebe tarefas e datas confirmadas. Planejado, prescrito e administrado permanecem distintos. Cada mensagem/tarefa tem responsável, estado, correlação, prazo quando definido e confirmação de recebimento; recebimento técnico não significa execução clínica. Chat conserva discussão operacional; decisão clínica aceita gera registro próprio com autoria e referência, nunca promoção automática do chat ao prontuário. Permissões são aplicadas no servidor por setor; vínculo por ID não concede acesso. A F1 monousuário prepara os contratos, sem declarar setores remotos, canal ou multiusuário liberados. Preservar os portões de assinatura/consentimento e a separação prescrição ≠ APAC.

- **D-F1-14 · Sincronização, túnel seguro e tolerância a falhas.** Comunicação externa somente pelo gateway e adaptador autorizado, autenticada e cifrada; nenhuma chave no frontend, nenhum banco exposto à internet ou túnel aberto por este registro. Acesso domiciliar à biblioteca é distinto de acesso remoto ao prontuário; este último depende de implantação própria autorizada. Preferir busca por IDs, filtros de aplicabilidade, cache por versão e sincronização incremental quando suportada, sem chamada externa por campo ou clique. Pacote traz manifesto, schema, versões, hashes e referências; validar integridade, duplicidades, dependências, aprovação e compatibilidade antes de ativação atômica. Hash comprova integridade, não veracidade clínica. Falha mantém última versão válida, com data/estado visíveis e recuperação possível. Retry limitado, timeout, idempotência e controle de revisão evitam duplicar pedidos e ações. Separar estados de transporte (recebido/falhou), curadoria (rascunho/aprovado/obsoleto), avaliação clínica e execução. Uma atualização não reescreve prescrições assinadas nem avaliações históricas; invalida avaliações em aberto quando pertinente. Trial consultável na F1 é referência para revisão médica, sem elegibilidade automática; qualquer POSSIBLE_MATCH permanece fora desta liberação, esclarecendo Q48.

### Aceite operacional desta integração

Fechar somente com evidência de: capacidades reais do Genspark; importação de pacote válido e rejeição de inválido; recuperação da versão anterior; funcionamento offline; busca por tumor/cenário; links até fonte e fato; avaliação da prescrição proposta antes do ciclo 1; reavaliação após medicamento novo; conflito de laudos preservado; separação entre dois tumores do mesmo paciente; não duplicação de pedidos; nenhuma saída de prontuário ao Genspark; permissões por setor quando implementadas. Medir latência, falhas, versão desatualizada, cobertura de regras, pendências e duplicidades com denominadores explícitos, sem metas numéricas inventadas. Prova documental, teste isolado, integração e demonstração no aplicativo são estados diferentes. Este registro autoriza o planejamento documental; implementação, credenciais, abertura de túnel, publicação e promoção clínica exigem suas tarefas e portões próprios.
- **D-F1-15 · Fechamento do corpus F1 (Dr. Silas, 2026-10-12).** (1) mDCF gástrico com cisplatina 40 mg/m² no **D3** (esquema de Shah). (2) Ifosfamida no colo do útero em ciclo de **28 dias**. (3) GIST: estratificação de risco AFIP/Miettinen da Aula 77 do Onco PRO 2026, com as correções do AFIP clássico (gástrico 5–10 cm com >5 mitoses = 55%; jejuno/íleo = 85%), ou o NIH modificado da SBOC; imatinibe adjuvante 400 mg/dia por 3 anos no alto risco; a tabela com erro do MOC não é usada. (4) Imatinibe no cordoma: usado **off-label**, dose por decisão médica. (5) Rim e próstata: vigilância e observação aplicáveis ao **baixo risco** (intervalo numérico ainda não fixado). (6) A conferência do MOC Tumores Sólidos 2026 foi aplicada (`docs/ondas/F1-MOC-2026-CONFERENCIA.md`). O tópico de documentação do corpus está **fechado**; a próxima etapa é a fase F1, depois das auditorias que o Dr. Silas vai apresentar.
- **D-F1-16 · Respostas às perguntas do corpus, 1ª rodada (Dr. Silas, 2026-10-12).** (1) As doses e as regras de monitorização tiradas da bula FDA ficam **provisórias** até a conferência na bula ANVISA. (15) mFOLFOX6 e FOLFIRI paliativos **COM bolus** de 5-FU 400 mg/m², o que revoga a omissão do D-W9-50; as fichas devem ser alinhadas. (22) FLOT com **5-FU 2.400 mg/m² em 46 h** (dose do serviço, mantém D-W9-59); a SBOC/MOC traz 2.600 em 24 h. (23 e 28) Irinotecano no esôfago e no gástrico **segue a SBOC** (esôfago 150 mg/m² a cada 14 dias); as fichas devem ser alinhadas. (43) A infusão de 5-FU **não** foi padronizada para todos os packs. Resposta registrada ao pé da letra: "com infusão 46 e D1 e D2 por 8 horas" (interpretação a confirmar). Ainda não foram editadas: as fichas `corpus/fichas` de FOLFOX e FOLFIRI paliativos, FLOT e irinotecano de esôfago e gástrico.
- **D-F1-17 · Respostas às perguntas do corpus, 2ª rodada (Dr. Silas, 2026-10-12).**
  - **(43A) Infusão de 5-FU:** o serviço trabalha com duas opções: 46 h em bomba, ou D1 e D2 com 8 horas por dia, sem bomba.
  - **Adrenal:**
    - (2A) Mitotano na faixa SBOC de 1–4 g/dia, titulado por mitotanemia.
    - (3A+B) Catecolaminas em urina de 24 h ou RM em T2 pelo SUS, e metanefrinas por outra via.
  - **Bexiga:**
    - (4A) ClCr < 60 = inelegível à cisplatina.
    - (5B) Erdafitinibe para FGFR2 ou FGFR3.
    - (6A) Gencitabina 2 g intravesical.
    - (7A) Pack próprio para o trato urinário superior.
    - (8A) Seguimento caso a caso.
  - **Cabeça e pescoço e anal:**
    - (9A) Capecitabina metronômica 625 mg/m².
    - (10B) Exigir hibridização in situ (EBER/HPV).
    - (11A) Adenocarcinoma anal segue o pack colorretal.
  - **Colo do útero:**
    - (12A) p16 só no diagnóstico.
    - (13A) KEYNOTE-A18 aguarda a SBOC.
  - **Colorretal:**
    - (14A) FOLFOXIRI sem bolus, LV 200.
    - (16A) CheckMate-8HW.
    - (17A) AJCC 8ª edição.
    - (18A) LV5FU2 fora.
  - **Endométrio:**
    - (19A) Olaparibe 300 mg 2x/dia, provisório.
    - (20B) Criar o protocolo de IO + QT no dMMR III/IV.
  - **Esôfago e gástrico:**
    - (21A) Nivolumabe + ipilimumabe no D29.
    - (24A) Faixas pelo limite inferior.
    - (25A) Backbone 80/800.
    - (26A) FLOT paliativo sem bolus.
    - (27A) Cisplatina 75 mg/m².
    - (29A) Qualquer fluoropirimidina + platina.
  - **GIST:** (30B) TC de tórax e EDA de rotina.
  - **Gliomas:**
    - (31B) Temozolomida no SUS = sim.
    - (32A) Método molecular definido com a patologia.
    - (33A) Carmustina como alternativa, mantendo o PCV.
    - (34B) Criar a temozolomida protraída.
  - **Mama:** (35A) Incorporar o câncer de mama na gestação.
  - **Melanoma:**
    - (36A) IIB/IIC caso a caso.
    - (37A) BRAF por PCR ou NGS, sem VE1 isolada.
    - (38A) USG de cadeia linfonodal no catálogo.
  - **Neuroendócrinos:** (39A) pNET provisório.
  - **Ovário:**
    - (40B) Buscar a dose do VAC e criar o protocolo.
    - (41A) EP com as doses do testículo.
    - (42A) Mucinoso com CAPOX ou FOLFOX do colorretal.
  - **Vias biliares:** (44A) Oxaliplatina 85 mg/m² no GEMOX.
  - **Pênis:** (45A) Incluir 5-FU tópico e imiquimode.
  - **Próstata:**
    - (47A) Docetaxel quinzenal provisório.
    - (48A) Prednisona 5 mg 2x/dia com olaparibe + abiraterona.
  - **Pulmão:**
    - (50A) CheckMate 816 e 77T separados.
    - (51A) Pembrolizumabe 400 mg a cada 6 semanas.
    - (52A) Limite inferior.
    - (53A) Clone de PD-L1 com a patologia.
  - **Sarcomas:**
    - (54B) Buscar a referência de gencitabina + DTIC e criar o protocolo.
    - (55A) DTIC 750 mg/m², 3 ciclos.
    - (56A) MTX em alta dose com protocolo institucional.
    - (57A) RM de membros e RX de segmentos no catálogo.
  - **Testículo:** (58A) Exames do curso como condicionais.
  - **Tireoide:** (59A) Anti-Tg e painéis NGS sem código SUS.
  - **Catálogo:** (60A) Catálogo v1.3.
  - **Pendentes de resposta:** 46 (pênis, conduta em cN1) e 49 (critério de alto risco no mHSPC). Respondidas em D-F1-20.

- **D-F1-18 · O paciente é um só, o software tem vários setores (Dr. Silas, 2026-10-12).** Literal: "QUANDO DIGO 1 SO PACIENTE, ME REFIRO QUE ELE DEVE SER VISTO COMO UM TODO, E NÃO FRAGMENTADO POR SETORES DE SOFTWARE, A ANATOMIA DO SOFTWARE SIM, DEVE SER SETORIALIZADA E FRAGMENTADA DE MANEIRA ESPECIFICA E PROFUNDA, MAS OS DADOS CLINICOS E HUMANOS, AO MEDICO, DEVE APARECER COMO UMA UNIDADE, PORTANTO A RECONCILIAÇÃO DE CADA SETOR ( COMORBIDADES, TOXICIDADES, INTERAÇÃO, ANALISE LABORATORIAL E IMAGING, BIOMARKERS E TRATAMENTO ) É A VIDA HUMANA QUE ESTÁ EM JOGO." Consequências: (1) o código se divide em setores clínicos profundos e especializados, cada um com contrato, regras, testes e responsável próprios; (2) uma camada de **reconciliação clínica** cruza as saídas dos setores sobre o mesmo paciente e a mesma revisão de fatos; (3) o médico vê **uma visão integrada** (achados cruzados com a cadeia de causa: exame + droga + comorbidade + toxicidade), nunca listas por setor para ele juntar de cabeça; (4) um setor sem dado ou sem cobertura aparece na visão integrada como lacuna, nunca como "normal"; (5) a conduta continua sendo do médico. Plano: `docs/ondas/F1-PLANO-MODELO-FATIAS.md` (desde a v2).
- **Registro · Relatório do Genspark sobre a biblioteca F1 (2026-10-12).** Resumo em `docs/ondas/F1-GENSPARK-RELATORIO-2026-10-12.md`. Fato operacional relatado: o Segundo Cérebro não tem API oficial de leitura/escrita; integração por pacote exportado com manifesto e checksums, sincronização contínua indisponível (atende à condição de D-F1-08). Nenhum item da biblioteca está verificado em fonte primária, aprovado ou publicado. As referências normativas citadas pelo Genspark (CTCAE v6.0, RDC 1.036/2026 sobre a Portaria 344/98 e as demais) seguem `[VERIFICAR]` até leitura integral da fonte oficial; nenhuma vira regra por este registro.
- **D-F1-19 · Maestro-ORK é o cerne; órgãos, sangue e nervos (Dr. Silas, 2026-10-12).** Literal: "DR SILAS ORDENA MANUTENÇÃO PEREMPTORIA DE MAESTRO-ORK, CERNE DO PROCESSO, REFUTANDO A AUDITORIA PROPOSTA NESTE ASPECTO. OS SETORES PROFUNDOS, SEPARADOS MAS INTEGRADOS, COMO ORGÃOS HUMANOS, COM SUAS FUNÇÕES E RESPONSABILIDADES, CADA QUAL EM SUA ANATOMIA, MAS INTEGRADOS PELO SANGUE E PELOS NERVOS (( ROTAS, TRILHAS, DUCTOS DO APP ). A UTILIDADE DOS TOPICOS 1,2,3 ( MAIS DOMINIO E MENOS AGENTES ) FAVORECEM O APP." Consequências: (1) Maestro (tabela fixa de planos por evento) e ORK (executor supervisionado) **não serão removidos nem substituídos**; fica refutada a recomendação da auditoria de removê-los ou de tirar a orquestração do centro; na F1 eles passam ao runtime (S6); (2) os setores são órgãos com anatomia própria, ligados pelo sangue (ledger e Retrato) e pelos nervos (rotas, trilhas e dutos); (3) adotados: porta única de entrada, mapa de núcleo e satélites com fronteiras no `check-boundaries`, e mais domínio com menos agentes (setores são funções puras; LLM só na extração e na síntese). Plano: `docs/ondas/F1-PLANO-MODELO-FATIAS.md` v3.
- **D-F1-20 · Respostas 46 e 49 do corpus (Dr. Silas, 2026-10-12).** **(46A) Pênis, cN1:** "cN1 PROVISÓRIA": a conduta da aula PRO fica aceita como provisória até fonte SBOC/diretriz; permanece RASCUNHO e não gera alerta. **(49A) mHSPC, alto risco e alto volume:** o Dr. Silas fixou os dois eixos. **Alto volume (CHAARTED):** metástase visceral OU ≥ 4 lesões ósseas com ≥ 1 fora da coluna vertebral e da pelve. **Alto risco (LATITUDE):** pelo menos 2 de 3: Gleason ≥ 8, ≥ 3 lesões ósseas, metástase visceral mensurável. Volume e risco não são idênticos (cerca de 10% discordantes; alto volume + alto risco = pior prognóstico; baixo + baixo = melhor). Fatores que complementam e **não substituem** os critérios: doença sincrônica (de novo) pior que metacrônica; M1c pior que M1b pior que M1a; LDH elevada, albumina baixa, ALP elevada, CRP elevada, hemoglobina baixa; grade group 5 ou padrão 5; performance status ruim e dor intensa basal. A decisão de intensificação considera principalmente o volume CHAARTED, com risco LATITUDE e timing como fatores adicionais. A grafia "> 8" da SBOC p.10 fica superada por "≥ 8". Os artigos originais CHAARTED e LATITUDE não estão no repo: critério registrado por decisão médica, fonte primária anexada quando disponível (sem NCT ou DOI inventado). Aplicado em `pack-penis.v2`, `pack-prostata.v2` e `F1-CORPUS-DECISOES-PENDENTES.md`.
- **D-F1-21 · Modo de trabalho da F1 (Dr. Silas, 2026-10-12).** "FABLE ORQUESTRA AGENTES SONNET. FABLE PLANNING (CÉREBRO, PENSADOR SENIOR, ONCOLOGISTA E ENGENHEIRO DE SOFTWARE MÉDICO) + AGENTES SONNET (BURROS, MECÂNICOS, SEGUEM ORDEM). AVALIE E CORRIJA, TESTES ADVERSARIAIS, ENTREGA COMPLETA." Consequência: o planejamento, as decisões de desenho e a revisão são do Fable; o Codex-Fugu orquestra a execução das fatias já aprovadas (distribui, integra, cobra prova) e não planeja nem decide contrato; agentes mecânicos recebem WRITE_SET fechado, spec literal e prova obrigatória, e nunca decidem clínica ou contrato. Toda fatia entrega com testes adversariais.
- **D-F1-22 · Referências arquiteturais externas são só padrão (Dr. Silas, 2026-10-14).** Medplum (recursos modulares, SDK/contratos), OpenMRS ESM (módulos por capacidade, carregamento incremental), CARE (jornadas clínicas React/TS), Bahmni (atendimento → farmácia → dispensação, setores) e FHIR Clinical Reasoning (evidência estruturada, regras computáveis, elegibilidade, rastreio regra–fonte–versão–resultado) servem apenas como referência de padrão. O OncoGlobal mantém modelo interno próprio: kernel, contratos Zod e ledger não são substituídos por FHIR; não se importa domínio, banco ou fluxo completo; nenhum acoplamento de runtime. Toda adaptação preserva identidade canônica, longitudinalidade, proveniência, estados explícitos, auditoria, separação extração/regra/minuta/decisão, autoridade médica e TS/React/Zod. Cada padrão é avaliado por ficha (PADRÃO · FONTE · CAPACIDADE · LOCAL · CONTRATO · RISCOS de acoplamento/clínico/operacional · ADOTAR/ADAPTAR/REJEITAR · JUSTIFICATIVA · TESTE). Fichas iniciais em `docs/arquitetura/REFERENCIAS-EXTERNAS.md` (3 ADOTAR, 5 ADAPTAR, 1 REJEITAR: FHIR como modelo de dados). Ficha não autoriza código: cada ADOTAR/ADAPTAR vira fatia com quadro de 7 blocos aprovado. Texto original em LABS-REFERENCIA `ENTRADA/DR-SILAS/2026-10-14_DR-SILAS_multi-ia-DSH-e-referencias-arquiteturais_v1.md` (a parte sobre multi-IA no DeepSeek Harness segue NÃO VERIFICADA e não decidida).
- **D-F1-23 · Claude atua no código, não só revisa (Dr. Silas, 2026-10-14).** Literal: "QUERO CLAUDE ATUE NO CODIGO, BRANCHS E PENDENCIAS, SEM SER SOMENTE LEITURA E GERANDO SOLICITAÇÕES EM DEMASIA AO CODEX. QUERO QUE CLAUDE ATUE DE FORMA MAIS PROATIVA, JÁ CORRIGINDO E FAZENDO ENTREGA, NÃO COMO SUBMISSO AO CODEX." Consequência: quando o pedido atual do Dr. Silas atribui ao Claude a entrega de uma fatia ou PR (ex.: "termine a F1"), essa ordem é a designação de escritor exigida pelo AGENTS.md: base = ramo do PR; caminhos de escrita = arquivos tocados pelo PR e pelos achados de revisão dele, mais os testes de regressão. Dentro desse escopo, achados de revisão (Codex GitHub ou local) são corrigidos diretamente pelo Claude, com teste de regressão, resposta e resolução do thread, sem abrir pedido ao Codex. Fora dele (outra fatia, contrato novo, regra clínica nova), vale o fluxo normal: quadro de 7 blocos e designação explícita. Um escritor por vez no mesmo ramo; merge continua exigindo OK do Dr. Silas. Ajusta D-F1-21 nesse ponto.
- **Registro · Auditoria externa de 12/10 sobre `d7c87b3` (conferida por leitura do código).** 7 achados de código **CONFIRMADOS**: (1) `ClinicalEvent.payload` é `unknown` e `porTipo()` descarta payload fora do schema sem pendência (`leituras.ts:125`); (2) `current = patientEvents.at(-1)` e `/consulta/carregar` seleciona esse encontro na sessão (`leituras.ts:195`, `rotas.ts:911`): correção de encontro antigo pode mudar a consulta ativa; (3) alergias, comorbidades e medicamentos passam pelo filtro do lote selecionado ou nulo (`contextoClinico.ts:22`): alergia do lote A pode faltar no lote B; (4) `agora()` é UTC (`oncoassistLocal.ts:46`) e o salão deriva o fuso do instante (`salao.ts:96`), enquanto a consulta fixa −03:00 (`leituras.ts:198`): assinatura entre 21h e 24h muda o dia civil e os 21 dias de validade; (5) `delta` fixo vazio e pendências fixas apesar de campos projetados (`leituras.ts:300,390`); (6) `ultimoAvisoEm: null` sempre e rótulo "SIGTAP ausente" literal (`leituras.ts:509,513`); (7) ORK marca `PRONTO` com um único `ok` e o timeout não cancela o trabalho (`ork.ts:100,35-42`). Também confirmados: o scanner ainda não aplica "satélite não importa satélite"; a ficha FOLFIRI segue sem bolus (D-F1-16 pendente de edição). **Refutado:** "o ledger exige revisão humana e ator SESSAO" não é falha: é a regra (`ledger.ts:46-52`); a consequência correta é que estímulos técnicos precisam de canal próprio, fora de `clinical_event`. Tudo entra no plano v4 como fatia S0 e ajustes de S6.
