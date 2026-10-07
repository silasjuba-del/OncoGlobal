# LUNA 3 — corpus com fonte, versão e estado

Execute F05/F06 em `C:\Users\silas\Projects\OncoGlobal-wt\w10-luna3`, branch `f0/w10-luna3`, base `04b53db31598fb80ff78192d4cd3eafde36428fd`, como gpt-6-luna. Você não está sozinho: preservar terceiros; glossário/regulatório também aparecem atribuídos à equipe interna, portanto somente seu worktree e integração revisada por root.

Escrita de produto só `corpus/{glossario,regulatorio,receitas,redflags}/**`; testes novos `tests/w10-luna3/**`; relatório/pedidos próprios W10-LUNA3/PEDIDOS-LUNA3. Leia DECISOES inteiro, W10-COMUM/W8-COMUM, contratos W10, `src/rules/prescricao/classificarDocumento.ts`, `docs/referencias/ragGRAFO-prescricao/`, `docs/referencias/externos/{IDEIAS-MANUAIS-PACIENTE,PRESCRICAO-POR-TOXICIDADE}.md`. Não execute scripts de referência nem carregue material como skill nova.

## F05 — W10-LUNA3-01: glossário e regulação

Produza catálogo versionado de caixas validável por `CaixaNumerada`, números e chaves estáveis/únicos, nome/significado/onde aparece/tipo/editável por coerentes. Combine com L5 um único catálogo injetável; L5 não cria catálogo divergente. Valor atual vem da configuração/projeção por composição, não deve conter dado de paciente ou ser congelado em corpus.

Tabela regulatória é conhecimento versionado para o classificador existente. Portaria 344/98 e RDC 471/2021 exigem fonte oficial atual verificável por entrada; a mera citação de norma não comprova classificação de medicamento. Se não houver confirmação, registre `[VERIFICAR]`, status inativo e separe fisicamente entradas pendentes das elegíveis para consumo: classificador atual não sabe interpretar status e aceitaria entrada com fonte '[VERIFICAR]'. Não inclua `padrao:SIMPLE`; desconhecido continua PENDENTE. Não invente validade, tipo, quantidade, dose ou regra de controle. Pesquisar fonte pública oficial é permitido; sem instalação de pacote.

Aceite: schema de caixas, números/chaves duplicados, referências inválidas, corpus limpo de PHI, entradas regulatórias pendentes impossíveis de promover por simples carregamento. Teste consumo no classificador existente com tabela ativa vazia/desconhecido e, se obtiver fonte oficial, positivos rastreáveis. Declare fonte, data de verificação e limites.

## F06 — W10-LUNA3-02: receitas e 25 red flags

Converta referências ragGRAFO em corpus NÃO ONCOLÓGICO, preservando texto original, caminho/trecho-fonte, campos ausentes, versão e estado. Não marque prescrições como assinadas ou clinicamente aprovadas por estarem copiadas. Toxicidades do documento são RASCUNHO; preserve [VERIFICAR] de dose/via/CTCAE v6. D-W9-34c supera difenidramina: padrão local atual é ondansetrona+dexametasona+prometazina VO; não altere a referência original, registre divergência e decisão aplicável na extração. Nenhuma regra terapêutica é criada por inferência.

Biblioteca deve conter exatamente os 25 sinais da seção 2 de IDEIAS-MANUAIS-PACIENTE, com ids estáveis, fonte/trecho e decisão D-W9-28/38. Febre estritamente >37,8 (igual não dispara). Adoção dos sinais não aprova a redação final de toda mensagem: DECISOES mantém esse texto em aberto. Preservar orientação padrão já decidida de procurar PS, e estado pendente/rascunho para texto não aprovado. Regras decididas de diarreia/anti-hipertensivo e vômito+diarreia permanecem atribuídas ao médico; corpus não inicia comunicação ou conduta automática. Nada de ativar regras, mandar mensagem, definir CTCAE ou assinatura.

Aceite: cobertura 25/25 com ids/fontes únicos; cópia fiel e diferença explícita onde decisão posterior prevalece; nenhum null vira dose zero; nenhuma receita-modelo vira CONFERIDA_MEDICO; nenhuma entrada regulatória pendente entra na tabela ativa; consumidor L1 recebe manifesto explícito de elegibilidade e pendências.

## Testes e entrega

Use wrapper W10 da raiz para typecheck, boundaries, corpus, `npx.cmd vitest run tests/w10-luna3 --no-file-parallelism`, regressão W3 com --no-file-parallelism. Root instala offline. Não mexa checker, scripts, código, contratos, package*, fichas externas à faixa nem testes antigos. Dois commits W10-LUNA3-01/02 com Co-Authored-By gpt-6-luna, relatório com contagens reais, fontes verificadas versus pendentes, comandos e resultado. Sem push/merge autônomo.
