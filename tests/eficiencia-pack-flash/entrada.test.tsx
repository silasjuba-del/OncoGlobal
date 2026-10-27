// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OncoassistLocal } from '../../src/ui/OncoassistLocal.js';
import { criarPortaFalsa } from '../../src/ui/api/fake.js';
import { fixturePack } from './fixtures.js';
afterEach(cleanup);
it('entrada real da consulta não chama revisão documental antes do acesso; recolher não desmonta', async()=>{
  const porta=criarPortaFalsa();porta.login=async()=>({ok:true,expiraEm:null});
  porta.revisaoClinica=vi.fn(async contexto=>({...fixturePack().resposta,contexto}));
  render(<OncoassistLocal fabricaPorta={()=>porta}/>);
  fireEvent.change(screen.getByLabelText('Senha do servidor'),{target:{value:'senha-sintetica'}});
  fireEvent.click(screen.getByRole('button',{name:'Entrar'}));
  fireEvent.change(await screen.findByLabelText('Paciente da agenda'),{target:{value:'en-verde'}});
  const abrir=await screen.findByRole('link',{name:'Ficha e packs'});
  expect(porta.revisaoClinica).not.toHaveBeenCalled();
  fireEvent.click(abrir);
  await screen.findByLabelText('Pack documental selecionado');
  expect(porta.revisaoClinica).toHaveBeenCalledTimes(1);
  const grupo=document.querySelector('[data-grupo="consulta-fase2"]')!;
  fireEvent.click(grupo.querySelector('button.oc21-acordeon-trigger')!);
  fireEvent.click(abrir);
  await waitFor(()=>expect(porta.revisaoClinica).toHaveBeenCalledTimes(1));
});
