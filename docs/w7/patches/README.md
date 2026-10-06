# Integração proposta

`comando-estudio.patch` adiciona somente o atalho `npm run estudio`. Não foi aplicado: `package.json` é de outra faixa. A aplicação já inicia com `node scripts/iniciar.mjs`.

A interface desta entrega é uma raiz de composição local em `src/app/estudio`, sem editar ou substituir `src/ui/App.tsx`, `src/ui/telas` ou `src/ui/api`. O Cursor pode adaptar sua porta aos serviços de `src/app/pesquisa`, mantendo os tipos canônicos sob autoridade do tech lead. Não publicar resultados de pesquisa como fatos confirmados por mero cast.

Integrações dependentes que não são satisfeitas por um patch de import: leitor de fatos confirmados do ledger com escopo paciente/lote, gate de desidentificação para extração documental por LLM, fornecedor LLM validado, extrator PDF/OCR e assinatura clínica vinculada ao conteúdo/versão. As capacidades permanecem desabilitadas ou manuais até essas integrações.
