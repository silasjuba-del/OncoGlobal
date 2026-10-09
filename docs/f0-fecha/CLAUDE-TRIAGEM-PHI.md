# Triagem PHI · 35 pendentes da Luna 5 · Claude (auditor cruzado, só leitura) · 2026-10-09

Base: `f0/f0f-luna5@8001655`, `docs/f0-fecha/PHI-TRIAGEM.json` (210 itens; 35 `PENDENTE` + 1 caminho protegido).
Proposta legível por máquina: `docs/f0-fecha/CLAUDE-TRIAGEM-PHI.json` (path, sha256, tipo, linha, ordinal, página, status proposto, motivo, evidência). **É proposta.** Quem aplica ao manifesto, se concordar, é a Astra. Nenhum valor de identificador foi copiado aqui nem no JSON.

## Resultado
**Nenhum dos 35 é dado real de paciente.**

| Status proposto | Itens | Base |
|---|---:|---|
| `synthetic_declared` | 19 | Todos os CPF/CNS com DV válido estão na **allowlist de sintéticos do projeto** (`tests/w11-adv/seguranca-phi.test.ts`). Os demais estão em fixtures de red team ou de teste do algoritmo de CNS, com DV inválido proposital, ou usam domínio reservado (`example.invalid`, `.local`). |
| `technical_token_false_positive` | 13 | Código de saída nativo do Windows em relatório (2), abreviação de commit e contagens no STATUS (1), DOI/PMID/setid em listas de referência (4), nome de arquivo `doc-N@N.html` (4), campo de modelo HTML vazio (1), formulário em branco de manual público (1). |
| `public_contact_metadata` | 3 | Página institucional de manual público (central de relacionamento, ouvidoria e e-mail do hospital editor). |

## Método (sem expor valores)
1. Contexto de cada linha lido com **dígitos mascarados**.
2. Validade de CPF/CNS calculada por script (algoritmo e-SUS/LEDI para CNS; DV padrão para CPF), imprimindo só "VALIDO/DV_INVALIDO".
3. Cada número válido conferido contra a allowlist H30 e contra exemplos públicos clássicos de CPF: todos estão na allowlist; 2 CPFs são exemplos públicos.
4. As 2 páginas de PDF lidas com dígitos mascarados: p.32 do manual de quimioterapia (contatos institucionais) e p.2 do manual do paciente (formulário vazio).

## Recomendações (não bloqueiam)
- **Dar marcador local aos sintéticos de DV válido**, para o scanner não depender da allowlist distante: comentário `// SINTÉTICO: …` na linha, ou trocar por números já usados como sintéticos. Arquivos: `tests/w10-cursor/cadastro.test.ts`, `tests/w10-grok/grok-13-apac-snapshot.test.ts`, `tests/redteam/rt12-harness-gateway.test.ts`, `tests/ui-telas/importar.test.tsx`. Mexer em `tests/redteam/**` é decisão da Astra.
- **Contatos institucionais em PDF público:** manter. O status `public_contact_metadata` já existe no manifesto.

## Fora do alcance do Claude
- `docs/referencias/ui-modelo-consulta.webp` (caminho protegido, `doNotRead`) **continua PENDENTE**. Não foi aberto. Precisa de revisão visual do **Dr. Silas**: é a imagem de referência de layout da consulta (D-W5-07). Basta ele dizer "sem dado de paciente" ou "tem dado".
- O scanner não detecta **nomes** escritos fora de campos rotulados. Esta triagem não afirma que o repositório não tem nomes reais em texto livre.

## Revisão visual do Dr. Silas (2026-10-09)
- `docs/referencias/ui-modelo-consulta.webp`: o Dr. Silas declarou, literalmente, **"SEM DADO DE PACIENTE"** ao responder no chat operacional do Claude. Status proposto: `public_ui_reference_reviewed`, ou o equivalente no manifesto, com `evidenceRef` = esta seção. O Claude não abriu o arquivo. O hash deve ser calculado pela Astra ao aplicar, para que uma mudança futura do arquivo volte a PENDENTE.
