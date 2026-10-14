# PEDIDOS · W10-INT-PRESCRICAO (RT-06, RT-08, RT-11)

Faixa respeitada: nada fora de `src/rules/{prescricao,morfometria,conhecimento}/**`, `tests/rules-*`, `docs/progresso`, `docs/w10`. O que os `.adv.ts` sondam fora da faixa fica aqui, como patch exato. Cada patch foi aplicado temporariamente, validado (tsc + fronteiras + redteam) e revertido.

Restricao de arquitetura: `src/rules` so importa `src/contracts` (R-08), entao as fachadas abaixo vivem em `src/kernel` (que pode importar `src/rules`); o codigo real esta nas pastas da faixa.

## P1 · Fachadas em `src/kernel` (4 arquivos novos; fecha RT-11a, RT-11c, RT-11d, RT-06a, RT-06d)

`src/kernel/trials.ts`
```ts
export { avaliarTrial, resumirTrial } from "../rules/conhecimento/index.js";
```
`src/kernel/grafo.ts`
```ts
export { carregarGrafo, carregarGrafoEstrito, verificarArestas } from "../rules/conhecimento/index.js";
```
`src/kernel/conhecimento.ts`
```ts
export { confrontarFontes, fontesDivergentes } from "../rules/conhecimento/index.js";
```
`src/kernel/morfometria.ts`
```ts
export { medirLesao, morfometria, calcularVolume, avaliarRecistComNovasLesoes } from "../rules/morfometria/index.js";
```
Resultado verificado: rt11 11/11 verde; rt06 verde nos itens a, b (com P2), d.

## P2 · `src/rules/tipos-w3.ts` e `src/rules/recist.ts` (fecha RT-06b e RT-06c)

Acrescentar ao FIM de `src/rules/tipos-w3.ts` (o teste sonda `tipos-w3["eixoCurtoMm"]`):
```ts
export const eixoCurtoMm = (l: { eixoCurtoMm: number | null }): number | null =>
  l.eixoCurtoMm !== null && Number.isFinite(l.eixoCurtoMm) && l.eixoCurtoMm >= 0 ? l.eixoCurtoMm : null;
```
Acrescentar ao FIM de `src/rules/recist.ts` (o teste sonda `recist.validarUnidadeMedida`; copia de `src/rules/morfometria/index.ts`, ja testada em `tests/rules-morfometria/index.test.ts`; `avaliarLinfonodoAlvo` pode ser copiada do mesmo arquivo se quiser a funcao tambem no recist):
```ts
export interface EntradaUnidade {
  valor: number | null;
  unidade: "mm" | "cm" | null;
  /** medida anterior da MESMA lesão, em mm: detecta troca cm×mm por fator ~10 */
  anteriorMm?: number | null;
  /** identificação do corte/série (ex.: "série 4, 3 mm") deste e do exame anterior */
  corte?: string | null;
  corteAnterior?: string | null;
}
export interface SaidaUnidade { estado: "OK" | "PENDENTE"; valorMm: number | null; convertido: boolean; motivos: string[] }

export function validarUnidadeMedida(e: EntradaUnidade): SaidaUnidade {
  const motivos: string[] = [];
  if (e.valor === null || !Number.isFinite(e.valor) || e.valor < 0) motivos.push("valor ausente ou inválido");
  if (e.unidade === null) motivos.push("unidade não declarada (cm ou mm): nunca presumida");
  const valorMm = motivos.length === 0 ? Math.round(e.valor! * (e.unidade === "cm" ? 10 : 1) * 1e6) / 1e6 : null;
  if (valorMm !== null && e.anteriorMm !== undefined && e.anteriorMm !== null && e.anteriorMm > 0 && valorMm > 0) {
    const r = valorMm / e.anteriorMm;
    if (r >= 8 || r <= 1 / 8) motivos.push(`variação de ${Math.round(r * 100) / 100}× sobre a medida anterior (${e.anteriorMm} mm): possível troca cm×mm`);
  }
  const c0 = e.corte ?? null, c1 = e.corteAnterior ?? null;
  if (c0 === null || c1 === null) { if (c0 !== c1) motivos.push("corte/série identificado só em um dos exames"); }
  else if (c0.trim().toLowerCase() !== c1.trim().toLowerCase()) motivos.push(`cortes diferentes entre exames (${c1} × ${c0}): medidas não comparáveis`);
  return { estado: motivos.length === 0 ? "OK" : "PENDENTE", valorMm: motivos.length === 0 ? valorMm : null, convertido: e.unidade === "cm" && motivos.length === 0, motivos };
}
```
Nao altera `avaliarRecist` nem o contrato `RecistInput`. Integrar de fato lesao nova/eixo curto ao `RecistInput` (campo `novasLesoes`, `LesaoRecist.eixoCurtoMm`/`tipo`) e mudanca de contrato: decisao do tech lead; hoje `avaliarRecistComNovasLesoes(candidatoAlvos, novas)` combina o candidato de `avaliarRecist` com as lesoes novas por fora.

