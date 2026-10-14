# Referências arquiteturais externas — fichas de decisão (D-F1-22)

Regra (D-F1-22): Medplum, OpenMRS ESM, CARE, Bahmni e FHIR Clinical Reasoning são **referências de padrão**, nunca
dependência, domínio, banco ou fluxo importado. O OncoGlobal mantém modelo interno próprio (kernel, ledger, contratos Zod).
Nenhuma ficha abaixo autoriza código: cada ADOTAR/ADAPTAR vira fatia própria com quadro de 7 blocos aprovado
(feedback "plano antes da fase") e o teste listado.

Invariantes que toda adaptação preserva: identidade canônica do paciente; longitudinalidade; proveniência
(`fontes[]`, `sourceId`, `contentHash`); estados explícitos (tabela v2, teto 5); auditoria/ledger append-only;
separação extração → regra → minuta → decisão; autoridade médica (só o médico assina); TypeScript + React + Zod.

---

## 1. Rastreio regra → fonte → versão → resultado
- **PADRÃO:** resultado de regra carrega a regra aplicada, sua versão e as evidências usadas (GuidanceResponse/`evaluatedResource` do FHIR CR).
- **FONTE:** FHIR Clinical Reasoning.
- **CAPACIDADE REUTILIZÁVEL:** todo achado de setor explica "por quê" com referência verificável.
- **LOCAL NO ONCOGLOBAL:** `src/modules/setores` (AchadosSetor: `regras[]`, `fatos[]`, `referencia`), `src/rules/*`.
- **CONTRATO AFETADO:** `contracts/f1/achadosSetor.ts`, `VersaoReferencia` (já existem; sem mudança de forma).
- **RISCO DE ACOPLAMENTO:** baixo (só conceito).
- **RISCO CLÍNICO:** baixo; reduz achado sem justificativa.
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADOTAR (já é o desenho atual; vira invariante explícito).
- **JUSTIFICATIVA:** o kernel já liga achado a `regra.referencia` e `fatos[].ref`; formalizar evita regressão.
- **TESTE NECESSÁRIO:** gate adversarial: todo achado VERDE/VERMELHO tem `regras[]` com id+versão+hash e ≥ 1 `fatos[].ref` existente no Retrato.

## 2. Critérios de elegibilidade computáveis
- **PADRÃO:** elegibilidade expressa como critérios com estado por critério (atende / não atende / dado ausente), nunca booleano único.
- **FONTE:** FHIR CR (PlanDefinition/`condition`, CQL como ideia, não como motor).
- **CAPACIDADE REUTILIZÁVEL:** semáforo de ciclo com motivo por critério.
- **LOCAL NO ONCOGLOBAL:** `src/rules/elegibilidadeCiclo.ts`, `src/server/f0c/avaliacaoConsulta.ts`.
- **CONTRATO AFETADO:** `SinalElegibilidade` (já tem `motivos[]`).
- **RISCO DE ACOPLAMENTO:** médio se adotar CQL/motor FHIR → rejeitado; baixo como padrão.
- **RISCO CLÍNICO:** médio: critério mal codificado gera falso VERDE. Mitiga: ausente nunca é VERDE.
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADAPTAR (padrão sim; CQL/motor externo não — cálculos determinísticos e offline em TS).
- **JUSTIFICATIVA:** coerente com "LLM só para cognição" e regras puras já existentes.
- **TESTE NECESSÁRIO:** tabela de critérios × {presente, ausente, conflito, vencido}: nenhum caminho com dado ausente produz VERDE.

## 3. Plano / recomendação como proposta, não ordem
- **PADRÃO:** recomendação nasce como proposta (`RequestGroup` com `intent=proposal`) e só vira ordem após decisão humana.
- **FONTE:** FHIR CR.
- **CAPACIDADE REUTILIZÁVEL:** separação minuta × decisão assinada.
- **LOCAL NO ONCOGLOBAL:** `PrescricaoProposta` (proposta), comando `ConfirmarBloco` (`src/server/rotas.ts`) que produz o documento ASSINADO, Flash (`src/server/flash.ts`).
- **CONTRATO AFETADO:** nenhum novo; reforça estados Revisão (RAW→ASSINADO). `ActionIntent` não participa: ele cobre ações externas (imprimir, enviar, exportar).
- **RISCO DE ACOPLAMENTO:** baixo.
- **RISCO CLÍNICO:** baixo; protege autoridade médica.
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADOTAR (como invariante já vigente).
- **JUSTIFICATIVA:** idêntico ao par `PrescricaoProposta` → `ConfirmarBloco` com assinatura médica.
- **TESTE NECESSÁRIO:** nenhuma rota cria evento ASSINADO fora de `ConfirmarBloco` com sessão médica válida e referência de assinatura (já coberto em W10/W8; manter no gate).

## 4. Módulos independentes por capacidade clínica (micro-frontends)
- **PADRÃO:** app composto por módulos com fronteira própria, registrados num shell; telas montadas por capacidade.
- **FONTE:** OpenMRS ESM.
- **CAPACIDADE REUTILIZÁVEL:** setores do software isolados, paciente integrado (D-F1-18).
- **LOCAL NO ONCOGLOBAL:** `src/ui/*`, `src/modules/*`, `scripts/check-boundaries.mjs`.
- **CONTRATO AFETADO:** nenhum; fronteiras já checadas por script.
- **RISCO DE ACOPLAMENTO:** alto se importar o framework ESM/single-spa → rejeitado; baixo como padrão.
- **RISCO CLÍNICO:** baixo.
- **RISCO OPERACIONAL:** médio (micro-frontend real aumenta build/deploy para app monousuário local-first).
- **DECISÃO:** ADAPTAR (fronteira de módulo + registro de capacidades no monólito modular; sem runtime de micro-frontend).
- **JUSTIFICATIVA:** monólito modular Node/TS decidido (Q7); D-F1-18 pede setores profundos e paciente único.
- **TESTE NECESSÁRIO:** `check:boundaries` falha se módulo de setor importar outro setor fora do contrato.

