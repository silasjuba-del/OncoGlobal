// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App.js";

describe("App", () => {
  it("mostra OncoGlobal — WORK e o aviso de dados sintéticos", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "OncoGlobal — WORK" })).toBeTruthy();
    expect(screen.getByText("dados sintéticos")).toBeTruthy();
  });
});
