# Arquivos externos preservados

Os dois PDFs de orientação anteriormente guardados nesta pasta foram retirados da árvore ativa na limpeza não clínica de 24/10/2026. Nenhum texto clínico derivado, regra, dose, decisão ou documento do corpus foi alterado.

Os originais estão identificados por caminho, tamanho, blob Git e SHA-256 em [NAO-CLINICO-20261024.json](../../_arquivo/NAO-CLINICO-20261024.json). A cópia local completa foi conferida antes da retirada. A recuperação por Git exige os objetos do histórico original; um clone raso pode precisar do histórico completo.

Para recuperar todos os arquivos exportados em uma pasta nova, fora do checkout:

```powershell
node scripts/restaurar-nao-clinico.mjs --destino 'C:\Users\silas\Documents\OncoGlobal-referencias-recuperadas'
```

Também é possível acrescentar ao comando os caminhos exatos dos PDFs inventariados para recuperar somente esses documentos. O comando verifica bytes e SHA-256 antes de publicar a pasta, não sobrescreve destinos existentes e não faz download nem modifica o checkout.

Os documentos de ideias e a fonte de prescrição por toxicidade permanecem nos caminhos atuais. Esta última continua consumida pelos testes; não foi tratada como duplicata descartável.
