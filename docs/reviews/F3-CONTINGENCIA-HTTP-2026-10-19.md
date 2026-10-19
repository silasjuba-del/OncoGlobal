# F3 / S-F3-04 — contingência por HTTP e interface

Escritor único: Codex. Base técnica 7f6e124 (PR27), integração após merge protegido do PR27. Worktree codex-f3-contingencia-http-20261019. Objetivo: percurso TelaSalao → entrada operacional médica → HTTP autenticado → folha persistida → prévia → reabertura no mesmo SQLite.

Caminhos: src/contracts/api/porta.ts, saidasHttp.ts e salaoContingencia.ts; src/server/rotas.ts, salaoContingencia.ts e salaoF3.ts; src/ui/api/http.ts; src/ui/telas/TelaSalao.tsx; src/ui/salao/ContingenciaSalao.tsx; tests/f3/contingencia-ui-http.test.tsx; este relatório. Reutiliza gerarFolhaContingenciaSalaoF3 e salao_folha_contingencia, sem tabelas paralelas.

A identificação e data da folha vêm do servidor. Destino, emergência E1 e resumo são entrada explícita do médico; nenhum ruleset novo é executado ou ativado. Fonte do resumo é rotulada como informação operacional médica. A folha não libera infusão, não administra dose, não altera prescrição nem confirma mensagens do canal. Histórico exige contexto selecionado de paciente/encontro. Chave de operação estável permite replay; conteúdo divergente retorna conflito, preservando o documento anterior.

Aceite: caso sintético atravessa tela/HTTP/SQLite, reabre folha após reinício; rejeita sessão ausente, contexto trocado e campos de identidade injetados; E1 exige destaque; HTML de entrada é escapado. Revisão independente antes de integração, CI do SHA final e preservação do Cursor conferidos separadamente.

F3 permanece PARCIAL: este recorte não fecha as fatias de fila, dose, administração, adiamento/nutrição ou o atendimento integral. Nenhuma aprovação clínica é produzida por testes. Não houve contato com paciente, impressão automática, configuração de provedor ou serviço externo.

Revisão independente encontrou duas bordas (replay após meia-noite e histórico atrasado); ambas receberam regressões. A prova de reabertura foi tornada determinística por folhaId, sem presumir ordem de UUIDs. O HTML agora imprime também patientId e encounterId para preservar identificação na contingência.

## Evidência do recorte F3

No snapshot de composição 8b04c7d: 118 testes em sete arquivos PASS (F3, salão HTTP/UI, contratos HTTP, integridade, ligações F2 e scanner PHI); typecheck, fronteiras (489 arquivos/zero exceções) e build UI PASS. Revisão independente Noether: sem bloqueantes, incluindo confirmação da composição; 80 testes focados revisados. A correção posterior do limite da caixa F2 foi incorporada por merge preservando seu histórico; o CI do SHA final continua necessário.

| Requisito | Implementação | Teste/evidência | Estado |
|---|---|---|---|
| Identidade do paciente/encontro e data do servidor | operarContingenciaSalao + contexto médico selecionado | sessão ausente, contexto trocado, identidade injetada recusados por HTTP | COMPROVADA_LOCAL |
| Documento local persistido, preview e reabertura | tabela existente salao_folha_contingencia; ContingenciaSalao em TelaSalao | HTML igual após reinício; seleção por folhaId, sem depender de ordem aleatória | COMPROVADA_LOCAL |
| Replay e conflito | ID por contexto/operação + comparação no gerador existente | repetição após meia-noite retorna folha original; alteração preserva original e retorna conflito | COMPROVADA_LOCAL |
| Histórico atrasado e conteúdo não confiável | merge por folhaId; escape HTML e iframe sandbox | resposta histórica atrasada não apaga folha nova; script literal escapado | COMPROVADA_LOCAL |
| Sem ativação clínica implícita | dados declarados pelo médico; nenhuma alteração do corpus | contagem de eventos clínicos não aumenta; nenhum envio externo no teste | COMPROVADA_LOCAL |

Medição: não foi realizado benchmark de carga desta fatia. Os tempos do runner são tempos de teste, não latência de atendimento. Demonstração local por componentes React com HTTP real e SQLite temporário; impressão física e uso assistencial real não foram demonstrados. A integração no GitHub e o SHA de merge são conferidos separadamente, sem declarar conclusão clínica da F3.

Preservação: snapshot inicial de 119 worktrees e 77 arquivos protegidos; nova comparação dos 77 hashes sem mudanças. As Lunas da avaliação global permaneceram em leitura na sua worktree, que não recebeu alterações desta fatia. Arquivos não commitados do Cursor não entram no PR.

Handoff: concluir os efeitos operacionais de adiamento/nutrição e depois a ligação de dose/administração/cumulativos à interface e aos eventos efetivos, reutilizando módulos/contratos existentes. Decisões médicas e regras pendentes pertencem ao médico; a próxima fase clínica não é ativada por esta entrega. FASE_CONCLUIDA: NAO.

Borda adicional de contexto: a contingência só monta depois que o servidor confirma a seleção. O seletor de paciente é serializado durante a seleção inicial e as trocas; teste A/B impede disparo concorrente enquanto A está pendente e permite B depois. Typecheck e três testes F3/HTTP-salão PASS; revisão independente sem bloqueantes. Os testes anteriores de atraso do histórico e meia-noite permanecem.

Prova adicional no navegador real: Chromium/Playwright atravessou o app local, gerou folha por HTTP, conferiu paciente/encontro no iframe, navegou para outra tela e reabriu a folha pelo ID, comparando HTML integral. Contadores de eventos clínicos e transporte não mudaram. Execução test:b2 PASS em s12-b2-evidence-QGEy1c, com screenshot f3-contingencia-local.png fora do Git; nenhuma impressão física nem provedor real foi acionado. Os dois paths adicionais desta prova são tests/f1/s12/browser-b2.js e tests/f1/s12/browser-contingencia.js. Revisão independente do harness: sem bloqueantes.

Composicao final597072d: incorpora correcao Meta0b75527 por merge preservando historia. Typecheck e fronteiras490arquivos/zero excecoes PASS; Chromium test:b2 PASS em s12-b2-evidence-GCDFfy, com folha persistida/reaberta e sem efeito clinico/transporte. Revisao independente do delta15caminhos manteve aprovacao. Auditoria adversarial externa dos seis helpers/projecoes permanece pendente em fatia separada; nao foi corrigida nem ativada pela contingencia. CI/GitHub do SHA publicado sao gates separados.
