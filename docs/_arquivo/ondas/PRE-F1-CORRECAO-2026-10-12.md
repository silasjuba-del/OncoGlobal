# Pré-F1: correção conservadora da auditoria

Data: 2026-10-12, America/Sao_Paulo. Executor da correção: Codex.
Pedido atual do Dr. Silas: corrigir com menor dano e desempenho preservado, sem regressão abrangente.

## Base e limites

- Worktree: `C:/Users/silas/Projects/OncoGlobal-wt/pre-f1-higiene`.
- Ramo: `f1/pre-f1-higiene`; base exata: `b5ea715`.
- WIP recebido do Claude: fronteiras, leitura com integridade, remoção de Maestro/ORK e respectivas provas.
- Cópia recuperável do WIP e logs locais: `C:/Users/silas/Projects/OncoGlobal-wt/_pre-f1-evidencias-20261012/`.
- O checkout principal já estava em `2f1e795`, com dois commits posteriores de corpus/documentação. Nenhum arquivo desse checkout foi alterado por esta correção.
- Não alterar regras clínicas, contratos congelados, conteúdo dos packs ou `EstadoApac`. `RASCUNHO` permanece; sua retirada exige outra fatia.
- Esta entrega corrige o pré-F1; não inicia o motor F1 nem constitui aprovação clínica ou merge.

## Diagnóstico reproduzido

| Verificação | Base limpa b5ea715 | WIP recebido |
|---|---|---|
| Matriz F0 | PASS (3 testes) | FAIL (2 testes; Q11/G-15 perderam donos e provas) |
| Scanner PHI | FAIL (16 candidatos em referências bibliográficas) | Mesmos 16, mais 3 divergências entre índice e arquivos modificados |
| Fronteiras | FAIL (tetosCumulativos importa cumulativoAlerta) | PASS com 54 exceções declaradas |

A falha PHI não foi causada pelo teste novo nem por arquivos faltando no inventário. A varredura já cobre arquivos não rastreados. Ela também exige que o índice corresponda aos bytes examinados; por isso os caminhos finais são adicionados explicitamente ao índice antes do verify.

## Correção escolhida

1. Restaurados da base os três arquivos de Maestro/ORK/tipos, seis arquivos de testes removidos e o percurso E2E original. A matriz e seus critérios permanecem inalterados; Q11 e G-15 não são adiados ou reclassificados.
2. Mantidas as novas fronteiras e as 54 exceções por arquivo/import, com prazo declarado `F1-S3`. Preservadas também as regras anteriores de isolamento entre agentes e entre harness/agentes. O scanner rejeita exceções sem prazo ou não utilizadas; a expiração por fase ainda requer acompanhamento no marco F1-S3.
3. A leitura do ledger separa eventos válidos de pendências de JSON/contrato. A consulta reaproveita a mesma leitura para projetar dados e apresentar as pendências, evitando a segunda consulta/validação/ordenação integral introduzida no WIP.
4. A pendência do paciente aparece na resposta HTTP, em `pendenciasLeitura` e no contador do cabeçalho, sem divulgar payload corrompido nem pendências de outro paciente. O ledger persistido não é apagado ou reparado automaticamente.
5. `modules/apac` e `modules/canal` permanecem, assim como suas regras e testes.

## Triagem PHI vinculada ao conteúdo

Revisão local de 16 candidatos `telefone`, presentes em 10 arquivos da base. Todos estão integralmente dentro de UUIDs `set_id`/`setid` de referências DailyMed/openFDA. A inspeção conferiu cada linha e verificou que remover somente o UUID da linha elimina o candidato, enquanto escanear o UUID isolado o reproduz. Isso classifica o token técnico; não valida o conteúdo clínico da referência.

| Arquivo relativo | Linhas revisadas |
|---|---|
| corpus/2-receitas/suporte/receitas-suporte-oncologico.v1.RASCUNHO.json | 1658 |
| corpus/4-interacoes-contraindicacoes/contraindicacoes-complemento.v1.RASCUNHO.json | 137 |
| corpus/4-interacoes-contraindicacoes/contraindicacoes-complemento.v2.RASCUNHO.json | 197 |
| corpus/4-interacoes-contraindicacoes/interacoes-complemento.v1.RASCUNHO.json | 318 |
| corpus/4-interacoes-contraindicacoes/interacoes-complemento.v2.RASCUNHO.json | 479 |
| corpus/5-ctcae-acao/ctcae-acao.v2.RASCUNHO.json | 970, 989, 1143, 1163, 1183, 1202 |
| corpus/6-pack-tumor/adrenal/pack-adrenal.v2.RASCUNHO.json | 707 |
| corpus/6-pack-tumor/sarcomas/pack-sarcomas.v2.RASCUNHO.json | 2479 |
| corpus/6-pack-tumor/tireoide/pack-tireoide.v2.RASCUNHO.json | 1395 |
| docs/ondas/F1-CORPUS-BUSCAS-CONSOLIDADAS.md | 47, 65 |

Adicionadas disposições em `docs/f0-fecha/PHI-TRIAGEM.json`, vinculadas a caminho, SHA-256 (UTF-8/LF), tipo, linha e ordinal. Scanner, critérios de aprovação e demais disposições inalterados. Alterações posteriores dos packs invalidam esses hashes; é obrigatório rever os achados na integração, sem atualizar hashes automaticamente.

## Validação

- Foco inicial após a correção: PASS, 24 testes em 6 arquivos (integridade, fronteiras, Maestro/ORK, matriz e E2E).
- `npm run verify`: PASS; typecheck, fronteiras (322 arquivos), corpus (209 arquivos) e 2.748 testes em 368 arquivos. Suíte regular em 631,54 s. Log: `verify-final.log` na pasta local de evidências.
- Provas adversariais W10: PASS, 240 testes em 31 arquivos, 14,34 s; log `adversarial-w10.log`.
- Provas adversariais W8: PASS, 41 testes em 9 arquivos, 3,15 s; log `adversarial-w8.log`. As contagens adversariais são baterias separadas, não uma soma de testes únicos à suíte regular.
- Matriz F0: 290 linhas/290 requeridas, 184 verdes, 106 não aplicáveis, zero vermelhas e zero erros. Q11/G-15 preservados com suas provas originais.
- Scanner PHI completo após a triagem: zero achados, zero pendências e zero arquivos sem varredura (execução direta adicional em 16,46 s).
- Desempenho: teste HTTP prova uma única leitura integral de `clinical_event` por consulta. Não é um benchmark de latência nem evidência de ganho global.
- Publicação, revisão independente, merge e início da F1: não executados nesta correção local.
