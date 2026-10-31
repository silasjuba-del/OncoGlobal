import { useState } from "react";
import { medirLesao, calcularVolume, type DirecaoMedida, type SaidaMorfometria } from "../../rules/morfometria/index.js";

/** Cálculo local sobre medidas explicitamente fornecidas; não interpreta pixels nem confirma RECIST. */
export function MedidasDocumento({ fonte }: { fonte: string }) {
  const [modo, setModo] = useState<"2D_CALIBRADO" | "3D_GEOMETRICO">("2D_CALIBRADO");
  const [reguaMm, setReguaMm] = useState(""), [reguaPx, setReguaPx] = useState(""), [medidaPx, setMedidaPx] = useState("");
  const [direcaoRegua, setDirecaoRegua] = useState<DirecaoMedida | "">(""), [direcao, setDirecao] = useState<DirecaoMedida | "">("");
  const [isotropica, setIsotropica] = useState(false), [cortes, setCortes] = useState("");
  const [superior, setSuperior] = useState(false), [inferior, setInferior] = useState(false);
  const [resultado, setResultado] = useState<SaidaMorfometria | null>(null);
  const numero = (s: string) => s.trim() ? Number(s.replace(",", ".")) : Number.NaN;
  function calcular() {
    if (modo === "2D_CALIBRADO" && (!direcaoRegua || !direcao)) {
      setResultado({ recusado: true, motivo: "Informe a direção da régua e da medida observadas.", reviewRequired: true, fator: null, medidaMm: null, volumeMm3: null, nota: null }); return;
    }
    if (modo === "2D_CALIBRADO") setResultado(medirLesao({ modo,
      regua: { direcao: direcaoRegua as DirecaoMedida, comprimentoMm: numero(reguaMm), comprimentoPx: numero(reguaPx), isotropicaDemonstrada: isotropica },
      medida: { direcao: direcao as DirecaoMedida, comprimentoPx: numero(medidaPx) },
    }));
    else {
      const pontos = cortes.trim().split(/\r?\n/).map(l => l.split(";").map(numero));
      setResultado(calcularVolume({ modo, areasMm2: pontos.map(p => p[0] ?? Number.NaN), posicoesMm: pontos.map(p => p[1] ?? Number.NaN),
        fatias: [{ poloSuperior: superior ? "OBSERVADO" : "TRUNCADO" }, { poloInferior: inferior ? "OBSERVADO" : "TRUNCADO" }] }));
    }
  }
  const direcoes = <><option value="">Selecione a direção</option><option value="HORIZONTAL">Horizontal</option><option value="VERTICAL">Vertical</option><option value="OBLIQUA">Oblíqua</option></>;
  return <details onChange={() => setResultado(null)}><summary>Calcular medida calibrada</summary>
    <p>Fonte: {fonte}. Confira escala, contorno e resultado no DICOM original. O cálculo não registra resposta tumoral.</p>
    <label>Modo de medida<select value={modo} onChange={e => setModo(e.target.value as typeof modo)}><option value="2D_CALIBRADO">Medida 2D</option><option value="3D_GEOMETRICO">Volume por cortes</option></select></label>
    {modo === "2D_CALIBRADO" ? <>
      <label>Régua em mm<input value={reguaMm} inputMode="decimal" onChange={e => setReguaMm(e.target.value)} /></label>
      <label>Régua em pixels<input value={reguaPx} inputMode="decimal" onChange={e => setReguaPx(e.target.value)} /></label>
      <label>Direção da régua<select value={direcaoRegua} onChange={e => setDirecaoRegua(e.target.value as DirecaoMedida)}>{direcoes}</select></label>
      <label>Medida em pixels<input value={medidaPx} inputMode="decimal" onChange={e => setMedidaPx(e.target.value)} /></label>
      <label>Direção da medida<select value={direcao} onChange={e => setDirecao(e.target.value as DirecaoMedida)}>{direcoes}</select></label>
      <label><input type="checkbox" checked={isotropica} onChange={e => setIsotropica(e.target.checked)} />Escala isotrópica demonstrada na fonte</label>
    </> : <>
      <label>Cortes: área em mm²; posição em mm, um por linha<textarea value={cortes} onChange={e => setCortes(e.target.value)} /></label>
      <label><input type="checkbox" checked={superior} onChange={e => setSuperior(e.target.checked)} />Polo superior observado, sem truncamento</label>
      <label><input type="checkbox" checked={inferior} onChange={e => setInferior(e.target.checked)} />Polo inferior observado, sem truncamento</label>
    </>}
    <button type="button" onClick={calcular}>Calcular a partir das medidas</button>
    {resultado && <p role="status">{resultado.recusado ? resultado.motivo : `${resultado.medidaMm === null ? "" : `${resultado.medidaMm} mm`}${resultado.volumeMm3 === null ? "" : `${resultado.volumeMm3} mm³`}. Revisão no original obrigatória.`}</p>}
  </details>;
}
