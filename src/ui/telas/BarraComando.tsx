import { useEffect, useRef, useState } from "react";
import {
  interpretarComando,
  proximoPaciente,
  type ComandoInterpretado,
  type PacienteBusca,
} from "./comandos.js";

export function BarraComando({
  pacientes,
  ordemIds,
  pacienteAbertoId,
  onAbrir,
  onValidarTudo,
  onImprimir,
  onNovaTriagem,
  onSalao,
  onApac,
  onCanal,
}: {
  pacientes: readonly PacienteBusca[];
  ordemIds: readonly string[];
  pacienteAbertoId: string | null;
  onAbrir: (patientId: string) => void;
  onValidarTudo: () => void;
  onImprimir: () => void;
  onNovaTriagem: () => void;
  onSalao: () => void;
  onApac: () => void;
  onCanal: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [lista, setLista] = useState<readonly PacienteBusca[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const confirmandoRef = useRef(false);
  const pacienteRef = useRef(pacienteAbertoId);
  pacienteRef.current = pacienteAbertoId;

  function armarImpressao() {
    if (!pacienteRef.current) return;
    confirmandoRef.current = true;
    setConfirmando(true);
  }

  function confirmarImpressao() {
    if (!confirmandoRef.current) return;
    confirmandoRef.current = false;
    setConfirmando(false);
    onImprimir();
  }

  function aplicar(resultado: ComandoInterpretado) {
    if (resultado.tipo === "INCOMPLETO") {
      setAviso("comando incompleto");
      setLista([]);
      return;
    }
    setAviso(null);
    if (resultado.tipo === "LISTA") {
      setLista(resultado.pacientes);
      return;
    }
    setLista([]);
    if (resultado.tipo === "ABRIR") onAbrir(resultado.patientId);
    if (resultado.tipo === "PROXIMO") {
      const seguinte = proximoPaciente(ordemIds, pacienteRef.current);
      if (seguinte) onAbrir(seguinte);
    }
    if (resultado.tipo === "VALIDAR") {
      if (pacienteRef.current) onValidarTudo();
    }
    if (resultado.tipo === "IMPRIMIR") armarImpressao();
    if (resultado.tipo === "TRIAGEM") onNovaTriagem();
    if (resultado.tipo === "SALAO") onSalao();
    if (resultado.tipo === "APAC") onApac();
    if (resultado.tipo === "CANAL") onCanal();
  }

  function executar() {
    aplicar(interpretarComando(texto, pacientes));
  }

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.ctrlKey && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setAberto((valor) => !valor);
        return;
      }
      if (evento.ctrlKey && evento.key === "Enter") {
        evento.preventDefault();
        if (pacienteRef.current) onValidarTudo();
        return;
      }
      if (evento.ctrlKey && evento.key.toLowerCase() === "p") {
        evento.preventDefault();
        armarImpressao();
        return;
      }
      if (evento.key === "Enter" && !evento.ctrlKey && confirmandoRef.current) {
        if (evento.target instanceof HTMLInputElement) return;
        evento.preventDefault();
        confirmarImpressao();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onValidarTudo, onImprimir, onAbrir]);

  return (
    <section aria-label="Comandos" className="pilha">
      <button type="button" onClick={() => setAberto(true)}>comandos</button>
      {confirmando ? <p role="status">Enter confirma a impressão</p> : null}
      {aberto ? (
        <div role="dialog" aria-label="Barra de comando" className="cartao pilha">
          <label>
            Comando
            <input
              ref={campo}
              aria-label="Comando"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key !== "Enter") return;
                evento.preventDefault();
                evento.stopPropagation();
                if (confirmandoRef.current) {
                  confirmarImpressao();
                  return;
                }
                executar();
              }}
            />
          </label>
          {aviso ? <p role="status">{aviso}</p> : null}
          {lista.length > 0 ? (
            <ul aria-label="Pacientes encontrados">
              {lista.map((paciente) => (
                <li key={paciente.patientId}>
                  <button type="button" onClick={() => onAbrir(paciente.patientId)}>
                    {paciente.nome} · {paciente.prontuario}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
