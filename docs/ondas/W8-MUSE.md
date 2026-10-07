# W8-MUSE · 10 FATIAS · design, microcopy, ícones e protótipos

> Leia primeiro `docs/ondas/W8-COMUM.md`, `docs/referencias/ui-modelo-consulta.webp`, `docs/referencias/kit-oncologia-2026-05.pdf`, `docs/referencias/CASO-REAL-01-LICOES.md §3` e `docs/ondas/ADENDO-W6-W7.md`. EXECUTOR = `MUSE`. Pasta `C:\Users\silas\Projects\OncoGlobal-wt\w8-muse` · branch `f0/w8-muse`.
> **Faixa:** só arquivos novos em `docs/design/**`, `src/ui/copy/**`, `src/ui/icones/**`, `tests/ui-copy/**`, `docs/progresso/W8-MUSE.md`. O Cursor (W6) monta as telas e vai **consumir** o que você produzir; você não edita telas nem componentes.
> **Direção:** consulta rápida, menos cliques, médico no centro. Branco-gelo + verde-petróleo do modelo como destaque; **vermelho só clínico**; cor sempre com texto/ícone. Sem fonte externa pesada, sem biblioteca de ícones (SVG próprio), sem dependência.

## MU-01 · Sistema visual
`docs/design/SISTEMA.md` + `docs/design/tokens-oncomed.css` (variáveis CSS: cores, tipografia, espaçamento, raio, sombra, movimento contido) alinhadas ao modelo; contraste AA documentado por par de cores.

## MU-02 · Semântica de estado
`docs/design/ESTADOS.md`: como mostram VERDE · VERMELHO · PENDENTE, conflito com candidatos, `ausente` × `nao_descrito`, rascunho × confirmado × assinado, baixa confiança/riscado com recorte, E1. Nada de estado novo (teto 5).

## MU-03 · Microcopy pt-BR
`src/ui/copy/pt-BR.ts`: catálogo de textos (botões, vazios, erros, confirmações, avisos legais: "As respostas da IA não substituem o julgamento clínico", "cabeçalho de exemplo: altere", "capacidade não habilitada", "RASCUNHO — NÃO VÁLIDO", "comando incompleto"). Verbos claros; sem jargão de TI. Teste `tests/ui-copy/copy.test.ts`: chaves únicas, nenhum texto vazio, nenhum número de corte clínico.

## MU-04 · Ícones SVG
`src/ui/icones/*.tsx` (componentes React só com SVG inline, `aria-hidden` + rótulo no uso): barra lateral do modelo (Resumo, Prontuário, Exames, Prescrição, APAC, Documentos, Agenda, Enfermagem, Farmácia, Relatórios, Configurações) + estados (alerta, pendente, conflito, assinado, rascunho, E1, riscado). Teste: todos renderizam e têm `viewBox`.

## MU-05 · Protótipo: consulta pronta
`docs/design/prototipos/consulta.html` (HTML estático, dados sintéticos do Paciente Teste 07, CSS dos tokens): reproduz o modelo com as **regras do app** (iniciais em vez de foto, PENDENTE nos cartões, OncoAssist desligado, links de diretriz sem dado na URL). Inclui o cartão de exame com **Resumo 1** e o modal **Resumo 2**.

## MU-06 · Protótipo: salão e agenda
`docs/design/prototipos/salao.html` e `agenda.html`: quadro FRENTE · FILA DO MÉDICO · SALÃO, E1 como badge sem reordenar; agenda com semáforo e pendências.

## MU-07 · Protótipo: APAC em bloco e laudo
`docs/design/prototipos/apac.html`: lote diário multipaciente, **uma competência**, D85 aviso, D90 fora; pré-visualização do laudo oficial com SOLICITAÇÃO preenchida, AUTORIZAÇÃO em branco, PENDENTE destacado.

## MU-08 · Protótipo: centro de comando dos agentes
`docs/design/prototipos/centro-comando.html`: cartões por módulo (estado, skills, versão de prompt, ativar/desativar), log de alterações, **break-glass = "desligar toda a IA por 30 min"** com contagem regressiva e texto explícito de que nenhuma trava de segurança é liberada.

## MU-09 · Impressos
`docs/design/IMPRESSOS.md` + `docs/design/prototipos/impressos.html`: diagramação A4 dos 5 documentos do kit e do laudo APAC (cabeçalho configurável, bloco do paciente, assinatura, marca d'água de rascunho, rodapé com hash). Para o Codex (W7) seguir no `src/impressao`.

## MU-10 · Acessibilidade e fechamento
`docs/design/ACESSIBILIDADE.md` (teclado, foco, leitores de tela, tamanho mínimo de alvo, `role="alert"` só E1) + revisão dos protótipos contra ela; relatório `docs/progresso/W8-MUSE.md` com capturas ou lista de arquivos e perguntas ao tech lead.
