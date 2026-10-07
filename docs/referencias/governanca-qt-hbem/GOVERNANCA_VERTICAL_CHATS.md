# Governança vertical dos chats

## Finalidade

Organizar pacientes entre chats do ChatGPT Work sem transformar busca textual, memória implícita ou título de conversa em cadastro clínico. A vertical serve para alocação operacional; o registro oficial continua fora do ChatGPT Work.

## Hierarquia INTRA-LLM

### Nível 0 — Programa QT H.BEM

Contém regras, glossário, modelos, índice de pacientes e decisões comuns. Não contém narrativa clínica acumulada de pacientes.

### Nível 1 — Chat de alocação

Mantém somente o mapa mínimo:

| Campo | Regra |
|---|---|
| `patient_key` | Identificador interno estável; não usar apenas nome |
| `chat_ref` | Referência do chat atribuído |
| `status` | `ATIVO`, `EM_REVISAO`, `ENCERRADO` ou `BLOQUEADO` |
| `last_encounter_id` | Último encontro conhecido |
| `memory_pointer` | Ponteiro para a nota no proprietário canônico |

O chat de alocação não recebe transcrição, laudo, esquema, diagnóstico detalhado ou cópia da nota.

### Nível 2 — Um chat clínico por paciente

Recebe apenas material do paciente confirmado. Cada nova entrada começa com `patient_key`, `encounter_id`, data, tipo de fonte e estado de revisão. Um chat não pode agregar pacientes diferentes, mesmo que tenham diagnóstico semelhante.

Um chat por paciente é convenção de organização, não garantia técnica de isolamento. O cadastro oficial resolve identidade; o executor recebe somente o recorte do paciente ativo. Continuação em novo chat mantém a identidade e atualiza o ponteiro, sem criar um segundo paciente. Memória compartilhada de projeto não substitui autorização e isolamento.

### Nível 3 — Encontro e fontes

Cada encontro mantém fontes separadas: `CHAT_PASTE`, `WHISPER_LOCAL`, `PLAUD_SOAP`, `LAUDO` e `NOTA_ANTERIOR`. O merge produz uma visão; não apaga as fontes.

### Nível 4 — Minuta e promoção

A nota começa como `DRAFT`. Somente ação explícita do Dr. Silas pode marcá-la como `REVIEWED_BY_PHYSICIAN` e encaminhá-la ao destino definido. A promoção não converte o ChatGPT Work em prontuário oficial.

## Barreiras verticais

- Sem `patient_key` e `encounter_id` confirmados, não mesclar nem vincular ao histórico. Permitir salvar fonte não vinculada no destino autorizado, para identificação posterior.
- Nome igual não prova identidade.
- Plaud multipaciente entra em quarentena até segmentação e confirmação humana.
- O índice de alocação armazena ponteiros, não conteúdo clínico.
- Nenhuma LLM resolve conflito de identidade ou decide qual fonte vocal é verdadeira.
- Renomear ou mover um chat exige atualizar o índice; chats de continuação apontam ao mesmo cadastro. Escrita concorrente na mesma nota exige controle de versão, não bloqueio arbitrário de conversas.

## INTRA-LLM versus INTER-LLM

| Dimensão | INTRA-LLM | INTER-LLM |
|---|---|---|
| Momento | Fase A | Após aprovação da Fase A |
| Participantes | Chats do mesmo ChatGPT Work | ChatGPT, Codex, Claude e bridges futuras |
| Unidade | Paciente → encontro → fontes → minuta | Tarefa versionada com entrada e saída delimitadas |
| Contexto | Regras comuns e chat clínico alocado | Pacote mínimo necessário; nunca histórico total por padrão |
| Autoridade | Médico promove a minuta | Nenhuma LLM promove conteúdo clínico |
| Risco principal | Mistura de pacientes entre chats | Perda de proveniência e exposição de PHI entre provedores |

## Regra de passagem

O cruzamento INTER-LLM só pode iniciar quando a fase INTRA-LLM provar: alocação unívoca, vínculo paciente-encontro, versionamento, trilha de fontes, revisão médica e proprietário canônico da persistência.
