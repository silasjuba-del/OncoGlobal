// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvestigacaoMinima } from '../../../src/ui/consulta/InvestigacaoMinima.js';
import type { PortaConsulta } from '../../../src/contracts/api/porta.js';
import type { InvestigacaoConsultaVisao } from '../../../src/contracts/api/investigacao.js';
afterEach(cleanup);
const ctx={patientId:'p',encounterId:'e',tumorLotId:'t'};
const out:InvestigacaoConsultaVisao={codigo:'INVESTIGACAO_CARREGADA',schema:'InvestigacaoConsulta@1',contexto:ctx,revisao:'rev',estado:'PENDENTE',fatos:[],resultado:null,lacunas:[{codigo:'PACK_NAO_APROVADO',texto:'Pack estruturado ainda não aprovado.',fatos:[]}]};
it('UI não consulta automaticamente; mostra ausência de pack ao clique sem inventar pedidos',async()=>{
 const investigar=vi.fn(async()=>out);render(<InvestigacaoMinima porta={{investigacao:investigar} as unknown as PortaConsulta} contexto={ctx}/>);
 expect(investigar).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Investigação e exames'}));
 expect(await screen.findByText(/PACK_NAO_APROVADO/)).toBeTruthy();expect(investigar).toHaveBeenCalledTimes(1);expect(screen.queryByText(/Minutas de pedidos/)).toBeNull();
});
it('troca de contexto remove resultado e resposta estrangeira permanece pendente',async()=>{
 const investigar=vi.fn(async()=>({...out,contexto:{...ctx,patientId:'outro'}}));render(<InvestigacaoMinima porta={{investigacao:investigar} as unknown as PortaConsulta} contexto={ctx}/>);
 fireEvent.click(screen.getByRole('button',{name:'Investigação e exames'}));expect(await screen.findByText(/contexto ou referências divergentes/)).toBeTruthy();expect(screen.queryByText(/PACK_NAO_APROVADO/)).toBeNull();
});
