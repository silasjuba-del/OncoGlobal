
export type TarefaRetornoId = "retorno" | "laboratorio" | "imagem";

export type MarcacaoTarefasRetorno = Readonly<Record<TarefaRetornoId, boolean>>;
