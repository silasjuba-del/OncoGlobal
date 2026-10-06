# W9-CODEX · 10 FATIAS · gates G-07, G-08, G-09, G-27 + correção sistemática

> Leia primeiro `docs/ondas/W9-COMUM.md`. EXECUTOR = `CODEX` (modelo `gpt-5.5`). Worktree `...\OncoGlobal-wt\w9-codex` · branch `f0/w9-codex`.
> Alvo: `tests/adv-w8/{g07-t49-lateralidade,g08-t50-anatomia-sexo,g09-t51-ptnm-biopsia,g27-saida-externa-limpa}.adv.ts` ficam verdes sem tocar nas expectativas. Estilo dos gates: ver `src/kernel/harness/gates.ts` (funções puras, `Veredito` com `gate/decisao/motivo`).
> Regra de ouro dos gates: **ausente ⇒ PENDENTE/ALERTA, nunca PASSA silencioso**. O app alerta e nunca bloqueia o clínico; só bloqueiam artefato, saída externa de PHI e autoridade de IA. Divergência de lateralidade = ALERTA + revisão humana obrigatória, não veto.

## CODEX-01 · G-07 lateralidade (T-49)
Leia `g07-t49-lateralidade.adv.ts` e implemente o gate em `gates.ts` com o nome/assinatura que o teste importa. Confronto PATH × RADS × procedimento × diagnóstico: divergência ⇒ ALERTA com revisão obrigatória; lateralidade ausente em qualquer fonte ⇒ PENDENTE; concordância plena ⇒ PASSA. Domínio de lateralidades válidas por órgão = `[VERIFICAR]` (pedido ao Dr. Silas).

## CODEX-02 · G-08 anatomia × sexo (T-50)
Próstata × cadastro F ⇒ revisão de identidade/anatomia (nunca veto automático); mama × M ⇒ simetria; `NAO_INFORMADO` ⇒ PENDENTE; coerente ⇒ PASSA. Tabela anatomia×sexo = `[VERIFICAR]`, lida de constante isolada em arquivo próprio para curadoria.

## CODEX-03 · G-09 pTNM exige ressecção + TNM explícito (T-51)
pT vindo de BIOPSIA ⇒ rejeita o campo (nunca preenche por regra); pT de ressecção cirúrgica com TNM explícito ⇒ PASSA; cT de biópsia ⇒ PASSA (a regra só veta o prefixo p); ressecção sem TNM explícito ⇒ PENDENTE.

## CODEX-04 · G-27 sanitizador de artefato
`src/kernel/llm/sanitizador.ts` (nome conforme o teste): remove metadado de autor/paciente de PDF e emite `SanitizationReport` (contrato existente; não alterar) com risco. Puro, sem dependência nova; formatos além do que o contrato/teste exigem (DICOM, pixel) ficam como `[VERIFICAR]` explícito, não fingidos.

## CODEX-05 · G-27 gate de saída externa limpa
Em `gates.ts`: artefato a caminho de serviço externo com metadado de identificação ⇒ `BLOQUEIA_SAIDA` (HALTED); sanitizado (risco BAIXO) + relatório válido ⇒ PASSA; sem relatório ⇒ PENDENTE/bloqueio, nunca PASSA. Convive com G-02. Não reabra egress: `src/server/autorizacao.ts` continua recusando canais externos.

## CODEX-06 · Ligar os gates ao caminho real
Em `src/app/**` (só ligação): os 4 gates rodam onde os dados entram (cadastro/extração/consolidação) e onde a saída sai (Action Gateway). Resultado vira alerta/pendência na projeção, **nunca** trava salvar rascunho. Teste ponta a ponta com Paciente Teste NN.

## CODEX-07 · Correção sistemática A · "PASSA silencioso"
Varra `gates.ts` e consumidores: qualquer gate/função que devolva PASSA/VERDE com entrada ausente, vazia, `NAO_INFORMADO` ou desconhecida. Para cada achado: teste que reprova primeiro (em `tests/w9-codex/`), depois a correção. Relatório com tabela arquivo:linha → antes/depois.

## CODEX-08 · Correção sistemática B · egress fechado por construção
Prove por teste que **todo** caminho que leva dado para fora (provider LLM, e-mail, WhatsApp, export APAC, impressão remota) passa por G-02 + G-27 + autorização do servidor. Qualquer caminho que contorne = defeito S0/S1: corrija ou `BLOQUEADO_ESCOPO` com patch. Inclui caminho de log e de erro (PHI em mensagem de exceção).

## CODEX-09 · Correção sistemática C · fuso, datas e identificadores nos gates
Revise os gates novos e os existentes contra D-W5-01/02 (−03:00; data civil; aviso APAC ≤1 dia adiantado) e contra o CPF rotulado "Cartão SUS" do caso real (use as lições em `docs/referencias/CASO-REAL-01-LICOES.md`, só o Paciente Teste 07 nos testes).

## CODEX-10 · Fechamento
`git mv` dos 4 `.adv.ts` verdes para `tests/kernel/gates-w9/` (só ajuste de import; sem mudar expectativa), rodar a config adv e confirmar **10 → 5 falhas** (restam k26, n19, t56, fn16 e caso07, do Grok). Relatório `docs/progresso/W9-CODEX.md`: fatias, tabelas `[VERIFICAR]` para o Dr. Silas, saídas reais dos comandos, lista de achados da correção sistemática com severidade.
