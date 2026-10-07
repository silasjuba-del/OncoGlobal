/** Ícones de cromo da casca (busca, tema, alerta). Catálogo clínico continua em src/ui/icones. */

type NomeCromo = "busca" | "lua" | "sol" | "sino" | "chevron";

export function IconeCromo({ nome }: { nome: NomeCromo }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {nome === "busca" ? (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </>
      ) : null}
      {nome === "lua" ? <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" /> : null}
      {nome === "sol" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </>
      ) : null}
      {nome === "sino" ? (
        <>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </>
      ) : null}
      {nome === "chevron" ? <path d="M9 6l6 6-6 6" /> : null}
    </svg>
  );
}
