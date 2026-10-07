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
- Modal Jornada 3D (CURSOR-08), Flash/TNM (CURSOR-09), revisão da caixa única (CURSOR-05)
