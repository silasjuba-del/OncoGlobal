# Correção de eixo · fase com writer único

**Data:** 2026-10-07  
**Writer desta fase:** esta sessão, no ramo `f0/w1-integrado`. Nenhuma outra LLM escreve aqui enquanto a fase estiver aberta.  
**Autoridade clínica:** Dr. Silas. Este arquivo não cria regra clínica nova. O eixo abaixo é cópia do que ele já fechou em `docs/planejamento/fontes/` (PLN-014, PLN-015, PLN-016).

## Eixo

X diz o que e onde (sistema → órgão → morfologia ou função → sítio).  
Y diz o que está acontecendo agora (achado novo, antigo, recorrente, piorando ou estável; causa conhecida, não ou incerta; gravidade; prioridade: eletivo, prioritário, urgente, emergência).  
Z é a ação médica que X + Y devem gerar: investigar, tratar, assistir, encaminhar, seguir.

X e Y informam. Z resolve. Documento final não mostra a IA. Fato só entra depois que o médico viu e confirmou o que está na tela.

## O que esta fase faz

1. **Alinhamento.** Trazer para o ramo de trabalho os registros de planejamento que já eram do Dr. Silas e ainda estavam só em `f0/planejamento`.
2. **Limpeza.** Os cinco avisos `SEM_IMPLEMENTACAO` da W8 estavam desatualizados: o motor existe e o teste já passa. O comentário mente; a asserção não muda. O N19 deixa de ser um stub que só pergunta se o arquivo existe e passa a chamar o harness com um arquivo fora da trilha.
3. **Atualização.** README e o contexto de nova aba passam a apontar o ramo real (`f0/w1-integrado`, commit `2690fe1`) e este eixo, em vez da onda W1 como se fosse o presente.
4. **Operacionalidade (menos clique).** Em `TelaConsulta`, um clique em “validar tudo” chama `exibirBundle` e só então `confirmar` (`validarComExibicao`). Validar bem-sucedido arma a impressão; Enter executa. Percurso de rotina: abrir → validar tudo → Enter.

## O que esta fase não faz

- Não integra `codex/w10-entrega-integrada`. A revisão do diff em `src/` classificou **MERGE_COM_RISCO**: a revisão de extração pode gravar `CONFIRMADO` no ledger sem o bundle ter sido exibido (A1 / G-25), e a projeção pode pintar laboratório datado de VERDE pela data mais recente. Isso atravessa o eixo Z (ação) antes da confirmação na tela.
- Não liga LLM, não exporta SIA, não abre WhatsApp, não inventa limiar, dose, interação nem estadiamento.
- Não apaga worktrees antigos. W1–W9 e as Lunas já estão contidas neste ramo (zero commits à frente). Só dois ramos tinham commits que o integrado não tinha: planejamento (docs, trazidos agora como arquivos) e a entrega Astra (recusada nesta fase).

## Situação clínica da fase

O caso ainda não percorre, num clique, kit → caixas com fonte → conflito visível → assinatura só do que foi exibido → um documento.

## O que falta do Dr. Silas

Nada nesta fase. A próxima decisão clínica continua sendo a da tela, quando esse percurso existir.

## Risco principal

Tratar a entrega Astra como “correção pronta” e confirmar fato que o médico não viu.

## Mudança técnica proposta

Docs de eixo no ramo de trabalho. Ponteiros de status honestos. N19 executa o harness. Código clínico da Astra fica de fora até o confirmar da extração exigir o mesmo gate de bundle exibido que `confirmarBloco` já usa.

## Teste adversarial necessário

Arquivo fora da trilha GROK (`src/server/rotas.ts`) passado a `scripts/verificar-manifesto.mjs --executor GROK --arquivos` termina com saída diferente de zero e a linha `FORA_DA_TRILHA`. Os outros quatro `.adv.ts` da W8 continuam com as mesmas asserções (pendente não vira verde; ficha inteira; dedupe pela chave do caso 07; write alheio bloqueado).

## Gate de aprovação

Você lê este arquivo e o eixo em `docs/planejamento/fontes/M-R`, `M-S` e `M-T`. Se o texto não for o que você escreveu, a fase para.
