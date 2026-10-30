// Biblioteca de prompts operacionais e skills de modificação de texto.
// Variáveis: {{documento}} (anexos/PDF), {{selecao}} (texto a transformar), {{entrada}} (pedido livre), {{titulo}}.
export interface PromptTemplate {
  id: string;
  name: string;
  kind: 'prompt' | 'skill';
  description: string;
  template: string;
  builtin?: boolean;
}

const GUARD =
  'Use somente o conteúdo fornecido. Não invente dados; quando faltar informação, escreva "NÃO ENCONTRADO NO DOCUMENTO". Marque divergências como "A CONFERIR".';

export const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    id: 'few-shot',
    name: 'Few-shot a partir do documento',
    kind: 'prompt',
    description: 'Gera pares exemplo-entrada → saída-ideal para treinar um prompt na tarefa descrita.',
    template: `Tarefa alvo: {{entrada}}

Com base no documento abaixo, crie 6 exemplos few-shot para essa tarefa, variando dificuldade e casos-limite.
Formato de cada exemplo:
### Exemplo N
**Entrada:** …
**Saída ideal:** …
**Por que esta saída é correta:** (cite a página ou trecho)

Ao final, escreva o prompt de sistema que usa esses exemplos. ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'pdf-to-spec',
    name: 'PDF → Especificação (spec-driven)',
    kind: 'prompt',
    description: 'Transforma o documento em especificação técnica com requisitos, regras e critérios de aceite.',
    template: `Converta o documento em uma especificação técnica para desenvolvimento orientado por especificação.

Estrutura obrigatória:
1. Objetivo e escopo (dentro / fora)
2. Glossário de termos do domínio
3. Requisitos funcionais (RF-01…) — cada um com fonte (página/trecho)
4. Regras de negócio e invariantes (RN-01…)
5. Modelo de dados (entidades, campos, tipos, validações)
6. Fluxos e transições de estado
7. Critérios de aceite testáveis (Dado/Quando/Então)
8. Lacunas e ambiguidades (A CONFERIR)

${GUARD}
Foco adicional: {{entrada}}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'aula',
    name: 'Crie uma aula',
    kind: 'prompt',
    description: 'Plano de aula com objetivos, roteiro, exemplos, caso prático e avaliação.',
    template: `Crie uma aula a partir do documento. Público: {{entrada}} (se vazio, residentes/pós-graduação).

Entregue:
- Título e 3–5 objetivos de aprendizagem (verbos de Bloom)
- Roteiro de 50 minutos com tempos
- Conceitos-chave explicados com analogias
- 1 caso prático comentado
- Slides sugeridos (título + 3 bullets cada)
- 5 perguntas de discussão e 1 avaliação rápida com gabarito

${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'topicos-questoes',
    name: 'Resuma em tópicos e gere questões',
    kind: 'prompt',
    description: 'Resumo hierárquico + questões de múltipla escolha com gabarito comentado.',
    template: `1. Resuma o documento em tópicos hierárquicos (máx. 3 níveis), preservando números, doses, datas e unidades exatamente como estão.
2. Gere 10 questões de múltipla escolha (A–E), estilo prova de título/residência, com gabarito comentado e página de referência.
3. Liste 5 "pegadinhas" ou pontos de confusão frequentes.

${GUARD}
Ênfase: {{entrada}}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'notebooklm',
    name: 'Resuma para NotebookLM',
    kind: 'prompt',
    description: 'Gera uma fonte limpa e autocontida, ótima para importar no NotebookLM.',
    template: `Reescreva o documento como uma FONTE para o NotebookLM:
- Título claro e metadados (origem, data, versão, autores se houver)
- Seções com títulos descritivos (##), parágrafos curtos e autocontidos
- Tabelas convertidas em listas legíveis
- Definições de siglas na primeira ocorrência
- Seção final "Perguntas que esta fonte responde" (10 itens)
Não resuma demais: preserve todos os dados quantitativos. ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'app-do-pdf',
    name: 'Crie um app do PDF (pipeline exec-spec)',
    kind: 'prompt',
    description: 'Pipeline: extrai a spec do PDF e entrega um app HTML único, executável na prévia.',
    template: `Execute o pipeline EXEC-SPEC sobre o documento:

ETAPA 1 — SPEC: objetivo do app, usuários, funcionalidades derivadas do documento (com página de origem), dados e regras.
ETAPA 2 — DESIGN: telas, componentes e fluxo principal.
ETAPA 3 — CÓDIGO: um único arquivo HTML autocontido (HTML+CSS+JS inline, sem dependências externas, acessível, responsivo) que implemente a spec. Coloque-o em um bloco \`\`\`html.
ETAPA 4 — TESTES MANUAIS: 5 verificações que o usuário deve fazer na prévia.

Pedido específico: {{entrada}}
Regras clínicas/numéricas do documento devem ser reproduzidas exatamente e citadas. ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'extrair-dados',
    name: 'Extrair dados estruturados (JSON/tabela)',
    kind: 'prompt',
    description: 'Extrai entidades, tabelas e valores para JSON e tabela Markdown.',
    template: `Extraia os dados estruturados do documento conforme: {{entrada}} (se vazio, todas as tabelas, valores numéricos, datas e entidades).
