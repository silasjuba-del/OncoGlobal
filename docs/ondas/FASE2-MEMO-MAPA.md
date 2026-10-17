# Fase 2 — mapa do memo OncoGlobal-F1

Este mapa torna explícita a correspondência entre o memo de curadoria solicitado e o corpus já versionado. Ele não move, exclui, desativa ou altera protocolos.

| Setor do memo | Cobertura técnica atual | Regra de uso na Fase 2 |
| --- | --- | --- |
| `00-INDICE-MESTRE` | índices e catálogos do corpus | leitura e rastreabilidade |
| `01-EXAMES` | investigação mínima, exames e leituras | proposta documental; requer revisão clínica |
| `02-RECEITAS-E-FARMACOS` | cálculos, receitas e farmacologia | rascunho e assinatura já governados |
| `03-LAUDOS` | documentos clínicos e administrativos | rascunho, conteúdo visível e confirmação |
| `04-INTERACOES-E-CONTRAINDICACOES` | regras e sinais de alerta | alerta preservado; não decide conduta |
| `05-CTCAE-E-ACOES` | CTCAE e ações propostas | exibe fonte e mantém decisão médica |
| `06-PACKS-DE-TUMOR` | `TumorPackExtract` e catálogo documental | todos os blocos são preservados; adaptação não ativa conteúdo |
| `07-ORIENTACOES` | documentos manuais e orientações | rascunho revisável antes de assinatura |
| `08-ENCAMINHAMENTOS` | documentos manuais de encaminhamento | exige destino e conteúdo antes de preparar assinatura |
| `_TRANSVERSAL`, `_MAPA`, `_CURADORIA`, `_FONTES` | fontes, hashes, estado de revisão e esta documentação | proveniência obrigatória; pendências ficam `A CONFERIR` |
| `_SCHEMA`, `_CONTRATO` | contratos TypeScript/Zod e rotas HTTP | validação técnica sem inferência clínica |
| `_PENDENCIAS`, `_ENTRADA`, `_AUDITORIA`, `_PACOTE` | pendências médicas, ingestão local, evidências e pacote | fechamento técnico separado de aprovação clínica |

## Garantia de preservação

O adaptador de packs guarda os blocos literais — inclusive `tratamento.protocolos` — no extrato documental. Ausência de referência não é critério de remoção. Conteúdo só pode passar a ativo após revisão e aprovação médica explícitas, com hash do original e hash da extração conferidos.
