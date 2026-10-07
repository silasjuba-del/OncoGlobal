# ADENDO W6 (Cursor) + W7 (Codex) · modelo de UI, kit de documentos, laudo APAC, impressora

> Vale como parte dos prompts `W6-CURSOR.md` e `W7-CODEX.md`. Leia também `docs/DECISOES.md` D-W5-03 a D-W5-07.
> **Para receber estes arquivos:** termine a fatia corrente, commite e rode `git merge f0/w1-integrado` no seu worktree. Referências em `docs/referencias/`.
> As faixas de arquivo de cada um **não mudam**, exceto as adições marcadas abaixo.

## O que chegou
| Arquivo | O que é | Quem usa |
|---|---|---|
| `docs/referencias/ui-modelo-consulta.webp` | modelo visual da tela de consulta | Cursor |
| `docs/referencias/kit-oncologia-2026-05.pdf` (+ `.txt`) | 5 documentos do Dr. Silas: orientação nutricional, sinais de alarme, receita de sintomáticos, requisição de exames por ciclo, relatório médico pericial | Codex (conteúdo e impressão), Cursor (tela de prescrição/documentos) |
| `docs/referencias/apac-laudo-solicitacao-autorizacao.pdf` (+ `apac-laudo-campos.txt`) | laudo oficial de solicitação/autorização de APAC (SUS) | Codex (impressão), Cursor (tela APAC) |

## Regras comuns
- **Cabeçalho institucional é configuração** (D-W5-03): `{ nomeInstituicao, linha2, cidadeUf }`. Valor inicial do kit ("Hospital do Bem - Unidade Oncológica · Complexo Hospitalar Regional Dep. Janduhy Carneiro - Patos/PB") entra **só como exemplo**, com aviso visível "cabeçalho de exemplo: altere nas configurações". Nunca fixo no código.
- **Linha do médico** (nome, CRM, RQEs) vem do **perfil do médico** (configuração local), não do hospital. Nunca no código.
- **Texto do kit é do médico** (D-W5-05, `DECISAO_MEDICA`): use **exatamente** como está, sem "melhorar", resumir ou completar. Corrigir acentuação do PDF (que veio sem acentos) **não** é permitido sem o médico: mantenha como está e registre `[VERIFICAR acentuação]`.
- Documento **sem assinatura** imprime com "RASCUNHO — NÃO VÁLIDO". Paciente: NOME, NASC., CIDADE, IDADE (e CPF/CID no relatório pericial) vêm do cadastro/ledger; ausente imprime "PENDENTE", nunca linha em branco preenchível que pareça completa. Para os modelos **em branco** (o médico também imprime para preencher à mão), existe a opção "imprimir modelo em branco", marcada como tal.

---

## CODEX (W7) · acréscimos

**Faixa adicionada:** `corpus/templates/kit/**`, `tests/corpus-kit/**`.

### CDX-05 (estende) · Kit e laudo APAC no motor de impressão
1. Crie `corpus/templates/kit/{orientacao-nutricional,sinais-alarme,receita-sintomaticos,requisicao-exames-ciclos,relatorio-pericial}.v1.json` no formato dos templates do GLM (`{id, versao, secoes:[{id,titulo,origem,campos}], proibidoConter}` + header G-17), com `fonte: { tipo: "DECISAO_MEDICA", referencia: "docs/referencias/kit-oncologia-2026-05.pdf", pagina: N }`. Texto fixo = `TEXTO_FIXO` copiado do `.txt`; identificação do paciente = `FATO_CONFIRMADO`; data/assinatura = `DECISAO_MEDICA`.
   - **Receita de sintomáticos:** cada item (droga, dose, orientação) vira linha **selecionável**: o médico desmarca o que não quer; nada é adicionado pela IA; doses **não** são calculadas nem alteradas pelo app (são texto do médico).
   - **Requisição de exames:** grade exame × ciclo 1–4 com marcação; exames adicionais em linhas livres.
   - **Relatório pericial:** prazo de afastamento ("6 meses") e data de início são **campos do médico**; o texto legal fica como está.
2. Crie `corpus/templates/kit/apac-laudo.v1.json`: mapeamento **campo do formulário → origem**:
   - IDENTIFICAÇÃO DO ESTABELECIMENTO SOLICITANTE (nome, CNES) → configuração institucional (`[VERIFICAR]` CNES);
   - IDENTIFICAÇÃO DO PACIENTE (nome, sexo, prontuário, CNS, nascimento, raça/cor, etnia, mãe, responsável, telefones, endereço, município, IBGE, UF, CEP) → cadastro; ausente = "PENDENTE";
   - PROCEDIMENTO PRINCIPAL (código, nome, qtde) e SECUNDÁRIOS (até 5) → prescrição/protocolo; **código SIGTAP `[VERIFICAR]`** até existir tabela importada; nunca inventado;
   - DESCRIÇÃO DO DIAGNÓSTICO, CID-10 principal/secundário/causas associadas → TumorLot confirmado;
   - JUSTIFICATIVA e OBSERVAÇÕES → texto do médico (a IA pode **rascunhar**; o médico edita e valida);
   - SOLICITAÇÃO (profissional, CNS do profissional, data, assinatura) → perfil do médico + data de geração no app (Q34);
   - **AUTORIZAÇÃO e PERÍODO DE VALIDADE: sempre em branco** (preenchidos pelo autorizador);
   - finalidade APAC herdada do lote ou PENDENTE; **nunca derivada da intenção** (G-12).
