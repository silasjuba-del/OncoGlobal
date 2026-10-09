# Fase B — faixas ajustadas ao código real

Ativação somente depois do portão A. Cinco executoras gpt-6-luna, em lotes de até três (limite desta sessão). Uma bateria de testes por vez, mediante mensagem TEST_SLOT da orquestradora. Cada executora também possui apenas seu relatório `docs/f0-fecha/LUNA-N.md` e seus logs de prova em `docs/f0-fecha/evidencias/lunaN/`.

## L1 — matriz

`docs/MATRIZ-RASTREABILIDADE-F0.md`, `scripts/matriz-f0.mjs`, `tests/f0-fecha/matriz.test.ts`.

Autorizado companion `scripts/matriz-f0.d.mts` para tipar o import do verificador no teste TypeScript.

## L2 — consulta completa

`tests/f0-fecha/consulta-completa.test.ts`, `tests/f0-fecha/fixtures/**`. Produção só leitura; lacunas retornam à Astra, sem fabricar prova verde.

## L3 — contratos e representação desconhecida da triagem

`src/contracts/w12/**`, `src/contracts/regras.ts`, `src/contracts/clinico.ts`, `corpus/rulesets/salao-triagem.v1.json`, `src/rules/{ctcaeClinico,retornoToxicidade,intervaloPosQt,canalRedflags,valorAtual,tontura,triagem}.ts`, `tests/contracts/**`, `tests/fixtures/triagem.ts`.

Ajuste de dependência: também possui `src/ui/salao/FormTriagem.tsx` e `tests/ui/triagem.test.tsx` para manter os produtores do contrato e o formulário sincronizados. O item L4(c), tontura sim/não/não sei (inicial null), passa para L3. As asserções clínicas existentes permanecem; fixtures de cenário conhecido podem informar explicitamente "não". Novos campos de vertigem ausentes nunca viram false/novo. Sem redefinir limiar.

Ajuste solicitado por L3 e autorizado pela Astra: `tests/w12-grok/grok-06-tontura.test.ts`, somente schema local/asserção que exigia ecog2ComTonturaCorta no JSON. Remover a exigência obsoleta conforme D-W9-76, preservando expectativas clínicas.

## L4 — Flash e configuração real

`corpus/glossario/caixas.v1.json`, `src/config/**`, `src/ui/consulta/**`, `src/ui/oncochart/Configuracoes.tsx` (nome real da tela), `src/ui/telas/TelaConfiguracoes*`, `src/ui/telas/TelaConsulta.tsx`, `src/server/flash.ts`, `src/server/rotas.ts`, `tests/f0-fecha/flash-producao.test.ts`.

Incluídos antes do despacho: `src/ui/api/http.ts` e `src/ui/api/porta.ts`, somente métodos de configuração autenticada da caixa Flash; `tests/w12-f4/servidor-flash.test.ts`, somente setup da caixa (hoje adiciona chave artificial 9001, que colidirá com a caixa real). Preservar todas as asserções clínicas desse teste; usar o catálogo real sem número injetado de teste. Configuracoes recebe porta por prop, para a Astra montá-la no inicializador local em C2. Não trocar a tela por uma persistência só em estado React/localStorage.

FormTriagem excluído desta faixa (pertence a L3). Servidor incluído para eliminar dependência de configuração de teste e preservar os campos novos de triagem no conteúdo/hash quando necessário. Nenhuma mudança de regra clínica. Portas/consumidores fora da faixa viram pedido concreto à Astra, não edição unilateral.

Autorizada extensão `.tsx` para `tests/f0-fecha/flash-producao.test.tsx`, pois a prova inclui a interface React real. O relatório e a matriz devem usar esse caminho efetivo.

## L5 — estabilidade e higiene

`tests/ui-telas/percursos.test.tsx` (somente esperas/timeouts), `tests/f0-fecha/phi-repo.test.ts`, `.gitattributes` se ausente, `docs/f0-fecha/HIGIENE.md`. Workflow CI somente leitura.

## Fronteiras e provas

As faixas acima não compartilham arquivo. L1 e L2 só leem produção; L5 não altera asserção de percurso. L3 e L4 possuem separadamente FormTriagem e Consulta Flash. Astra é a única escritora do integrado e resolve consumidores transversais em C2.

"Zero PROVISORIO-W12" será demonstrado no código ativo e nos contratos finais; as citações literais em decisões, pedidos históricos e no próprio manifesto da missão serão inventariadas, sem apagar fonte histórica para satisfazer uma busca textual.

A matriz pode apontar lacunas: não classificá-las como F1/ORGANIZACIONAL apenas para obter verde. A condição de fechamento continua a da missão.
