import { useState } from "react";
import type { Fonte } from "../../contracts/base.js";
import type { Triagem } from "../../contracts/clinico.js";
import type { ContextoTriagem, SalaoRuleset } from "../../contracts/regras.js";
import { avaliarTriagem } from "../../rules/index.js";
import { ResultadoTriagem } from "./ResultadoTriagem.js";

/** Borda de unidade: °C → décimos inteiros. 37,9 → 379. Não é regra clínica. */
export function celsiusParaDecimos(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10);
}

/** Borda de unidade: g/dL → dg/dL, na mesma conta de décimos. */
export function gDlParaDgDl(texto: string): number | null {
  return celsiusParaDecimos(texto);
}

function textoParaInteiro(texto: string): number | null {
  const t = texto.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function dataCivil(texto: string): string | null {
  const t = texto.trim();
  if (t === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function dadoNumero(valor: number | null, fonte: Fonte) {
  if (valor === null) {
    return {
      valor: null,
      estado: "PENDENTE" as const,
      campo: "AUSENTE" as const,
      motivo: "não informado na triagem",
      fontes: [] as Fonte[],
      revisao: "RAW" as const,
    };
  }
  return {
    valor,
    estado: "PENDENTE" as const,
    campo: "PRESENTE" as const,
    motivo: "informado na triagem",
    fontes: [fonte],
    revisao: "REVISAR" as const,
  };
}

function dadoData(valor: string | null, fonte: Fonte) {
  if (valor === null) {
    return {
      valor: null,
      estado: "PENDENTE" as const,
      campo: "AUSENTE" as const,
      motivo: "não informado na triagem",
      fontes: [] as Fonte[],
      revisao: "RAW" as const,
    };
  }
  return {
    valor,
    estado: "PENDENTE" as const,
    campo: "PRESENTE" as const,
    motivo: "informado na triagem",
    fontes: [fonte],
    revisao: "REVISAR" as const,
  };
}

type Recurso = Triagem["recurso"];

export function FormTriagem({
  patientId,
  encounterId,
  chegadaEm,
  ruleset,
  contexto,
  fonte,
  draftRevision = null,
  onSalvar,
}: {
  patientId: string;
  encounterId: string;
  chegadaEm: string;
  ruleset: SalaoRuleset;
  contexto: ContextoTriagem;
  fonte: Fonte;
  draftRevision?: number | null;
  onSalvar: (triagem: Triagem, expectedRevision: number | null) => void | Promise<void>;
}) {
  const [pas, setPas] = useState("");
  const [fc, setFc] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tempC, setTempC] = useState("");
  const [hb, setHb] = useState("");
  const [anc, setAnc] = useState("");
  const [plq, setPlq] = useState("");
  const [coleta, setColeta] = useState("");
  const [ecog, setEcog] = useState("");
  const [grau, setGrau] = useState("");
  const [tontura, setTontura] = useState<boolean | null>(null);
  const [recurso, setRecurso] = useState<Recurso>("AMBULATORIAL");
  const [idade, setIdade] = useState("");
  const [resultado, setResultado] = useState<ReturnType<typeof avaliarTriagem> | null>(null);

  function montar(idadeAnos: number | null): Triagem {
    return {
      patientId,
      encounterId,
      pas: dadoNumero(textoParaInteiro(pas), fonte),
      fc: dadoNumero(textoParaInteiro(fc), fonte),
      spo2: dadoNumero(textoParaInteiro(spo2), fonte),
      tempDecimos: dadoNumero(celsiusParaDecimos(tempC), fonte),
      hbDgDl: dadoNumero(gDlParaDgDl(hb), fonte),
      anc: dadoNumero(textoParaInteiro(anc), fonte),
      plq: dadoNumero(textoParaInteiro(plq), fonte),
      coletaHemograma: dadoData(dataCivil(coleta), fonte),
      ecog: dadoNumero(textoParaInteiro(ecog), fonte),
      grauCtcae: dadoNumero(textoParaInteiro(grau), fonte),
      tontura,
      vertigemHistoricoAnterior: null,
      vertigemInicioNovo: null,
      recurso,
      idadeAnos,
      chegadaEm,
    };
  }

  async function salvar() {
    // D-W9-03 · idade em branco nunca vira 0: segue como null (PENDENTE) e a regra manda à fila do médico.
    const triagem = montar(textoParaInteiro(idade));
    setResultado(null);
    try {
      await onSalvar(triagem, draftRevision);
      setResultado(avaliarTriagem(triagem, contexto, ruleset));
    } catch {
      // Keep every entered value in place; TelaSalao presents the server error.
    }
  }

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <label>
        PA sistólica (mmHg)
        <input value={pas} onChange={(e) => setPas(e.target.value)} />
      </label>
      <label>
        Frequência cardíaca (bpm)
        <input value={fc} onChange={(e) => setFc(e.target.value)} />
      </label>
      <label>
        Saturação (%)
        <input value={spo2} onChange={(e) => setSpo2(e.target.value)} />
      </label>
      <label>
        Temperatura (°C)
        <input value={tempC} onChange={(e) => setTempC(e.target.value)} />
      </label>
      <label>
        Hemoglobina (g/dL)
        <input value={hb} onChange={(e) => setHb(e.target.value)} />
      </label>
      <label>
        Neutrófilos (/µL)
        <input value={anc} onChange={(e) => setAnc(e.target.value)} />
      </label>
      <label>
        Plaquetas (/µL)
        <input value={plq} onChange={(e) => setPlq(e.target.value)} />
      </label>
      <label>
        Coleta do hemograma
        <input value={coleta} onChange={(e) => setColeta(e.target.value)} />
      </label>
      <label>
        ECOG
        <input value={ecog} onChange={(e) => setEcog(e.target.value)} />
      </label>
      <label>
        Grau CTCAE
        <input value={grau} onChange={(e) => setGrau(e.target.value)} />
      </label>
      <label>
        Idade (anos)
        <input value={idade} onChange={(e) => setIdade(e.target.value)} />
      </label>
      <label>
        Tontura
        <select aria-label="Tontura" value={tontura === null ? "NAO_SEI" : tontura ? "SIM" : "NAO"}
          onChange={(e) => setTontura(e.target.value === "NAO_SEI" ? null : e.target.value === "SIM")}>
          <option value="NAO_SEI">Não sei</option>
          <option value="SIM">Sim</option>
          <option value="NAO">Não</option>
        </select>
      </label>
      <label>
        Recurso
        <select value={recurso} onChange={(e) => setRecurso(e.target.value as Recurso)}>
          <option value="AMBULATORIAL">AMBULATORIAL</option>
          <option value="CADEIRA">CADEIRA</option>
          <option value="CAMA">CAMA</option>
        </select>
      </label>
      <button type="submit">salvar triagem</button>
      {resultado ? <ResultadoTriagem resultado={resultado} /> : <p>sem avaliação</p>}
    </form>
  );
}
