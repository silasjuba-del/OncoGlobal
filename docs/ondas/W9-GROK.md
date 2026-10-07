# W9-GROK · 10 FATIAS · regras, fichas, ownership e ligação ao pipeline

> Leia primeiro `docs/ondas/W9-COMUM.md`. EXECUTOR = `GROK`. Worktree `...\OncoGlobal-wt\w9-grok` · branch `f0/w9-grok`.
> Alvo: deixar verdes `tests/adv-w8/{fn16-t34-semaforo-interacoes,t56-g16-owner-write,n19-manifesto-merge,k26-n17-ficha-inteira,caso07-dedupe}.adv.ts` (5 falhas `SEM_IMPLEMENTACAO`) sem tocar nas expectativas, e fechar as pendências técnicas abertas. Funções puras, determinísticas, sem dependência nova. Código calcula; IA não entra.
> Você **não** edita `src/kernel/harness/gates.ts` nem `src/kernel/llm/**` (são do Codex) nem `src/leitura/**`/`src/impressao/**` (W7 Codex).

## GROK-01 · FN-16 semáforo de interações (T-34)
`src/rules/` (nome conforme o teste): ruleset 100% inativo ⇒ nenhuma interação vira VERMELHO sem fonte; lista de medicamentos incompleta ⇒ PENDENTE; par coberto por interação ATIVA com fonte ⇒ VERMELHO (achado, nunca bloqueio); "sem interação encontrada" só com checagem completa + ruleset ativo. Não ative interações: curadoria é do Dr. Silas/farmácia (`corpus/rulesets/interacoes.v1.json` fica inativo).

## GROK-02 · T-56 / G-16 ownership em runtime
Arquivo **novo** `src/kernel/harness/ownership.ts`: veredito de write por dono (`ownerOf` de `src/contracts/agentes.ts` + `corpus/capabilities.v1.json`). Write alheio ⇒ rejeitado; dono no próprio objeto ⇒ passa; leitura alheia não é write. Exporte para o Codex registrar (pedido em `docs/w9/PEDIDOS-GROK.md`, sem editar `gates.ts`).

## GROK-03 · N19 verificador de diff × manifesto
`scripts/verificar-manifesto.mjs` (novo): dado base e HEAD, reprova diff fora da trilha declarada em `docs/MANIFESTO-W1-F0.md`, nomeando o arquivo, e pina base + contratos/rulesets/hash. Teste em `tests/w9-grok/`. Não edite `check-boundaries.mjs` nem `package.json` (sugira o script npm em PEDIDOS).

## GROK-04 · K-26 / N17 biblioteca de fichas aprovadas (mecanismo)
`src/modules/documentos/` (novo): carrega **uma ficha inteira** por `templateId+version+hash`; dose remontada de trechos fora de ficha inteira é recusada; versão inexistente ⇒ erro tipado, nunca mistura versões. **Sem conteúdo clínico**: só fichas sintéticas de teste. As ~50 fichas reais são curadoria do Dr. Silas.

## GROK-05 · Dedupe de exames (caso 07 D1/D2/D3) em função pura
Leia `caso07-dedupe.adv.ts` e `tests/fixtures/caso07/`. Chave laboratório+nº exame+data de entrada; reimpressão com data de extração diferente não impede dedupe; RTU e IHQ de mesmo diagnóstico permanecem dois exames. Se o teste exige caminho em `src/leitura` (faixa do Codex W7): implemente a função pura em `src/rules/` e registre `BLOQUEADO_ESCOPO` + patch de religação em `docs/w9/PEDIDOS-GROK.md`.

## GROK-06 · Ligar `src/rules/w8` ao pipeline
Antigravity entregou funções puras (identificadores, rasura, hierarquia de fonte, data clínica, vínculo de documento, patologia por sítio, resumo de imagem, dedupe, interações). Crie o orquestrador novo em `src/orchestration/` que as chama na ordem certa sobre o snapshot, sem editar `src/rules/w8/*` e sem import entre eles dentro de `w8` (o orquestrador importa; os arquivos de `w8` continuam isolados). Saída: pendências/alertas, nunca bloqueio de clínico.

## GROK-07 · CP-001b emissão APAC validada e persistida no ledger
Validação de emissão APAC persistida no ledger (hoje a exportação APAC está contida). Uma competência por lote, lote diário com vários pacientes, aviso ≤1 dia adiantado, fuso −03:00. Layout oficial de exportação SIA e SIGTAP = `[VERIFICAR]` (pendência do Dr. Silas): não invente.

## GROK-08 · Alinhar tipos de snapshot de `src/modules` à projeção real
Os tipos de snapshot divergem da projeção em `src/kernel/projections`. Alinhe do lado de `src/modules` (contratos congelados; se o conserto exigir contrato, `BLOQUEADO_ESCOPO` + patch). Teste de compatibilidade estrutural projeção → snapshot.

## GROK-09 · Rulesets estruturais com consumidor
`identificadores` e `dedupe-exame`: agora existem consumidores (GROK-05/06). Prepare a ativação como mudança mínima e testada, mas só ative se não houver conteúdo clínico não decidido; senão deixe inativo e liste em PEDIDOS para decisão do Dr. Silas.

## GROK-10 · Fechamento
`git mv` dos `.adv.ts` verdes para `tests/w9-grok/` ou pastas de domínio (só import, sem mexer em expectativa) e rodar a config adv: restante deve ser só o que o Codex ainda não integrou. Relatório `docs/progresso/W9-GROK.md` com fatias, tabelas de curadoria pendente, saídas reais e achados.
