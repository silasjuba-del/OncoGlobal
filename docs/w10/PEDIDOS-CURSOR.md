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

### Ainda não nesta fatia
- Tema PERSONALIZAR (D-W9-16) entra na CURSOR-11.
- O miolo do painel de 396 px entra nas fatias seguintes.
