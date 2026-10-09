# Portabilidade e nova revisão PHI

Scanner final: inventário de arquivos publicáveis via Git (rastreados, inclusive sob diretório ignorado, mais não rastreados não ignorados), lendo bytes atuais do checkout. Artefatos ignorados de runtime/build não são superfície publicável. Não se afirma varredura de todo o disco.

`c6c34ab` acrescenta modo opcional `utf8-lf`: UTF-8 estrito, preservando BOM e normalizando somente CRLF para LF. Binários/NUL/UTF-8 inválido não admitem esse modo. SHA bruto continua padrão. `db1c550` verifica realpath e recusa arquivo/junction fora do repositório, antes de ler. Testes negativos cobrem conteúdo alterado, arquivo rastreado ignorado, arquivo local novo, modo inválido e junction real.

O manifesto anterior havia sido triado no worktree com LF. `PROVA-EOL-MANIFESTO.json` registra a comparação: 63 registros textuais mantêm exatamente o SHA aprovado ao normalizar EOL; 38 desses diferiam apenas por CRLF no checkout integrado. Nenhum SHA desses 63 foi atualizado. Um TXT sintético (`tests/fixtures/caso07/03-documentos-pessoais-comprovante.txt`) tinha SHA bruto CRLF aprovado: após confirmar igualdade bruta, foi migrado explicitamente para SHA UTF-8/LF, sem alterar conteúdo. STATUS sofreu alteração real e exige nova revisão de suas ocorrências; não entra na equivalência por EOL.

Nova revisão individual: dois campos SHA do relatório JSON do Claude; quatro exemplos textuais de nome de arquivo desse JSON e um da versão Markdown; dois registros do código nativo de saída do Windows nos logs C1-L1; endereço reservado sintético usado apenas na configuração Git de repositórios temporários do teste do scanner. A classificação não deriva de pasta permitida. Cada ocorrência fica vinculada a tipo, linha, ordinal, contexto, arquivo e SHA no manifesto.

As nove capturas de `demo/` foram geradas pela execução local documentada em `../F0-DEMO.md`, abertas e inspecionadas pela Astra. Paciente Teste 92, médico sintético, textos e valores sintéticos. Revisão por arquivo e SHA; nenhum OCR genérico ou anonimização universal é alegado.

A imagem de referência anteriormente pendente foi confirmada fictícia pelo Dr. Silas e inspecionada, conforme C2-PHI-ASTRA.md. Essa declaração vale para os bytes já registrados no manifesto; qualquer alteração exige nova revisão.
