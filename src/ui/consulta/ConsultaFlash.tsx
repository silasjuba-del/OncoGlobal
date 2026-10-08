import { useState } from "react";
import { marcadoInicialmente } from "./Bundle.js";
import { COPY_PT_BR } from "../copy/pt-BR.js";
import { TarefasRetorno, type MarcacaoTarefasRetorno, type TarefaRetornoId } from "./TarefasRetorno.js";
import { montarLinhaPontualizada } from "./viewmodels.js";

/**
 * Consulta Flash (one click). Decisão PLN-031 (fonte M-AK).
 * O componente NÃO executa efeitos. Os botões só entregam o plano ao chamador
 * (aoSalvarRascunho / aoFinalizar) para o médico ver antes.
 * Ausente = PENDENTE. Semáforo sem amarelo. Nunca "liberado/aprovado/apto".
 */

export type SituacaoExame = "DENTRO_DO_LIMITE" | "FORA_DO_LIMITE" | "SEM_REFERENCIA";

export interface ExameRecenteFlash {
  data: string;
  nome: string;
  /** Frase do laudo, exibida tal como veio. Nunca rótulo genérico. */
  fraseLaudo?: string;
  situacao: SituacaoExame;
}

export interface ItemFlash {
  id: string;
  rotulo: string;
  origem: "MODELO_MEDICO" | "SUGESTAO";
  preMarcado: boolean;
}

export type EstadoApacFlash = "VALIDA" | "PENDENTE" | "INCOMPATIVEL";

export interface ApacFlash {
  cid: string;
  sigtap: string;
  finalidade: string;
  competencia: string;
  estado: EstadoApacFlash;
  pendencias: readonly string[];
}

export interface RetornoFlash {
  dias: number | null;
  motivo?: string;
  examesAntesDoRetorno: readonly string[];
}

/** Itens do cartão "Tarefas do retorno". Pré-seleção vem só do modelo padrão salvo (origem MODELO_MEDICO). */
export interface TarefasRetornoFlash {
  modeloPadraoSalvo: boolean;
  retorno: ItemFlash;
  /** Laboratório está sempre presente. */
  laboratorio: ItemFlash;
  imagem: ItemFlash;
}

export interface ConsultaFlashProps {
  cabecalho: {
    diagnostico?: string;
    tnm?: string;
    estadio?: string;
    biomarcador?: string;
    antecedentes?: string;
    medicacoesUso?: string;
    alergia?: string;
    ecog?: string;
    tratamentoAtual?: string;
    linha?: string;
    cicloDia?: string;
  };
  exames: readonly ExameRecenteFlash[];
  acoesHoje: readonly ItemFlash[];
  receitas: readonly ItemFlash[];
  apac: ApacFlash;
  iaFala: readonly string[];
  retorno: RetornoFlash;
  /** Quando presente, mostra o cartão "Tarefas do retorno". */
  tarefasRetorno?: TarefasRetornoFlash;
  /** Mostra a linha pontualizada dos achados-chave no topo. */
  linhaPontualizada?: boolean;
  aoSalvarRascunho: (plano: PlanoFlash) => void;
  aoFinalizar: (plano: PlanoFlash) => void;
}

/** Plano entregue ao chamador. Não emite nada: APAC sempre rascunho. */
export interface PlanoFlash {
  acoesMarcadas: readonly string[];
  receitasMarcadas: readonly string[];
  apac: ApacFlash & { emitir: false };
  retorno: RetornoFlash;
  /** Presente só quando o cartão de tarefas do retorno foi exibido. */
  tarefasRetorno?: MarcacaoTarefasRetorno;
}

const ID_LIBERAR_TRATAMENTO = "liberar_tratamento";

/** Marcação inicial. Receita só pré-marca se origem MODELO_MEDICO. "Liberar tratamento" nunca nasce marcada. */
export function marcadoInicialFlash(item: ItemFlash): boolean {
  if (item.id === ID_LIBERAR_TRATAMENTO) return false;
  return marcadoInicialmente({
    documentId: item.id,
    documentVersion: 1,
    titulo: item.rotulo,
    preMarcado: item.preMarcado,
    visivel: true,
    origem: item.origem,
  });
}

const TEXTO_SITUACAO: Record<SituacaoExame, string> = {
  DENTRO_DO_LIMITE: "dentro do limite",
  FORA_DO_LIMITE: "fora do limite",
  SEM_REFERENCIA: "sem referência",
};

const TEXTO_CHIP_APAC: Record<EstadoApacFlash, string> = {
  VALIDA: "✓ VERDE",
  PENDENTE: "! PENDENTE",
  INCOMPATIVEL: "× VERMELHO",
};

function valorOuPendente(v: string | undefined): string {
  return v && v.trim().length > 0 ? v : "PENDENTE";
}

