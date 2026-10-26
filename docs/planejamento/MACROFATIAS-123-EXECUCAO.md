# Execução integrada das macrofatias 1, 2 e 3

Autorização: Silas, 26/10/2026. Branch `codex/medico-oncoassist-m123`, base `d3e998a3` do PR #75 ainda aberto. Entrega por PR dependente do #75; nenhum merge autorizado. WIP do checkout principal e PDFForge original são preservados.

## Resultado

Agenda/cadastro e pré-consulta médicos persistidos → pacote original PDFForge recebido/não revisado → revisão documental → conversa OncoAssist contextual com fontes e modelos locais configuráveis → orientação dietética editável → documentos revisados e assinados explicitamente → retorno agendado → recuperação no mesmo SQLite.

## Contratos e autoridade

- Pacote `oncoglobal.import.v1` não identifica o paciente. Contexto é o selecionado na sessão do servidor. Original e derivado têm hashes próprios; páginas externas/anotações não são fatos. Reimportação é idempotente e identidade de pacote com conteúdo divergente é recusada.
- Conversa/preferências são rascunhos locais. Modelo local opcional deve usar loopback e não seguir redirecionamentos; sem modelo, briefing documental determinístico é identificado como tal. Não habilitar extração na nuvem nem alterar D-F1-40.
- Biblioteca é referência, corpus é regra curada, prontuário é contexto do paciente. Saída gerada não vira referência nem evento clínico automaticamente.
- Cadastro e agenda passam pelo kernel; pré-consulta preserva relato e revisão. Nutrição prepara texto manual revisável para ORIENTACOES existente, sem doses ou recomendações clínicas inventadas.
- Salão/farmácia/STUDY/multiusuário/WhatsApp/e-mail preservados, fora da navegação v1. Não apagar seus testes nem modificar corpus para fechar gates.

## Escritores e integração

| Frente | Território |
|---|---|
| Documental | Contrato importacaoDocumental, serviço, cliente, DocumentosMedicos, testes documental; upload.ts apenas guardas pós-await/replay. |
| Clínica | Contrato consultorioMedico, serviço, cliente, AgendaMedica/PreConsultaMedica/NutricaoMedica e testes próprios. |
| OncoAssist | Contrato conversaOncoassist, serviço/adapter local, cliente/UI, testes próprios. |
| Integrador Codex | Rotas/catálogo/contratos HTTP/PortaConsulta/http/OncoassistLocal; ligação revisão/Flash; ponte PDFForge revisável; E2E e documentação. |

Um dono por arquivo. Mudanças clínicas e de assinatura seguem os consumidores existentes. Revisão final por revisores sem autoria da frente.

## PDFForge

Original: `C:\Users\silas\Downloads\rea-main\pdfforge`, sem Git. Cópia isolada de 83 arquivos de fonte/configuração em `C:\Users\silas\Projects\OncoGlobal-coordination\20261026-m123-cli\pdfforge-m123`; dependências próprias. Manifesto SHA256 do original guardado externamente. A ponte versionada neste PR deve permitir reproduzir as alterações somente sobre fontes com hashes esperados, recusando WIP divergente. Não copiar todo o app Electron nem trocar versões do OncoGlobal neste lote.

## Consultorias CLI solicitadas

- Fugu: invocado via CLI com `responses`, `image_generation=false`, modo read-only. Provedor recusou por assinatura inativa; nenhuma revisão Fugu é alegada.
- Kimi: consultoria textual de contrato recebida após incompatibilidade do modo headless com aprovação de ferramentas. Não é auditoria independente do código. Recomendações úteis: contexto externo ao pacote, original como fonte, hash de derivados, limites e prova de conformidade cruzada.
- Grok: consultoria textual recebida, com propostas de testes adversariais; não equivale a auditoria integral do código.
- Cursor: revisão de fontes concluída via CLI; achados aplicáveis tratados e testados.
- Antigravity: parecer parcial recebido; timeout impede alegar revisão completa. Alegação de ausência de testes unitários refutada pelos arquivos deste lote.
- Mistral: tentativa sem parecer final utilizável (erro de saída/CLI). GLM e Muse: sem executor compatível confirmado neste ambiente. Prompts autocontidos `PROMPT-{MISTRAL,GLM,CURSOR,ANTIGRAVITY,MUSE}-M123.md` preparados no diretório externo de coordenação.
- Hub antigo de outra tarefa preservado. Nenhum desses auxiliares recebeu autoria de produto; logs externos não são enviados ao repositório.

## Critérios de aceite

