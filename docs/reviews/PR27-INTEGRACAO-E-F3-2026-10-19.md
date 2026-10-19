# PR27 — correções finais e ponto de partida F3 (2026-10-19)

Base: 08cb3226d4c0d6a7cdf029a62735dae968fbabea. Escritor/integrador: Codex, worktree codex-pr27-integracao-f3-20261019. Escritor F5: Codex Noether, apenas f5AnamneseOncoChief.ts e novo teste F5. Revisão independente: Codex Archimedes, APROVADO no diff completo, 36 testes focados.

Corrigidos: projeção do vínculo reconciliado na pré-consulta (incluindo revisão do cache, revogação, IMAP sem identidade clínica e dados inválidos); contexto imutável das minutas F4; replay de contingência F3 retornando documento persistido ou conflito explícito; consentimento F5 ligado a paciente e COMUNICACAO_CLINICA; retorno dos vencedores persistidos em resumo e voz, com rejeição de colisão entre contextos. Áudio temporário expurgado.

Validação local: typecheck PASS; fronteiras 486 arquivos, zero exceções; corpus PASS. Bateria focada: 34 testes funcionais PASS e 14 testes PHI PASS após stage explícito dos oito caminhos. A primeira execução PHI registrou divergência índice/worktree (sem critério relaxado); reteste com índice alinhado passou. As dependências incompletas da main local impediram o primeiro typecheck; a junction da worktree foi apontada para as dependências já presentes da worktree bateria2, sem instalar ou alterar dependências compartilhadas.

Preservação: inventário de todas as worktrees, HEAD, índice, status e hashes em OncoGlobal-backups/pr27-integracao-20261019/before.json; inventário adicional dos checkouts ativos em active-before.json. Arquivos locais de Cursor e frentes concorrentes não integram esta alteração. CI/revisão GitHub e merge devem ser conferidos no SHA efetivo.

F3 permanece parcial. Próxima fatia: S-F3-04 contingência pelo HTTP e interface, com contexto de paciente/encontro, documento persistido e reabertura; reutilizar gerarFolhaContingenciaSalaoF3. Sem alterar corpus, limiares, regras em RASCUNHO, assinatura de prescrição ou permissões multiusuário. Adiamento/nutrição, dose/administração e integração clínica integral continuam pendentes até prova própria.

## Falha real de CI e reteste F6

Severidade operacional: aviso recusado indevidamente. Run push 39325722933 falhou em tests/f6/multiusuario-setores-rbac.test.ts:234; run PR39325731386 passou no mesmo código. Causa reproduzida: UUID aleatório com sufixo numérico satisfaz o detector de telefone e produz PHI_DETECTADA_NO_AVISO. Regressão determinística falhou antes da correção e passou depois. O identificador padrão agora codifica os nibbles UUID em letras a-p, de forma bijetiva, preservando entropia. Detector PHI, permissões e corpus inalterados; avisos com identificador fornecido continuam sujeitos ao gate. Reteste F6: 4/4 PASS, typecheck PASS. Sem habilitação clínica ou transporte externo.
