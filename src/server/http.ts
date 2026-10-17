import { createServer, type Server } from "node:http";
import { rotear, type ServidorDeps } from "./rotas.js";
import { createSettingsService } from "../kernel/config/settings.js";
import { carregarCorpusServidor } from "./corpus.js";
import { criarMotorF1 } from "../kernel/orquestracao/runtime.js";
import { referenciaBibliotecaAtiva } from "./biblioteca.js";
import { carregarConfigMotor } from "../kernel/corpus/configMotor.js";
import { carregarPacksTumor } from '../kernel/corpus/tumorPacks.js';
import { selecionarPack } from '../modules/consulta/revisaoClinica.js';

/** Loopback only; a caller cannot override the bind address. */
export function criarServidorLocal(deps: ServidorDeps, config: { host?: string; port?: number } = {}): Server {
  if (config.host !== undefined && config.host !== "127.0.0.1")
    throw new Error("BIND_FORA_DO_LOOPBACK");
  let corpus: ReturnType<typeof carregarCorpusServidor> | null = null;
  try { corpus = carregarCorpusServidor(); } catch { /* dependent readers report PENDENTE */ }
  const ownsSettings = deps.settings === undefined && !!deps.configRootDir && !!corpus;
  const settings = deps.settings === undefined
    ? ownsSettings && deps.configRootDir && corpus
      ? createSettingsService({ rootDir: deps.configRootDir, caixas: corpus.caixasTodas, now: deps.agora })
      : null
    : deps.settings;
  const runtimeDeps: ServidorDeps = { ...deps, settings,
    corpus,
    salaoRuleset: deps.salaoRuleset === undefined ? corpus?.ruleset ?? null : deps.salaoRuleset };
  const configMotor=carregarConfigMotor();
  const catalogoTumorPacks=deps.catalogoTumorPacks??carregarPacksTumor();
  runtimeDeps.catalogoTumorPacks=catalogoTumorPacks;
  configMotor.regras=[...configMotor.regras,...catalogoTumorPacks.packs.filter(p=>p.estado==='ATIVO').map(p=>p.referencia)];
  runtimeDeps.packInvestigacao=deps.packInvestigacao??(r=>{const p=selecionarPack(r,catalogoTumorPacks.packs);
    return p?.estado==='ATIVO'?{referencia:p.referencia,status:'CONFERIDA_MEDICO',fonte:p.original.arquivo,requisitos:p.requisitos}:null;});
  runtimeDeps.motorF1=deps.motorF1??criarMotorF1(deps.db,deps.agora,()=>({...configMotor,biblioteca:referenciaBibliotecaAtiva(deps.db)??configMotor.biblioteca}));
  let encerrando = false;
  const pendentes = new Set<Promise<unknown>>();
  const acompanhar = (trabalho: Promise<unknown>) => {
    const acompanhado = trabalho.finally(() => pendentes.delete(acompanhado));
    pendentes.add(acompanhado);
    void acompanhado.catch(() => {}); // Os caminhos abaixo já registram erro sem conteúdo clínico.
  };
  acompanhar(runtimeDeps.motorF1.processar().catch(()=>deps.log({rota:"motor-f1",codigo:"RECUPERACAO_PENDENTE",status:503})));
  const server = createServer((req, res) => {
    if (encerrando) {
      res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ codigo: "SERVIDOR_ENCERRANDO" }));
      return;
    }
    acompanhar(rotear(runtimeDeps, req, res).then(()=>runtimeDeps.motorF1?.processar()).catch(() => {
      // The router handles expected failures; this fallback remains PHI-free.
      runtimeDeps.log({ rota: "desconhecida", codigo: "ERRO_INTERNO", status: 500 });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }));
  });
  // HTTP respondido não significa que o processamento pós-commit terminou.
  // O callback/evento close só libera o chamador para fechar SQLite após drenar esse trabalho.
  const fecharHttp = server.close.bind(server);
  let encerramento: Promise<Error | undefined> | null = null;
  server.close = (callback) => {
    if (!encerramento) {
      encerrando = true;
      encerramento = (async () => {
        while (pendentes.size) await Promise.allSettled([...pendentes]);
        return new Promise<Error | undefined>(resolve => fecharHttp(error => resolve(error)));
      })();
    }
    if (callback) void encerramento.then(error => callback(error));
    return server;
  };
  if (ownsSettings) server.on("close", () => settings?.close());
  server.listen(config.port ?? 0, "127.0.0.1");
  return server;
}