1. Paciente/encontro criados via UI, replay sem duplicata; agenda editável por intervalo e cancelamento/remarcação persistidos.
2. Pré-consulta e orientação recuperadas após restart; confirmação médica explícita; troca de contexto e revisão concorrente protegidas.
3. Pacote gerado pelo exporter PDFForge aceito no importador; hash adulterado e ID divergente recusados; fonte reaberta após restart com original/anotações/derivado.
4. OncoAssist responde com fontes abríveis e histórico contextual; biblioteca não muda corpus; preferências não aprendem clínica; resposta tardia/cancelada não vira anotação nem assinatura.
5. Streaming vem do adapter real de transporte, não animação de texto pronto. Provedor não configurado é indicado explicitamente. Testes usam servidor local sintético, sem enviar dados reais.
6. Nutrição entra em ORIENTACOES por ação médica; prévia não assina, confirmação assina versão exibida, replay não duplica. Retorno pode gerar agendamento explícito.
7. Testes focados, contratos, fronteiras, corpus, E2E real, build PDFForge e CI integral/adversarial. Nenhum skip, limiar relaxado ou aprovação clínica implícita.

## Recuperação

Sem mudança destrutiva de esquema nem reescrita de eventos. Fontes PDFForge originais permanecem intactas. Reverter commits do novo PR preserva módulos anteriores; os rascunhos adicionais são inertes e não devem ser promovidos por leitores genéricos.

## Estado

Implementação integrada na branch de entrega, ainda não integrada em main. Revisão independente de servidor e parecer Cursor usados para corrigir configuração inválida, troca de contexto, rascunho reaplicado, proteção de navegação e instalador sobre junção.

Entrega: [PR #76](https://github.com/silasjuba-del/OncoGlobal/pull/76), base na branch do #75 ainda aberto. Após integrar a dependência por decisão humana, retargetar para main e repetir os gates; não mesclar automaticamente na branch intermediária.

Evidências locais em 26/10/2026:
- `npm run typecheck`: passou.
- Fronteiras: 604 arquivos, zero exceções; corpus: 241 verificações aprovadas.
- `npm run ui:build` e build da cópia PDFForge: passaram.
- Suite M123: 11 arquivos / 56 testes aprovados, incluindo IPC com API Electron simulada e backup/restauração real comparando drafts, eventos e operações.
- Contratos HTTP: 124 testes aprovados após atualizar o inventário revisado. PDFForge na cópia isolada: 6 arquivos / 132 testes aprovados, incluindo a bateria adversarial existente.
- `node scripts/test-medico-m123.mjs`: jornada Chromium concluída (round10, sem HMR), evidência local `medico-m123-evidence-YHZhJm/resumo.json`. Cadastro → pré-consulta → importação original/derivado → revisão → conversa HTTP/SSE sintética com cancelamento → dieta → cinco documentos assinados explicitamente → retorno em 14 dias → reinício do SQLite e recuperação. Hash lógico dos documentos: `1e9778073e7fd61c71a7e28463692dee0f49b68fe83440724ddf679fdc478655`.
- Testes de retorno/assinatura: 34 aprovados. Retorno sem exames agora cria tarefa de retorno após assinatura, sem criar exames ou tarefa de coleta; teste antigo atualizado para esse novo requisito explícito.
- Backup: produtores novos usam `rawRef=referencia-local` para payload incorporado no SQLite; nenhuma proteção do backup foi relaxada.
- Inventário HTTP: 110 rotas, preservadas as 91 anteriores e adicionadas 19 rotas deste lote; baseline revisado.
- Preservação por SHA256: 18 arquivos WIP do checkout principal e 83 originais PDFForge sem divergências do manifesto externo.
- Reexecução final Chromium após os ajustes de backup: `medico-m123-evidence-oD1VeZ/resumo.json`, `M123_E2E_APROVADO`, hash lógico `9676b2f81ebf8863dab1938587eee7362fad9656f73d02711bb829179e6a71c0`. Revisão independente final estática: nenhum bloqueador concreto, sem equivaler a aprovação clínica.

Limites: smoke Electron nativo não aprovado neste Windows (crash GPU/timeout). Build, mock IPC e importação no Chromium não comprovam o botão desktop. Modelo clínico real não foi instalado/avaliado; o E2E usa transporte real e resposta sintética. Aprovação clínica, merge e produção não são alegados. CI integral/adversarial e nova execução Chromium devem ser conferidos no PR antes da decisão de merge.

Correção encontrada pela CI: abortar apenas o transporte do navegador não assegurava cancelamento no servidor através do proxy; um final tardio podia concluir o turno. O stream agora informa o ID da reserva persistida e o botão solicita cancelamento durável por API antes de fechar o transporte. A interface aguarda confirmação, preserva a pergunta e ignora final concorrente. Bateria do assistente após a correção: 22 testes aprovados, incluindo a corrida de confirmação. CI e jornada são repetidas sobre a correção.
