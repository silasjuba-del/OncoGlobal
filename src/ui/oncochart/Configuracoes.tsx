import { useEffect, useState } from "react";
import { NUMERO_CAIXA_MODELO_FLASH, LABS_MODELO_FLASH, RAD_MODELO_FLASH, lerModeloFlashConfigurado, type ModeloFlash } from "../../config/flash.js";
import { NUMERO_CAIXA_RECEITUARIO_ESPECIAL, lerConfiguracaoServico } from "../../config/servico.js";
import type { PortaConsulta } from "../api/porta.js";
import type { TemaOnco } from "./tema.js";

let sequenciaOperacaoFlash = 0;

const GLOSSARIO: readonly { n: number; nome: string }[] = [
  { n: 8, nome: "Identidade" },
  { n: 21, nome: "Laudo / texto" },
  { n: 34, nome: "Achado estruturado" },
  { n: 45, nome: "Prescrição antineoplásica" },
];

/** Configurações + caixa de número + glossário (CURSOR-11, D-W9-16/17). */
export function Configuracoes({
  tema,
  onTema,
  onFechar,
  porta,
  somenteFlash = false,
  incluirServico = false,
}: {
  somenteFlash?: boolean;
  /** Caixa 18 autenticada, sem abrir a tela demonstrativa com CNES fixo. */
  incluirServico?: boolean;
  tema: TemaOnco;
  onTema: (t: TemaOnco) => void;
  onFechar: () => void;
  porta?: Pick<PortaConsulta, "lerCaixaConfiguracao" | "alterarCaixaConfiguracao">;
}) {
  const [caixaN, setCaixaN] = useState("");
  const [dado, setDado] = useState("");
  const [salvo, setSalvo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [cnes] = useState("2605473");
  const [personalizar, setPersonalizar] = useState(false);
  const [modeloFlash, setModeloFlash] = useState<ModeloFlash>({ laboratorio: false, imagem: false });
  const [outrosLab, setOutrosLab] = useState("");
  const [outrosRad, setOutrosRad] = useState("");
  const [especial, setEspecial] = useState(false);
  const [revisaoServico, setRevisaoServico] = useState<number | null>(null);
  const [servicoOcupado, setServicoOcupado] = useState(false);
  const [mensagemServico, setMensagemServico] = useState("Carregando configuração do serviço…");
  const [revisaoFlash, setRevisaoFlash] = useState<number | null>(null);
  const [estadoFlash, setEstadoFlash] = useState<"CARREGANDO" | "PRONTO" | "ERRO">("CARREGANDO");
  const [mensagemFlash, setMensagemFlash] = useState("Carregando configuração autenticada…");
  const [salvandoFlash, setSalvandoFlash] = useState(false);

  useEffect(() => {
    let ativa = true;
    setEstadoFlash("CARREGANDO"); setRevisaoFlash(null);
    setMensagemFlash("Carregando configuração autenticada…");
    if (!porta?.lerCaixaConfiguracao) {
      setEstadoFlash("ERRO");
      setMensagemFlash("Persistência autenticada indisponível nesta tela.");
      return () => { ativa = false; };
    }
    void porta.lerCaixaConfiguracao(NUMERO_CAIXA_MODELO_FLASH).then(({ revision, value }) => {
      if (!ativa) return;
      const modelo=lerModeloFlashConfigurado(value);
      if (value !== null && !modelo) {
        setEstadoFlash("ERRO");
        setMensagemFlash("Valor armazenado inválido; modelo não foi carregado.");
        return;
      }
      setModeloFlash(modelo ?? {laboratorio:false,imagem:false});
      setOutrosLab(modelo?.solicitacoes?.laboratorio.filter(x=>!LABS_MODELO_FLASH.includes(x)).join("; ") ?? "");
      setOutrosRad(modelo?.solicitacoes?.imagem.filter(x=>!RAD_MODELO_FLASH.includes(x)).join("; ") ?? "");
      setRevisaoFlash(revision);
      setEstadoFlash("PRONTO");
      setMensagemFlash(value === null ? "Sem modelo salvo; nada será pré-marcado." : "Modelo salvo carregado.");
    }, (erro: unknown) => {
      if (!ativa) return;
      setEstadoFlash("ERRO");
      setMensagemFlash(erro instanceof Error ? `Não foi possível ler a configuração: ${erro.message}` : "Não foi possível ler a configuração.");
    });
    return () => { ativa = false; };
  }, [porta]);

  useEffect(()=>{
    let ativa=true; setRevisaoServico(null); setEspecial(false);
    if(!porta?.lerCaixaConfiguracao || !(incluirServico || !somenteFlash)) return ()=>{ativa=false;};
    void porta.lerCaixaConfiguracao(NUMERO_CAIXA_RECEITUARIO_ESPECIAL).then(({revision,value})=>{
      if(!ativa) return; setEspecial(lerConfiguracaoServico(value).servicoTemReceituarioEspecial);
      setRevisaoServico(revision); setMensagemServico("Configuração do serviço carregada.");
    },()=>{if(ativa) setMensagemServico("Não foi possível carregar a configuração do serviço.");});
    return ()=>{ativa=false;};
  },[porta,somenteFlash,incluirServico]);

  async function salvarServico() {
    if(revisaoServico===null || servicoOcupado || !porta?.alterarCaixaConfiguracao) return;
    setServicoOcupado(true);
    try {
      const r=await porta.alterarCaixaConfiguracao({numero:NUMERO_CAIXA_RECEITUARIO_ESPECIAL,
        valorNovo:{servicoTemReceituarioEspecial:especial},expectedRevision:revisaoServico,
        operationId:`servico-receituario-${Date.now()}-${++sequenciaOperacaoFlash}`});
      setRevisaoServico(r.revision);setMensagemServico("Configuração do serviço gravada.");
    } catch(e) {setMensagemServico(e instanceof Error ? `Não foi possível gravar: ${e.message}` : "Falha ao gravar configuração.");}
    finally{setServicoOcupado(false);}
  }

  async function salvarModeloFlash() {
    if (!porta?.alterarCaixaConfiguracao || revisaoFlash === null || salvandoFlash) return;
    setSalvandoFlash(true);
    try {
      const outros=(texto:string)=>texto.split(";").map(x=>x.trim()).filter(Boolean);
      const laboratorio=[...new Set([...(modeloFlash.solicitacoes?.laboratorio ?? []).filter(x=>LABS_MODELO_FLASH.includes(x)),...outros(outrosLab)])];
      const imagem=[...new Set([...(modeloFlash.solicitacoes?.imagem ?? []).filter(x=>RAD_MODELO_FLASH.includes(x)),...outros(outrosRad)])];
      const novo:ModeloFlash={laboratorio:laboratorio.length>0,imagem:imagem.length>0,solicitacoes:{laboratorio,imagem}};
      if(!lerModeloFlashConfigurado(novo)) throw new Error("Use até 50 itens por seção, com até 200 caracteres por item.");
      const alteracao = await porta.alterarCaixaConfiguracao({ numero: NUMERO_CAIXA_MODELO_FLASH,
        valorNovo: novo, expectedRevision: revisaoFlash,
        operationId: `flash-modelo-${Date.now()}-${++sequenciaOperacaoFlash}` });
      setRevisaoFlash(alteracao.revision);
      setModeloFlash(novo);
      setMensagemFlash(alteracao.estado === "REPLAY" ? "Modelo já estava salvo." : "Modelo Flash gravado no servidor.");
    } catch (erro) {
      setMensagemFlash(erro instanceof Error ? `Não foi possível gravar: ${erro.message}` : "Não foi possível gravar o modelo.");
    } finally {
      setSalvandoFlash(false);
    }
  }

  const hits = GLOSSARIO.filter(
    (g) =>
      !busca.trim() ||
      String(g.n).includes(busca) ||
      g.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const painelFlash = (<section aria-label="Modelo padrão da Consulta Flash" aria-busy={estadoFlash === "CARREGANDO" || salvandoFlash}>
        <h3>Modelo padrão da Consulta Flash</h3>
        <p>As opções marcadas são uma preferência editável do médico. A Consulta Flash continua revisável antes de qualquer assinatura.</p>
        <p>Selecione os exames exatos. QT nunca é pré-marcada pelo modelo.</p>
        {modeloFlash.solicitacoes===undefined && (modeloFlash.laboratorio || modeloFlash.imagem) && <p>O modelo antigo não identificava exames. Escolha os itens para atualizar.</p>}
        {([['laboratorio',LABS_MODELO_FLASH,'LAB'],['imagem',RAD_MODELO_FLASH,'RAD']] as const).map(([grupo,itens,titulo])=><fieldset key={grupo} disabled={estadoFlash!=="PRONTO" || salvandoFlash}>
          <legend>{titulo}</legend>
          {itens.map(exame=><label key={exame}><input type="checkbox" aria-label={`Modelo ${exame}`} checked={modeloFlash.solicitacoes?.[grupo].includes(exame) ?? false}
            onChange={e=>setModeloFlash(atual=>{const listas=atual.solicitacoes ?? {laboratorio:[],imagem:[]};return {...atual,solicitacoes:{...listas,[grupo]:e.target.checked ? [...listas[grupo],exame] : listas[grupo].filter(x=>x!==exame)}};})}/>{exame}</label>)}
          <label>Outros<input aria-label={`Modelo outros ${titulo}`} value={grupo==='laboratorio' ? outrosLab : outrosRad} onChange={e=>grupo==='laboratorio' ? setOutrosLab(e.target.value) : setOutrosRad(e.target.value)} placeholder="Médico escreve; separe por ;" maxLength={2000}/></label>
        </fieldset>)}
        <button type="button" className="oc-btn-primary" onClick={() => void salvarModeloFlash()}
          disabled={estadoFlash !== "PRONTO" || salvandoFlash || !porta?.alterarCaixaConfiguracao}>
          {salvandoFlash ? "Salvando…" : "Salvar modelo Flash"}
        </button>
        <p aria-label="status configuração Flash" aria-live="polite">{mensagemFlash}</p>
      </section>);
  const painelServico = (<section aria-label="Configuração do receituário especial">
        <h3>Receituário especial</h3>
        <label><input type="checkbox" aria-label="Serviço possui receituário especial" checked={especial} disabled={revisaoServico===null || servicoOcupado} onChange={e=>setEspecial(e.target.checked)}/>Serviço possui receituário especial</label>
        <button type="button" disabled={revisaoServico===null || servicoOcupado || !porta?.alterarCaixaConfiguracao} onClick={()=>void salvarServico()}>Salvar configuração do serviço</button>
        <p aria-label="status configuração serviço" aria-live="polite">{mensagemServico}</p>
      </section>);
  if (somenteFlash) return <section aria-label="Configurações da Consulta Flash">{painelFlash}{incluirServico ? painelServico : null}</section>;

  return (
    <div className="oc-cfg" role="dialog" aria-label="Configurações">
      <header className="oc-cfg-h">
        <h2>Configurações</h2>
        <button type="button" onClick={onFechar} aria-label="Fechar configurações">
          Fechar
        </button>
      </header>

      <section aria-label="Identidade profissional">
        <h3>Identidade</h3>
        <label>
          Telefone
          <input aria-label="Telefone" defaultValue="" />
        </label>
        <label>
          CRM
          <input aria-label="CRM" defaultValue="" />
        </label>
        <label>
          Hospital
          <input aria-label="Hospital" defaultValue="" />
        </label>
        <label>
          CNES (exemplo editável)
          <input aria-label="CNES" defaultValue={cnes} />
        </label>
        <label>
          CNS
          <input aria-label="CNS" defaultValue="" />
        </label>
      </section>

      <section aria-label="Layout e tema">
        <h3>Layout</h3>
        <div role="group" aria-label="Tema DIA NOITE PERSONALIZAR">
          <button
            type="button"
            aria-pressed={!personalizar && tema === "dia"}
            data-tema-opcao="dia"
            onClick={() => {
              setPersonalizar(false);
              onTema("dia");
            }}
          >
            DIA
          </button>
          <button
            type="button"
            aria-pressed={!personalizar && tema === "noite"}
            data-tema-opcao="noite"
            onClick={() => {
              setPersonalizar(false);
              onTema("noite");
            }}
          >
            NOITE
          </button>
          <button
            type="button"
            aria-pressed={personalizar}
            data-tema-opcao="personalizar"
            onClick={() => setPersonalizar(true)}
          >
            PERSONALIZAR
          </button>
        </div>
        <p className="oc-muted">MCP/plugins externos nascem desligados.</p>
      </section>

      <section aria-label="Caixa de número">
        <h3>Caixa de número</h3>
        <label>
          Nº da caixa
          <input
            aria-label="Número da caixa"
            value={caixaN}
            onChange={(e) => setCaixaN(e.target.value)}
          />
        </label>
        <label>
          Dado
          <input
            aria-label="Dado da caixa"
            value={dado}
            onChange={(e) => setDado(e.target.value)}
          />
        </label>
        {caixaN ? (
          <p>
            Caixa #{caixaN}: valor antigo ={" "}
            {GLOSSARIO.find((g) => String(g.n) === caixaN)?.nome ?? "PENDENTE"}
          </p>
        ) : null}
        <button
          type="button"
          className="oc-btn-primary"
          onClick={() => setSalvo(`salvo #${caixaN} → ${dado} (evento versionado sintético)`)}
        >
          Salvar (1 clique)
        </button>
        {salvo ? (
          <p role="status">{salvo}</p>
        ) : null}
      </section>

      {painelFlash}
      {painelServico}

      <section aria-label="Glossário de caixas">
        <h3>Glossário</h3>
        <label>
          Pesquisar
          <input
            aria-label="Pesquisar glossário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <ul>
          {hits.map((g) => (
            <li key={g.n}>
              <button type="button" onClick={() => setCaixaN(String(g.n))}>
                #{g.n} {g.nome}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Esteira de UI">
        <h3>Esteira de UI</h3>
        <p className="oc-muted">Versões em uso — padrão PADROES-UI §4 (sintético).</p>
        <ul>
          <li>Consulta · W10-CURSOR</li>
          <li>Prescrição · Modelo 05</li>
          <li>Jornada 3D · CSS preserve-3d</li>
        </ul>
      </section>
    </div>
  );
}

