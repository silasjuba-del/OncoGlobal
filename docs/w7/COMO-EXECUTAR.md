# Cockpit, Oncoboard e pesquisa clínica local

Implementação da extensão pedida pelo Dr. Silas, no worktree `w7-codex`, branch `f0/w7-codex`. Mantém três áreas: hospital à esquerda, tags do paciente no topo e ferramentas de apoio à direita. Nenhuma prescrição identificada do protótipo anterior foi incorporada ao repo.

## Iniciar

Requisitos já definidos pelo repo: Node 24+ e dependências do lockfile instaladas.

```powershell
# Defina sua senha apenas no ambiente do processo. Não a grave no Git.
$env:ONCOGLOBAL_SENHA = Read-Host 'Senha local (mínimo 12 caracteres)' -MaskInput
$env:ONCOGLOBAL_MEDICO_ID = 'seu-identificador-local'
$env:ONCOGLOBAL_CRM = 'seu-CRM'
node scripts/iniciar.mjs --data-dir 'C:\OncoGlobalDados' --port 4180
```

O comando compila a composição e imprime o endereço local. A senha não é persistida. O processo aceita exclusivamente `127.0.0.1`. Fechar e abrir novamente com o mesmo `dataDir` recupera workspace, versões, histórico e idempotência. Informe novamente a senha para uma nova sessão.

## Exercitar pesquisa clínica

1. Abra Pesquisa clínica e incorpore `docs/w7/exemplo-estudo.json` para um teste sem dados reais. TXT/MD também podem conter título e seções Braços, Inclusão, Exclusão e Desfechos.
2. Confira o original, SHA-256 e localizadores. A extração local produz candidatos; não declara que houve chamada a IA.
3. Revise cada critério. Para o exemplo, mapeie inclusão como texto `marcador = presente` e exclusão como texto `impedimento = presente`. Grupos AND/OR e não aplicabilidade são decisões explícitas; sem mapeamento permanece PENDENTE.
4. Confirme a versão do estudo. Adicione os dados do paciente com referência, data e revisão. No exemplo, marcador `presente` e impedimento `ausente` produzem `POSSIBLE_MATCH`, não elegibilidade.
5. Cadastre a alocação documentada ao braço, com data/fonte. Somente então registre toxicidade, evento, imagem seriada ou resposta informada. Atribuições diferentes no mesmo dia não se sobrescrevem.
6. Use paciente novo ou já em tratamento. A situação não substitui os critérios de linha, washout ou protocolo. Pacientes têm fatos e seguimentos separados.

Anexos complementares ficam vinculados ao estudo sem reescrever critérios aprovados. PDFs/DOCX/imagens são guardados localmente como binários com SHA-256, sem OCR. Para utilizá-los em critérios, incorpore a transcrição textual e revise suas fontes. Entradas rejeitadas por validação ficam disponíveis em **Entradas locais preservadas**, como RAW; não viram fatos.

## Oncoboard

As três personas são **oncologista clínico**, **cirurgião oncológico** e **radioterapeuta**. Cada prompt tem 24 instruções específicas e formato de resposta com fontes. O adapter permanece desligado por padrão. Notas manuais não são apresentadas como pareceres da IA.

O adapter de extração de estudo não recebe documentos enquanto faltar o gate DLP validado. Não há fornecedor LLM nem credencial selecionados neste pedido. O conteúdo integra somente o workspace após revisão explícita; nada é assinado nem promovido automaticamente ao ledger clínico.

## Kit e APAC

- Cinco templates com texto médico literal e página física do PDF de origem, sem correção automática de acentuação.
- Receita: seleção de IDs dos itens do template; dose e orientação não vêm de texto alterável da UI.
- Exames: grade de ciclos 1–4, datas e exames adicionais livres.
- Pericial: prazo e início dependem de campos médicos; ausência aparece como PENDENTE.
- APAC: estrutura de blocos do formulário, CNES/SIGTAP a verificar, diagnóstico/CIDs apenas por metadados de lote confirmado, autorização/validade vazias.
- Rascunho não assinado é visualizável com marca d'água, mas não emitido pelo executor.
- Modelo em branco é identificado e pode passar pelo Gateway, seguido do clique no documento que abre `window.print()`. A escolha da impressora é feita no diálogo do sistema. A preferência local não implica impressão silenciosa.

## Limites de integração

Esta composição mantém o workspace de pesquisa separado do prontuário canônico. A coleta automática de fatos do ledger, o shell/API da faixa Cursor, a assinatura clínica real, o provedor LLM/OCR, o layout de exportação SIA e a validação institucional do APAC permanecem dependências explícitas. Não foram alterados contratos, regras clínicas, componentes existentes nem a faixa Fugu/Cursor. O patch opcional em `patches/` apenas adiciona um comando de inicialização ao package.json; não foi aplicado.

## Verificação

```powershell
npm run verify -- -- --no-file-parallelism
node node_modules/vite/bin/vite.js build --config src/app/vite-estudio.config.ts
```

Saída integral da verificação em `VERIFY-FINAL.txt`. O roteiro de navegador `fluxo-browser.js` registra o teste de upload, critérios, matriz, braço, imagem seriada, receita selecionável e prévia APAC. Ele é executado com Playwright CLI após login, em workspace apenas sintético.
