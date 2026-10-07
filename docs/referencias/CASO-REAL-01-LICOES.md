# CASO REAL 01 · lições desidentificadas (para todos os executores)

> Fonte: kit documental real de um paciente (11 páginas), avaliado pelo tech lead **no PC do Dr. Silas**. **Nenhum dado identificável foi copiado para cá.** Nomes, números, datas exatas e instituições foram removidos ou trocados. É proibido pedir o original, procurar o paciente ou recriar o caso com dados reais. Para teste, use só o **Paciente Teste 07** sintético (§4).

## 1. O que o kit contém (tipos, não conteúdo)
| # | Documento | Natureza da fonte |
|---|---|---|
| 1 | Ficha de recepção do sistema hospitalar (dados cadastrais, procedimento SIGTAP da consulta, assinatura de acompanhante) | administrativa |
| 2 | Receituário de outro especialista (urologia) resumindo o caso: estadiamento, exames e plano multimodal | **secundária** (cita exames, não é o exame) |
| 3 | Documentos pessoais escaneados (identidade, cartão SUS) + conta de energia **em nome de outra pessoa** | identificação / comprovante de terceiro |
| 4–5 | Anatomopatológico de biópsia de próstata por fragmento (6 sítios) | primária |
| 6 | Ressonância multiparamétrica de próstata | primária, **com trechos riscados à caneta** |
| 7–8 | Cintilografia óssea (**a mesma página duas vezes**) | primária, duplicada |
| 9 | Anatomopatológico de RTU de próstata | primária |
| 10–11 | Imuno-histoquímica (**o mesmo laudo duas vezes**: original e reimpressão extraída do SISREG com outra data no topo) | primária, duplicada |
Além disso, o Dr. Silas mostrou fotos de celular de laudos em papel: sombra, inclinação, dobra, baixo contraste.

## 2. Armadilhas encontradas (cada uma vira teste)
**Identidade (F2 · K-08 · FN-23)**
- I1 · O campo rotulado **"Cartão SUS" em vários laudos contém, na verdade, o CPF** (11 dígitos). O CNS verdadeiro (15 dígitos) aparece em outro documento como "Matrícula". **Rótulo não prova o tipo do identificador:** validar formato e dígito verificador (CPF 11 com DV; CNS 15 com regra própria) e classificar pelo valor, não pelo rótulo. Rótulo e valor discordando → conflito VERMELHO, nunca ligação silenciosa.
- I2 · A ficha mostra o mesmo número de 11 dígitos rotulado como "CI" (identidade). Mesmo achado.
- I3 · Comprovante de residência **em nome de outra pessoa** (familiar). Endereço desse documento **não** liga paciente e **não** é dado do paciente sem confirmação.
- I4 · Assinatura no rodapé da ficha é de **acompanhante**, não do paciente.
- I5 · Médico **solicitante** do exame ≠ médico assistente ≠ médico que assina o laudo. Nenhum deles é o usuário do app.

**Duplicidade (F1 · INV-07)**
- D1 · Mesma cintilografia em 2 páginas idênticas → **um** exame.
- D2 · Mesma imuno-histoquímica: original + reimpressão do SISREG com "data da extração" diferente no cabeçalho → **um** exame; chave de deduplicação = laboratório + número do exame + data de entrada, **nunca** a data impressa no topo.
- D3 · O anatomopatológico da RTU e a conclusão da imuno-histoquímica repetem o mesmo diagnóstico: **dois exames distintos** (materiais e datas diferentes) com conclusão concordante. Não deduplicar; registrar concordância.

**Datas (F2 · K-02)**
- T1 · Data clínica (coleta/entrada do material, realização do exame) ≠ data de emissão ≠ data da assinatura digital no rodapé ≠ data de extração do SISREG ≠ data de impressão da ficha. Só a **data clínica** entra na linha do tempo.
- T2 · Idade impressa no laudo difere da idade na ficha (meses depois). Idade é derivada da data de nascimento na data de referência; nunca copiar "idade" de laudo.

**Hierarquia de evidência (F11 · evidenceLayer)**
- E1 · O receituário do urologista cita RM, PSA, biópsia, AP e cintilografia em uma linha cada. Isso é **fonte secundária**. Quando existe o laudo primário, ele prevalece; o secundário só **corrobora** ou **conflita**.
- E2 · Um valor (PSA) só existe na fonte secundária; não há laudo laboratorial. Entra como "mencionado em receituário de outro médico, sem laudo primário", nunca como resultado laboratorial confirmado.
- E3 · A fonte secundária escreve "PIRADS" **sem o número**. Campo PENDENTE; nunca inferir a categoria pelo texto da RM.

**Texto alterado à mão (F2 · novo)**
- R1 · Na RM, linhas inteiras estão **riscadas à caneta** (dimensões e peso da próstata; frase sobre a glândula central). O OCR lê o texto riscado como se valesse. Regra: texto com sinal de rasura/riscado → marcar "trecho riscado à mão: não usar sem revisão", PENDENTE, mostrar a imagem do trecho ao médico. Nunca extrair valor de trecho riscado como fato.

