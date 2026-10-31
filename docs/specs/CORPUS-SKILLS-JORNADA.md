# Corpus e skills de jornada — entrega PR 86

## Objetivo e escopo autorizado

Silas autorizou em 30/10/2026 a conclusão integral, escrita exclusiva pelo Codex, testes e PR para revisão, sem merge. Base: PR 86, e2743316. Worktree isolada; main e trabalho concorrente preservados.

Entregar: correções das contas/integrações do Cursor; corpus pulmão versionado e validável; mesma porta de skills nativas para primeira consulta, retorno e follow-up; etapas explícitas de proveniência, urgência, extração, contexto, corpus, segurança, pedidos e revisão; persistência de rascunhos com replay, recuperação e invalidação por mudança das entradas. O conteúdo em revisão não autoriza tratamento, assinatura, mensagem ao paciente ou administração.

## Contratos e responsabilidades

- `src/rules`: cálculos determinísticos, parâmetros já autorizados e estados pendentes; sem importar outra regra nem acessar IO.
- `src/server/f0c`: seleção as-of dos exames basais, integração das avaliações e proveniência.
- `corpus/jornadas`: síntese de pulmão, fontes identificadas por documento/versão/hash e página, divergências e lacunas; sem PDFs, caminhos privados ou dados de pacientes.
- `src/contracts`: schema do corpus e extensões da skill; elegibilidade e segurança não convertem ausência em aprovação.
- `src/modules/documentos`: composição das jornadas e documentos não assinados.
- `src/server/skillsClinicas.ts`: autenticação, vínculo das fontes, corpus injetado, persistência/idempotência; só skills nativas, sem carregar pacotes externos.
- `src/ui/consulta`: seleção de kit/contexto, referências, execução e reabertura de rascunhos; isolamento de respostas atrasadas entre pacientes.

Um escritor: Codex, em todos os caminhos acima e respectivos testes/documentação. Nenhum subagente escritor.

## Aceite

1. Typecheck, fronteiras, corpus e baterias obrigatórias passam sem skips novos ou relaxamento de critérios clínicos.
2. FEVE basal existente chega à regra; exame futuro/inválido/conflitante não vira basal válido. Audiometria documentada resolve sua pendência, sem pedir exame duplicado.
3. Tetos cumulativos com unidades distintas preservam avaliação por unidade; soma incompleta não gera tranquilização.
4. Corpus preserva fontes, alternativas, momento e linhas. Rascunho nunca vira regra ativa por ser recuperado.
5. Primeira consulta, retorno e follow-up usam o mesmo fluxo de fontes vinculadas; urgência interrompe propostas eletivas e exige revisão.
6. Reabrir/reiniciar recupera saída idêntica. Mudanças de fonte, corpus ou contexto invalidam a atualidade; nenhuma assinatura ou evento clínico é criado pela skill.
7. Revisão final do diff, somente arquivos selecionados no commit e push sem força para o PR; não fazer merge.

## Sequência de execução

Corrigir regressões e integração clínica → incorporar corpus como referência em revisão → estender skill nativa e UI → testes unitários/integrados/adversariais → CI e entrega. Lacunas de fonte e limiares que exigem curadoria permanecem visíveis, sem inventar valores.

## Estado

Implementados: corpus pulmão (44 cartões, 19 ações, 13 divergências), contrato Zod estrito, catálogo nativo com primeira consulta/retorno/follow-up, seleção de referências, avaliação clínica integrada, triagem radiológica sobre fontes vinculadas, persistência/replay e reabertura pela interface. Retorno pode usar o prontuário sem novo laudo; primeira consulta exige kit vinculado. A recuperação compara cadastro, fontes, ledger, corpus e avaliação clínica.

Corrigidos: fronteira do equivalente; matriz de peso; tetos multiunidade; contagem dos sinais em rascunho; disposição PHI do divisor numérico do PRNG, após inspeção; FEVE basal ligada ao episódio e validada temporalmente; audiometria realizada que resolve pendência; referência de dose inválida que não pode cair na dose anterior; chaves React distintas nos dois formulários do salão. A precisão Mosteller de duas casas permanece alinhada ao prescritor.

Provas dirigidas: basais ausentes/futuros/conflitantes, equivalente histórico/unidade, dose, corpus órfão, HTTP/persistência/reinício, isolamento de contexto da UI e soma sem limite que recusa unidades incompatíveis. Chromium executa `CORPUS_SKILLS_HTTP_UI_SQLITE`: fonte vinculada → cartão PUL-26 + ações EX-08/EN-01 → rascunhos → reabertura idêntica, sem novo evento clínico. O PR registra os resultados da bateria completa e do CI vinculados ao SHA entregue; aprovação técnica não é aprovação clínica.

## Como usar

Na consulta, abrir **Jornada por skills**. Escolher primeira consulta, retorno ou follow-up; selecionar laudos vinculados e, se pertinente, cartões e ações de pulmão. **Preparar rascunhos da jornada** salva documentos locais não assinados. **Reabrir jornada** recupera a mesma versão e informa alterações nas entradas. Uma suspeita urgente interrompe propostas eletivas e mantém a fonte visível. A seleção de um cartão não confirma elegibilidade do paciente.

O catálogo e o executor são recursos nativos do aplicativo; não instalam nem carregam pacotes externos de skills. Nenhum mecanismo de admissão foi contornado. O original médico-legal dos packs e os documentos-fonte não foram fragmentados nem publicados nesta entrega.

## Dados basais

Fatos confirmados `feveBasal` usam `{episodioId, data, percentual, metodo}`; `audiometriaBasal` usa `{episodioId, data, estado: "REALIZADO", resultado}`. Fonte e revisão vêm do evento. Ausente, conflito, outro episódio, data impossível/futura ou exame apenas agendado não satisfazem a avaliação. `rtMediastino` confirmado conserva a presença/ausência documentada do agravante; ausência do registro não equivale a negativo. O equivalente usa as exposições normalizadas e validadas no horizonte do encontro, mantendo os tetos de cada droga.

## Limites clínicos preservados

Os dados do corpus continuam em RASCUNHO; L4/L5 sem evidência estruturada, acesso NCCN/ONCO PRO, tabela TNM para cálculo, cortes não curados e cobertura farmacológica incompleta permanecem explícitos. Critérios de elegibilidade e segurança são separados; nenhum estado indeterminado autoriza tratamento. Não há emissão de pedido, assinatura, administração ou mensagem ao paciente pela skill.