export function ConsultaFlash(props: ConsultaFlashProps) {
  const { cabecalho, exames, acoesHoje, receitas, apac, iaFala, retorno, tarefasRetorno } = props;

  const [tarefas, setTarefas] = useState<MarcacaoTarefasRetorno>(() => {
    if (!tarefasRetorno || !tarefasRetorno.modeloPadraoSalvo) {
      return { retorno: false, laboratorio: false, imagem: false };
    }
    return {
      retorno: marcadoInicialFlash(tarefasRetorno.retorno),
      laboratorio: marcadoInicialFlash(tarefasRetorno.laboratorio),
      imagem: marcadoInicialFlash(tarefasRetorno.imagem),
    };
  });

  function alternarTarefa(id: TarefaRetornoId) {
    setTarefas((atual) => ({ ...atual, [id]: !atual[id] }));
  }

  const linha = props.linhaPontualizada
    ? montarLinhaPontualizada({ diagnostico: cabecalho.diagnostico, exames })
    : "";

  const [marcadas, setMarcadas] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    for (const a of acoesHoje) inicial[`acao:${a.id}`] = marcadoInicialFlash(a);
    for (const r of receitas) inicial[`receita:${r.id}`] = marcadoInicialFlash(r);
    return inicial;
  });

  function alternar(chave: string) {
    setMarcadas((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  function montarPlano(): PlanoFlash {
    return {
      acoesMarcadas: acoesHoje.filter((a) => marcadas[`acao:${a.id}`] === true).map((a) => a.id),
      receitasMarcadas: receitas.filter((r) => marcadas[`receita:${r.id}`] === true).map((r) => r.id),
      apac: { ...apac, pendencias: [...apac.pendencias], emitir: false },
      retorno: { ...retorno, examesAntesDoRetorno: [...retorno.examesAntesDoRetorno] },
      ...(tarefasRetorno ? { tarefasRetorno: { ...tarefas } } : {}),
    };
  }

  return (
    <section role="dialog" aria-label="Consulta flash">
      <header>
        <p>
          <strong>CONSULTA FLASH</strong>
        </p>
        {linha ? <p aria-label={COPY_PT_BR.flashRetorno.achadosChave}>{linha}</p> : null}
        <p>
          DX: {valorOuPendente(cabecalho.diagnostico)} · TNM: {valorOuPendente(cabecalho.tnm)} · Estádio:{" "}
          {valorOuPendente(cabecalho.estadio)} · Biomarcador: {valorOuPendente(cabecalho.biomarcador)}
        </p>
        <p>
          AP: {valorOuPendente(cabecalho.antecedentes)} · MUC: {valorOuPendente(cabecalho.medicacoesUso)} · Alergia:{" "}
          {valorOuPendente(cabecalho.alergia)} · ECOG: {valorOuPendente(cabecalho.ecog)}
        </p>
        <p>
          Tratamento: {valorOuPendente(cabecalho.tratamentoAtual)} · Linha: {valorOuPendente(cabecalho.linha)} · Ciclo/dia:{" "}
          {valorOuPendente(cabecalho.cicloDia)}
        </p>
        <p>
          RETORNO: {retorno.dias === null ? "PENDENTE" : `${retorno.dias} DIAS`}
          {retorno.motivo ? ` · ${retorno.motivo}` : ""}
        </p>
      </header>

      {tarefasRetorno ? (
        <TarefasRetorno
          prazoDias={retorno.dias}
          marcadas={tarefas}
          modeloPadraoSalvo={tarefasRetorno.modeloPadraoSalvo}
          onAlternar={alternarTarefa}
        />
      ) : null}

      <section aria-label="Exames recentes">
        <h2>Exames recentes</h2>
        {exames.length === 0 ? (
          <p>nenhum exame recente</p>
        ) : (
          <ul>
            {exames.map((e, i) => (
              <li key={`${e.data}-${e.nome}-${i}`}>
                {e.data} · {e.nome} · {e.fraseLaudo ?? "laudo sem frase"} · {TEXTO_SITUACAO[e.situacao]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Ações de hoje">
        <h2>Hoje</h2>
        <ul>
          {acoesHoje.map((a) => (
            <li key={`acao:${a.id}`}>
              <label>
                <input
                  type="checkbox"
                  checked={marcadas[`acao:${a.id}`] === true}
                  onChange={() => alternar(`acao:${a.id}`)}
                />
                {a.rotulo}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Receitas pré-selecionadas">
        <h2>Receitas pré-selecionadas</h2>
        <ul>
          {receitas.map((r) => (
            <li key={`receita:${r.id}`}>
              <label>
                <input
                  type="checkbox"
                  checked={marcadas[`receita:${r.id}`] === true}
                  onChange={() => alternar(`receita:${r.id}`)}
                />
                {r.rotulo}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="APAC e SIGTAP">
        <h2>APAC / SUS</h2>
        <p>
          CID {valorOuPendente(apac.cid)} · SIGTAP {valorOuPendente(apac.sigtap)} · {valorOuPendente(apac.finalidade)} ·{" "}
          <span aria-label="estado da APAC">APAC {TEXTO_CHIP_APAC[apac.estado]}</span>
        </p>
        <p>
          Competência {valorOuPendente(apac.competencia)} ·{" "}
          {apac.pendencias.length === 0 ? "sem pendências" : `pendências: ${apac.pendencias.join("; ")}`}
        </p>
      </section>

      <section aria-label="IA fala">
        <h2>IA fala</h2>
        <ul>
          {iaFala.map((linha, i) => (
            <li key={i}>{linha}</li>
          ))}
        </ul>
      </section>

      <footer>
        <button type="button" onClick={() => props.aoSalvarRascunho(montarPlano())}>
          SALVAR RASCUNHO
        </button>
        <button type="button" onClick={() => props.aoFinalizar(montarPlano())}>
          FINALIZAR · IMPRIMIR · SAIR
        </button>
      </footer>
    </section>
  );
}
