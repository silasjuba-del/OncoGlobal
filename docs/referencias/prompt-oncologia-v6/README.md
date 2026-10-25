# Oncologia v6.0 — referência fornecida pelo responsável

Os três documentos desta pasta foram fornecidos pelo Dr. Silas para incorporar o formato de geração de resumo à continuidade do OncoGlobal. As cópias são integrais; os arquivos originais não foram alterados.

- [Prompt completo](SYSTEM-PROMPT-ONCOLOGIA-v6.0.md)
- [Guia de comandos e exemplos](GUIA-RAPIDO-v6.0.md)
- [Auditoria documental e matriz de testes proposta](AUDITORIA-E-TESTES-v6.0.md)

Origem local: `C:/Users/silas/.codex/visualizations/2026/10/25/01a170b3-c42a-73e2-8f4a-5d601d7465cf/prompt-oncologia-v6/`.

| Arquivo | SHA-256 da fonte e da cópia |
|---|---|
| SYSTEM-PROMPT-ONCOLOGIA-v6.0.md | 07d59f7894a82eaf8606a5ec70538c50891f6b4c46b49ef699dbd930384a292c |
| GUIA-RAPIDO-v6.0.md | 3e5a5eefcf9491cdb16ad05f2a6968fdd32473693bff0e387def559549f75d1d |
| AUDITORIA-E-TESTES-v6.0.md | 3f85b2e26a6afd270ef827ddec02c05c11acbc9387218b3110da386327364287 |

## Formato incorporado ao planejamento

```text
/atendimento
Hoje: [somente o que mudou].
Decisão: [conduta explicitamente definida pelo médico].
Saídas: evolução + exames + retorno.
```

Saída enxuta, apenas com os blocos necessários: **AGORA**, **MUDOU**, **PRONTO PARA REVISAR**, **PRECISO DE VOCÊ**, **ESTADO DA ENTREGA**.

Recuperar dados acessíveis antes de perguntar; reutilizar a decisão explícita no mesmo contexto; preservar fonte/data e histórico; solicitar somente lacunas indispensáveis à saída solicitada. Pendência de prescrição não bloqueia resumo independente. Trials e estatística entram somente sob demanda.

Extração não equivale a confirmação médica. A decisão atual informada pode preencher o plano; nenhuma sugestão da IA ganha essa autoria. Não copiar exame físico histórico como atual, inferir dose ou usar resumo inteiro como indicação de todos os exames. Registro assinado não é sobrescrito.

Os dois fluxos de entrada permanecem Drive/documento → app e LLM/skill → resumo secundário → app. A transcrição de PDF por LLM antes da vinculação médica continua permitida quando configurada/autorizada, sempre não verificada. A fila global continua identificada como não pertencente automaticamente à consulta aberta.

## Mapa da integração no código atual

Base conferida: main `effd7636d842712e54762096900e3798c8616c53`.

| Ponto existente | Tratamento necessário para integrar o formato |
|---|---|
| `src/server/extracaoLlm.ts` — `executarSinteseRetratoLlm` | Preservar contexto selecionado, referências reais, snapshot/replay e rascunho inerte. Separar texto médico de hoje/decisão das citações recuperadas; não converter nenhum deles em assinatura ou confirmação global. |
| `src/ui/consulta/SinteseProposta.tsx` | Coletar entrada mínima e saídas, mostrando fonte/data e pendências por documento. Limpar/inutilizar estado ao trocar contexto. Atualmente só apresenta proposta citada; não há suporte aos novos comandos. |
| `src/contracts/api/sinteseProposta.ts` e porta HTTP | Reutilizar contratos de contexto e referências; versionar a extensão de formato. Não substituir `Retrato` ou `ClinicalEvent` pelo YAML conceitual do prompt. |
| `src/kernel/projections/retrato/index.ts` | Fonte existente de recuperação/delta. Usar somente dados efetivamente recuperados e o horizonte do encontro; não simular Drive ou recuperação ausente. |
| `src/modules/documentos/resumoLongitudinal.ts` | Renderizador legado sem consumidor de produção localizado nesta conferência. Hoje tem conduta sempre vazia e trials fixos. Alterá-lo sozinho não integra a jornada usada na interface. |
| Consulta Flash, prescrição, exames e retorno | Reaproveitar a decisão explícita em rascunhos relacionados, preservando os validadores, a ciência de alertas e a assinatura nos fluxos próprios. Comando textual não cria capacidade, ordem ou efeito externo. |

O perfil profissional presente no documento é conteúdo de referência fornecido pelo responsável. Não foi aplicado como configuração do servidor, credencial de sessão, assinatura ou novo default clínico.

## Estado verificável

- Inclusão documental e integridade das cópias: verificadas.
- Integração funcional de Hoje/Decisão/Saídas, resumo/evolução por diferenças e pendências por documento: implementada na branch `codex/resumo-oncologia-v6`; [escopo, provas e limites](../../specs/ATENDIMENTO-V6.md). Preview real solicitado antes de merge.
- Matriz de testes v6.0 completa: proposta, não executada integralmente. As provas da integração atual são registradas separadamente; os checks das PRs #66–68 não substituem essas provas.
- Alegações e referências da auditoria fornecida pertencem à revisão documental de origem; não foram revalidadas clinicamente nesta inclusão.
- A inclusão documental original preservou o produto. A integração posterior está delimitada na especificação acima; corpus, configuração e registros clínicos continuam preservados.

## Continuidade

Revisar a UI e as provas da integração descrita na especificação. Codex é o escritor; revisão independente obrigatória. Preservar os documentos-fonte e não declarar a matriz inteira executada com base em testes de um subconjunto. Novos documentos e cálculos dependem dos respectivos fluxos tipados, fontes e decisões médicas.
