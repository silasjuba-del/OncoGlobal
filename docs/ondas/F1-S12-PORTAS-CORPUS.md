# S12 — A12: portas dos 33 rascunhos originais

Auditoria estática dos bytes atuais dos 33 caminhos enumerados em `F1-CORPUS-BUSCAS-CONSOLIDADAS.md`, matriz de entrega original. Não é reconstrução histórica. Os 33 não são sinônimo do material privado escolhido em 1A.

**Resultado: auditoria realizada; integração operacional desses 33 arquivos não comprovada.** Todos permanecem `RASCUNHO`, `consultavel:true`, `alerta:false`, `aprovacaoClinica:null`. Uma porta declarativa, a existência de destino e a aprovação clínica são evidências diferentes.

Há 19/33 arquivos com `portas` declarativas e 14/33 sem esse campo. A expansão posterior contém 77 RASCUNHO nos oito pilares; o inventário Git total contém 210 JSON. Nenhum desses números, por si, prova consumo no runtime.

## Mapa arquivo por arquivo

Prefixo de todos os caminhos: `corpus/`. `D` significa porta documental declarada; `S` significa sem campo `portas`. Nenhuma linha abaixo afirma binding operacional da versão exata.

| # | Arquivo | Oferta e consumo documentados | Situação do elo |
| --- | --- | --- | --- |
| 1 | `1-exames/rads/pedido-imagem-resumo-caso.v1.RASCUNHO.json` | `estrutura.resumoDoCaso_max5linhas.fatoConfirmado`, decisão, exame, conferência | S; ID do catálogo exigido em texto, sem vínculo estruturado. Pedido implementado não prova consumo deste arquivo. |
| 2 | `1-exames/labs/labs-por-esquema.v1.RASCUNHO.json` | `painels[].classe`, `porCiclo`, `baseline`, `monitorizacao`, `periodicidade` | S; ligação protocolo/validade ausente. |
| 3 | `1-exames/path/campos-laudo-path.v1.RASCUNHO.json` | Laudo/pack → `patologia.marcadores[]` | D; falta binding campo extraído → FATO → marcador/consumidor. |
| 4 | `1-exames/endoscopicos/campos-laudo-endoscopico.v1.RASCUNHO.json` | Indicação/intervalo do pack → exames realizados | D; procedimento → resultado → vigilância não executável. |
| 5 | `2-receitas/especiais/receitas-especiais-estrutura.v1.RASCUNHO.json` | Famílias, IDs, drogas, campos, `posologia:null` | S; faltam referências tipadas à interação/contraindicação. Preservar doses nulas. |
| 6 | `2-receitas/classes/classes-farmacologicas.v1.RASCUNHO.json` | Classe, exemplos, fatos verificados | S; distinto do catálogo operacional `f0c/classes-farmacos`. |
| 7 | `3-laudos/afastamento/laudo-afastamento.v1.RASCUNHO.json` | Contrato comum L → documento de afastamento | D; binding de campos/fonte/consumidor ausente. |
| 8 | `3-laudos/fgts/laudo-fgts.v1.RASCUNHO.json` | L → documento FGTS | D; mesmo elo ausente. |
| 9 | `3-laudos/fraldas/laudo-fraldas.v1.RASCUNHO.json` | L → documento fraldas | D; mesmo elo ausente. |
| 10 | `3-laudos/incapacidade/laudo-incapacidade.v1.RASCUNHO.json` | L → documento incapacidade | D; mesmo elo ausente. |
| 11 | `3-laudos/inss/laudo-inss.v1.RASCUNHO.json` | L → documento INSS | D; mesmo elo ausente. |
| 12 | `3-laudos/judicializacao-drogas/laudo-judicial.v1.RASCUNHO.json` | L → documento judicialização | D; não confundir com template legado de nome semelhante. |
| 13 | `3-laudos/loas/laudo-loas.v1.RASCUNHO.json` | L → documento LOAS | D; mesmo elo ausente. |
| 14 | `3-laudos/nutricao/laudo-nutricao.v1.RASCUNHO.json` | L → documento nutrição | D; mesmo elo ausente. |
| 15 | `3-laudos/oxigenio/laudo-oxigenio.v1.RASCUNHO.json` | L → documento oxigênio | D; mesmo elo ausente. |
| 16 | `3-laudos/transporte/laudo-transporte.v1.RASCUNHO.json` | L → documento transporte | D; mesmo elo ausente. |
| 17 | `4-interacoes-contraindicacoes/interacoes-complemento.v1.RASCUNHO.json` | IDs, par, severidade proposta, monitorização, conduta/fonte | S; par textual sem ponteiro à receita; `propostaAlerta` não é ativação. |
| 18 | `4-interacoes-contraindicacoes/contraindicacoes-complemento.v1.RASCUNHO.json` | IDs, drogas, classificação, critério/ação/fonte | S; parâmetros tipados, aplicabilidade e protocolo/receita não ligados. |
| 19 | `5-ctcae-acao/ctcae-graus.v1.RASCUNHO.json` | ID, termo oficial, registro CSV, graus | S; critérios textuais/CSV não equivalem à regra estruturada do motor. |
| 20 | `5-ctcae-acao/ctcae-acao.v1.RASCUNHO.json` | Termo/grau/ação/fonte → `suporteIds` | S; 17/17 células com suporte vazio: elo para receita/orientação/exame/encaminhamento faltante. |
| 21 | `6-pack-tumor/mama/mama.v1.RASCUNHO.json` | Biomarcadores, exames por ID, fases, sucessor | S; 9/9 IDs resolvem; sucessor existe; v1 supersedido. |
| 22 | `6-pack-tumor/colorretal/colorretal.v1.RASCUNHO.json` | Mesmo contrato de pack | S; 9/9 IDs resolvem; sucessor existe; v1 supersedido. |
| 23 | `6-pack-tumor/prostata/prostata.v1.RASCUNHO.json` | Mesmo contrato de pack | S; 12/12 IDs resolvem; sucessor existe; v1 supersedido. |
| 24 | `6-pack-tumor/pulmao/pulmao.v1.RASCUNHO.json` | Mesmo contrato de pack | S; 12/12 IDs resolvem; sucessor existe; v1 supersedido. |
| 25 | `6-pack-tumor/gastrico/gastrico.v1.RASCUNHO.json` | Mesmo contrato de pack | S; 11/13 entradas resolvem como ID exato. PET com observação e laparoscopia/citologia são texto em `examesPorId.condicionais`; sucessor existe. |
| 26 | `7-orientacoes/atividade-fisica/atividade-fisica.v1.RASCUNHO.json` | Hemograma/metástases ósseas/toxicidade → orientação | D; gatilhos textuais sem binding tipado. |
| 27 | `7-orientacoes/dieta/dieta-geral-qt.v1.RASCUNHO.json` | Prescrição/peso/triagem/comorbidades → dieta | D; consumidor da versão não demonstrado. |
| 28 | `7-orientacoes/dieta/dieta-por-toxicidade.v1.RASCUNHO.json` | Toxicidade vigente/CTCAE-ação → dieta | D; ponteiro termo/grau → suporte ausente. |
| 29 | `7-orientacoes/dieta/dieta-por-tumor.v1.RASCUNHO.json` | Pack/cirurgias → dieta | D; associação descritiva sem binding executável. |
| 30 | `7-orientacoes/sinais-alarme/sinais-alarme-consolidado.v1.RASCUNHO.json` | Origens, correspondência, regra febre | S; 3/3 origens existem; falta vínculo estruturado saída/canal/tarefa. |
| 31 | `8-encaminhamentos/mastologia/encaminhamento-mastologia.v1.RASCUNHO.json` | Contrato E e packs | D; 1/1 pack resolve; binding documento/agenda ausente. |
| 32 | `8-encaminhamentos/cirurgia-oncologica/encaminhamento-cirurgia-oncologica.v1.RASCUNHO.json` | E e packs | D; 12/12 packs resolvem; mesmo binding ausente. |
| 33 | `8-encaminhamentos/radioterapia/encaminhamento-radioterapia.v1.RASCUNHO.json` | E e packs | D; 9/9 packs resolvem; mesmo binding ausente. |

