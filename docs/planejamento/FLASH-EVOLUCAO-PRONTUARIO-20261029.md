# Flash, evolução e prontuário — fechamento integrado

Autorização: pedido de Silas em 29/10/2026. Base origin/main e otimização local 29e247c1 preservada por cherry-pick. Writer único: Codex. Worktree isolado; main e PRs 76/78 preservados.

## Lote e aceite
- Preservar Tumor Pack integral e carregar detalhes sob demanda.
- Incorporar na Flash a evolução V6 salva, por escolha médica explícita, referência imutável, mesma identidade/encontro/lote e texto resolvido no servidor.
- Preservar fontes, autoria, data clínica, ausência e pendências. Evolução desatualizada não pode ser incorporada nem assinada silenciosamente.
- Revisar os documentos, assinar pelo gateway existente e recuperar no histórico; replay não duplica documentos.
- Exibir informações disponíveis e os limites da decisão de ciclo; APAC e prescrição permanecem atos próprios.
- Provar HTTP/SQLite, UI, concorrência e reabertura, tipos, fronteiras, corpus e build.

WRITE_SET: contratos Flash, servidor Flash/atendimento/confirmacao/prescricaoFlash, componentes Flash e suas duas composições, apresentação JEV/lacunas, testes relacionados e workflow de verificação e este registro. Sem corpus clínico novo, dependências novas, merge ou deploy.

## Estado
Implementação em andamento. Lacuna confirmada: evolução V6 salva não alimentava o documento Flash.

## Verificação em andamento
- HTTP/SQLite: 3 testes novos aprovados, incluindo reinício, replay, versão alterada e referência adulterada.
- UI: 3 testes novos e 3 existentes aprovados; revisão explícita, ausência de inclusão automática, versão desatualizada e falha de rede.
- Chromium: primeira execução completa aprovada em desktop e mobile, com reinício real; inspeção visual motivou alargar o prontuário e recolher a lista duplicada de lacunas.
- A bateria Windows em forks não retornou resultados e foi encerrada apenas nos processos desta tarefa; reexecuções com threads. Não se alterou a configuração do projeto para mascarar isso.
- Tipos, fronteiras (591 arquivos), corpus (241 arquivos) e build passaram antes da última revisão visual; gates finais em curso.

## Entrega técnica
- Evolução escolhida por referência id/versão/hash. Texto vem da versão persistida, com autoria e data; confirmação revalida versão/base uma vez por referência no conjunto.
- Documento assinado preserva vínculo com a evolução; fontes e texto integral continuam recuperáveis no histórico. Assinatura não equivale a administração.
- Fluxo direto Atendimento → Flash; ambas as apresentações Flash podem recuperar a evolução. Rascunho mantém a referência após recarregar.
- Tumor Pack integral preservado, otimização anterior incorporada na branch isolada. PRs 76/78 não foram integrados nem alterados.
- Layout: prontuário largo, ações antes do histórico, lacunas expansíveis, selects e captura sem transbordamento mobile. Evolução escolhida recolhe seu texto sem apagá-lo.

Provas finais locais: 315 testes da bateria focada (31 arquivos; um teste de quantidade de grupos foi atualizado e os sete testes do arquivo passaram na reexecução). Bateria de eficiência/S9: 76 testes passaram; dois seletores antigos de “Liberar ciclo” foram corrigidos e os três testes do arquivo passaram. Chromium aprovou desktop 1440×1000 e mobile 390×844, assinatura, reabertura após reinício do SQLite e ausência de overflow mobile. Evidências sintéticas: `flash-evolucao-sintetica-8zcykU/resultado.json` no diretório temporário local. Tipos, fronteiras, corpus e build aprovados. CI integral e adversarial devem ser observadas no PR; nenhuma aprovação clínica, merge ou produção foi realizada.

Uso: Síntese proposta → preencher Hoje/Decisão → Preparar rascunhos → Continuar na Flash → Conferir evolução salva → Incluir esta evolução → selecionar atos → Revisar documentos para assinatura → Confirmar e assinar conteúdo exibido → Histórico. Uma evolução pendente/desatualizada exige revisão na origem; a consulta e os demais atos permanecem acessíveis.
