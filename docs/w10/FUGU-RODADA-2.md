# FUGU · rodada 2 (tech lead, 2026-10-07)

Antes: `git merge f0/w1-integrado` e `npm ci --offline` no `w10-fugu`. Faixa a mesma da W10 (+ `src/leitura/**`). Sem mudar expectativa de teste; red team e adv-w8 são critério de aceite.

## Prioridade 1 · bug e lacunas do extrator (Modelo 11, `docs/referencias/modelos/11-resumo-primeira-consulta.md` §2)
- **L-07 (BUG): "colo do útero/colo uterino" vira cólon** — corrigir a ordem da tabela de sítio (mais específico antes de "colo"), + pele/face/subsítios de cabeça e pescoço; **lateralidade no masculino** (direito/esquerdo, à direita/à esquerda).
- L-08 lesão como entidade (sítio + subsítio + lado + data) antes de `conflitoLateralidade` (dois primários em lados opostos ≠ conflito).
- L-01 portão de qualidade de texto (texto ilegível/OCR ruim = PENDENTE, nunca PRONTO).
- L-02 classificador de página/documento (AP, IHQ, TC, RM, PET, cintilografia, labs, guia de regulação, encaminhamento, receita, evolução, documento pessoal/NÃO CLÍNICO).
- L-03 datas tipadas: exame × recebimento × assinatura × impressão; a timeline usa a data do exame.
- L-04 dedupe de laudos (nº do exame + data + similaridade) — chave final aguarda D-W8-01 (curadoria); implemente como proposta + revisão.
- L-05 parser de AP em blocos (conclusão → órgão → histologia multilinha; grau; dimensão; LV/PN; margens).
- L-06 parser de IHQ em tabela (anticorpo, clone, interpretação, %; HER2 com ISH; p16; Gleason/ISUP; PD-L1 com anticorpo e CPS/TPS).
- L-09 CID com fonte; CID de guia/SISREG nunca vira diagnóstico nem APAC (RAC-02); `conflitoCid` passa a ter entrada.
- L-10 domínios: performance status (fonte/data/avaliador), antropometria, comorbidade, alergia, hábitos, medicação em uso.
- L-11 imagem: medidas, linfonodo, "invade/compromete <estrutura>", grau de certeza, negação sem acento.
- L-12 página faltando / seção vazia ⇒ PENDENTE explícito.
- L-13 estadiamento derivado por código sempre DERIVADO/SUSPEITO + confirmação (tabelas por tumor = curadoria).
- L-15 conduta de outro serviço rotulada pela origem; nunca entra como nossa conduta.
(L-14 biomarcadores por tumor = curadoria do Dr. Silas.)

## Prioridade 2 · red team da sua faixa (`docs/w10/REDTEAM-DISTRIBUICAO.md`, seção FUGU)
RT-04a ("compatível com", "sugestivo de" ⇒ UNCERTAIN, nunca EXPLICIT) · RT-15a/b/c · RT-02a · RT-10a/c · RT-01a · RT-03a · RT-04b–d · RT-09b/c · RT-13b. Exporte os nomes que os testes procuram.

## Prioridade 3 · leitura local
O app lê **texto colado, Word (.docx) e PDF digital** localmente (já feito; manter). PDF **escaneado** não é OCR local: fica PENDENTE com o motivo "enviar ao extrator do kit" — o kit escaneado será processado por LLM (D-W9-65), fora desta fatia.

Feche com o relatório `docs/progresso/W10-FUGU.md` (saídas reais) e contagens antes/depois do red team.
