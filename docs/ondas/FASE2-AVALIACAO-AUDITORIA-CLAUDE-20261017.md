# Avaliação da auditoria Claude e atualização documental dos packs

Data: 2026-10-17. Autor da revisão técnica/documental: Codex.

## Material avaliado

Auditoria fornecida no chat: “ONCOGLOBAL X+Y=Z × código real — Avaliação e Planning”, com base declarada `main ffa1134`, e documento anexo “F2 corrigido — Eixo Y liga + Planning terapêutico”. Não foi apresentada outra auditoria nesta rodada. Esta avaliação não equivale a aprovação clínica do conteúdo.

O Dr. Silas solicitou em seguida um prompt para o Claude especificando as informações necessárias à nova auditoria. A avaliação acima se refere apenas aos materiais anteriores; o delta novo aguarda auditoria independente. Não houve envio automático a outro chat.

Bases verificadas: `C:\Users\silas\Projects\OncoGlobal`, main `ffa1134`; worktree `C:\Users\silas\Projects\OncoGlobal-wt\codex-fase2-lacunas-t1`, branch `codex/fase2-lacunas-t1`, commit anterior à atualização `2c0991d`. O commit do worktree não estava integrado ao main. Remoto: `silasjuba-del/OncoGlobal`.

## Veredito

| Afirmação | Avaliação |
|---|---|
| O main não lê o pack v2 no caminho de revisão clínica | Compatível com a base ffa1134 inspecionada. Não extrapolar esse resultado ao worktree posterior. |
| O Eixo Y não possui encadeamento completo por cenário nem planejamento individual | Confirmado para o worktree examinado: o adaptador documental não implementa o motor universal proposto. |
| Existem 12 cenários no colorretal | Correto em `identidade.cenarios`; `tratamento.cenarios` detalha 8 entradas. A afirmação anterior de Codex de que 12 estaria errado foi excessiva. As listas representam granularidades distintas. |
| Contrato para 32 packs v2 | A pasta examinada contém 29 arquivos `pack-*.v2.*.json`. O número 32 não pode ser usado como contagem comprovada desta base. |
| X e Z integralmente implementados/alinhados | A existência de componentes e portas não comprova todos os fluxos em execução. Esta rodada não repete a prova funcional nem declara fechamento integral. |
| REAL, MODELO e DESEJADO devem permanecer distintos | Aprovado como princípio arquitetural. Escolha física de tabelas é decisão posterior, não conteúdo do pack. |
| Item planejado passa a CONFIRMADO quando o pedido é emitido | Requer correção: pedido emitido não é exame realizado. Distinguir previsto, solicitado, realizado, resultado disponível e revisado; tratamento planejado, prescrito e administrado também permanecem separados. |
| Sem resultado significa exame não feito | Não comprovado. O estado inicial correto é ausência de comprovação/resultado disponível, até reconciliação. |
| Reprogramação exige LLM | Não como regra universal. Datas e dependências simples são determinísticas; cognição clínica pode receber proposta assistida, sem escrita autônoma de fatos. |
| SUS determina APAC; privado determina relatório/judicialização | Simplificação indevida. Indicação clínica, registro, incorporação, procedimento, cobertura e disponibilidade local precisam de evidência separada. |
| Ativar o pack permite usar todos os blocos | Não assumir. Curadoria deve ser granular; um bloco revisado não aprova automaticamente protocolos, doses, seguimento e relações. |

## Escopo desta atualização

Escritor único: Codex. WRITE_SET: 29 JSONs v2 em `corpus/6-pack-tumor/`, o manifesto `FASE2-NCCN-DELTA-20261017.json` e os documentos desta rodada em `docs/ondas/`. Nenhuma edição de `src/`, `tests/`, `scripts/`, configuração ou dependências.

O pedido atual autoriza atualização de conteúdo. As regras antigas de descartar linhas sem dose completa ou resolver conflitos por uma escolha automática não foram aplicadas aos novos itens: prevalece o contrato universal fornecido pelo Dr. Silas. Conteúdo incompleto permanece identificado e consultável para curadoria, sem ser marcado como prescrevível.

## Forma de atualização

Cada pack mantém os campos legados e recebe a propriedade aditiva `tumor_pack_universal`. A camada reúne os 12 domínios, índice do conteúdo original, itens NCCN, fontes, relações documentais, conflitos e pendências. Não é uma migração destrutiva nem uma implementação do motor clínico.

`header.versao` continua identificando a estrutura legada preservada. A extensão possui `schema_documental`, versão e revisão próprias. O hash do arquivo completo muda; aprovações ou extratos ligados a hashes anteriores não podem ser reutilizados como aprovação da revisão nova.

Fontes NCCN: PDFs locais fornecidos pelo usuário; versão declarada, SHA-256, página física, seção e trecho localizador. O conteúdo é atribuído ao arquivo fornecido; a autenticidade/atualidade no portal NCCN não foi validada nesta rodada. Não foram copiados PDFs para o repositório.

Os novos itens continuam `A_CONFERIR`, sem aprovação clínica, proposta automática ou prescrição. Acesso SUS/privado permanece não verificado por indicação; referências históricas do pack continuam preservadas. Números e condições só foram estruturados quando extraídos explicitamente. Posologias restantes foram marcadas como não extraídas nesta rodada, sem inventar valores.

## Limites explícitos

- Trata-se de incorporação documental do delta identificado, não de extração integral das 6.149 páginas.
- As listas de identidade e de cenários de tratamento não foram fundidas por inferência.
- Os quatro packs hematológicos sem PDF específico recebem o índice universal e a pendência de fonte; nenhum conteúdo NCCN foi fabricado para eles.
- Os 21 temas sem pack próprio permanecem no inventário como fila de extração; não foram criados lotes falsamente completos.
- Domínios sem conteúdo estruturado não foram marcados como não aplicáveis.
- O runtime não foi alterado para consumir a nova camada. Ela é conteúdo documental para a etapa posterior de curadoria/integração.
- A declaração histórica de “Fase 2 concluída” não é ratificada: faltam o encadeamento operacional, a prova completa do ditado e o tratamento do erro do worker informado anteriormente.

As contagens e hashes da entrega constam no manifesto JSON. A validação compara todos os valores legados com o commit-base, verifica referências internas e fontes/páginas, e executa o validador de corpus existente sem alterar suas expectativas.

## Resultado técnico da atualização documental

- 29 packs receberam a extensão; 25 têm itens de delta NCCN e quatro registram ausência de PDF específico.
- 115 itens novos; 12 novos registros de conflito; 3.817 unidades legadas indexadas.
- 653 protocolos legados preservados.
- Comparação recursiva contra `2c0991d`: todos os valores originais semanticamente idênticos, inclusive fontes, conflitos e decisões históricas.
- 115 referências dos itens verificadas contra hash, páginas e trecho localizador dos PDFs fornecidos.
- Referências internas, IDs e mapa de cobertura verificados.
- `npm run check:corpus`: passou, 211 arquivos. `git diff --check`: passou.
- Nenhum código alterado. Atualização ainda no worktree, sem commit ou publicação, aguardando a auditoria solicitada.

Esses resultados comprovam preservação e integridade estrutural/documental. Não comprovam validade clínica de cada acréscimo, completude da posologia nem fechamento das diretrizes integrais.
