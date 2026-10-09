# Lacunas verificadas para C2

## C2-UI-01 — consulta completa na porta local

Observado por leitura em 72ce726: `src/ui/OncoassistLocal.tsx` conecta HTTP real e monta RevisaoExtracaoLocal, PainelOncoassist, TelaSalao e CaixaCanal. Não monta TelaConsulta (que contém Flash) nem TelaApacLote. `src/ui/App.tsx` usa criarPortaFalsa.

Consequência: demonstrar Flash somente em App prova a casca sintética, não o ciclo persistido. A demo da missão precisa ligar os componentes existentes à porta local real e verificar o percurso com SQLite sintético.

Dono: Astra em C2, após receber L2/L4. Faixa reservada: `src/ui/OncoassistLocal.tsx`, testes de integração local e script de demo sintética. L4 cuida do componente TelaConsulta e da Flash; Astra cuida da montagem na porta local. Não alterar bancos reais nem declarar demo concluída sem execução.

## C2-CONTRATO-01 — campos novos no hash de triagem

Observado em `src/server/rotas.ts`: o objeto `valores` usado no hash do rascunho de triagem enumera campos. Ao acrescentar histórico/início de vertigem (L3), L4 deve incluí-los explicitamente nesse objeto para que mudanças não sejam tratadas como replay de conteúdo antigo. Fonte/ausência devem ser preservadas.
