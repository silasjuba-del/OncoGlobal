import { fileURLToPath } from "node:url";

function noFonte(parentURL) {
  if (!parentURL?.startsWith("file:")) return false;
  const caminho = fileURLToPath(parentURL).replaceAll("\\", "/");
  return caminho.includes("/src/") || caminho.includes("/tests/f2/grok/");
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".js") && noFonte(context.parentURL)) {
    try {
      return await nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    } catch {
      // O .js existe de verdade; segue o resolvedor padrão.
    }
  }
  return nextResolve(specifier, context);
}