3. `src/impressao/apacLaudo.ts`: HTML A4 que reproduz a **disposição** do formulário oficial (blocos e ordem dos campos), sem embutir o PDF. Teste: todo campo do `apac-laudo-campos.txt` aparece; AUTORIZAÇÃO vazia; CID vem do lote; sem SIGTAP → "PENDENTE [VERIFICAR]".

### CDX-06 (estende) · Impressora escolhida pelo médico (D-W5-04)
- O app **não** fala com a impressora diretamente. Fluxo principal: o executor `IMPRIMIR` gera o HTML (uma vez por chave) e a UI abre a **janela de impressão do sistema** (`window.print()` numa janela do documento), onde o médico escolhe a impressora instalada (rede, Wi-Fi ou Bluetooth).
- Opcional nesta onda: `src/app/impressoras.ts` lista as impressoras instaladas do Windows (`Get-Printer` via `child_process`, sem rede) para a tela de configurações mostrar e salvar a **preferida** em `<dataDir>/preferencias.json`. Impressão silenciosa direto na impressora: `[VERIFICAR]`, não implemente.
- Teste: reimprimir com a mesma chave não gera arquivo novo; preferência salva sobrevive ao reinício; nenhum caminho de rede.

---

## CURSOR (W6) · acréscimos

**Faixa adicionada:** nenhuma (continua só arquivos novos em `src/ui/api/**`, `src/ui/telas/**`, `tests/ui-telas/**`).

### Modelo visual (D-W5-07) · aplica-se a CUR-12 em diante
Siga `docs/referencias/ui-modelo-consulta.webp` como **referência de layout**:
- **barra lateral** escura: Resumo · Prontuário · Exames · Prescrição · APAC · Documentos · Agenda · Enfermagem · Farmácia · Relatórios · Configurações; médico logado no rodapé;
- **topo**: busca (Ctrl+K = sua barra de comando CUR-13), notificações, "Novo registro";
- **cabeçalho clínico** em cartões: paciente (nome, nascimento/idade, sexo, ID) · DIAGNÓSTICO (com "confirmado por …") · ESTADIAMENTO · CID-10 · TNM · SUBTIPO. Cada cartão mostra estado: dado ausente = "PENDENTE" no próprio cartão; conflito = vermelho com candidatos;
- **abas** Evolução · Prescrição · Exames;
- coluna esquerda: dados anagráficos, dados clínicos gerais (antecedentes, medicações, **alergias sempre visíveis**), linha do tempo;
- centro: exame físico (ECOG 0–4 em botões; escolher ECOG **monta rascunho** do texto, nunca fato), evoluções recentes, exames de imagem/biópsia em cartões, labs recentes (abas Hemograma · Função renal · Função hepática · Outros, com **data da coleta** visível), conduta atual;
- direita: **ALERTAS E PENDÊNCIAS** (contador; cada item com estado), **ATUALIZAÇÕES E DIRETRIZES** (links NCCN/ESMO/INCA/PubMed/ClinicalTrials: abrem no navegador **sem nenhum dado do paciente na URL**), **ONCOASSIST (IA)** (Resumo do caso · Sugestão de pendências · Rascunho de conduta · caixa de pergunta) com o aviso "As respostas da IA não substituem o julgamento clínico";
- gaveta de detalhe (ex.: biópsia com anexos) e **visualizador de imagem** (miniaturas, zoom, avançar/voltar, tela cheia) para imagens já no PC.

**O desenho não vence as regras do app:**
- **sem foto do paciente** (não há fonte para ela; use iniciais);
- não existe badge "Ativo" inventado: só estados do contrato;
- tags de evolução ("Resposta parcial", "ECOG 1", "Sem toxicidade G3+") só aparecem se vierem de fato confirmado ou de regra (RECIST/CTCAE de `src/rules`); nunca texto livre da IA;
- **OncoAssist nesta onda fica desligado** ("capacidade não habilitada"): os botões existem, não chamam nada; quando ligado, só via desidentificação e só rascunho;
- "Novo registro" e "Ações rápidas" passam pela porta (CUR-11); imprimir/enviar só por `/acao`;
- cores: use os tokens do tema gelo; o verde-petróleo do modelo pode virar o destaque (`--cor-destaque`) **num arquivo novo** `src/ui/telas/tema-oncomed.css` que sobrescreve variáveis, sem editar `tokens.css`; vermelho só para semântica clínica.

### CUR-12/16/18 (estendem)
- **Prescrição (aba)**: lista os documentos do kit para marcar e imprimir em bloco (receita de sintomáticos com itens desmarcáveis, sinais de alarme, orientação nutricional, requisição de exames por ciclo, relatório pericial). Pré-marcados pelo pack/rotina; o médico desmarca; "validar tudo" + "imprimir" separado.
- **APAC (tela de lote, CUR-18)**: cada APAC abre o **laudo oficial** em pré-visualização (HTML do Codex quando existir; até lá, o fake mostra os campos), com campos PENDENTE destacados e AUTORIZAÇÃO em branco.
- **Configurações** (nova tela em `src/ui/telas/Configuracoes.tsx`): cabeçalho institucional (com o aviso "exemplo: altere"), perfil do médico (nome, CRM, RQEs, CNS do profissional), impressora preferida (lista vinda da porta; `[SERVIDOR_PENDENTE]` até o Codex), offset do serviço (−03:00, só leitura).
