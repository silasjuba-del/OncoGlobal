# W10 · PLANO · Configurações, caixas numeradas, caixa única, APAC automática com antiglosa

> Fonte: `docs/DECISOES.md` D-W9-16 a D-W9-21 (Dr. Silas, 2026-10-06). Começa **depois** da W9 integrada (gates G-07/08/09/27 e ownership precisam existir).
> Regras de sempre: `docs/ondas/W8-COMUM.md` (onde diz W8, leia W10). IA propõe, código calcula, médico decide e assina. Ausente = PENDENTE.

## Arquitetura (backend linear, frontend é extensão)
```
caixa única (texto | PDF | Word)
  → conversão local (PDF digital/Word → texto; escaneado → PENDENTE)
  → desidentificação local (G-02)
  → extração por agente (proposta, proveniência por campo)          [IA propõe]
  → caixas numeradas (registro + glossário, versionadas no ledger)   [código guarda]
  → APAC preenchida no modelo real (D-W5-06, só SOLICITAÇÃO)
  → ANTIGLOSA (regras de código + SIGTAP da competência)            [código calcula]
  → médico valida/assina                                             [médico decide]
  → lote do faturamento (uma competência, D-W5-10) → exportação SIA (D-W9-12)
```

## Faixas
| Executor | Faixa | Fatias |
|---|---|---|
| CODEX (backend) | `src/app/**`, `src/leitura/**`, `src/apac/**` (novo), `corpus/glossario/**` (novo), `tests/{app,leitura,apac}/**` | C1–C6 |
| CURSOR (telas) | `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**` | U1–U4 |
Contratos novos (caixa numerada, entrada do glossário, veredito de antiglosa) = **tech lead** escreve antes da onda, em `src/contracts/`.

## CODEX
- **C1 · Registro de caixas + glossário.** Cada campo do app tem nº estável, nome, significado, onde aparece, tipo, valor atual. Glossário em `corpus/glossario/caixas.v1.json`. Alterar = evento no ledger (quem, quando, antes/depois). Teste: nenhum campo da UI/APAC sem número.
- **C2 · Caixa única: conversão local.** Texto colado, PDF digital e Word (.docx) → texto com página/origem. PDF escaneado ou ilegível ⇒ PENDENTE, nunca envia a serviço externo. Dependência nova só se o tech lead aprovar em `package.json` (pedir em PEDIDOS).
- **C3 · Extração → caixas.** Agente propõe valor por caixa com proveniência (EXTRACTED, DOCUMENT_CONFIRMED, INFERRED ≥2 fontes, NOT_FOUND, UNCERTAIN). Nada vira fato sem validação. Conflito nunca some. LLM desligada nesta onda: dublê determinístico atrás da porta.
- **C4 · APAC automática.** Preenche o laudo APAC (modelo real `docs/referencias/apac-laudo-solicitacao-autorizacao.pdf`) a partir das caixas; AUTORIZAÇÃO em branco; finalidade nunca deduzida da intenção (D-W9-12).
- **C5 · Antiglosa.** Validador determinístico antes do faturamento: procedimento existe na competência SIGTAP; compatibilidade CID × procedimento; idade, sexo, finalidade; CNS (algoritmo e-SUS, D-W9-13); CNES; campos obrigatórios; competência única do lote; duplicidade; datas. Cada achado diz o motivo e a caixa (nº). Regras sem fonte = `[VERIFICAR]`. Alerta, não bloqueia o médico; bloqueia só a exportação.
- **C6 · Importador SIGTAP + exportação SIA.** Pacote oficial por competência (D-W9-11), código como texto. Exportação TXT posicional conforme `docs/referencias/Layout_Exportacao_APAC.pdf` (precisa estar no repo; sem ele, `BLOQUEADO_DEPENDENCIA`).

## CURSOR
- **U1 · Configurações.** Uma tela: telefone, CRM, hospital, CNES, CNS, sites externos, sincronizar telefone, rede/impressora, skills, plugins, MCP (externos nascem desligados), layout DIA | NOITE | PERSONALIZAR (tokens da Muse).
- **U2 · Caixa de número.** Em Configurações, uma caixa: digita nº + dado, mostra o nome da caixa e o valor antigo antes de salvar, 1 clique salva.
- **U3 · Glossário.** Lista pesquisável das caixas numeradas; clicar numa caixa em qualquer tela mostra o nº.
- **U4 · Caixa única de entrada.** Colar texto ou soltar PDF/Word; mostra o que foi para cada caixa, o que ficou PENDENTE e os achados da antiglosa por caixa; 1 clique validar.
