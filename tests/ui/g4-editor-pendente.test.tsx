// @vitest-environment jsdom
// G4 · OG-005 (Task010): uma edição que chega antes do efeito de montagem do editor não pode
// ser apagada pelo aviso inicial "sem pendência" enviado à tela principal.
import { fireEvent } from "@testing-library/dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import type { BasePrescricaoExecutavelResposta } from "../../src/contracts/api/operacaoPrescricaoExecutavel.js";
import { EditorPrescricaoExecutavel } from "../../src/ui/consulta/EditorPrescricaoExecutavel.js";
import { PainelEstudos } from "../../src/ui/pesquisa/PainelEstudos.js";

const base: BasePrescricaoExecutavelResposta = {
  contexto: { patientId: "pt-g4-sintetico", encounterId: "en-g4-sintetico", tumorLotId: "lote-g4-sintetico" },
  revisao: "a".repeat(64), pacienteNome: "Paciente sintético G4", vigente: null, episodio: null, ciclo: null, pendencias: [],
};

const ambiente = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined };
const anterior = ambiente.IS_REACT_ACT_ENVIRONMENT;
afterEach(() => { ambiente.IS_REACT_ACT_ENVIRONMENT = anterior; document.body.innerHTML = ""; });

it("edição feita assim que o campo aparece, antes dos efeitos de montagem, continua pendente na tela principal", async () => {
  // Fora de act(): o React agenda os efeitos passivos depois do commit, como no navegador.
  ambiente.IS_REACT_ACT_ENVIRONMENT = false;
  const container = document.body.appendChild(document.createElement("div"));
  const avisos: boolean[] = [];
  const editado = new Promise<void>((resolver) => {
    const observador = new MutationObserver(() => {
      const motivo = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Motivo da prescrição"]');
      if (!motivo) return;
      observador.disconnect();
      // Microtarefa logo após o commit: antes de qualquer efeito passivo de montagem.
      fireEvent.change(motivo, { target: { value: "Edição sintética imediata" } });
      resolver();
    });
    observador.observe(container, { childList: true, subtree: true });
  });
  const raiz = createRoot(container);
  raiz.render(<EditorPrescricaoExecutavel base={base} aoAlterarPendente={(p) => avisos.push(p)}
    aoPreparar={async () => { throw new Error("não deve preparar"); }}
    aoAssinar={async () => { throw new Error("não deve assinar"); }} />);
  await editado;
  await new Promise((resolver) => setTimeout(resolver, 50));
  expect(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Motivo da prescrição"]')?.value)
    .toBe("Edição sintética imediata");
  // O último aviso é o que a tela principal usa para proteger a navegação.
  expect(avisos.at(-1)).toBe(true);
  raiz.unmount();
});

it("estudos: conteúdo digitado antes dos efeitos de montagem continua pendente na tela principal", async () => {
  ambiente.IS_REACT_ACT_ENVIRONMENT = false;
  const container = document.body.appendChild(document.createElement("div"));
  const avisos: boolean[] = [];
  const editado = new Promise<void>((resolver) => {
    const observador = new MutationObserver(() => {
      const fonte = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Conteúdo literal da fonte"]');
      if (!fonte) return;
      observador.disconnect();
      fireEvent.change(fonte, { target: { value: "Fonte sintética imediata" } });
      resolver();
    });
    observador.observe(container, { childList: true, subtree: true });
  });
  const raiz = createRoot(container);
  const nunca = async () => { throw new Error("não deve chamar a porta"); };
  raiz.render(<PainelEstudos estudos={[]} contexto={null} aoImportar={nunca} aoRevisar={nunca} aoAvaliar={nunca}
    aoAlterarPendente={(p) => avisos.push(p)} />);
  await editado;
  await new Promise((resolver) => setTimeout(resolver, 50));
  expect(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Conteúdo literal da fonte"]')?.value)
    .toBe("Fonte sintética imediata");
  expect(avisos.at(-1)).toBe(true);
  raiz.unmount();
});
