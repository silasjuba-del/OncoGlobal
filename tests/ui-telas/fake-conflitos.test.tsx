// @vitest-environment jsdom
import {TelaConsulta} from "../../src/ui/telas/TelaConsulta.js";
import {criarChaves} from "../../src/ui/api/chaves.js";
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {criarPortaFalsa,ID} from "../../src/ui/api/fake.js";
import {TelaSalao} from "../../src/ui/telas/TelaSalao.js";
afterEach(cleanup);
it("UI conserva conflito 409 quando outra aba salva a triagem",async()=>{
 const porta=criarPortaFalsa(),salvar=porta.salvarTriagem.bind(porta);
 vi.spyOn(porta,"salvarTriagem").mockImplementation(async(t,r)=>{await salvar(t,r);return salvar(t,r);});
 render(<TelaSalao porta={porta}/>);fireEvent.click(await screen.findByRole("button",{name:"salvar triagem"}));
 expect((await screen.findAllByRole("alert")).some(e=>/conflit|revis|salvar/i.test(e.textContent??""))).toBe(true);
});
it.each(["FALHA","OUTCOME_UNKNOWN"] as const)("fake permite exercitar %s sem fabricar sucesso",async falhaAcao=>{
 const porta=criarPortaFalsa({falhaAcao}),intent={verbo:"BACKUP_LOCAL" as const,objeto:{tipo:"BACKUP",id:"sintetico",versao:1},escopo:{patientId:null,encounterId:null},destino:null,idempotencyKey:"teste-falha"};
 if(falhaAcao==="FALHA")await expect(porta.acao(intent)).rejects.toMatchObject({codigo:"FALHA_SIMULADA"});
 else {expect((await porta.acao(intent)).decisao).toBe("OUTCOME_UNKNOWN");expect((await porta.acao(intent)).decisao).toBe("OUTCOME_UNKNOWN");}
});

it("revisitar consulta nao conserva ciencia que ainda nao foi registrada",async()=>{
 const porta=criarPortaFalsa(),chaves=criarChaves(),confirmar=vi.spyOn(porta,"confirmar");
 const view=render(<TelaConsulta patientId={ID.e1} porta={porta} chaves={chaves}/>);
 const check=await screen.findByRole("checkbox",{name:/Estou ciente/}) as HTMLInputElement;
 fireEvent.click(check);expect(check.checked).toBe(true);
 view.rerender(<TelaConsulta patientId={ID.verde} porta={porta} chaves={chaves}/>);
 await waitFor(()=>expect(screen.queryByRole("checkbox",{name:/Estou ciente/})).toBeNull());
 view.rerender(<TelaConsulta patientId={ID.e1} porta={porta} chaves={chaves}/>);
 expect((await screen.findByRole("checkbox",{name:/Estou ciente/}) as HTMLInputElement).checked).toBe(false);
 expect(confirmar).not.toHaveBeenCalled();
});
