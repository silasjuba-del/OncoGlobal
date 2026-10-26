# Ponte documental PDFForge

Esta pasta contém a ponte revisável; não incorpora o app Electron inteiro nem muda suas dependências. O original PDFForge sem Git foi preservado. A cópia de teste local está no diretório de coordenação indicado no plano M123.

## Reproduzir sobre uma cópia

```powershell
node integrations/pdfforge/aplicar-ponte.mjs <copia-pdfforge> --check
node integrations/pdfforge/aplicar-ponte.mjs <copia-pdfforge>
```

O aplicador exige hashes exatos dos cinco arquivos originais, valida todas as alterações antes de escrever, recusa links/junctions e preserva backups `.antes-oncoglobal`. Arquivo divergente ou novo arquivo preexistente diferente interrompe a aplicação. Ele não deve ser aplicado à pasta de trabalho alheia sem conferir sua origem. Reaplicar sobre os mesmos arquivos já modificados é idempotente.

## Fluxo

No visualizador/editor desktop, preencher o autor declarado e escolher **Enviar ao OncoGlobal — pacote local**. O processo principal confere a origem IPC, constrói `oncoglobal.import.v1` e salva na pasta `oncoglobal-export` do userData local, com nome opaco. O texto exibido informa o caminho. O pacote contém o documento original, não uma versão anonimizada; não enviá-lo a serviços externos.

No OncoGlobal, entrar, selecionar o encontro em Agenda e pacientes, abrir Documentos e PDF e importar o `.oncoglobal.json`. O paciente é o contexto autenticado; o pacote não pode determiná-lo. O documento entra recebido e não revisado. Conferir vínculo, páginas e extração no percurso existente antes de promover qualquer fato.

O editor pode incluir um PDF derivado com hash próprio e referência ao hash original. Anotações IA/usuário e páginas extraídas são auxiliares de revisão, não substituem o original nem comprovam autoria clínica. Exportação não chama LLM, não leva token/senha do OncoGlobal e não assina.

## Limites

- PDF v1; original mais derivado até 8 MiB; envelope HTTP até 13 MiB.
- Exportar novamente cria novo pacote; reimportar o mesmo arquivo é replay. Mesmo ID com conteúdo/metadados divergentes é recusado.
- PDF protegido/ilegível pode permanecer pendente de leitura local. Whiteout/corretor visual não é desidentificação.
- A ponte não habilita as capacidades de nuvem/sites/plugins existentes no PDFForge. A adoção do app inteiro e a atualização de Electron/React/Vite/pdf.js continuam fora desta integração documental.
- Os modelos de extração em nuvem do OncoGlobal continuam sob a política vigente. O assistente novo configura somente endpoint local permitido.

## Provas

`tests/medico-m123/documental/exportador.test.ts` confronta o exporter real com o schema do importador. `npm run test:medico-m123` usa esse mesmo exporter e a interface real até persistência, assinatura e reabertura. `smoke-ponte.cjs` testa o botão/IPC em Electron real com userData temporário sintético; executar com o binário Electron da cópia e o caminho da cópia como argumento, depois do build. Não usa chaves de produção.

Em 26/10/2026, build da cópia e jornada Chromium do OncoGlobal passaram. O smoke nativo Electron **não passou** neste Windows: crash do processo GPU e timeout na tentativa sem aceleração. O teste IPC automatizado simula a API Electron e usa filesystem/exporter reais; não substitui a validação do botão no desktop. Essa validação continua pendente antes de declarar a ponte desktop operacional.
