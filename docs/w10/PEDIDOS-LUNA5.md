# PEDIDOS-LUNA5 · contratos e integração de configuração

## P-L5-01 · Evento canônico para configuração global

- **Fato observado:** `src/contracts/w10/clinico-w10.ts` define `AlteracaoCaixa` sem `revision` nem `operationId`; `src/kernel/ledger/schema.ts` exige `patientId` e `encounterId` para `clinical_event`.
- **Dano observável:** configuração global não pode ser gravada no ledger clínico sem atribuir paciente/encontro incorretos; também não há contrato para idempotência/revisão da alteração.
- **Decisão/contrato necessário:** tech lead definir porta/evento operacional global versionado com operação, revisão esperada, autor de sessão, antes/depois e idempotência, preservando `AlteracaoCaixa` como evento estrito se esse formato for mantido.
- **Dono:** tech lead / root.
- **Contenção atual:** W10-LUNA5 usa SQLite operacional local dedicado em `config-w10.sqlite`. Snapshot, idempotência, conflito e envelope `PROVISORIO-W10` são atômicos; envelope armazena os objetos `AlteracaoCaixa` sem campos extras. Esta persistência não é declarada como integração do ledger canônico.

## P-L5-02 · Catálogo de caixas de configuração

**Estado:** chaves confirmadas pela L3 e catálogo WIP reportado em `corpus/glossario/caixas.v1.json` (16 itens); a integração ao worktree do root ainda precisa ser validada.

- **Fato observado:** perfil F09 precisa registrar eventos numerados, enquanto o catálogo compartilhado é fornecido pela L3 em `corpus/glossario/caixas.v1.json`.
- **Dano observável:** sem as caixas de configuração no catálogo, alterações no perfil devem falhar em vez de produzir eventos sem número/tipo/editabilidade aprovados.
- **Decisão/contrato necessário:** L3 incluir as chaves abaixo no envelope `{ schemaVersion: "caixas.v1", versao, caixas }`, usando `editavelPor: "MEDICO"`, números estáveis e sem `valorAtual` no corpus:
  - `config.medico.nome`, `config.medico.crm`, `config.medico.rqe`, `config.medico.telefone`, `config.medico.cns`;
  - `config.instituicao.hospital`, `config.instituicao.cnes`;
  - `config.preferencias.tema` (`TEXTO`, enum validado pelo serviço), `config.preferencias.layoutPersonalizado`, `config.preferencias.impressora`, `config.preferencias.sincronizarTelefone` (`BOOLEANO`);
  - `config.conexoes.sites`, `config.conexoes.redeImpressora`, `config.conexoes.skills`, `config.conexoes.plugins`, `config.conexoes.mcp`.
- **Dono:** L3 / root para a integração e confirmação dos números atribuídos.
- **Contenção atual:** catálogo injetado no serviço e fixtures pequenas só nos testes; nenhuma cópia do glossário de produção é criada por L5.
