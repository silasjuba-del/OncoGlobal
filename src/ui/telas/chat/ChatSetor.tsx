import { useState } from "react";
import type { ChatSetorVisao } from "../../api/porta.js";
import { ChipEstoque } from "./ChipEstoque.js";
import { CorrecaoFarmacia } from "./CorrecaoFarmacia.js";

/** Chat do setor. A farmácia não tem botão para alterar a prescrição. */
export function ChatSetor({ visao }: { visao: ChatSetorVisao }) {
  const [aberta, setAberta] = useState(false);
  const [respostas, setRespostas] = useState<readonly string[]>([]);
  const prescricao = visao.prescricao;

  return (
    <section aria-label={`Chat ${visao.setor}`} className="pilha">
      <h1>Chat {visao.setor}</h1>
      <ul>
        {visao.mensagens.map((mensagem) => (
          <li key={mensagem.mensagemId}>{mensagem.autor}: {mensagem.texto}</li>
        ))}
      </ul>
      {prescricao ? (
        <section aria-label="Prescrição no chat" className="pilha">
          <p>Prescrição: {prescricao.texto}</p>
          <p>Estado: {prescricao.estado}</p>
          <ChipEstoque chip={prescricao.chip} />
          <button type="button">prescrever</button>
          <CorrecaoFarmacia
            estado={prescricao.estado}
            proposta={prescricao.proposta}
            onAceitar={() => setAberta(true)}
            onResponder={(texto) => setRespostas((atual) => [...atual, texto])}
          />
          {aberta ? (
            <section aria-label="Prescrição aberta para correção">
              <p>{prescricao.texto}</p>
              <p>rascunho sem assinatura</p>
            </section>
          ) : null}
          {respostas.length > 0 ? (
            <ul aria-label="Respostas do médico">
              {respostas.map((texto) => <li key={texto}>{texto}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