Saída: 1) tabela Markdown; 2) JSON válido em bloco \`\`\`json; 3) lista de campos ausentes/ambíguos (A CONFERIR) com página.
Nunca normalize unidades ou arredonde valores. ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'mapa-mental',
    name: 'Mapa mental (Mermaid)',
    kind: 'prompt',
    description: 'Mapa de conceitos e relações em Mermaid, com legenda das relações.',
    template: `Construa um mapa mental do documento em Mermaid (\`\`\`mermaid, tipo mindmap) e, em seguida, um grafo de relações (flowchart) com arestas rotuladas ("causa", "indica", "contraindica", "faz parte de"…). Diferencie relações explícitas no texto de relações inferidas (marque inferidas com "?"). ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'flashcards',
    name: 'Flashcards (Anki)',
    kind: 'prompt',
    description: 'Cartões pergunta/resposta em CSV pronto para importar no Anki.',
    template: `Crie 25 flashcards de alto rendimento a partir do documento. Saída em bloco \`\`\`csv com colunas: frente;verso;tags;pagina
Cartões atômicos (um fato por cartão), sem ambiguidade. Tema prioritário: {{entrada}}. ${GUARD}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'auditoria',
    name: 'Auditoria crítica de evidências',
    kind: 'prompt',
    description: 'Avalia afirmações, nível de evidência, inconsistências e o que precisa ser conferido.',
    template: `Audite o documento como revisor técnico:
| Afirmação | Página | Tipo (fato/recomendação/opinião) | Evidência citada | Força | Problema/A CONFERIR |
Depois: inconsistências internas, números que não fecham, referências ausentes, e 5 perguntas para o autor.
Não corrija silenciosamente nenhum conflito. Foco: {{entrada}}

--- DOCUMENTO: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'reels-prompt',
    name: 'Reels → Prompt',
    kind: 'prompt',
    description: 'Transforma transcrição + legenda de um Reels em prompt reutilizável.',
    template: `A seguir está a transcrição (e legenda) de um vídeo curto (Reels).
1. Resuma a ideia central em 2 linhas.
2. Extraia o método/técnica ensinado em passos.
3. Transforme isso em um PROMPT reutilizável, com papel, contexto, instruções, variáveis entre {{chaves}} e formato de saída, em bloco \`\`\`text.
4. Dê 2 exemplos de uso do prompt.
Objetivo do usuário: {{entrada}}

--- REELS: {{titulo}} ---
{{documento}}`,
  },
  {
    id: 'foto-ui',
    name: 'Foto → UI/UX',
    kind: 'prompt',
    description: 'Analisa imagens anexadas (tela, rascunho, foto) e gera spec UI/UX + protótipo HTML.',
    template: `Analise as imagens anexadas (capturas de tela, rascunhos ou fotos).
1. Descreva a interface/ideia: objetivo, hierarquia visual, componentes.
2. Problemas de UX e acessibilidade (WCAG), com prioridade.
3. Especificação UI: grade, tipografia, paleta (hex), espaçamentos, estados.
4. Protótipo: um único arquivo HTML autocontido (CSS/JS inline) em bloco \`\`\`html, fiel ao que foi visto + melhorias.
Contexto: {{entrada}}
{{documento}}`,
  },
  {
    id: 'foto-prompt',
    name: 'Foto → Prompt',
    kind: 'prompt',
    description: 'Transforma uma foto/print (tela, slide, quadro, diagrama) em prompt reutilizável para recriar ou analisar o conteúdo.',
    template: `Analise as imagens anexadas e devolva:
1. O que a imagem contém (texto legível transcrito literalmente, elementos visuais, estrutura).
2. A intenção provável de quem a capturou (inferência — marque como tal).
3. Um PROMPT reutilizável em bloco \`\`\`text que permita a outra IA recriar, explicar ou expandir esse conteúdo, com papel, contexto, instruções, variáveis entre {{chaves}} e formato de saída.
4. Uma versão curta do prompt (até 3 linhas).
Objetivo do usuário: {{entrada}}
{{documento}}`,
  },
  {
    id: 'frames-exame',
    name: 'Frames de exame (TC/RM) → descrição de apoio',
    kind: 'prompt',
    description: 'Sequência de quadros capturados de um visualizador de imagem: descrição estruturada para estudo/revisão — não é laudo.',
    template: `As imagens anexadas são quadros sequenciais capturados da tela de um visualizador de exame (rolagem de TC/RM).
AVISO OBRIGATÓRIO: isto é apoio para estudo e revisão; não constitui laudo nem diagnóstico. A interpretação é do médico.
1. Qualidade da captura: modalidade aparente, plano, janela, número de quadros, limitações (resolução, compressão, cortes ausentes).
2. Anatomia visível por quadro (indique o número do quadro).
3. Achados que merecem atenção do médico, cada um com: quadro(s), localização, descrição morfológica, grau de certeza (baixo/médio/alto) e o que conferiria no exame original.
4. O que NÃO é possível avaliar com estes quadros.
5. Perguntas para o laudo oficial / radiologista.
Contexto clínico informado pelo médico: {{entrada}}
{{documento}}`,
  },
  {
    id: 'reconciliar',
    name: 'Reconciliar respostas (IA-Round)',
    kind: 'prompt',
    description: 'Funde as respostas de vários modelos: convergências, divergências, complementos e versão final.',
    template: `Você é o reconciliador de um IA-Round. Abaixo estão respostas de modelos diferentes para a MESMA pergunta.
Pergunta original: {{entrada}}

Entregue:
## Convergências
O que dois ou mais modelos afirmam de forma equivalente (cite quais).
## Divergências
Cada ponto em conflito: posição de cada modelo, qual está melhor fundamentada e por quê. Se não for possível decidir, marque "A CONFERIR".
## Complementos únicos
Contribuições válidas que só um modelo trouxe.
## Erros ou afirmações sem suporte
## Resposta consolidada
Versão final que soma as visões iguais e incorpora o melhor do contraditório, sem inventar nada que nenhum modelo disse.

--- RESPOSTAS ---
{{documento}}`,
  },
  {
    id: 'transcricao-notas',
    name: 'Transcrição → Notas estruturadas',
    kind: 'prompt',
    description: 'Para YouTube, Plaud ou microfone: notas com marcações de tempo, decisões e pendências.',
    template: `Transforme a transcrição em notas estruturadas:
- Resumo (5 linhas)
- Tópicos com marcação de tempo [mm:ss]
- Fatos/dados citados (literal), decisões, pendências (responsável/prazo se houver)
- Perguntas em aberto
${GUARD}
Foco: {{entrada}}

--- TRANSCRIÇÃO: {{titulo}} ---
{{documento}}`,
  },
];