**Patologia por fragmento (F6 · REGRAS)**
- P1 · Seis sítios com graus diferentes (alguns grupo de grau 2, outros grupo 1). Um único sítio tem padrão cribriforme; os demais dizem "**sem** padrão cribriforme". Extração é **por sítio**, com lateralidade e posição (base, terço médio, ápice); negação preservada por sítio.
- P2 · "Grau do caso" (maior grupo, presença de cribriforme em qualquer sítio, % de fragmentos) é **agregação por regra** em `src/rules`, com fonte; **nunca** feita pelo LLM. A regra de agregação é `[VERIFICAR]` com o Dr. Silas.
- P3 · Imuno-histoquímica é tabela (anticorpo · clone · interpretação). Extrair linha a linha; "Positivo/Negativo" literal, sem interpretar.

**Estadiamento (G-12 · K-18)**
- S1 · O receituário diz "doença localmente avançada"; a RM descreve extensão para gordura periprostática e contato com feixes; a cintilografia é negativa; sem linfonodomegalia. O app **mostra os elementos com fonte**; o **TNM é do médico**. Nenhuma regra ou LLM fecha o estádio.
- S2 · A cintilografia descreve captação articular degenerativa. "Sem lesão neoplásica secundária" é a impressão; captação articular **não** é lesão óssea oncológica. Testar que "hiperfixação" sozinha não vira metástase.

**Captura (F4 · visão)**
- C1 · Fotos de celular: sombra, inclinação, dobra, baixo contraste. Cada campo extraído leva **confiança**; baixa confiança ou ilegível → PENDENTE, com recorte da imagem para o médico conferir.
- C2 · Carimbos, assinaturas e QR codes se sobrepõem ao texto. QR code **nunca** é seguido automaticamente (é link externo).

## 3. Referências visuais e de comportamento enviadas pelo Dr. Silas (sem PHI)
- **Resumo de imagem em 2 níveis** (vale para RADS e para a UI):
  - **Resumo 1 (seco, no cartão):** sede + tamanho.
  - **Resumo 2 (modal, 1 clique):** lesão + dimensão RECIST + linfonodos + osso + pleura + órgãos adjacentes + infiltração/obstrução/perfuração + achados não oncológicos **em uma palavra cada**.
  - Campo não descrito no laudo = "não descrito" (≠ "ausente"); negação explícita = "ausente".
- **Centro de comando dos agentes (OncoAssist):** cartão por módulo (ex.: farmacêutico, enfermeiro, gestor administrativo) com estado, número de skills, versão do prompt e botão ativar/desativar; **log de alterações** (quem, quando, motivo); botão "break-glass" global por 30 minutos.
  - Mapear estados para `CapabilityStatus` (≤ 5 estados).
  - **Break-glass só pode significar "desligar toda a IA e operar manual por 30 min"** (kill switch, sempre permitido). **Nunca** pode liberar gate, PHI para LLM, assinatura ou envio. Volta sozinho ao fim do prazo, com registro no log.
  - Log de toggles é append-only e local.
- **Cartões com indicador de intensidade** (pontos ●●●○○): estilo aceitável para alertas e pendências, **desde que** o número de pontos venha de uma regra com fonte e tenha texto ao lado; nunca "impacto" inventado pela IA.

## 4. Paciente Teste 07 (sintético) · reproduz as armadilhas sem dado real
Câncer de próstata localmente avançado, documentos sintéticos:
- ficha com CPF sintético (DV inválido de propósito) rotulado "CI"; laudos com o **mesmo CPF rotulado "Cartão SUS"**; CNS sintético de 15 dígitos rotulado "Matrícula" (I1/I2);
- comprovante de residência em nome de "Familiar Teste 07" (I3);
- biópsia com 6 sítios, graus mistos e cribriforme em 1 sítio (P1);
- RM com 2 trechos marcados como riscados (R1);
- cintilografia negativa com captação articular, **duplicada** (D1, S2);
- AP de RTU + IHQ **duplicada** com cabeçalho de extração diferente (D2, D3);
- receituário de outro especialista com PSA sem laudo e "PIRADS" sem número (E1–E3);
- datas: emissão, assinatura digital e extração diferentes da data clínica (T1).
Resultado esperado: 1 paciente; identificadores em conflito VERMELHO até revisão; 6 exames únicos (não 8); 2 trechos riscados PENDENTES; PSA "mencionado sem laudo"; PIRADS PENDENTE; TNM PENDENTE (médico); nenhuma metástase óssea inferida.

## 5. Quem faz o quê
| Executor | Ação |
|---|---|
| **Fugu W5 · RED** | ataques novos: I1–I5, D1–D3, T1–T2, E1–E3, R1, P1, S2, C1–C2 (famílias F1, F2, F4, F11) |
| **Fugu W5 · REGRAS** | validação de CPF/CNS por valor; agregação de patologia por sítio como regra com fonte `[VERIFICAR]`; nada de TNM automático |
| **Fugu W5 · DOMINIO** | chave de deduplicação de exame (D2); hierarquia primária × secundária (E1) |
| **Fugu W5 · KERNEL** | identidade: rótulo × valor em conflito (I1) na fila de vínculo |
| **Codex W7** | CDX-01: incluir o **Paciente Teste 07** com todas as armadilhas e o resultado esperado da §4 |
| **Cursor W6** | cartão de exame com **Resumo 1** e modal **Resumo 2**; trecho riscado/baixa confiança com recorte da imagem; tela "Centro de comando" em Configurações (estados, versão, log, break-glass como kill switch) |
| **GLM (próxima onda)** | microprompts RADS/PATH com as regras de §2–§3 (sem número de corte) |
