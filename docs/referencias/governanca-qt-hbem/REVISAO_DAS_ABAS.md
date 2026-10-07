# Documento de revisão das abas

## Princípio

A interface deve acompanhar o ciclo do encontro. A revisão não será um textarea simples e não copiará o formato Kimi rejeitado. A nota terá blocos clínicos, fontes e decisões visualmente separadas.

## Superfícies propostas para a Fase A

Revisão de 16/09/2026: usar três superfícies principais — **Mesa, Fila Plaud e Revisão**. As funções abaixo não exigem sete abas: Retorno é comparação na Revisão; OncoAssist e SBOC formam diálogo/painel contextual; Memória aparece como histórico e destino. A lista é proposta, não inventário de telas já implementadas.

| Aba | Função | Conteúdo obrigatório | Risco a bloquear |
|---|---|---|---|
| **Mesa** | Iniciar ou retomar encontro | paciente confirmado para vinculação, `encounter_id`, caixa única, Whisper local | atribuir captura não identificada ao paciente errado |
| **Fila Plaud** | Acompanhar SOAP assíncrono | estado, tempo decorrido, vínculo, alerta diurno | Plaud no paciente errado ou alerta repetido |
| **Revisão** | Conferir a nota formatada | consenso, divergências, fontes, versões, campos clínicos | esconder conflito ou editar sem trilha |
| **Retorno** | Comparar encontro atual com anterior | trechos adicionados, removidos e discordantes | chamar mudança documental de progressão clínica |
| **OncoAssist** | Diálogo e direção clínica | opinião rotulada, fonte, data, lacunas, acesso | parecer confundido com prescrição |
| **SBOC / Evidências** | Consultar índice sob demanda | capítulo, fase, trial e resumo em até cinco linhas | ler pasta inteira ou inventar benefício |
| **Memória** | Mostrar versões e destino | estado, autor, fontes, hash/ponteiro, promoção médica | múltiplos proprietários silenciosos |

## Anatomia da aba Revisão

1. Cabeçalho fixo: paciente, encontro, data, versão e estado.
2. Cartões de fontes recebidas, com origem e horário.
3. Bloco **Conteúdo concordante**.
4. Bloco **Divergências**, com “Plaud diz” e “Whisper diz”.
5. Síntese clínica formatada por seções, com campos ausentes em branco ou declarados ausentes.
6. Caixa separada **Opinião do OncoAssist**, nunca incorporada automaticamente à síntese.
7. Histórico de versões e ações: revisar, devolver, rejeitar ou promover.

## Abas que não entram agora

- Prescrição de quimioterapia.
- Farmácia e infusão.
- Painel Grok.
- Console de consenso entre modelos.
- Sincronização oncoMed.
- Judicialização automática.

## Parecer

As abas propostas são coerentes se **Mesa**, **Fila Plaud** e **Revisão** formarem o núcleo obrigatório. Retorno, OncoAssist e SBOC podem aparecer progressivamente, mas precisam compartilhar o mesmo vínculo paciente-encontro e a mesma trilha de versões. “Memória” deve ser uma visão de um único proprietário, não um agregador de bancos concorrentes.

## Direção visual — PRM

### Hero, carrossel e movimento

Requisitos visuais acrescentados pelo Dr. Silas: hero, carrossel, microinterações e transições. São especificação de frontend; não animações já implementadas.

- **Hero funcional:** na abertura da Mesa, faixa compacta com contexto do dia, tarefas pendentes e ações Retomar encontro, Nova minuta e FLASH. Avatar OncoAssist pode acompanhar uma mensagem curta. Ao abrir um paciente, o hero se reduz para dar prioridade à identidade e à nota; sem grandes banners promocionais ou métricas fictícias.
- **Carrossel:** cards de atalhos, cursos, novidades e evidências selecionadas, com navegação manual, botões anterior/próximo, posição e alternativa Ver todos. Sem autoplay. Informação indispensável do paciente, conflito, alerta ou pendência crítica permanece visível fora do carrossel. Navegação por teclado e toque; foco não pode desaparecer ao trocar card.
- **Microinterações:** foco e hover discretos; feedback de copiar, salvar, anexar fonte e concluir tarefa. Salvo só aparece após confirmação real da persistência; falha mantém conteúdo e oferece próxima ação. Mudanças de estado usam texto/ícone além de cor. Voz tem indicação explícita de ouvindo/parado, controle de interrupção e alternativa digitada.
- **Transições:** proposta inicial de 120–180 ms para controles e 180–240 ms para painéis, sujeita a validação visual. Preferir opacidade e deslocamento curto; evitar zoom, paralaxe, brilho repetitivo e saltos no texto clínico. Reservar espaço durante carregamento. Movimento nunca posterga ação nem altera o paciente ativo.
- **Movimento reduzido:** respeitar prefers-reduced-motion, removendo deslocamentos e animações dispensáveis. Sem digitação artificial atrasando resposta, avatar pulsando continuamente ou carrossel que avance sozinho. Leitores de tela recebem estados importantes sem anúncios repetitivos.

Aceitação futura: teclado, foco, contraste, zoom 200%, leitura de cards, redução de movimento, estado de erro e desempenho em equipamento modesto. Verificar ausência de deslocamento de conteúdo, travamento e perda de edição. Reutilizar recursos de UI disponíveis antes de adicionar dependência de animação. Estes testes ainda não foram executados.