export const BUILTIN_SKILLS: PromptTemplate[] = [
  { id: 'sk-corrigir', name: 'Corrigir português', kind: 'skill', description: 'Ortografia, gramática e pontuação, sem mudar o sentido.', template: 'Corrija ortografia, gramática, concordância e pontuação do texto abaixo. Não altere sentido, termos técnicos, números ou unidades. Devolva apenas o texto corrigido.\n\n{{selecao}}' },
  { id: 'sk-formal', name: 'Reescrever formal/acadêmico', kind: 'skill', description: 'Registro formal, impessoal, para artigo ou parecer.', template: 'Reescreva em registro formal e acadêmico (português do Brasil), impessoal, conciso e preciso, preservando todos os dados. Devolva apenas o texto.\n\n{{selecao}}' },
  { id: 'sk-leigo', name: 'Simplificar para paciente', kind: 'skill', description: 'Linguagem leiga, frases curtas, sem jargão.', template: 'Reescreva para um paciente leigo (nível de leitura de 8º ano): frases curtas, sem jargão (explique termos inevitáveis entre parênteses), tom acolhedor. Não acrescente informação clínica que não esteja no texto.\n\n{{selecao}}' },
  { id: 'sk-traduzir', name: 'Traduzir PT ↔ EN', kind: 'skill', description: 'Detecta o idioma e traduz para o outro.', template: 'Se o texto estiver em português, traduza para inglês; se estiver em inglês, para português do Brasil. Preserve terminologia técnica e formatação. Devolva apenas a tradução.\n\n{{selecao}}' },
  { id: 'sk-encurtar', name: 'Encurtar (−50%)', kind: 'skill', description: 'Mantém o essencial com metade do tamanho.', template: 'Reduza o texto para cerca de metade do tamanho mantendo todas as informações essenciais e números. Devolva apenas o texto.\n\n{{selecao}}' },
  { id: 'sk-bullets', name: 'Converter em tópicos', kind: 'skill', description: 'Transforma prosa em lista hierárquica.', template: 'Converta o texto em tópicos hierárquicos claros, sem perder informação.\n\n{{selecao}}' },
  { id: 'sk-email', name: 'Transformar em e-mail', kind: 'skill', description: 'E-mail profissional com assunto e fechamento.', template: 'Transforme o conteúdo em um e-mail profissional: linha de assunto, saudação, corpo objetivo, próximos passos e fechamento. Destinatário/contexto: {{entrada}}\n\n{{selecao}}' },
  { id: 'sk-instrucao', name: 'Instrução livre', kind: 'skill', description: 'Aplica ao texto a instrução digitada.', template: 'Aplique ao texto a seguinte instrução: {{entrada}}\nDevolva apenas o resultado.\n\n{{selecao}}' },
];

export interface TemplateVars {
  documento?: string;
  selecao?: string;
  entrada?: string;
  titulo?: string;
}

/** Preenche as variáveis; variável sem valor vira texto vazio (e linhas só com ela somem). */
export function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*(documento|selecao|entrada|titulo)\s*\}\}/g, (_, key: keyof TemplateVars) => vars[key]?.trim() ?? '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const usesVar = (template: string, v: keyof TemplateVars) => new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(template);
