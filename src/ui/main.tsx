import { createRoot } from "react-dom/client";
// @ts-expect-error folha CSS pura, resolvida pelo Vite
import "./tema/base.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
