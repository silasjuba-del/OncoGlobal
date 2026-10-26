import { createRoot } from "react-dom/client";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./tema/base.css";
import { OncoassistLocal } from "./OncoassistLocal.js";

const root = document.getElementById("root");
const perfilLegado = (import.meta as ImportMeta & { env?: { VITE_ONCOGLOBAL_PERFIL?: string } }).env?.VITE_ONCOGLOBAL_PERFIL === "LEGADO";
if (root) createRoot(root).render(<OncoassistLocal perfil={perfilLegado ? "LEGADO" : "MEDICO"} />);
