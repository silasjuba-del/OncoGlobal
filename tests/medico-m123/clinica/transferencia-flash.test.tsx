// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConsultaFlash } from '../../../src/ui/consulta/ConsultaFlash.js';
import type { ConsultaFlashProps, DocumentoManualFlash } from '../../../src/contracts/api/flash.js';
afterEach(cleanup);
const atual: DocumentoManualFlash = { id: 'orientacao-sintetica', tipo: 'ORIENTACOES', titulo: 'Orientação SINTETICA', destino: null, texto: 'Texto editado e salvo pelo médico.' };
function props(): ConsultaFlashProps {
  const apac = { cid:'',sigtap:'',finalidade:'',competencia:'',estado:'PENDENTE' as const,pendencias:[] };
  return { cabecalho:{},exames:[],acoesHoje:[],receitas:[],apac,iaFala:[],retorno:{dias:14,examesAntesDoRetorno:[]},
    planoInicial:{acoesMarcadas:[],receitasMarcadas:[],apac:{...apac,emitir:false},retorno:{dias:14,examesAntesDoRetorno:[]},documentosManuais:[atual]},
    aoSalvarRascunho:vi.fn(),aoFinalizar:vi.fn() };
}
it('nova proposta divergente não sobrescreve texto médico até escolha explícita', async()=>{
  const p=props(), consumir=vi.fn();
  render(<ConsultaFlash {...p} documentoProposto={{...atual,texto:'Nova proposta SINTETICA',solicitacaoId:'envio-1'}} aoConsumirDocumentoProposto={consumir}/>);
  await screen.findByRole('alert',{name:'Revisar substituição de documento'});
  expect((screen.getByLabelText(/Conteúdo do documento 1/) as HTMLTextAreaElement).value).toBe(atual.texto);
  expect(consumir).toHaveBeenCalledWith('envio-1');
  expect((screen.getByRole('button',{name:'SALVAR RASCUNHO'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Manter texto atual'}));
  fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));
  expect(p.aoSalvarRascunho).toHaveBeenCalledWith(expect.objectContaining({documentosManuais:[atual]}));
});
it('substituição explicitamente aceita conserva um único documento e suas edições posteriores', async()=>{
  const p=props();
  const view=render(<ConsultaFlash {...p} documentoProposto={{...atual,texto:'Nova proposta',solicitacaoId:'envio-2'}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Substituir pelo texto proposto'}));
  const campo=screen.getByLabelText(/Conteúdo do documento 1/);
  fireEvent.change(campo,{target:{value:'Edição posterior revisada'}});
  view.rerender(<ConsultaFlash {...p} documentoProposto={{...atual,texto:'Nova proposta',solicitacaoId:'envio-2'}}/>);
  await waitFor(()=>expect((campo as HTMLTextAreaElement).value).toBe('Edição posterior revisada'));
  fireEvent.click(screen.getByRole('button',{name:'SALVAR RASCUNHO'}));
  expect(p.aoSalvarRascunho).toHaveBeenCalledWith(expect.objectContaining({documentosManuais:[{...atual,texto:'Edição posterior revisada'}]}));
});
