import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirLedger } from "../../../src/kernel/ledger/db.ts";
import { receberTransporteSintetico } from "../../../src/server/canalEntrada.ts";

const pedido = JSON.parse(process.argv[2]);
const db = abrirComRetry(pedido.caminho);
try {
  aguardarPares(pedido.caminho, pedido.pares);
  const resultado = receberTransporteSintetico(db, pedido.entrada);
  process.stdout.write(JSON.stringify(resultado));
} finally {
  db.close();
}

function abrirComRetry(caminho) {
  let ultimo;
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    try {
      return abrirLedger(caminho);
    } catch (erro) {
      ultimo = erro;
      esperar(25);
    }
  }
  throw ultimo;
}

function aguardarPares(caminho, pares) {
  const barreira = `${caminho}.barreira`;
  mkdirSync(barreira, { recursive: true });
  writeFileSync(join(barreira, `${process.pid}`), "1");
  const limite = Date.now() + 8_000;
  while (readdirSync(barreira).filter((nome) => nome !== "largada").length < pares) {
    if (Date.now() > limite) throw new Error("BARREIRA_INCOMPLETA");
    esperar(15);
  }
  const marca = join(barreira, "largada");
  if (!existsSync(marca)) {
    try { writeFileSync(marca, String(Date.now() + 200), { flag: "wx" }); } catch { /* o outro processo gravou a largada */ }
  }
  const largada = Number(readFileSync(marca, "utf8"));
  while (Date.now() < largada) esperar(5);
}

function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
