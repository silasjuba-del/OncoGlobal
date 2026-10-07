# PEDIDOS · W10-CURSOR

A faixa desta onda não edita `src/ui/copy/**`, `src/ui/icones/**` nem `src/contracts/**`. O que falta fica aqui.

## CURSOR-01

### Chaves de copy (`src/ui/copy/pt-BR.ts`)
A casca usa estas frases enquanto a chave não existe:

| Chave pedida | Texto em uso |
|---|---|
| `navegacao.salao` | Salão |
| `navegacao.canal` | Canal |
| `navegacao.consulta` | Consulta |
| `app.diaNoite` | Dia / noite |
| `app.buscarOncoChart` | Buscar pacientes, exames, protocolos… |
| `app.alertasClinicos` | Alertas clínicos |
| `app.modoDia` | Modo dia |
| `app.modoNoite` | Modo noite |
| `app.usuario` | Usuário |

`navegacao.agenda`, `navegacao.prontuario` e `navegacao.apac` já existem e foram usadas. O título `OncoGlobal — WORK` e a frase `dados sintéticos` ficam literais: o teste de `App` exige essas strings.

### Ícones (`src/ui/icones`)
Pedir no catálogo (a casca não altera essa pasta):

- busca, lua, sol, sino, chevron, usuário
- canal (o trilho reusa `IconeDocumentos`)
- salão (o trilho reusa `IconeEnfermagem`)

Os desenhos de cromo estão em `src/ui/oncochart/icones-cromo.tsx` até entrarem no catálogo.

### Fontes
Geist e Geist Mono estão em `src/ui/oncochart/fontes/*.woff2`, com a OFL ao lado. Sem dependência npm e sem CDN.

## CURSOR-02

### Contratos (`src/contracts/w10`)
- Cartão Modelo 08 (convênio, matrícula, CNS, mãe, responsável, cidade, endereço, profissão, obs)
- Diagnóstico/estadiamento versionado com `stageHistory` (hoje: tipos `PROVISORIO-W10` em `src/ui/oncochart/chart-visao.ts`)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `consulta.flash` | Consulta Flash |
| `consulta.alergiaPendente` | Alergia PENDENTE |
| `consulta.negaAlergias` | Nega alergias |
| `cadastro.titulo` | Cartão de cadastro |

### Fake / servidor
- CNS sintético com DV inválido já entra nos identificadores da porta falsa
- Alergia real de exemplo: `penicilina` no PR-VERMELHO

## CURSOR-03

### Porta / Fugu
- Projeção longitudinal da timeline (lanes, barras, eventos, HOJE) — hoje `timelineSintetica` em `src/ui/oncochart/timeline-visao.ts` (`PROVISORIO-W10`)
- `stageHistory` só leitura (nunca sobrescreve)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `timeline.titulo` | Linha do tempo oncológica |
| `timeline.ver3d` | Ver em 3D |

## CURSOR-04

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `abas.visaoGeral` | Visão geral |
| `abas.quimioterapia` | Quimioterapia |
| `abas.dadosClinicos` | Dados clínicos |
| `abas.evolucao` | Evolução |
| `cards.protocolos` | Protocolos ativos |
| `cards.documentos` | Documentos recentes |
| `cards.estadiamento` | Estadiamento e avaliações |
| `cards.rascunho` | Rascunho de evolução |
| `cards.caixaUnica` | Soltar PDF/Word — caixa única |

### Ainda aberto
- Tema PERSONALIZAR (CURSOR-11)

## CURSOR-05

### Contratos / Fugu
- Reconciliação real ClinicalFact + EncounterSegment (`PROVISORIO-W10` em `caixa-revisao-visao.ts`)
- Extração de caixas numeradas (hoje sintética)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `revisao.titulo` | Caixa de revisão |
| `revisao.resumo` | ✓ N fatos reconciliados · ⚠ K precisam confirmação |
| `revisao.juncaoNuncaAuto` | Sem paciente — junção só com clique (nunca automática) |
| `caixaUnica.colar` | Colar texto na caixa única |
| `caixaUnica.enviar` | Enviar para revisão |

## CURSOR-06

### Porta / servidor
- Fila do dia com status agora/espera/feito e “Chamar próximo” real
- Exame selecionado (resumo/laudo/imagens) ligado ao lote
- OncoBoard persistido (hoje board sintético no App)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `painel.exame` | Exame |
| `painel.board` | OncoBoard |
| `painel.fila` | Fila |
| `fila.chamarProximo` | Chamar próximo |

## CURSOR-07

### Funções / catálogo
- Catálogo RADS 30 emergências (regra Grok) — chips sintéticos na UI
- Morfometria “4 cliques” → função de cálculo da equipe interna (UI só mostra DRAFT)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `viewer.titulo` | Visualizador de imagem |
| `viewer.oncoAssist` | OncoAssist |
| `viewer.semConduta` | Narra o laudo e achados já extraídos — sem conduta. |
| `viewer.morfoDraft` | DRAFT / NEEDS_REVIEW — morfometria sintética; não alimenta RECIST |
| `viewer.voz` | Voz local (opcional) |

## CURSOR-08

### Porta / Fugu
- Paradas/narração da Jornada 3D a partir da projeção longitudinal (hoje `montarParadasJornada` + timeline sintética)
- Lesões RECIST e graus CTCAE confirmados via contrato (hoje `chart3d-visao.ts`)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `jornada.titulo` | Jornada oncológica · 3D |
| `jornada.semConduta` | Narração assistiva — sem conduta. |
| `jornada.tour` | Tour guiado |
| `chart3d.recist` | RECIST 1.1 · lesões-alvo |
| `chart3d.ctcae` | CTCAE · skyline de toxicidade |
| `chart3d.limiarRp` | −30% limiar RP |

## CURSOR-09

### Canal / servidor
- Vínculo + consentimento real para WhatsApp (hoje UI mostra `CANAL_EXTERNO_NAO_HABILITADO`)
- Portões de liberação QT com motivos do salão/bula (hoje sintéticos)

### Copy
| Chave pedida | Texto em uso |
|---|---|
| `dock.mic` | Mic |
| `dock.novo` | Novo registro |
| `dock.exame` | Solicitar exame |
| `dock.ciclo` | Ciclo QT |
| `dock.pack` | Tumor-pack |
| `dock.trials` | Trials |
| `dock.jornada` | Jornada 3D |
| `dock.whatsapp` | Encerrar · WhatsApp |
| `ov.interacoes` | Interações |
| `ov.liberacao` | Liberação QT |
| `ov.flash` | Consulta Flash |
