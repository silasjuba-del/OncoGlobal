# Continuação da revisão clínica — Fase 2

Pedido em 2026-10-16: “CONTINUE CORRIGINDO, TERMINE A FASE 2”.
Escritor único: Codex. Base: `f43fe3f`. Branch: `codex/fase2-lacunas-t1`.
Escopo: matriz A1–I5 da auditoria anexada; não confundir esta revisão com a fase F2/canal do roadmap histórico.

## Execução

1. Conectar packs documentais a um contrato separado, preservar conteúdo literal e estados; reunir ficha mínima, pré-requisitos, seguimento e fontes na consulta.
2. Reaproveitar o motor de investigação e o caminho existente de minutas/revisão; não produzir recomendações a partir de conteúdo não conferido.
3. Corrigir conexões longitudinais e medir cliques por etapa sem identidade ou conteúdo clínico.
4. Completar o ditado local via `SpeechRecognition` com `processLocally=true`, mantendo preparação explícita de idioma e nenhuma alternativa remota para áudio.
5. Revalidar critérios da matriz, executar testes por fronteira e prova de navegador; rodar verificação integral somente após congelar o código.

WRITE_SET inicial: `src/contracts/fase2/tumorPack.ts`, `src/contracts/fase2/revisaoClinica.ts`, `src/kernel/corpus/tumorPacks.ts`, `src/modules/consulta/revisaoClinica.ts`, `src/server/revisaoClinica.ts`, `src/server/investigacao.ts`, `src/server/http.ts`, `src/server/rotas.ts`, `src/contracts/api/porta.ts`, `src/contracts/api/saidasHttp.ts`, `src/ui/api/http.ts`, `src/ui/consulta/RevisaoClinica.tsx`, `src/ui/consulta/metricasConsulta.ts`, `src/ui/OncoassistLocal.tsx`, `src/ui/telas/importar/BotaoVoz.tsx`, `src/rules/kitTumorLot.ts`, testes em `tests/fase2/` e este documento. Extensões necessárias serão nominadas antes da edição.

## Limites clínicos concretos

Extensão do WRITE_SET para a conexão longitudinal: `src/server/leituras.ts`, `src/kernel/projections/timelinePaciente.ts` e `src/contracts/w10/clinico-w10.ts` somente se necessário à tipagem da projeção. A leitura RECIST deve respeitar lote e horizonte da consulta; o resultado continua proposto e pCR é separado.

Revisão clínica separada em `docs/ondas/FASE2-REVISAO-MEDICA-PENDENTE.md`: cópia rastreável dos 25 sinais, sem modificar ou ativar o corpus. Somente o médico pode conferir essa lista.

Extensão para G3: `src/contracts/fase2/estadoDoenca.ts`, `src/server/estadoDoenca.ts`, `src/ui/consulta/EstadoDoenca.tsx`. Registro explícito de remissão/recidiva pelo médico, com data e fundamento, prévia exibida e confirmação no WriteRouter existente. Nunca deriva estado da doença de RECIST nem altera estágio histórico.

Extensão para B3: `src/contracts/api/investigacao.ts`, `src/modules/investigacao/index.ts`, `src/ui/consulta/InvestigacaoMinima.tsx`, `src/ui/consulta/ConsultaPersistida.tsx`. Categoria de exame explícita no contrato; um clique leva a minuta com indicação e referência à Consulta Flash, preservando a revisão/assinatura existentes. Categoria ausente não é inferida do nome do exame.

Para conservar a proveniência da minuta até o documento: `src/contracts/api/flash.ts`, `src/server/flash.ts`, `src/ui/consulta/ConsultaFlash.tsx`. O cliente transporta referências; a indicação é recalculada no servidor antes da preparação e rejeitada se a versão/fatos mudarem.

Os mesmos três arquivos recebem documentos médicos manuais (encaminhamento, laudo e orientações), aproveitando prévia, bundle, assinatura e histórico existentes. O médico fornece destino e conteúdo; o sistema só incorpora resumo clínico já confirmado. Rascunho incompleto pode ser salvo, mas não preparado para assinatura.

O corpus mantém packs e sinais de alarme em RASCUNHO; correção de software não é conferência médica do conteúdo. O contrato original dos doze blocos não foi encontrado no material acessível. O contrato técnico desta continuação será explicitamente documentado como novo adaptador, sem alegar recuperação de uma especificação ausente. Regras sem fonte ou conferência permanecem indisponíveis para produzir ações clínicas.

## Fechamento técnico

Entrega técnica concluída sem alteração de arquivos do corpus. A preservação literal dos protocolos passou a ter regressão em teste, e o mapa do memo solicitado está em `docs/ondas/FASE2-MEMO-MAPA.md`.

Validação final executada após o congelamento do código:

- `npm run typecheck`
- `npm run check:boundaries`
- `npm run check:corpus`
- testes Fase 2, ditado local, consulta e consumidores RECIST
- `npm run verify`
- navegador Chrome com servidor e áudio sintéticos locais: o botão mudou para `Parar ditado` e exibiu “Ouvindo neste computador. A fala preenche somente o rascunho.”

O navegador confirmou a inicialização do reconhecimento local e a permissão de mídia sintética. A transcrição final não é falsificada quando o arquivo de áudio sintético não produz resultado; o campo permanece rascunho editável e exige revisão antes de persistir.

## Fechamento clínico pendente

Permanece a conferência médica explícita dos 25 sinais de alarme e dos critérios/intervalos que o corpus não declarou. Isso bloqueia ativação clínica, não a preservação nem a consulta documental dos protocolos.