Operação também apresenta diagnóstico técnico, custo/tokens por tarefa, latência e estado do backend. Configurações mostra disponibilidade dos provedores, sem revelar chaves. Comunicação inclui tarefas para a secretaria, distinguindo rascunho, atribuído, enviado, recebido e resolvido quando comprovados. OncoAssist/OncoAgent é uma única identidade visual. Erro técnico mostra explicação acionável e referência de suporte, sem expor logs ou dados clínicos desnecessários.

Adicionar **Operação** para acompanhar grafo, BRAIN_OS e evidências do Harness, e **Comunicação** para rascunhos e calendário de Facebook/Instagram/WhatsApp. São áreas de apoio, fora das três superfícies clínicas. Mostrar estados reais e pendências; manter publicação e envio visualmente distintos de salvar minuta. Abrir Comunicação não deve carregar automaticamente o paciente ativo nem sua história. Nada dessas áreas está implementado por esta especificação.

Conectores ficam em **Configurações → Conexões**, sem acrescentar uma aba clínica por fornecedor. Mostrar conta, escopo, estado, última operação real e ações de conectar/desconectar. Na mesa aparecem somente ações contextuais autorizadas: buscar documento, consultar agenda e preparar mensagem. Diferenciar claramente Preparar de Enviar, e conexão disponível de sincronização concluída. Esta é proposta de interface, não integração ativa.

PRM é a sigla confirmada pelo Dr. Silas; sua expansão e seu significado funcional ainda não foram definidos. Esta seção especifica uma interface clínica contemporânea de uso diário, com densidade legível e aparência de SaaS, sem presumir SaaS multi-tenant implementado. Proposta de design, não frontend já alterado.

Layout: navegação discreta à esquerda; barra fixa com nome, ID_PATIENT, encontro e estado; nota no centro; painel contextual à direita para FLASH, OncoAssist, fontes ou banca. Em telas estreitas o painel vira drawer. A fila Plaud permanece acessível sem interromper a edição. Identidade fica visível ao trocar painel, versão ou documento.

Paleta proposta: fundo névoa `#F5F7FA`, superfície `#FFFFFF`, texto ardósia `#172B3A`, ação petróleo `#0B6670`, pendência âmbar `#865B08`, risco bordô `#A32942`. Cor sempre acompanhada de texto/ícone; contraste deve ser medido antes da adoção. Tipografia: Manrope para títulos curtos, Source Sans 3 para leitura clínica, monospace do sistema para IDs e datas. Usar fallback local e conferir licença antes de incorporar fontes.

Elemento distintivo: uma faixa de proveniência ao lado de cada seção mostra origem, data e revisão, com detalhes abertos por clique. Cards menores mantêm todas as rubricas; nada de ocultar lacuna clínica apenas para caber. Sem gráficos de produtividade ornamentais, texto gigante ou animação contínua. Kimi continua rejeitado; não usar seu layout como base.

| Componente | Uso proposto |
|---|---|
| Card + Badge | Resumo prático, comorbidades, fármacos citados, pendências e estado de revisão |
| Sheet/Drawer | OncoAssist e fontes, sem perder a nota ou o paciente ativo |
| Command | `/flash agora`, abrir documento, buscar evidência; comando não envia ou assina |
| Dialog/AlertDialog | Revisão de documento e confirmação de efeito real, com teclado e foco previsíveis |
| Tabs internas | Nota, comparação e histórico dentro da revisão; não multiplicar telas principais |
| Accordion | Detalhe de fontes, interações e argumentos das personas, mantendo alertas importantes visíveis |

Base sugerida: componentes existentes do app primeiro; [shadcn/ui](https://ui.shadcn.com/docs/components) e [tokens de tema](https://ui.shadcn.com/docs/theming) onde agregarem comportamento. 21st.dev é fonte de exploração visual; código importado precisa de revisão de licença, dependências, acessibilidade e compatibilidade. Não instalar uma biblioteca paralela para duplicar componentes disponíveis. As skills frontend-design e 21st-ai orientaram esta especificação; nenhuma geração remota, instalação ou chamada paga foi realizada.

Painel farmacológico mostra citotóxicos e outras opções como opinião, com indicação discutida, fonte e pendências. Sem dose automática, ordem de infusão ou botão que pareça liberar tratamento. Banca mostra personas identificadas como IA, perspectivas, convergências e divergências; avatar com voz é opcional e desligado até ação do usuário.

Documentos: conteúdo selecionável/editável; cabeçalho institucional autorizado, identificação e história pertinente. Modal com ações consistentes: Voltar → Fechar → Imprimir. Escape fecha quando não houver perda silenciosa; edição pendente exige preservar ou decidir descarte. Focus trap, retorno de foco, zoom 200%, navegação por teclado e movimento reduzido são critérios de aceitação. Avatar nunca é a única forma de acessar conteúdo.

Validação futura: inspecionar estados vazio/carregando/erro/conflito/sem fonte; responsividade; troca de paciente; impressão A4 e múltiplas páginas; nome longo e história extensa; comparação da tela com impressão. Não foram executados testes visuais ou de impressão nesta atualização documental. O programa especifica fixtures sintéticas e critérios; nenhum dado profissional ausente será preenchido por inferência.
