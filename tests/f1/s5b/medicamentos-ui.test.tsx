// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {ReconciliarMedicamentos} from '../../../src/ui/consulta/ReconciliarMedicamentos.js';
import {criarPortaFalsa} from '../../../src/ui/api/fake.js';
import {ErroPorta} from '../../../src/ui/api/porta.js';
afterEach(cleanup);
const ctx={patientId:'p',encounterId:'e',tumorLotId:null};
it('atestado inicia desmarcado; lista vazia confirmada notifica somente após escrita',async()=>{const porta=criarPortaFalsa(),callback=vi.fn();let liberar!:(r:{codigo:'GRAVADA';eventId:string})=>void;
 porta.reconciliarMedicamentos=vi.fn(()=>new Promise<{codigo:"GRAVADA";eventId:string}>(r=>{liberar=r;}));render(<ReconciliarMedicamentos porta={porta} contexto={ctx} aoFatosConfirmados={callback}/>);
 const button=screen.getByRole('button',{name:'Confirmar lista atual'}) as HTMLButtonElement;expect(button.disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);expect(callback).not.toHaveBeenCalled();expect(porta.reconciliarMedicamentos).toHaveBeenCalledWith(expect.objectContaining({medicamentos:[],listaAtualCompleta:true,...ctx}),expect.any(AbortSignal));
 liberar({codigo:'GRAVADA',eventId:'f'});await waitFor(()=>expect(callback).toHaveBeenCalledWith(ctx));
});
it('erro expõe referências; resposta tardia em outro contexto não notifica',async()=>{const porta=criarPortaFalsa(),callback=vi.fn();porta.reconciliarMedicamentos=vi.fn(async()=>{throw new ErroPorta('LISTA_MEDICAMENTOS_CONFLITANTE','f1, f2');});
 const r=render(<ReconciliarMedicamentos porta={porta} contexto={ctx} aoFatosConfirmados={callback}/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button'));await screen.findByText(/Referências: f1, f2/);expect(callback).not.toHaveBeenCalled();
 let liberar!:(r:{codigo:'REPLAY';eventId:string})=>void;porta.reconciliarMedicamentos=vi.fn(()=>new Promise<{codigo:"REPLAY";eventId:string}>(resolve=>{liberar=resolve;}));fireEvent.click(screen.getByRole('button'));
 r.rerender(<ReconciliarMedicamentos porta={porta} contexto={{...ctx,patientId:'outro',encounterId:'outro-e'}} aoFatosConfirmados={callback}/>);liberar({codigo:'REPLAY',eventId:'f'});await Promise.resolve();expect(callback).not.toHaveBeenCalled();expect(screen.queryByText('Lista atual completa confirmada.')).toBeNull();
});
