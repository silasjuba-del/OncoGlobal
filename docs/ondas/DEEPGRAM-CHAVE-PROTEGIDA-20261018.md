# Deepgram — chave protegida entre reinicializações

Pedido: salvar a chave com segurança para não precisar inseri-la a cada abertura. Base: main `ae436c9`. Escritor: Codex, branch `codex/deepgram-chave-segura`.

Escopo: cofre de credenciais no gateway, configuração do ditado e interface correspondente; testes e documentação. Corpus clínico e protocolos não são alterados.

Windows: DPAPI `CurrentUser`, sem chave mestra embutida. O arquivo em `%LOCALAPPDATA%/OncoGlobal/credenciais/` contém somente envelope cifrado. Instalação (diretório de dados) e identidade médica determinam nome e entropia distintos. Uma chave salva para este perfil é recuperada em novos logins e após reiniciar o servidor. Não é salva no navegador, no SQLite clínico, no repositório ou em arquivo de ambiente em texto puro. DPAPI utiliza a proteção da conta Windows; não impede acesso por programas que já executem como essa mesma conta ou comprometam o servidor autenticado.

O subprocesso nativo usa PowerShell do Windows sem perfil e sem janela; recebe os dados por stdin, nunca por argumentos ou variáveis de ambiente. Erros retornam somente códigos fixos. Falha de criptografia não cai para gravação em texto puro. Escrita usa arquivo temporário já cifrado e substituição por rename. Pasta/arquivo redirecionados por link são recusados. O segredo nunca é retornado pelas rotas HTTP.

O ambiente do subprocesso é explicitamente restrito a SystemRoot, WINDIR, USERPROFILE, APPDATA, LOCALAPPDATA, TEMP e TMP. Credenciais Deepgram, de outros provedores e demais variáveis do servidor não são herdadas. O teste da chamada real ao adaptador verifica esse limite sem imprimir valores de ambiente em falhas.

Se a leitura do cofre falhar, a falha afeta somente essa fonte: uma chave já configurada na sessão ou no ambiente continua podendo iniciar o ditado. O estado informa a indisponibilidade do cofre sem expor seu conteúdo. Uma operação de salvamento só é confirmada após leitura protegida bem-sucedida. Regressões cobrem as duas alternativas e a reparação explícita do cofre com a chave atual.

Interface: “Salvar com segurança neste computador”, “Salvar a chave desta sessão” e “Esquecer chave salva”. O caminho temporário existente permanece disponível. Remover a chave salva invalida tickets, conexões e cópias temporárias daquele médico neste servidor. Variável de ambiente, quando configurada externamente, continua sendo alternativa independente. Em outros sistemas operacionais, a persistência não é oferecida sem um cofre compatível; não há fallback em texto puro.

Validação inclui: DPAPI real no Windows com chave sintética; leitura em nova instância e login; isolamento por instalação/médico; arquivo adulterado; falha de cifragem sem perder a versão anterior; remoção; ausência de segredo na resposta; ausência de armazenamento no navegador. Referência: https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection.

A credencial que estava apenas na memória da versão anterior não possuía rota de exportação. O usuário fez a primeira gravação pelo campo protegido. Em 18/10/2026, o servidor foi encerrado, um processo novo foi iniciado e o navegador foi recarregado. Após novo login, a configuração voltou como “salva com segurança”, com o botão de ditado habilitado e o campo da chave vazio. Nenhuma segunda entrada da chave foi realizada. Prova local: `%TEMP%/oncoglobal-f2-20261018-evidence/browser/deepgram-cofre-reinicio.png`. O valor não foi lido nem registrado pelo agente.

Testes locais: 97 casos de cofre/ditado/UI/contratos passaram; a checagem posterior de cofre e UI passou com 12 casos, incluindo DPAPI real no Windows (contagens sobrepostas). Typecheck, fronteiras com zero exceções e builds UI/SSR passaram. A bateria final de 31 testes passou, cobrindo também origem temporária versus salva e recuperação de arquivo corrompido. A origem da chave efetivamente usada é informada sem retornar seu conteúdo. O teste da DPAPI nativa executa apenas no Windows; os demais cenários do cofre são portáveis e entram no CI Linux.
