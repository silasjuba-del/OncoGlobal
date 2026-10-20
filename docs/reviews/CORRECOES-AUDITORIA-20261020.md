# Correções da auditoria e refatoração de segurança — 20/10/2026

Base: `a8f919c0bc616bd2fd206cba81845cb8fcb23361`. Execução autorizada expressamente por Silas, em worktree isolada e com um escritor. Integração e publicação pertencem à frente.

## Regras preservadas

- Os hashes e replays já persistidos não foram migrados. Não houve alteração de corpus, doses, limiares clínicos ou motores RECIST.
- Rascunho não é fato. O registro Zod em `src/contracts/rascunhos.ts` distingue origem inerte, extração, resumo legível e confirmação dedicada. Todos os envelopes registrados ficam fora do bundle genérico; os fluxos dedicados continuam reconstruindo o payload depois de suas validações próprias.
- E1 é apresentado a partir de alerta confirmado ou da regra existente sobre triagem confirmada. Rascunhos não produzem E1. Vermelho e E1 não foram tratados como sinônimos.
- Ciência exige seleção explícita e vínculo com alertas exibidos no contexto. O registro é operacional, separado da evolução; não autoriza tratamento ou envio.
- A auditoria de uma assinatura negada é gravada após o rollback da unidade clínica. O helper transacional usa `BEGIN IMMEDIATE` na transação externa e savepoints apenas no aninhamento.
- A leitura clínica do paciente conserva contatos e decisões de vínculo globais necessários para detectar transferência, revogação e conflito. Impressão e consulta compartilham a validação do ledger.
- Datas civis inválidas produzem ausência de resultado, que os consumidores tratam como pendência. Datas válidas preservam os resultados anteriores.
- Migrações são somente aditivas. O cache de schema não é confirmado dentro de uma transação externa que ainda possa sofrer rollback.

## Limites e rastreabilidade

O G-23 passou a limitar o fluxo de voz ao limite de 15 segundos já usado como padrão no fluxo F5. Isso não responde pelo médico ao questionário sobre fontes de E1, política de voz ou demais decisões pendentes.

G-24 está especificado no plano e referenciado na implementação FN-24. A presença dessa referência não comprova um gate G-24 explícito nem uma jornada completa de importação Plaud; essa lacuna não deve ser anunciada como resolvida por esta refatoração.

As declarações `.d.mts` necessárias para tipar módulos `.mjs` foram preservadas. Módulos clínicos sem consumidor atual não foram ativados ou apagados por conveniência. Referências históricas em documentos e no manifesto congelado de exceções não foram reescritas como se fossem novas decisões.

Evidências detalhadas, comandos, resultados RED/GREEN e commits constam de `OncoGlobal-coordination/20261020-pr33-review-cursor-next10/train/ASTRA-CORRECOES.md`. Testes locais, integração e aprovação clínica são estados distintos.
