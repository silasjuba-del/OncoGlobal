// W8-MUSE · MU-04 · ícones de estado (sempre com palavra — ver ESTADOS.md).
import { Icone } from "./Icone.js";

export function IconeAlerta() {
  return (
    <Icone>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.4v.3" />
    </Icone>
  );
}

export function IconePendente() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none" />
    </Icone>
  );
}

export function IconeConflito() {
  return (
    <Icone>
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="5.5" cy="19.5" r="2" />
      <circle cx="18.5" cy="19.5" r="2" />
      <path d="M12 6.5v4c0 3-2.5 4-4.8 4.7M12 10.5c0 3 2.5 4 4.8 4.7" />
    </Icone>
  );
}

export function IconeAssinado() {
  return (
    <Icone>
      <path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 013 3L8 19l-4 1z" />
      <path d="M14.5 6.5l3 3" />
    </Icone>
  );
}

export function IconeRascunho() {
  return (
    <Icone>
      <rect x="5" y="3" width="14" height="18" rx="2" strokeDasharray="3.5 2.5" />
      <path d="M9 9h6M9 13h6" />
    </Icone>
  );
}

export function IconeE1() {
  return (
    <Icone>
      <path d="M6 16v-5a6 6 0 0112 0v5l1.5 2.5h-15z" />
      <path d="M10 21a2 2 0 004 0" />
    </Icone>
  );
}

export function IconeRiscado() {
  return (
    <Icone>
      <path d="M3 8h18M3 16h18" />
      <path d="M4.5 20L19.5 4" />
    </Icone>
  );
}
