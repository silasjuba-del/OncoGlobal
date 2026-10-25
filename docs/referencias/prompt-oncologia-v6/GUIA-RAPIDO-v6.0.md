# Guia rápido — oncologia v6.0

Objetivo: selecionar o paciente uma vez, informar o que mudou e dizer a decisão uma vez. A IA monta os rascunhos relacionados; confirmações clínicas e assinatura continuam explícitas.

## Uso mais econômico

```text
/atendimento [paciente_id]
Hoje: [mudanças].
Decisão: [conduta definida pelo médico].
Saídas: [documentos desejados].
```

Se o app já tiver o paciente selecionado, omitir o identificador. Se os dados novos estiverem nos anexos, pode bastar:

```text
/atendimento — use os documentos novos; mostre apenas mudanças e decisões pendentes.
```

O comando não inventa plano nem produz todos os documentos. O sistema primeiro recupera o contexto; se houver uma lacuna crítica, pergunta apenas sobre ela.

## Comandos essenciais

| Intenção | Entrada mínima |
|---|---|
| Resumo longitudinal | `/resumo-caso` |
| Primeira consulta com documentos | `/primeira-consulta` + anexos/referências acessíveis |
| Retorno | `/evolucao hoje: [...] plano: [...]` |
| Conferência pré-tratamento | `/pre-qt` |
| Preparação de esquema | `/protocolo [id/variante]` |
| Revisar evento adverso | `/toxicidade [descrição ou grau informado]` |
| Revisar medicamentos | `/reconciliar-medicamentos` |
| Receita oral | `/receita-vo [itens selecionados]` |
| Receita EV | `/receita-ev [itens selecionados]` |
| Receita para serviço externo | `/receita-ev-ubs [destino e itens]` |
| Pedidos vinculados ao plano | `/pedido-exames` |
| Orientação pertinente ao regime | `/orientacao-qt paciente` ou `equipe` |
| Orientação alimentar | `/dieta` |
| Sinais de alarme | `/sinais-alarme` |
| Relatório para finalidade definida | `/laudo-pericial [finalidade e prazo, se decidido]` |
| Minuta de consentimento | `/tcle` |
| Retorno previsto | `/retorno 21 dias` |
| Justificativa APAC | `/apac-inicial` ou `/apac-mudanca [decisão]` |
| Conferência administrativa | `/apac-auditoria` |
| Revisão de evidências | `/trials` ou `/evidencia [pergunta]` |
| Estudos em recrutamento | `/trials recrutamento` |
| Conjunto documental | `/kit-saida evolução + exames + retorno` |
| Retificação | `/corrigir [campo] = [valor], fonte: [...]` |

## Exemplos sintéticos de interação

### 1. Sem redigitação

Médico: `/resumo-caso`

Sistema: identifica paciente/encontro já selecionados; recupera fontes; entrega síntese e mudanças. Não pergunta novamente nome, diagnóstico ou biomarcador já disponíveis. Se o registro não está acessível, informa essa limitação sem simular recuperação.

### 2. Uma decisão alimenta vários documentos

Médico: `/evolucao — hoje: fadiga G2 informada, sem febre referida. Plano: [decisão]. Saídas: evolução e retorno em 21 dias.`

Sistema: estrutura SOAP, preserva “G2 informado pelo médico” e “sem febre referida”, prepara retorno com data-base explicitada. Não inventa exame físico, protocolo, dose ou pedido de exame.

### 3. Receita por nome

Médico: `/receita-vo [medicamento selecionado]`

Sistema: procura prescrição vigente ou template curado aplicável. Se houver uma única referência, apresenta posologia proposta e fonte para revisão. Se não houver, pergunta somente os parâmetros necessários; não exige redigitar a identificação e não emite receita incompleta como final.

### 4. Confirmação com baixo esforço

Em vez de pedir toda a lista medicamentosa novamente:

```text
Lista reconciliada em [data]: [lista recuperada].
Para a prescrição de hoje:
1 — Confirmo a lista apresentada.
2 — Houve mudanças: [...].
3 — Não foi avaliada hoje.
```

Só apresentar essa pergunta quando a ação depender da reconciliação. Não aplicar automaticamente a outros domínios.

### 5. Dados insuficientes sem paralisar tudo

Falta um dado necessário ao cálculo de dose. O sistema pode entregar resumo, cronologia e minuta de evolução, deixando somente a dose/prescrição dependente pendente. Não gera aparência de liberação.

## Configuração única, fora da consulta

Para reduzir perguntas recorrentes, o administrador deve configurar uma vez, com revisão adequada:

- identificação do profissional e serviço, fuso e formatos;
- identificador e fonte canônica do paciente;
- integrações e permissões realmente disponíveis;
- catálogos de protocolos, variantes, versões e status de curadoria;
- templates de suporte, documentos e orientações aprovados;
- fórmulas/métodos, unidades, arredondamento e critérios de validade por uso;
- fontes oficiais de atualização e competência administrativa;
- regras de autorização, assinatura, impressão, transmissão e recuperação.

Não perguntar tudo isso em cada atendimento. Se a configuração não existir, degradar somente a capacidade dependente. Templates não podem ganhar aprovação automaticamente pelo uso frequente.

## Implantação e consumo de contexto

O arquivo SYSTEM-PROMPT-ONCOLOGIA-v6.0.md é autocontido. Pode ser usado integralmente onde couber no contexto.

Em um aplicativo com roteador de módulos, mantenha as regras comuns de identidade, fonte, tempo, autoridade, perguntas, persistência e segurança sempre ativas; carregue os módulos clínicos correspondentes ao comando. Não separar o módulo de prescrição das regras de cálculo/validação nem permitir que o roteador remova salvaguardas para economizar tokens.

Um prompt sozinho não cria conectores, memória longitudinal, calculadora, botões, documentos A4 ou assinatura. A redução real de entrada depende do que a integração consegue recuperar. O ganho deve ser medido em cenários sintéticos antes de adoção clínica.
