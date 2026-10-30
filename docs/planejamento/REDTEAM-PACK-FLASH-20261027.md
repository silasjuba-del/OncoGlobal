# Red team de eficiência — Tumor Pack e Consulta Flash

Base: `e036d0f3aa194fcd00ce1fe500bfa264b7c6ad6c` (main remoto, 2026-10-27).
Responsável único pelos arquivos desta fatia: Codex. Checkout isolado, sem merge/push.

## Objetivo e fronteiras

Reduzir carga antecipada, duplicação de transporte e leituras repetidas sem alterar
conteúdo clínico, seleção médica, critérios, assinatura ou invalidação temporal.
PRs 76/78 permanecem fora da base; compatibilidade será informada na entrega.
Não apagar corpus, campos históricos, alternativas clínicas ou caminhos legados.

## Lote e provas

1. Carregar revisão documental e bases auxiliares sob demanda, preservando estado.
2. Projeção compacta explícita; fonte integral autenticada sob demanda; contrato completo preservado.
3. Compartilhar leitura da Flash na mesma requisição; manter nova conferência ao assinar.
4. Unificar conferência de preview e montagem final de documentos.
5. Red team: respostas tardias, troca de contexto, adulteração de hash/ID, origem indisponível,
   protocolo duplicado por nome, revisão alterada, retorno/receita/assinatura e replay.
6. Typecheck, fronteiras, testes dirigidos e regressão ampliada após fechar os defeitos.

WRITE_SET: contratos de leitura de pack/porta/saídas; rotas e serviços de revisão/Flash;
UI da revisão/Flash/consulta; testes dessas jornadas e este relatório.
Nenhuma alteração de regras médicas, corpus, provider, credenciais ou bancos reais.

## Critério de encerramento

Nenhuma falha grave conhecida aberta no lote implementado; evidências e limitações
registradas. Isso não constitui prova de ausência universal de defeitos nem aprovação clínica.
Recuperação: contratos completos e corpus originais permanecem; alterações isoladas no branch.

## Estado

Lote concluído e verificado. Nenhuma falha grave conhecida aberta no escopo implementado. Não houve merge, push ou deploy.

## Achados e correções

| ID | Achado | Correção / limite |
|---|---|---|
| EF-01 | Seção recolhida montava revisão e fazia carga | Pack inicia recolhido; primeiro acesso monta; recolher conserva a instância e a edição. Troca de contexto reinicia o grupo. |
| EF-02 | Resposta transportava blocos, setores e original | Projeção compacta opt-in, fonte autenticada sob demanda; resposta legada completa permanece. |
| EF-03 | Timeline e base de ação carregadas sem solicitação | Carga após ação explícita; estados não consultado/indisponível permanecem distintos. |
| EF-04 | Preparação/salvamento Flash repetiam leitura e trabalho documental | Uma leitura por requisição; rascunho retorna antes da preparação. Nova validação na assinatura permanece. |
| EF-05 | Conferência de preview duplicada | Helper comum, mantendo contexto, IDs, hashes, versões e rejeição de duplicatas. |
| EF-06 | Conjunto de impressão reconstruído em etapas intermediárias | Composição após textos e identificação finais; documentos individuais e conjunto mantidos. |
| EF-07 | Leituras puras disparavam processamento global | Investigação e proposta de dose agora NENHUM, com prova HTTP de zero processamento global e gravação no cenário sintético. Leitura clínica integrada mantém seu motor. |
| EF-08 | Busca serializava conteúdo a cada tecla | Índice de busca reutilizado durante a vida do mesmo lote, sem fundir itens nem apagar variantes. |

As projeções completa e compacta compartilham as mesmas verificações de ativação e
integridade de setores. Schema de leitura não serve para ativação. Nenhuma regra
clínica, fonte ou opção terapêutica foi excluída.

## Medição

35 packs; 682 registros de protocolos. JSON das respostas completas comparado ao
compacto: 13.981.188 → 6.239.402 bytes (55,37% menor), conforme teste executável.
Não é medição de RAM, latência em produção nem tráfego comprimido.

## Verificação já realizada