## P3 · RT-08a teste "duas fichas homonimas" depende de fixture inexistente

`tests/redteam/rt08-prescricao-dose.adv.ts` chama `carregarFicha("GC","vias biliares","metastatico","1")` e espera `templateId === "GC-vias-biliares"`, mas o teste nunca registra essa ficha: `ProtocolTemplate.parse(ficha(...))` so valida o objeto, nao o coloca em biblioteca. O corpus real (`corpus/fichas/**`) nao tem GC de bexiga nem de vias biliares, e os `templateId` reais seguem `FICHA.<tumor>.<slug>@<versao>`. Inventar essas fichas seria conteudo clinico S0 sem curadoria, entao NAO foi feito. Duas saidas (so o tech lead altera teste do red team):
- (a) o teste registrar a fixture antes: `registrarBiblioteca([ficha(), ficha({templateId:"GC-vias-biliares",tumor:"vias biliares"})])` (exportada de `src/rules/prescricao/index.ts`; `cenario` e comparado sem acento/caixa, `versao` exata); ou
- (b) curadoria do Dr. Silas fornecer as fichas GC bexiga e GC vias biliares em `corpus/fichas/**` e a raiz de composicao chamar `registrarBiblioteca(corpus)`.
Os outros dois testes de RT-08a (carregador existe; versao inexistente => `FICHA_VERSAO_INEXISTENTE`) estao verdes.

## P4 · Raiz de composicao: registrar o corpus de fichas

`registrarBiblioteca(brutas)` valida cada ficha com `ProtocolTemplate` (templateId unico) e passa a servir `carregarFicha`. Quem le `corpus/fichas/**` (src/app ou kernel) deve chamar na subida. Sem registro, toda busca falha com `FICHA_VERSAO_INEXISTENTE` (falha segura). Nota: o carregamento nao reconfere o `hash` (SHA-256 canonico de `tests/corpus-fichas/gerar-fichas.mjs`); reconferir e trabalho da raiz de composicao, que tem `node:crypto`.

## P5 · Decisoes que dependem do Dr. Silas ([VERIFICAR])

- Cortes de linfonodo em `avaliarLinfonodoAlvo`: defaults RECIST 1.1 (< 10 mm normal; 10 a < 15 patologico nao-alvo; >= 15 mm elegivel a alvo). O comentario do teste RT-06 fala "alvo exige >= 10 mm"; usei os valores do RECIST 1.1 e deixei os cortes parametrizaveis (idealmente vindos do ruleset recist ativo).
- `idadeDoDado(dado, agora, limiteDias?)`: sem limite informado nao marca "desatualizado" (so mostra fonte e idade). Qual limite de idade de peso/altura/ClCr e politica clinica.
- `validarAntiemese`: `alerta` so dispara por NK1 (padrao local sem NK1, D-W9-23c/34c); itens do padrao local ausentes saem em `ausentesPadrao` (informativo, nunca bloqueia).
- `ehDoseDeEstudo`: lista de esquemas D-W9-22i embutida (TPF, ddMVAC, IFL, Mayo); ampliar conforme a curadoria revisar a planilha.

## P6 · Sugestao de fronteira (opcional)

`scripts/check-boundaries.mjs` so deixa `src/rules/index.ts` reexportar arquivos de `src/rules/`. Por isso `src/rules/prescricao/index.ts`, `morfometria/index.ts` e `conhecimento/index.ts` sao autossuficientes (a regra de arredondamento/BSA/Calvert e copia de `instanciarProtocolo.ts`, com teste de equivalencia). Permitir barrel `src/rules/*/index.ts` removeria a duplicacao.
