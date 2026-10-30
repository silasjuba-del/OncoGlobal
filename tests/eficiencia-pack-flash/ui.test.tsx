// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { FonteIntegralPack } from '../../src/ui/consulta/FonteIntegralPack.js';
import { SecaoAcordeon21st } from '../../src/ui/oncochart/PainelCombinacoes21st.js';
import { ConsultaPersistida } from '../../src/ui/consulta/ConsultaPersistida.js';
import { criarPortaFalsa, ID } from '../../src/ui/api/fake.js';
import { compactarRevisaoClinica, lerFontePack } from '../../src/server/leituraPack.js';
import { FontePackResposta, LotePackLeitura } from '../../src/contracts/fase2/leituraPack.js';
import { fixturePack } from './fixtures.js';
afterEach(cleanup);
const toggle = (aberto: boolean) => {
  const d = screen.getByText('Fonte integral, versão e preservação').closest('details')!;
  d.open = aberto; fireEvent(d, new Event('toggle'));
};
function pendente<T>() { let resolve!: (v:T)=>void; const promise = new Promise<T>(r=>{resolve=r;}); return { promise, resolve }; }

it('seção fechada não monta; abrir monta uma vez; recolher preserva edição e estado', async () => {
  const montagens = vi.fn();
  function Filho() { useEffect(() => { montagens(); }, []); return <input aria-label="Edição médica sintética" defaultValue=""/>; }
  const props = { id:'consulta-fase2' as const, numero:'01', titulo:'Pack', resumo:'Consulta', aoAlternar:()=>{}, aoFocarSomenteEste:()=>{} };
  const { rerender } = render(<SecaoAcordeon21st {...props} sobDemanda aberto={false}><Filho/></SecaoAcordeon21st>);
  expect(montagens).not.toHaveBeenCalled();
  rerender(<SecaoAcordeon21st {...props} sobDemanda aberto><Filho/></SecaoAcordeon21st>);
  fireEvent.change(screen.getByLabelText('Edição médica sintética'),{target:{value:'Escolha do médico'}});
  rerender(<SecaoAcordeon21st {...props} sobDemanda aberto={false}><Filho/></SecaoAcordeon21st>);
  rerender(<SecaoAcordeon21st {...props} sobDemanda aberto><Filho/></SecaoAcordeon21st>);
  expect(montagens).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText('Edição médica sintética') as HTMLInputElement).value).toBe('Escolha do médico');
});
it('fonte sob demanda reutiliza a mesma versão e não solicita nada antes de abrir', async () => {
  const f = fixturePack(), lote = LotePackLeitura.parse(compactarRevisaoClinica(f.resposta).loteCompleto);
  const carregar = vi.fn(async()=>lerFontePack(f.catalogo,f.pedido));
  render(<FonteIntegralPack lote={lote} carregar={carregar}/>);
  expect(carregar).not.toHaveBeenCalled(); toggle(true);
  await waitFor(()=>expect(document.querySelector('pre')?.textContent).toContain('Divergência sintética'));
  toggle(false); toggle(true);
  expect(carregar).toHaveBeenCalledTimes(1);
});
it('resposta tardia de outra versão é descartada; fonte divergente não vira conteúdo conferido', async () => {
  const f=fixturePack(), lote=LotePackLeitura.parse(compactarRevisaoClinica(f.resposta).loteCompleto);
  const a=pendente<FontePackResposta>(),b=pendente<FontePackResposta>();
  const carregar=vi.fn().mockImplementationOnce(()=>a.promise).mockImplementationOnce(()=>b.promise);
  const {rerender}=render(<FonteIntegralPack lote={lote} carregar={carregar}/>); toggle(true);
  const novo={...lote,original:{...lote.original,sha256:'b'.repeat(64)}};
  rerender(<FonteIntegralPack lote={novo} carregar={carregar}/>);
  await act(async()=>a.resolve(lerFontePack(f.catalogo,f.pedido)));
  expect(document.querySelector('pre')).toBeNull();
  await act(async()=>b.resolve(lerFontePack(f.catalogo,f.pedido)));
  expect(await screen.findByText(/Não foi possível conferir/)).toBeTruthy();
  expect(document.querySelector('pre')).toBeNull();
});
it('Flash abre sem pré-carregar timeline/base; timeline indisponível não é ausência de histórico', async () => {
  const porta=criarPortaFalsa(),base=vi.fn(async()=>{throw Error('sintético');}),timeline=vi.fn(async()=>{throw Error('sintético');});
  porta.carregarBaseAcaoComposta=base;porta.carregarTimelineMulticamadas=timeline;
  const visao=await porta.carregarConsulta(ID.verde,null,'en-verde');
  render(<ConsultaPersistida porta={porta} contexto={{patientId:visao.patientId,encounterId:visao.encounterId,tumorLotId:visao.tumorLotId}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Consulta Flash'}));
  expect(await screen.findByLabelText('Conteúdo da Consulta Flash')).toBeTruthy();
  expect(base).not.toHaveBeenCalled();expect(timeline).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Carregar timeline longitudinal'}));
  expect(await screen.findByText(/Não foi possível carregar a timeline/)).toBeTruthy();
  expect(timeline).toHaveBeenCalledTimes(1);
});
