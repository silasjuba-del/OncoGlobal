# F1 — caso-guia sintético e reprodução S12

O caso escolhido e aceito por Silas (decisão 2A) é câncer de cólon metastático, FOLFIRI referido, biomarcadores não disponíveis, diarreia CTCAE grau 2 referida, neutropenia referida sem febre e hemoglobina 8,2 g/dL. A aceitação é do comportamento demonstrado; não é aprovação coletiva de doses, regras ou elegibilidade.

## Entrada e resultado observados

- Fixture: `tests/f0-fecha/fixtures/colon-e2e.ts`. PDF digital de história, imagem PNG da avaliação e PDF bitmap do laboratório são gerados com dados exclusivamente fictícios.
- Servidor: `tests/f1/s12/fixtures/servidor-demo.ts`; HTTP real em loopback, SQLite em arquivo, OCR local e executor de impressão HTML real. Não injeta documentos clínicos prontos nem usa provider externo.
- Navegador: `tests/f1/s12/browser-colon.js`; upload dos três arquivos, conversão PRONTO, vinculação, prévia, seleção e confirmação da revisão, Flash, prévia final e assinatura explícita.
- Diagnóstico e hemoglobina tornam-se dois fatos confirmados com fonte. FOLFIRI, ausência de biomarcadores, diarreia e neutropenia permanecem no texto original incluído por seleção médica; não são convertidos silenciosamente em fatos estruturados.
- Biomarcador ausente não vira negativo, neutropenia sem contagem não recebe grau, quimioterapia não é pré-selecionada para liberação. O grau referido é preservado sem inventar contagem de evacuações.
- Resultado do percurso: três documentos assinados (evolução, retorno pendente e conjunto); impressão HTML executada. A lacuna de prazo permanece visível. O teste não afirma administração de FOLFIRI, papel impresso ou triagem de salão neste percurso de navegador.

## Fixture de retorno documental

`tests/f1/s12/browser-retorno.js` percorre outro paciente sintético: Pantoprazol 40 mg pela manhã por 30 dias, HMG e Cr, retorno em 14 dias. Via e quantidade não informadas permanecem PENDENTE. Foram gerados cinco documentos: evolução, pedido laboratorial com duas solicitações lógicas (HMG e Cr), retorno, receita e conjunto, além de uma tarefa confirmada no ledger.

Contagem explícita: após paciente/encontro já aberto, cinco cliques — abrir Flash, selecionar receita, revisar documentos, confirmar/assinar e reabrir histórico. Login/seleção de paciente ficam fora; existem seis preenchimentos programáticos com `locator.fill`. Não se alega medir esforço total de digitação ou que toda consulta, incluindo digitação e seleção de paciente, exige apenas cinco ações.

## Persistência e desempenho

`tests/f1/s12/browser-reabertura.js` deve ser executado após reiniciar o servidor no mesmo diretório sintético. Reabre os dois pacientes e reimprime a versão 1 do conjunto. A prova exige comparação externa do hash de todas as linhas clínicas e dos HTML antes/depois, além da contagem de documentos e tarefa. Resultados finais estão em `F1-S12-RELATORIO.md`.

`tests/f1/s12/latencias.test.ts` mede HTTP, SQLite em memória, Retrato, sete setores e resumo JSON. `browser-latencias.js` mede seleção de encontro até resumo confirmado visível e duas oportunidades de frame; tela completa exige histórico, controles e estado networkidle. São provas distintas; nenhuma mede streaming LLM ou o instante físico de apresentação do monitor.

## Reprodução local

1. Executar os gates e `npm run ui:build` na versão em revisão.
2. Compilar `tests/f1/s12/fixtures/servidor-demo.ts` com Vite SSR (`configFile:false`, saída `dist/s12-demo/servidor.mjs`). Executar `node dist/s12-demo/servidor.mjs`; o manifesto informa diretório temporário, porta e senha exclusivamente sintética.
3. Executar Vite preview na porta local disponível, com `ONCOGLOBAL_API_PORT` igual à porta da fixture. Abrir `/oncoassist.html` com Playwright CLI.
4. Definir apenas na sessão do navegador `s12KitDir` para o subdiretório `kit` informado no manifesto. Executar `playwright-cli run-code --filename` com os scripts de retorno e cólon. Cada execução exige banco novo; a reabertura usa o mesmo banco.
5. Medir latências; registrar ledger/HTML; enviar `stop` ao servidor; reiniciá-lo passando o mesmo diretório, atualizar a porta do preview e executar o script de reabertura. Comparar hashes.
6. Guardar vídeos, capturas, logs e SQLite em diretório privado, fora da árvore a publicar. Os scripts e fixtures sintéticas são versionados; dados locais e credenciais reais não são.

Prova ao vivo do provider: não executada, dispensada expressamente por Silas neste fechamento. Os testes de contratos, transporte injetado, PHI e idempotência permanecem exigidos.
