// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it(
    "mostra OncoGlobal — WORK e o aviso de dados sintéticos",
    async () => {
      render(<App />);
      expect(await screen.findByRole("heading", { name: "OncoGlobal — WORK" }, { timeout: 20_000 })).toBeTruthy();
      expect(screen.getByText("dados sintéticos")).toBeTruthy();
    },
    30_000,
  );
});
