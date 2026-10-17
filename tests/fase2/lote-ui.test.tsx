// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { OncoassistLocal } from '../../src/ui/OncoassistLocal.js';
import { criarPortaFalsa,ID } from '../../src/ui/api/fake.js';
afterEach(cleanup);
it('lote exige escolha explícita e muda o contexto usado nas fontes',async()=>{
  const porta=criarPortaFalsa(),base=await porta.carregarConsulta(ID.verde,'lot-verde','en-verde');
  porta.login=vi.fn(async()=>({ok:true,expiraEm:null}));
  porta.agendaDoDia=vi.fn(async()=>({hoje:'2026-10-16',itens:[{patientId:base.patientId,encounterId:base.encounterId,nome:'Paciente Sintético',horario:'10:00',prontuario:'sintetico',semaforo:'VERDE' as const,pendentes:0,preConsultaPronta:false,contatosDesdeUltima:0,temE1:false}]}));
  porta.carregarConsulta=vi.fn(async(_pid:string,lote?:string|null)=>({...base,tumorLotId:lote??null}));
  porta.oncoassistFontes=vi.fn(async()=>({fontes:[]}));const fabrica=()=>porta;
  porta.carregarFonteRevisao=vi.fn(async()=>{throw Error('FONTE_NAO_SELECIONADA_NESTE_TESTE');});
  render(<OncoassistLocal fabricaPorta={fabrica}/>);
  fireEvent.change(screen.getByLabelText('Senha do servidor'),{target:{value:'senha-sintetica-ui-fase2'}});fireEvent.click(screen.getByRole('button',{name:'Entrar'}));
  fireEvent.change(await screen.findByLabelText('Paciente da agenda'),{target:{value:base.encounterId}});
  const seletor=await screen.findByLabelText('Lote tumoral');expect((seletor as HTMLSelectElement).value).toBe('');
  const lote=base.cabecalho.lotes.find(l=>l.patientId===base.patientId)!;
  fireEvent.change(seletor,{target:{value:lote.tumorLotId}});
  await waitFor(()=>expect((screen.getByLabelText('Lote tumoral') as HTMLSelectElement).value).toBe(lote.tumorLotId));
  expect(porta.carregarConsulta).toHaveBeenCalledWith(base.patientId,lote.tumorLotId,base.encounterId);
  await waitFor(()=>expect(porta.oncoassistFontes).toHaveBeenCalledWith(expect.objectContaining({tumorLotId:lote.tumorLotId}),expect.any(AbortSignal)));
});
