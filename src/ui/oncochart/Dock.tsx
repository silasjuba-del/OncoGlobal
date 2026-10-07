export type AcaoDock =
  | "mic"
  | "novo"
  | "exame"
  | "ciclo"
  | "pack"
  | "trials"
  | "jornada"
  | "whatsapp";

const BOTOES: readonly { id: AcaoDock; rotulo: string }[] = [
  { id: "mic", rotulo: "Mic" },
  { id: "novo", rotulo: "Novo registro" },
  { id: "exame", rotulo: "Solicitar exame" },
  { id: "ciclo", rotulo: "Ciclo QT" },
  { id: "pack", rotulo: "Tumor-pack" },
  { id: "trials", rotulo: "Trials" },
  { id: "jornada", rotulo: "Jornada 3D" },
  { id: "whatsapp", rotulo: "Encerrar · WhatsApp" },
];

/** Dock flutuante inferior (CURSOR-09). Alvos ≥ 44px. */
export function Dock({
  gravando,
  onAcao,
}: {
  gravando?: boolean;
  onAcao: (acao: AcaoDock) => void;
}) {
  return (
    <nav className="oc-dock" aria-label="Dock de ações">
      {BOTOES.map((b) => (
        <button
          key={b.id}
          type="button"
          className="oc-dock-btn"
          data-acao={b.id}
          data-min-touch="44"
          aria-pressed={b.id === "mic" ? !!gravando : undefined}
          onClick={() => onAcao(b.id)}
        >
          {b.rotulo}
        </button>
      ))}
    </nav>
  );
}
