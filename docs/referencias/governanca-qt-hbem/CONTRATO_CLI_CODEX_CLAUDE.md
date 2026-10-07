# Contrato de comunicação CLI — Codex e Claude

## Papéis

**ChatGPT / Work — núcleo de condução e contexto**

- Organiza o programa, os chats e as minutas, com identidade e fontes explícitas.
- Codex é o executor técnico desse núcleo dentro do escopo autorizado.

**Codex — líder de integração**

- Reconstrói estado do workspace e dependências.
- Define tarefa, allowlist e critérios de aceitação.
- Integra resultados, resolve conflitos e verifica o fluxo completo.
- Mantém a distinção entre prova documental, teste local e prontidão clínica.

**Claude — auditor**

- Revisa contrato, raciocínio estatístico, consistência e riscos.
- Aponta omissões e contraexemplos.
- Não altera arquivos fora da allowlist nem promove decisão clínica.
- Devolve resultado estruturado ao Codex.

**Grok — auxiliar sob demanda**

- Apoia pesquisa, alternativas e contrapontos em tarefas delimitadas.
- Não assume condução, auditoria final ou promoção clínica.
- Esta atribuição de papel não ativa integração nem concede acesso a pacientes.

**Dr. Silas — autoridade**

- Decide escopo clínico, aceita ou rejeita recomendações e promove minutas.
- Autoriza qualquer trânsito futuro de dados clínicos entre provedores.

## Regra de comunicação

A comunicação via CLI deve ocorrer por arquivos versionáveis em `orchestration/`, nunca por PHI escrita diretamente em argumentos do terminal. Esta Fase A define o contrato; não ativa automaticamente chamadas externas.

`orchestration/` é destino proposto para envelopes técnicos sem PHI, não uma pasta já operacional. Pacotes clínicos mínimos, quando autorizados para o destino, ficam em armazenamento privado fora do Git e são referenciados por ponteiro. Não repetir confirmação para trânsito já coberto por autorização vigente. Cada execução também precisa de versão da entrada, identificador de correlação, prazo/timeout, chave de idempotência e validação do retorno; retry não pode repetir efeitos.

### Envelope de tarefa

```json
{
  "schema": "qt-hbem.task.v1",
  "task_id": "UUID",
  "mode": "INTER_LLM_TECHNICAL_REVIEW",
  "owner": "CODEX",
  "assignee": "CLAUDE",
  "scope": [],
  "allowlist": [],
  "inputs": [],
  "constraints": [
    "NO_PHI_BY_DEFAULT",
    "NO_CLINICAL_PROMOTION",
    "NO_UNSOURCED_NUMBERS"
  ],
  "acceptance": [],
  "status": "READY"
}
```

### Envelope de retorno

```json
{
  "schema": "qt-hbem.result.v1",
  "task_id": "UUID",
  "reviewer": "CLAUDE",
  "status": "PASS_OR_CHANGES_REQUIRED_OR_BLOCKED",
  "findings": [],
  "evidence": [],
  "files_touched": [],
  "limitations": []
}
```

## Protocolo

1. Codex cria o envelope e define entradas mínimas.
2. O arquivo é validado para ausência de PHI não autorizada.
3. Claude executa apenas a tarefa delimitada.
4. Claude grava o retorno estruturado.
5. Codex confere evidências e divergências.
6. Se houver conflito, os pareceres permanecem lado a lado; não há votação automática.
7. Mudança clínica retorna ao Dr. Silas. Mudança técnica segue o gate de implementação aplicável.

## Distinção essencial

- **INTRA-LLM:** coordenação de contexto e pacientes dentro do ChatGPT Work. É a primeira prova do produto.
- **INTER-LLM:** passagem explícita e auditável de uma tarefa entre provedores/modelos. É fase posterior e não herda automaticamente o contexto clínico dos chats.

## Proibições

- Colocar nome, ID, transcrição ou laudo em linha de comando.
- Enviar a pasta inteira do paciente quando bastar um recorte autorizado.
- Tratar concordância Codex–Claude como verdade clínica.
- Permitir que Claude, Codex, ChatGPT ou Grok promovam uma minuta.
- Ativar Grok ou oncoMed usando este documento como autorização.
