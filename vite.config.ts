import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const plugins = [];
  if (!process.env.VITEST) {
    const { default: react } = await import("@vitejs/plugin-react");
    plugins.push(react());
  }
  return {
    plugins,
    test: {
      // O plugin do React junto do jsdom estoura os 60s de arranque do worker no Windows.
      pool: "threads",
    },
  };
});
