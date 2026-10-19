# Proveniência temporal da conversão da biblioteca

Base inspecionada: `39bb74a` (main). O PR #19 já estava integrado em 17/10/2026, 19:41 UTC, pelo merge `117aaede`. A correção inicial do apontamento de 15/10 já estava presente: edição e vigência não eram mais usadas como publicação. Esta fatia completa a exigência de evidência documental e a regressão, sem reaplicar o patch antigo.

## Contrato e consumidores conferidos antes da alteração

- `src/kernel/corpus/biblioteca.ts`: `ItemBiblioteca@1` exige `publicadoEm` como data e `recuperadoEm` como instante; objeto estrito. Ausência de publicação não cabe no contrato atual.
- `src/contracts/api/saidasHttp.ts`, `src/contracts/api/biblioteca.ts` e `src/server/biblioteca.ts`: transporte, validação HTTP e persistência preservam os mesmos campos.
- `src/ui/biblioteca/BibliotecaLocal.tsx`: exibe publicação e recuperação separadas.
- Portanto, não há mudança de schema nem migração dos pacotes imutáveis existentes. Data desconhecida exclui o item com `SEM_DATA_PUBLICACAO`; declaração sem prova exclui com `DATA_PUBLICACAO_NAO_VERIFICADA`. Mapeamento que fornece data sem prova é recusado antes de gerar destino. Se todos forem excluídos, permanece `NENHUM_ITEM_CONVERGIDO`.

## Correção

`scripts/converter-biblioteca.mjs` exige que a data declarada corresponda a uma entrada em `verificacoes[].publicacoes`, com trecho documental e localizador. Uma URL apenas conferida não basta, inclusive quando a data vem de `fonte.publicadoEm`. Datas impossíveis e incompletas são recusadas. Havendo revisões distintas na evidência, o mapeamento precisa selecionar `versaoFonte`; não escolhe automaticamente a primeira ou a mais recente.

O inventário conserva `evidenciaPublicacao` e `datasOriginais`: edição literal, publicação declarada, recuperação original e vigência do header. Não interpreta a edição legada como data de acesso; a referência textual original continua preservada. `proveniencia.recuperadoEm` continua sendo a recuperação do snapshot para conversão, explicitada no inventário; não representa novo acesso à fonte externa. Não são acrescentados campos ao contrato estrito do item.

`scripts/converter-biblioteca-mapeamento.json` v1.1.0 registra as provas já curadas:

- DailyMed: `history.json`, `/data/history/0`, `spl_version=2`, `published_date=Sep 25, 2026`; revisão 1 publicada em `Dec 25, 2024`. Seleção explícita `SPL 2`. API conferida diretamente nesta execução; o timestamp global `db_published_date` não é usado como publicação do documento.
- Lei 8.922/1994: rodapé oficial de publicação no D.O.U. em 26.7.1994, distinto da data da lei (25/7) e da vigência local. Fonte documental: https://www.planalto.gov.br/ccivil_03/leis/l8922.htm.

O conversor continua offline: o registro de prova é uma declaração curada, auditável, não uma verificação automática da autenticidade ou do significado do trecho. Inclusão documental não confirma o conteúdo clínico.

### Correções da revisão independente de 18/10/2026

Na base atualizada após o PR #25, a revisão identificou dois bloqueios e um
problema de rastreabilidade. O gate agora considera pares data/revisão, exige
seleção explícita quando há publicações distintas e recusa uma mesma revisão
ligada a datas conflitantes. Ausência, repetição ou vazio do identificador não
permitem escolher silenciosamente uma data, inclusive quando herdada da fonte.

A URL da prova precisa ser textual e HTTPS válida; verificações/provas nulas
não produzem evidência. O inventário preserva a URL efetivamente cotejada mesmo
se o registro trouxer outra propriedade `fonte`. Quinze casos de regressão foram
adicionados: quatorze falharam antes da correção, demonstrando as lacunas.

## Regressão e limites

`tests/f1/s3/converter-biblioteca.test.ts`: publicação desconhecida; acesso confundido com edição; vigência local; data declarada sem prova; datas inválidas/incompletas; preservação independente das datas; revisões ausente/incompatível/explícita; URL sem trecho/localizador; painel DailyMed real e importação em RASCUNHO sem visibilidade clínica.

Prova operacional: exportação e conversão dos dois arquivos atualmente mapeados passaram pelo importador real (2 incluídos, 0 excluídos). A tentativa de exportação integral parou em `PHI_ESTRUTURAL:corpus/6-pack-tumor/adrenal/pack-adrenal.v2.RASCUNHO.json`, arquivo fora do diff. Não se alterou scanner, exceção ou material clínico para contornar essa falha.

Nenhum arquivo de `corpus/` foi modificado. Doses, decisões clínicas, estados dos protocolos e regras de ativação permanecem preservados. Importação não ativa a biblioteca; a aprovação médica continua independente.

## Validações executadas

- Conversor final e scanner PHI: 45 testes em 2 arquivos, aprovados (31 do conversor + 14 do scanner). A primeira execução do scanner detectou diferença entre índice Git e árvore de trabalho; após stage explícito dos quatro caminhos revisados, passou sem exceção nova.
- `verify:f1`: 891 testes em 100 arquivos, aprovados; a regressão DailyMed adicionada depois foi coberta na execução final do conversor acima.
- W10: 240 testes em 31 arquivos, aprovados. W8: 41 em 9 arquivos, aprovados.
- Typecheck, fronteiras gerais e de fechamento F1-S3 (zero exceções), corpus (241 arquivos) e build da UI: aprovados.
- Exportação/conversão do recorte real mapeado: 2 arquivos/2 itens, importador real aprovado. A exportação integral tem a limitação PHI registrada acima.
- Suíte geral final: `npm test -- --pool=forks --reporter=dot`, **3.770 testes em 473 arquivos**, todos aprovados, em 358 s. As tentativas com a configuração padrão de threads não produziram resumo final nesta execução; não se declara `npm run verify` integralmente aprovado. Seus passos de typecheck, fronteiras e corpus passaram; a bateria completa foi concluída com processos isolados, sem alterar configuração do repositório ou excluir testes.
