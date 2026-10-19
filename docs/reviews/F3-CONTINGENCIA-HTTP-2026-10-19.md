# F3 / S-F3-04 — contingência por HTTP e interface

Escritor único: Codex. Base técnica 7f6e124 (PR27), integração após merge protegido do PR27. Worktree codex-f3-contingencia-http-20261019. Objetivo: percurso TelaSalao → entrada operacional médica → HTTP autenticado → folha persistida → prévia → reabertura no mesmo SQLite.

Caminhos: src/contracts/api/porta.ts, saidasHttp.ts e salaoContingencia.ts; src/server/rotas.ts, salaoContingencia.ts e salaoF3.ts; src/ui/api/http.ts; src/ui/telas/TelaSalao.tsx; src/ui/salao/ContingenciaSalao.tsx; tests/f3/contingencia-ui-http.test.tsx; este relatório. Reutiliza gerarFolhaContingenciaSalaoF3 e salao_folha_contingencia, sem tabelas paralelas.

A identificação e data da folha vêm do servidor. Destino, emergência E1 e resumo são entrada explícita do médico; nenhum ruleset novo é executado ou ativado. Fonte do resumo é rotulada como informação operacional médica. A folha não libera infusão, não administra dose, não altera prescrição nem confirma mensagens do canal. Histórico exige contexto selecionado de paciente/encontro. Chave de operação estável permite replay; conteúdo divergente retorna conflito, preservando o documento anterior.

Aceite: caso sintético atravessa tela/HTTP/SQLite, reabre folha após reinício; rejeita sessão ausente, contexto trocado e campos de identidade injetados; E1 exige destaque; HTML de entrada é escapado. Revisão independente antes de integração, CI do SHA final e preservação do Cursor conferidos separadamente.

F3 permanece PARCIAL: este recorte não fecha as fatias de fila, dose, administração, adiamento/nutrição ou o atendimento integral. Nenhuma aprovação clínica é produzida por testes. Não houve contato com paciente, impressão automática, configuração de provedor ou serviço externo.

Revisão independente encontrou duas bordas (replay após meia-noite e histórico atrasado); ambas receberam regressões. A prova de reabertura foi tornada determinística por folhaId, sem presumir ordem de UUIDs. O HTML agora imprime também patientId e encounterId para preservar identificação na contingência.
