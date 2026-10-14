# Pedidos Luna3 — W10

## P-01 — Escopo de caixas APAC e configuração global

- Fato: `CaixaNumerada` tem campos estritos de glossário e não declara escopo de persistência; `Apac.campos` é `Record<string, unknown>`. A antiglosa associa `ctx.caixas` à chave `apac.<campo>` por número (`src/apac/antiglosa.ts`, `caixa()`), enquanto as configurações do médico usam `config.*`.
- Dano observável se misturados: campos clínicos/demográficos do laudo podem ser interpretados como preferências globais do médico e expor dados entre atendimentos.
- Decisão necessária: no compositor, filtrar `config.*` para serviço de perfil global e `apac.*` para `ContextoAntiglosa.caixas`/solicitação corrente; não armazenar valores APAC no corpus ou no perfil local.
- Donos: L1 composição e L5 serviço de configuração; tech lead se decidir incluir escopo no contrato.
- Contenção: números APAC 101–131 ficam em faixa separada e os campos de config ficam em 1–16; nenhum valor é armazenado no corpus.

## P-02 — Campos do laudo sem tipo de valor canônico

- Fato: `CAMPOS_SOLICITACAO` e `CAMPOS_OBRIGATORIOS_PADRAO` fixam chaves/rótulos, mas `Apac.campos` permanece `Record<string, unknown>`.
- Dano observável: o glossário pode dar impressão de validar conteúdo que o contrato não tipa.
- Decisão necessária: criar contrato tipado dos campos APAC em fase própria, sem alterar esta fatia; até lá tipos do glossário são apenas metadados de entrada (TEXTO para campos simples, LISTA para procedimentos secundários).
- Dono: tech lead/integração APAC.
- Contenção: glossário não inclui valores, validade, enum nem regra regulatória de campo.

## P-03 — Regulação de medicamentos ainda pendente de confirmação por substância

- Fato: `classificarDocumento` não lê status de verificação e classificaria qualquer entrada com tipo aceito. A checagem oficial de 2026-10-07 confirmou o escopo e o histórico atual das normas ANVISA, mas não confirmou aqui a classificação individual de cada candidato.
- Dano observável: colocar item `[VERIFICAR]` na tabela que o classificador consome poderia classificar documento sem fonte suficiente.
- Decisão necessária: revisão oficial individual de DCB/sais/associações e do tipo documental com norma vigente antes de mover entradas para a tabela ativa.
- Dono: curadoria regulatória/tech lead.
- Contenção: tabela ativa contém zero entradas e não declara `padrao`; os 12 candidatos estão em arquivo separado sem forma `TabelaRegulatoria`.

## P-04 — Texto final de red flags permanece aberto

- Fato: D-W9-28 adota os 25 sinais como base; `docs/DECISOES.md` mantém texto final das mensagens em aberto.
- Dano observável: texto aprovado como mensagem poderia gerar comunicação ou ação clínica sem revisão final do médico.
- Decisão necessária: Dr. Silas redige/aprova cada texto e confirma destinos locais quando configurar comunicação.
- Dono: Dr. Silas.
- Contenção: biblioteca preserva fonte e orientação padrão de PS, mas `consumivel:false`, `textoFinalAprovado:false`, sem envio ou conduta automática.

## P-05 — D-W9-34c diverge da regra R1 histórica no documento de toxicidades

- Fato: a fonte de toxicidade conserva difenidramina; D-W9-34c posterior define prometazina VO. O arquivo original foi preservado byte a byte e a divergência foi registrada em envelope versionado.
- Dano observável: consumidores que leiam apenas R1 podem recuperar padrão superado.
- Decisão necessária: antes de qualquer uso futuro, consumidor deve aplicar D-W9-34c e obter revisão do médico; confirmar doses/trechos marcados [VERIFICAR] em fonte.
- Dono: curadoria de prescrição / Dr. Silas.
- Contenção: toxicidades ficam RASCUNHO não consumível, com referência explícita à decisão posterior; nenhum template foi reescrito.
