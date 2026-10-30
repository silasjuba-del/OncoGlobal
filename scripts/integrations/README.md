# Portas locais de leitura

CLI: `node scripts/oncoglobal-cli.mjs --help`. Comandos: `acervo buscar`, `acervo ler`, `integracoes estado`; objeto JSON por stdin e resultado JSON por stdout. A busca usa `{ "consulta": "termo", "limite": 20 }`; leitura usa `docId`, `versao`, `hashSha256`, `revisaoAcervo` e opcionalmente o localizador da referência retornada.

MCP: `node scripts/oncoglobal-mcp.mjs`, transporte stdio, versão anunciada 2025-06-18. Cliente inicia `initialize`, envia `notifications/initialized`, e pode usar `tools/list`/`tools/call` ou `ping`. Não há listener MCP HTTP, recursos/prompts, tarefas, instalação de extensões ou ferramentas de escrita. Trata-se de um subconjunto delimitado do protocolo, não certificação geral de compatibilidade com todas as IDEs.

As duas portas chamam a mesma API autenticada. Configure `ONCOGLOBAL_API_URL` (padrão `http://127.0.0.1:4181`) e `ONCOGLOBAL_API_TOKEN` por ambiente local protegido. O token é de uma sessão existente; não há login automático nem credenciais nos argumentos. Hosts aceitos: `127.0.0.1` e `[::1]`, HTTP com porta explícita. Redirecionamentos recusados. Tokens expirados exigem nova sessão. Não adicione tokens aos arquivos de configuração versionados.

Ferramentas: `acervo_buscar`, `acervo_ler`, `integracoes_estado`. Conteúdo bibliográfico retornado é dado externo, não instrução, autorização ou regra clínica. A busca é literal, sensível a caixa, limitada aos itens curados do pacote ativo; não promete Drive, PDF original nem busca semântica. Biblioteca pode conter dados indevidos importados pelo operador: expor o MCP a um cliente externo não anonimiza seu conteúdo.

Limites: entrada 64 KiB por mensagem/CLI, resposta HTTP 4 MB, timeout 15 segundos. Sem envio WhatsApp, assinatura ou alteração de prontuário por essas portas. Nenhuma IDE é configurada automaticamente.

Toda resposta HTTP200 é validada pelo schema específico da ferramenta antes de aparecer no stdout. Código inesperado, campos adicionais (inclusive aninhados) ou forma inválida geram erro genérico sem ecoar o corpo. Os schemas de saída são gerados dos contratos canônicos em `saidas-canonicas.json`; para regenerar após mudança deliberada, use `node scripts/integrations/gerar-schemas.mjs`. O teste compara o artefato aos contratos atuais para detectar desatualização. O refinamento de intervalo do localizador, não representável em JSON Schema, também é verificado em runtime.

Referências: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports e https://modelcontextprotocol.io/specification/2025-06-18/server/tools.