## 5. Carregamento incremental de funcionalidade
- **PADRÃO:** capacidade liga/desliga por configuração, com estado explícito quando ausente.
- **FONTE:** OpenMRS ESM (feature flags/extension slots).
- **CAPACIDADE REUTILIZÁVEL:** OCR, LLM, APAC entram sem quebrar o resto.
- **LOCAL NO ONCOGLOBAL:** `status()` PENDENTE/DISPONIVEL em `src/kernel/llm/openai`, OCR local.
- **CONTRATO AFETADO:** nenhum.
- **RISCO DE ACOPLAMENTO:** baixo.
- **RISCO CLÍNICO:** baixo, desde que desligado = PENDENTE visível (nunca silencioso).
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADOTAR (padrão já em uso; padronizar códigos de status).
- **TESTE NECESSÁRIO:** cada capacidade desligada devolve código PENDENTE estável e não emite egresso.

## 6. SDK tipado e contratos de integração
- **PADRÃO:** cliente tipado único compartilhado entre front, back e agentes; recursos versionados.
- **FONTE:** Medplum (SDK TS).
- **CAPACIDADE REUTILIZÁVEL:** porta de API única, validada.
- **LOCAL NO ONCOGLOBAL:** `src/contracts/api/porta.ts`, `src/ui/api/http.ts`, Zod compartilhado (Q6).
- **CONTRATO AFETADO:** `porta.ts` (sem mudança de forma).
- **RISCO DE ACOPLAMENTO:** alto se usar o SDK/servidor Medplum (FHIR como modelo) → rejeitado.
- **RISCO CLÍNICO:** baixo.
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADAPTAR (padrão "um cliente tipado"; sem dependência Medplum).
- **TESTE NECESSÁRIO:** paridade `fake.ts` × `http.ts` × rotas: toda rota tem schema Zod de entrada e saída.

## 7. Recursos clínicos modulares em FHIR como modelo de dados
- **PADRÃO:** persistir o domínio como recursos FHIR.
- **FONTE:** Medplum / FHIR.
- **DECISÃO:** REJEITAR.
- **JUSTIFICATIVA:** regra obrigatória: kernel, contratos e ledger não são substituídos por FHIR. FHIR fica, no máximo, como
  formato de exportação futuro, mapeado a partir do modelo canônico (fatia própria, se houver demanda).
- **TESTE NECESSÁRIO:** nenhum (não implementado).

## 8. Jornadas clínicas compostas e componentes assistenciais reutilizáveis
- **PADRÃO:** jornada (consulta, triagem, administração) composta de componentes React reutilizáveis com estado explícito.
- **FONTE:** CARE (React + TS).
- **CAPACIDADE REUTILIZÁVEL:** componentes de revisão "1 clique por bloco" (Q17, L10).
- **LOCAL NO ONCOGLOBAL:** `src/ui/consulta`, `src/ui/telas`.
- **CONTRATO AFETADO:** nenhum.
- **RISCO DE ACOPLAMENTO:** baixo (sem código copiado; licença a conferir antes de qualquer trecho).
- **RISCO CLÍNICO:** baixo.
- **RISCO OPERACIONAL:** baixo.
- **DECISÃO:** ADAPTAR (inspiração de composição; código próprio).
- **TESTE NECESSÁRIO:** testes de UI da jornada: ≤ 5 cliques no retorno de rotina (Q18) e "validar tudo" bloqueado com VERMELHO.

## 9. Atendimento → farmácia → dispensação; organização por setores
- **PADRÃO:** ordem médica assinada gera tarefa de farmácia/dispensação rastreável, por setor.
- **FONTE:** Bahmni.
- **CAPACIDADE REUTILIZÁVEL:** fila da farmácia (estado Farmácia 4) e salão de QT ligados à prescrição assinada.
- **LOCAL NO ONCOGLOBAL:** salão (`lerSalao`), tarefas de retorno S9, futura fila de farmácia.
- **CONTRATO AFETADO:** futuro contrato de tarefa de farmácia (fora da F1).
- **RISCO DE ACOPLAMENTO:** alto se integrar OpenERP/Odoo do Bahmni → rejeitado; baixo como padrão.
- **RISCO CLÍNICO:** médio (dispensação errada). Mitiga: tarefa só nasce de documento ASSINADO.
- **RISCO OPERACIONAL:** médio (setores ainda não ativos; v1 monousuário).
- **DECISÃO:** ADAPTAR, adiado para fase de setores (pós-F1).
- **TESTE NECESSÁRIO:** tarefa de farmácia nunca nasce de minuta; cancelamento da prescrição propaga para a fila.

---

## Rejeições gerais
- Importar banco, domínio ou fluxos completos de OpenMRS, Bahmni, Medplum ou CARE.
- Usar CQL/motor FHIR como executor de regras (regras ficam TS puro, determinísticas, offline).
- Acoplamento de runtime (SDK, servidor, micro-frontend framework) com qualquer um dos projetos.
