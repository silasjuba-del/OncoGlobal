# Fonte M-AK · PLN-031 · 2026-10-07 · texto íntegro do Dr. Silas

> Cópia literal. Título do Dr. Silas: "RESUMO (FLASH = ONE CLICK - BYEBYE - NEEEXXTTTT!!!". O nome "MARIA X" do desenho é fictício/sintético (nenhum dado real). Não editar.

CONSULTA FLASH — ONE CLICK BYE-BYE
Eu reduziria o modal ao que efetivamente encerra a consulta. APAC/SIGTAP ficam visíveis, mas não devem poluir o raciocínio clínico.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CONSULTA FLASH                                              ECOG 1  ● ESTÁVEL │
│ MARIA X · 58a · Mama esquerda                              RETORNO: 21 DIAS │
├──────────────────────────────────────────────────────────────────────────────┤
│ CARCINOMA MAMÁRIO NST · cT2N1M0 · EC IIB · RE90 RP40 HER2− Ki67 30%        │
│ AP: HAS · DM2        MUC: Losartana · Metformina        ALERGIA: DIPIRONA   │
│ TTO ATUAL: TC adjuvante · C3D1 · Docetaxel + Ciclofosfamida                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ EXAMES                                                                       │
│ 02/10 · HMG       Hb 11,2 · ANC 2.340 · Plaq 188 mil              ✓ LIBERA │
│ 02/10 · Creat     0,82 · ClCr 78 mL/min                            ✓        │
│ 21/09 · TC TAP    Sem evidência de progressão                     ESTÁVEL   │
│ 18/09 · ECO       FEVE 61%                                        ✓        │
├──────────────────────────────────────────────────────────────────────────────┤
│ HOJE                                                                         │
│ ☑ Liberar tratamento    ☑ Receita suporte    ☑ Solicitar HMG               │
│ ☑ Retorno 21 dias       ☐ TC TAP             ☐ Encaminhamento              │
│                                                                              │
│ RECEITAS PRÉ-SELECIONADAS                                                    │
│ ☑ Ondansetrona          ☑ Dexametasona       ☐ Analgesia                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ APAC / SUS                                                                   │
│ CID C50.4 · SIGTAP 03.xx.xx.xxx-x · ADJUVANTE · APAC ✓ VÁLIDA              │
│ Competência 10/26 · validade xx/xx/26 · pendências: nenhuma                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ ⚠ IA FALA                                                                    │
│ Neuropatia não graduada · perguntar impacto funcional antes de liberar.      │
│ APAC vence antes do próximo ciclo.                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ SALVAR RASCUNHO ]                      [ ✓ FINALIZAR · IMPRIMIR · SAIR ]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Anatomia mínima
O header clínico é imutável e sempre visível:
`DX + TNM + ESTÁDIO + BIOMARCADOR`
`AP + MUC + ALERGIA + ECOG`
`TTO ATUAL + LINHA + CICLO/DIA`
Depois vêm somente quatro áreas operacionais: Exames recentes → ações de hoje → receitas/documentos pré-selecionados → APAC/SIGTAP.

APAC/SIGTAP precisa ser operacional, não decorativo
Não basta mostrar código. O chip deve responder imediatamente:
CID C50.4 · SIGTAP XXXXX · ADJUVANTE · APAC VÁLIDA · COMP 10/26 · SEM PENDÊNCIAS
Estados:
✓ VERDE: compatível/válida
! PENDENTE: falta dado/documento
× VERMELHO: incompatibilidade que exige ação
A regra continua sendo backend mínimo operacional: não criar quinze estados de APAC.

O clique final
`FINALIZAR · IMPRIMIR · SAIR` deve executar deterministicamente:
`validar campos obrigatórios → confirmar CD → gerar evolução → atualizar tratamento → gerar/renovar APAC se necessário → selecionar SIGTAP → gerar receitas/exames/encaminhamentos → definir retorno → snapshot assinado → imprimir lote → fechar paciente → próximo da fila`
A IA não assina nem escolhe silenciosamente a conduta. Ela deixa o modal praticamente pronto; o médico corrige o excepcional e dá um clique final.
Eu acrescentaria uma coisa que está faltando no desenho: “RETORNO” deve ser objeto operacional, não texto — `21 dias + motivo + exames necessários antes do retorno`. Isso permite que o próprio clique final gere agenda + pedidos e elimine outra etapa burocrática.
