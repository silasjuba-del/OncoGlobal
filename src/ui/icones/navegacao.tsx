// W8-MUSE · MU-04 · ícones da barra lateral (ordem do modelo).
import { Icone } from "./Icone.js";

export function IconeResumo() {
  return (
    <Icone>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </Icone>
  );
}

export function IconeProntuario() {
  return (
    <Icone>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </Icone>
  );
}

export function IconeExames() {
  return (
    <Icone>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17.5l5-4 4 3 3-2.5 4 3.5" />
    </Icone>
  );
}

export function IconePrescricao() {
  return (
    <Icone>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M9.5 9.5l5 5" />
    </Icone>
  );
}

export function IconeApac() {
  return (
    <Icone>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9.3 14.5l2 2 3.6-4.2" />
    </Icone>
  );
}

export function IconeDocumentos() {
  return (
    <Icone>
      <rect x="7" y="7" width="13" height="14" rx="2" />
      <path d="M7 9V5a2 2 0 012-2h8" />
      <path d="M11 13h5M11 17h5" />
    </Icone>
  );
}

export function IconeAgenda() {
  return (
    <Icone>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <path d="M8 14h3M8 17.5h5" />
    </Icone>
  );
}

export function IconeEnfermagem() {
  return (
    <Icone>
      <path d="M12 20.5S4 15.5 4 10a4.2 4.2 0 017-3.1A4.2 4.2 0 0120 10c0 5.5-8 10.5-8 10.5z" />
      <path d="M7 11.5h2.5l1.2-2 1.8 4l1.2-2H17" />
    </Icone>
  );
}

export function IconeFarmacia() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </Icone>
  );
}

export function IconeRelatorios() {
  return (
    <Icone>
      <path d="M4 4v16h16" />
      <path d="M8.5 15v-4M13 15V8M17.5 15v-6.5" />
    </Icone>
  );
}

export function IconeConfiguracoes() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="3" />
      <path d="M17.5 12H20M12 17.5V20M6.5 12H4M12 6.5V4" />
      <path d="M15.9 15.9l1.8 1.8M8.1 15.9l-1.8 1.8M8.1 8.1L6.3 6.3M15.9 8.1l1.8-1.8" />
    </Icone>
  );
}
