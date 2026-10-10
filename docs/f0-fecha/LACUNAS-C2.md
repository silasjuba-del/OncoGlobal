# Lacunas verificadas para C2

## B-L4-APAC — catálogo expandido desativa antiglosa (em correção por L4)

Prova servidor de L4: 81 PASS / 1 FAIL, reproduzida isoladamente. Causa confirmada: lerApacs em src/server/leituras.ts exige config.caixas.length === 47; a caixa Flash aumenta o catálogo para 48 e resultadoAntiglosa vira null. Faixa ampliada de L4 para corrigir o consumidor por presença semântica de chaves APAC, usando a lista obrigatória existente e mantendo pendência para catálogo incompleto. Nenhuma asserção clínica deve ser afrouxada.

## C2-E6B-02 — conflito multifonte antes da confirmação e resolução explícita

Reproduzido por L2 em HTTP real/SQLite sintético: `/consulta/rascunho/reconciliar` responde 200 e `decisaoClinicaTomada:false`, mas mantém creatininas 1,2 e 1,8 mg/dL (mesmo paciente/encontro/data 2026-10-09, vínculos explícitos persistidos) em campos separados por segmento. Cada campo tem um candidato e conflict:false; conflitos é vazio. A leitura após confirmação individual detecta a divergência, mas a caixa de revisão antes da confirmação não a agrega.

O teste E6b-2 permanece vermelho. A prova também não encontrou uma operação de resolução médica explícita que preserve as duas fontes e a decisão no histórico. Dono Astra, após a faixa de rotas de L4: pipeline/reconciliação/rotas/projeção e prova real. Nunca juntar segmentos apenas por nome/score; exigir vínculo persistido, mesmo encontro e datas adequadas ao domínio. A resolução deve registrar ator, contexto, conteúdo/revisão e justificativa, sem apagar evidência ou promover sugestão silenciosamente.

L2 entregará os seis testes e fixtures com BLOQUEIO documentado, sem skip; três rodadas verdes somente após correção causal.

## C2-UI-01 — consulta completa na porta local

Observado por leitura em 72ce726: `src/ui/OncoassistLocal.tsx` conecta HTTP real e monta RevisaoExtracaoLocal, PainelOncoassist, TelaSalao e CaixaCanal. Não monta TelaConsulta (que contém Flash) nem TelaApacLote. `src/ui/App.tsx` usa criarPortaFalsa.

Consequência: demonstrar Flash somente em App prova a casca sintética, não o ciclo persistido. A demo da missão precisa ligar os componentes existentes à porta local real e verificar o percurso com SQLite sintético.

**Restrição descoberta na revisão:** TelaConsulta contém chamadas incondicionais a cadastroSintetico, timelineSintetica, montarRevisaoSintetica e prescricaoSintetica, além de callbacks de revisão que só mudam estado React. É proibido montá-la inalterada sobre pacientes da porta HTTP real. A integração deve usar uma composição de consulta real sem esses fallbacks (ou segregação explícita comprovada), com Flash/assinatura ligadas à persistência e prova negativa de ausência de dados sintéticos sob paciente real. O nome "Paciente Teste" da demo não substitui essa fronteira de produção.

Dono: Astra em C2, após receber L2/L4. Faixa reservada: `src/ui/OncoassistLocal.tsx`, testes de integração local e script de demo sintética. L4 cuida do componente TelaConsulta e da Flash; Astra cuida da montagem na porta local. Não alterar bancos reais nem declarar demo concluída sem execução.

## C2-CONFIG-01 — settings no bootstrap local

Observado por leitura: `src/server/http.ts` só cria SettingsService quando recebe configRootDir; `src/app/oncoassistLocal.ts` não passa esse diretório. Portanto a configuração real da caixa Flash precisa desse fio no bootstrap, além da implementação de L4. Dono Astra: `src/app/oncoassistLocal.ts` e prova local de configuração, reutilizando o store configuracional já existente, no dataDir explicitamente selecionado. Corpus/ruleset já são carregados por criarServidorLocal; não duplicar loader.

Também encaminhar `/config` ao servidor local no proxy de `vite.config.ts` (dono Astra), juntamente com `/login` e `/consulta`. L4 publica os métodos na porta HTTP; Astra monta Configuracoes com essa porta na UI local.

## C2-CONTRATO-01 — campos novos no hash de triagem

Observado em `src/server/rotas.ts`: o objeto `valores` usado no hash do rascunho de triagem enumera campos. Ao acrescentar histórico/início de vertigem (L3), L4 deve incluí-los explicitamente nesse objeto para que mudanças não sejam tratadas como replay de conteúdo antigo. Fonte/ausência devem ser preservadas.

## C2-COMPAT-01 — leitura de triagens anteriores aos campos de vertigem

Revisão do commit L3 `3b1b67b`: campos novos usam boolean nullable obrigatório. Eventos antigos não possuem essas propriedades e podem deixar de passar no parser. Correção Astra na integração: defaults null para ausência legada, preservando o evento original e adicionando prova de leitura de payload antigo. Não converter ausência em false nem em início novo. Não chamar a mera declaração de tipo de compatibilidade comprovada.