**L:** identificação, tumor/CID/data/estadiamento, resumo longitudinal, prescrição vigente e modelo de resumo; requisitos/anexos/assinatura/validade descrevem conteúdo sem mapear cada saída a fato confirmado.

**E:** resumo, tumor, patologia, exames realizados e prescrição vigente → documento e retorno na agenda. `fatoConfirmado` e `decisaoMedica` separam responsabilidades documentalmente; não comprovam preenchimento/persistência.

## Consumidores e encaminhamento dos achados

`src/server/corpus.ts` e `src/kernel/corpus/configMotor.ts` leem caminhos operacionais explícitos distintos. `src/kernel/corpus/biblioteca.ts` importa manifestos validados, mas isso não comprova conversão/importação dos 33 rascunhos. `src/server/investigacao.ts` exige pack estruturado aprovado e mantém `PACK_NAO_APROVADO` quando ausente.

Existência de destinos verificada: 53/55 ocorrências de exames por ID exato, 5/5 sucessores, 22/22 referências de packs dos encaminhamentos, 3/3 origens de sinais. Permanecem **duas entradas textuais no pack antigo, 17 suportes CTCAE vazios e os bindings da tabela**.

Esses achados ficam explícitos no trabalho contínuo S3c: corrigir o sucessor, estruturar referências, aprovar cada item e provar seu consumidor antes de ativar. Não reativar versões supersedidas; não completar doses/condutas por inferência. Esta S12 não altera esses arquivos nem declara que sua integração clínica está encerrada. A auditoria A12 está documentada; a integração do catálogo inteiro não está PASS.
