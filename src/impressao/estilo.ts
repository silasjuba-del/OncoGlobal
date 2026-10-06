/** Estilos puros de impressão. A página é A4 e não depende de recursos remotos. */
export const CSS_IMPRESSAO_A4 = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { color: #111; font: 11pt Arial, sans-serif; line-height: 1.35; margin: 0; }
.documento { position: relative; }
.cabecalho { border-bottom: 1px solid #555; margin-bottom: 1rem; padding-bottom: .6rem; }
.aviso-configuracao { border: 1px solid #9a6700; color: #6a4b00; padding: .35rem; font-size: 9pt; }
.medico { margin-top: .3rem; }
h1 { font-size: 16pt; text-align: center; }
h2 { font-size: 12pt; margin: 1rem 0 .4rem; }
.campo { margin: .2rem 0; }
.texto-fixo { white-space: pre-wrap; font: inherit; }
.pendente { font-weight: bold; }
.rascunho { position: fixed; top: 43%; left: 8%; transform: rotate(-28deg); color: rgba(160,0,0,.22); font-size: 34pt; font-weight: bold; z-index: 10; }
.rodape { border-top: 1px solid #aaa; font-size: 8pt; margin-top: 1rem; padding-top: .35rem; overflow-wrap: anywhere; }
.grade { border-collapse: collapse; width: 100%; }
.grade th, .grade td { border: 1px solid #555; padding: .25rem; vertical-align: top; }
.bloco { break-inside: avoid; }
.operacional { border: 2px solid #a00; color: #700; padding: .5rem; }
@media print { .rascunho { position: fixed; } .bloco { break-inside: avoid; } }
`;