- Typecheck aprovado.
- Fronteiras: 590 arquivos, zero exceções.
- Corpus: 241 arquivos válidos; nenhum arquivo de corpus modificado.
- Build de UI aprovado.
- Provas novas: preservação integral; variantes com mesmo nome; ativação sem revisão;
  setor/ID duplicado; fonte com ID/hash divergente; autorização e contexto via HTTP;
  respostas atrasadas; edição preservada ao recolher; bases auxiliares sob demanda;
  contagem de leituras Flash e conflito de revisão.
- Primeira regressão detectou um erro transitório na composição do conjunto de
  impressão durante a refatoração; corrigido e testes de impressão repetidos.
- Expectativas de catálogo atualizadas explicitamente para 92 rotas (uma leitura nova).
  Nenhum teste foi desativado e nenhum limiar clínico foi alterado.

## Fora da simplificação deste lote

Não desligar setores clínicos, invalidadores temporais ou provas de assinatura.
Não migrar corpus para Biblioteca e não acrescentar chamada obrigatória de LLM.
Não declarar a extração de requisitos como cobertura completa do conhecimento clínico.
O motor ainda calcula avaliação integrada: seu desmembramento requer uma fatia própria,
com definição de dependências clínicas e validade temporal.
PR 76 altera arquivos comuns (Flash/portas/UI); PR 78 altera rotas e acervo.
Nenhum foi incorporado silenciosamente. Integração futura exige resolver o diff e repetir
os testes das respectivas jornadas. Revisão independente e aprovação clínica não realizadas.


## Encerramento e reprodução

- Regressão ampliada: **105 arquivos / 662 testes aprovados**, duração 456,16 s.
- Ataques adicionais de cliente/contexto e entrada real: **2 arquivos / 6 testes aprovados**.
- Total de testes novos desta fatia: 16 (10 na regressão ampliada e 6 na execução adicional).
- `npm run typecheck`, `node scripts/check-boundaries.mjs`, `node scripts/validate-corpus.mjs`,
  `npm run ui:build` e `git diff --check`: aprovados.
- Logs locais ignorados pelo Git: `redteam-regressao.log`, `redteam-contexto.log`,
  `redteam-build.log`. A rodada intermediária `redteam-dirigido.log` contém falhas já
  corrigidas de expectativa de abertura de seção; não é o resultado final.

Comandos de testes finais:

```powershell
npm exec vitest run tests/eficiencia-pack-flash tests/fase2 tests/f1/s8 tests/f1/s9 tests/w12-f4 tests/f0c/flash-backend.test.ts tests/ui tests/ui-telas tests/oncoassist-local tests/server/contratos-saida.test.ts tests/server/g2-processamento-http.test.ts -- --reporter=dot
npm exec vitest run tests/eficiencia-pack-flash/porta-http.test.ts tests/eficiencia-pack-flash/entrada.test.tsx -- --reporter=dot
```

Os dois testes adicionais foram criados após a coleta da regressão ampliada; numa
nova execução da primeira linha também serão coletados. A contagem pode aumentar.

Verificações de UI usam jsdom; HTTP usa loopback e dados sintéticos. Não houve
benchmark em produção nem teste visual em navegador nesta fatia. Nenhum código
clínico, dado de paciente real ou regra de tratamento foi alterado. As garantias
referem-se aos cenários executados e não provam ausência universal de defeitos.

Próximo passo: revisão independente/reconciliação. O piloto clínico de um pack não
foi antecipado. Preservar o papel do Dr. Silas na definição do conteúdo e não usar
esta otimização técnica como aprovação clínica.

## Reconciliação das contagens de fronteiras — revisão PR #79

As contagens são de fotografias diferentes, pelo mesmo `scripts/check-boundaries.mjs`: a otimização de 27/10 (commit original `29e247c1`, incorporado como `cb602d05`) tinha 590 arquivos de fonte verificados. A integração de 29/10 (`35e6d6f6`) acrescentou `src/ui/consulta/EvolucaoNaFlash.tsx`, totalizando 591. Alterações de layout nos arquivos existentes não acrescentaram arquivos a essa contagem. Ambos os resultados tinham zero exceções; não são contagens de testes nem de todo o repositório.
