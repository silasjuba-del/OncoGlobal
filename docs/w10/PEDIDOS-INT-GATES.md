# PEDIDOS · W10-INT-GATES (ao tech lead)

## RT-10b · historicalMetastaticDisease (contrato; fora da faixa)
O teste faz `PatientTimeline.safeParse({...base, historicalMetastaticDisease:false})` com `stageHistory` = `cT2N0M0`, sem estado anterior.
Um schema Zod sem memória não distingue "false legítimo" (paciente nunca metastático) de "rebaixado". Única forma de o parse falhar seria
proibir `false` sempre (quebra pacientes M0) ou inferir de `stageHistory` (aqui não há M1). Expectativa **inconsistente com a regra §5.7**; não alterada.
Patch proposto (contrato, tech lead): manter o schema e acrescentar em `src/contracts/w10/clinico-w10.ts`
`export function validarMonotonicidade(ant: PatientTimeline, novo: PatientTimeline): boolean { return !(ant.historicalMetastaticDisease && !novo.historicalMetastaticDisease); }`
chamada no ponto de gravação da projeção; e ajustar o `.adv.ts` para testar essa função (ou aceitar M1 em `stageHistory` como gatilho de superRefine:
`stageHistory.some(e => /M1/.test(e.valor)) => historicalMetastaticDisease===true`).

## RT-12c · READ x WORLD_EFFECT (gateway; fora da faixa)
O teste procura `autorizarLeitura|readGate|executarLeitura` em `src/kernel/gateway/gateway.ts`. Patch sugerido (fail-closed, sem verbo novo em ActionIntent):
`export function autorizarLeitura(i:{destino:string; escopo:{patientId:string|null}}): {ok:false; motivo:"CANAL_EXTERNO_NAO_HABILITADO"}` enquanto o egress estiver fechado (D-W9-15),
e, ao abrir, exigir allowlist de domínio + `desidentificar` sobre a consulta (G-02) e nunca expor patientId.
