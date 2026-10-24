import { createRoot } from "react-dom/client";
// @ts-expect-error CSS resolvido pelo Vite
import "./tema/base.css";
import { DemonstracaoApp } from "./DemonstracaoApp.js";
const root = document.getElementById("root");
if (root) createRoot(root).render(<DemonstracaoApp />);
