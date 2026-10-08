# Jev pelo OncoAssist — execução local

O SDK `@typesafe-ai/sdk@0.6.0` é usado pelo serviço `src/app/oncoassist.ts` e pelas rotas autenticadas do servidor existente. A capacidade inicial é sugerir o tipo de uma fonte documental: LAB, RADS, PATH, NOTA, OUTRO ou INDETERMINADO. Não gera parecer, diagnóstico, estádio, dose, prescrição ou confirmação clínica.

## Configuração

No ambiente do processo backend, configure `ONCOGLOBAL_SENHA` (12 a 512 caracteres), `ONCOGLOBAL_MEDICO_ID` e `ONCOGLOBAL_CRM`. Não coloque senha ou chave na linha de comando, em arquivos versionados ou em variáveis `VITE_*`.

Para habilitar o provedor, configure também `TYPESAFE_API_KEY` e `ONCOASSIST_JEV_ENABLED=true`. Sem opt-in ou chave a capacidade informa PENDENTE e não chama a rede. A chave não é fornecida nem gravada por esta implementação.

Use o diretório absoluto do ledger existente, contendo `ledger.sqlite`:

```powershell
$env:ONCOGLOBAL_API_PORT = '4181'
npm.cmd run oncoassist:local -- --data-dir 'C:\caminho\dos\dados'
```

Em outro terminal, no mesmo worktree:

```powershell
$env:ONCOGLOBAL_API_PORT = '4181'
npm.cmd run ui:dev
```

Abra a URL local apresentada pelo Vite com `/oncoassist.html`. A API e o proxy vinculam-se a 127.0.0.1. Essa entrada usa login e agenda reais do ledger escolhido; a página padrão continua sendo a demonstração. A composição não cria pacientes, agenda ou dados clínicos automaticamente. A entrada separada evita carregar módulos sintéticos com dependências Node no navegador real.

## Percurso

1. Entrar com a senha local e selecionar paciente da agenda de hoje.
2. O servidor recupera a consulta e suas fontes de extração previamente vinculadas por revisão médica.
3. Selecionar um documento e solicitar a classificação. O navegador envia referência e contexto; o texto e o dicionário de identificação são recuperados localmente pelo servidor.
4. O serviço desidentifica e verifica resíduos localmente. Envia somente marcadores documentais de vocabulário fechado, em ordem fixa, ao endpoint da TypeSafe. Transcrição, nomes, valores, datas, fonte, hash original e mapa de reidentificação ficam locais. Sem marcadores reconhecidos, retorna PENDENTE e não chama o provedor.
5. A resposta é validada e exibida como sugestão para revisão, sem escrita no ledger clínico.

O detector local usa padrões e identificadores conhecidos, mas a saída não depende de reconhecer todos os nomes: nenhum trecho livre é encaminhado ao Jev. A representação reduzida limita a classificação; sua acurácia no provedor real permanece não validada. Os testes usam somente fontes sintéticas e transporte offline.

## Contratos de consumo

- `POST /consulta/oncoassist/status`: capacidade, sem expor chave.
- `POST /consulta/oncoassist/fontes`: fontes vinculadas ao paciente/encontro/lote selecionados.
- `POST /consulta/oncoassist/classificar-fonte`: proposta referente a um draft persistido; rejeita corpo livre, dicionário enviado pelo navegador, troca de contexto e alteração da fonte durante a chamada.
- `POST /consulta/rascunho/preparar-revisao`: fornece o conteúdo selecionado e seu comprovante de exibição; não confirma fatos.
- `POST /consulta/rascunho/revisar`: exige o comprovante para confirmar fatos. A interface consumidora deve mostrar o conteúdo antes da ação médica; receber HTTP 200 sozinho não prova leitura visual.
- `POST /consulta/estatistica`: aceita opcionalmente `{ "periodoClinico": { "inicio": "2026-10-01", "fim": "2026-10-31" } }`; datas inclusivas, exclusões explícitas, sem fallback para data de ingestão.

O modo local do OncoAssist apresenta classificação documental e revisão de extrações já vinculadas, com resumo exibido e confirmação separada; não expõe todos os fluxos da consulta clínica. Nenhum índice vetorial, conector de laboratório, Plaud/Nova-3 ou integração externa de agenda foi instalado por esta mudança.

Documentação do provedor consultada: https://docs.typesafe.ai/sdk/javascript e https://docs.typesafe.ai/primitives/choice.
