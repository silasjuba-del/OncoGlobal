import { existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { abrirLedger } from "../kernel/ledger/db.js";
import { auditar } from "../kernel/ledger/ledger.js";
import { sqliteIdempotencia } from "../kernel/ledger/idempotencia.js";
import { criarGateway } from "../kernel/gateway/gateway.js";
import { criarGerenciadorSessao } from "../server/sessao.js";
import { criarServidorLocal } from "../server/http.js";
import { criarOncoassistJev } from "./oncoassist.js";

export interface OpcoesOncoassistLocal {
  dataDir: string;
  senha: string;
  medicoId: string;
  crm: string;
  port: number;
}

export function configuracaoOncoassistLocal(args: readonly string[], env: Readonly<Record<string, string | undefined>>): OpcoesOncoassistLocal {
  let dataDir: string | undefined;
  let porta = env.ONCOGLOBAL_API_PORT ?? "4181";
  for (let i = 0; i < args.length; i += 2) {
    const nome = args[i], valor = args[i + 1];
    if (!valor || valor.startsWith("--")) throw new Error("ARGUMENTOS_INVALIDOS");
    if (nome === "--data-dir" && dataDir === undefined) dataDir = valor;
    else if (nome === "--port") porta = valor;
    else throw new Error("ARGUMENTOS_INVALIDOS");
  }
  if (!dataDir || !isAbsolute(dataDir)) throw new Error("DATA_DIR_ABSOLUTO_OBRIGATORIO");
  if (!/^\d{1,5}$/.test(porta) || Number(porta) < 1 || Number(porta) > 65535) throw new Error("PORTA_INVALIDA");
  const senha = env.ONCOGLOBAL_SENHA;
  const medicoId = env.ONCOGLOBAL_MEDICO_ID?.trim();
  const crm = env.ONCOGLOBAL_CRM?.trim();
  if (!senha || senha.length < 12 || senha.length > 512 || !medicoId || !crm) throw new Error("CREDENCIAIS_LOCAIS_AUSENTES");
  return { dataDir: resolve(dataDir), senha, medicoId, crm, port: Number(porta) };
}

/** Opens the existing ledger. Never seeds patients or starts a second data store. */
export async function iniciarOncoassistLocal(opcoes: OpcoesOncoassistLocal) {
  if (!isAbsolute(opcoes.dataDir) || !Number.isInteger(opcoes.port) || opcoes.port < 1 || opcoes.port > 65535)
    throw new Error("CONFIGURACAO_LOCAL_INVALIDA");
  const arquivo = resolve(opcoes.dataDir, "ledger.sqlite");
  if (!existsSync(arquivo) || !statSync(arquivo).isFile()) throw new Error("LEDGER_LOCAL_AUSENTE");
  const agora = () => new Date().toISOString();
  const sessoes = criarGerenciadorSessao({ medicoId: opcoes.medicoId, crm: opcoes.crm,
    senha: opcoes.senha, duracaoMs: 8 * 60 * 60 * 1000, agora });
  const db = abrirLedger(arquivo);
  const gateway = criarGateway({ agora, store: sqliteIdempotencia(db), executores: {},
    auditar: (e) => auditar(db, { ator: { tipo: "SISTEMA", id: "oncoassist-local" },
      ...e, politicaVersao: "oncoassist-local-v1" }),
  });
  let fechado = false;
  const fecharDb = () => { if (!fechado) { fechado = true; db.close(); } };
  try {
    const server = criarServidorLocal({ db, sessoes, gateway, agora, log: () => {}, configRootDir: opcoes.dataDir,
      oncoassistJev: criarOncoassistJev(),
    }, { host: "127.0.0.1", port: opcoes.port });
    server.once("close", fecharDb);
    await new Promise<void>((ok, fail) => {
      const aoErro = () => { server.off("listening", aoEscutar); fail(new Error("SERVIDOR_LOCAL_INDISPONIVEL")); };
      const aoEscutar = () => { server.off("error", aoErro); ok(); };
      server.once("error", aoErro); server.once("listening", aoEscutar);
    });
    return {
      port: opcoes.port,
      async encerrar() { await new Promise<void>((ok) => { server.close(() => ok()); server.closeIdleConnections(); }); },
    };
  } catch { fecharDb(); throw new Error("SERVIDOR_LOCAL_INDISPONIVEL"); }
}

export async function startCLI(args = process.argv.slice(2)) {
  const config = configuracaoOncoassistLocal(args, process.env);
  const running = await iniciarOncoassistLocal(config);
  console.log(`OncoAssist: API local em 127.0.0.1:${running.port}. Abra /oncoassist.html na interface local.`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => { void running.encerrar().then(() => process.exit(0)); });
  return running;
}
